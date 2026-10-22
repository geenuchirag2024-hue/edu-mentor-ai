"""Authentication routes — JWT-based register/login with role support."""

from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, security
from backend.api.schemas.auth import TokenResponse, UserLogin, UserOut, UserRegister
from backend.config import get_settings
from backend.db.database import get_db
from backend.db.models import User

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
        import traceback
        traceback.print_exc()
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
