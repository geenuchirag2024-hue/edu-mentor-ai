"""Authentication and role-based authorization dependencies for FastAPI."""

from __future__ import annotations

from collections.abc import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.db.database import get_db
from backend.db.models import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate JWT bearer token and return the authenticated User model."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        uid = int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory ensuring the authenticated user has one of allowed roles."""
    normalized_allowed = {r.lower().strip() for r in allowed_roles}

    async def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role or "student").lower().strip()
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role '{current_user.role}' is not authorized for this operation",
            )
        return current_user

    return _role_checker


async def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    """Dependency ensuring the user is an authenticated teacher."""
    if (current_user.role or "student").lower().strip() != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: teacher role required for this operation",
        )
    return current_user


async def require_student(current_user: User = Depends(get_current_user)) -> User:
    """Dependency ensuring the user is an authenticated student."""
    if (current_user.role or "student").lower().strip() != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: student role required for this operation",
        )
    return current_user
