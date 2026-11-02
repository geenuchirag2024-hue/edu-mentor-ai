"""Authentication routes — JWT-based register/login, role-based access, and secure password recovery."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, security
from backend.api.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
    UserLogin,
    UserOut,
    UserRegister,
    ValidateResetTokenRequest,
    ValidateResetTokenResponse,
)
from backend.config import get_settings
from backend.db.database import get_db
from backend.db.models import PasswordResetToken, User
from backend.services.email import send_password_reset_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        pwd_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str, role: str = "student") -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    try:
        clean_email = str(body.email).strip().lower()
        existing = await db.execute(select(User).where(func.lower(User.email) == clean_email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        clean_role = str(body.role or "student").strip().lower()
        if clean_role not in ("student", "teacher"):
            clean_role = "student"

        user = User(
            full_name=body.full_name.strip(),
            email=clean_email,
            password_hash=hash_password(body.password),
            role=clean_role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        user_out = UserOut.model_validate(user)
        token = create_access_token(str(user.id), role=user.role)
        return TokenResponse(access_token=token, token_type="bearer", user=user_out)
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        logger.exception("Registration error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Registration error: {exc}")


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    clean_email = str(body.email).strip().lower()
    result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_out = UserOut.model_validate(user)
    token = create_access_token(str(user.id), role=user.role or "student")
    return TokenResponse(access_token=token, token_type="bearer", user=user_out)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Generate a single-use cryptographically secure reset token and send instructions.

    Returns a generic message regardless of whether the email exists to avoid account enumeration.
    """
    settings = get_settings()
    clean_email = str(body.email).strip().lower()

    result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    user = result.scalar_one_or_none()

    generic_message = (
        "If an account exists for this email address, password reset instructions have been sent."
    )
    dev_link: str | None = None

    if user is not None:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(
            minutes=settings.password_reset_token_expire_minutes
        )

        # Invalidate any previously active unused tokens for this user
        await db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)  # noqa: E712
            .values(is_used=True)
        )

        reset_token_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_used=False,
        )
        db.add(reset_token_record)
        await db.commit()

        reset_link = f"{settings.frontend_url}/reset-password?token={raw_token}"
        await send_password_reset_email(user.email, reset_link, full_name=user.full_name)

        if settings.app_env == "development" and not settings.smtp_host:
            dev_link = reset_link

    return ForgotPasswordResponse(message=generic_message, reset_link_dev=dev_link)


@router.post("/validate-reset-token", response_model=ValidateResetTokenResponse)
async def validate_reset_token(body: ValidateResetTokenRequest, db: AsyncSession = Depends(get_db)):
    """Verify whether a password reset token is valid, unused, and not expired."""
    token_hash = _hash_token(body.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()

    if not record:
        return ValidateResetTokenResponse(
            valid=False,
            message="This password reset token is invalid or does not exist.",
        )

    if record.is_used:
        return ValidateResetTokenResponse(
            valid=False,
            message="This password reset token has already been used. Please request a new one.",
        )

    if record.expires_at < datetime.utcnow():
        return ValidateResetTokenResponse(
            valid=False,
            message="This password reset link has expired. Please request a new one.",
        )

    return ValidateResetTokenResponse(
        valid=True,
        message="Token is valid and active.",
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset user password using a verified single-use token. Preserves user role and invalidates token."""
    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    token_hash = _hash_token(body.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()

    if not record or record.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used password reset token. Please request a new one.",
        )

    if record.expires_at < datetime.utcnow():
        record.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has expired. Please request a new one.",
        )

    # Fetch user to update password
    user_res = await db.execute(select(User).where(User.id == record.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token was not found.",
        )

    # Update password and invalidate all tokens for this user
    user.password_hash = hash_password(body.new_password)
    record.is_used = True

    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .values(is_used=True)
    )
    await db.commit()

    logger.info("Successfully reset password for user id=%s (role=%s)", user.id, user.role)

    return ResetPasswordResponse(
        success=True,
        message="Your password has been successfully reset. You can now sign in with your new password.",
    )
