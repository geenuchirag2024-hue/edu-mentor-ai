"""Student Notifications routes for Edu-Mentor AI V3.

Provides:
- Unread notification counting
- Listing notifications for published study materials
- Mark-as-read and mark-all-read operations
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.api.schemas.resources import NotificationsResponse, StudentNotificationOut
from backend.db.database import get_db
from backend.db.models import StudentNotification, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsResponse)
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve notifications for the current student, ordered newest first."""
    query = (
        select(StudentNotification)
        .where(StudentNotification.user_id == current_user.id)
        .order_by(StudentNotification.created_at.desc())
        .limit(50)
    )
    res = await db.execute(query)
    notifications = res.scalars().all()

    unread_query = select(func.count(StudentNotification.id)).where(
        StudentNotification.user_id == current_user.id,
        StudentNotification.is_read.is_(False),
    )
    unread_res = await db.execute(unread_query)
    unread_count = unread_res.scalar() or 0

    return NotificationsResponse(
        notifications=[StudentNotificationOut.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=StudentNotificationOut)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    notif = await db.get(StudentNotification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return StudentNotificationOut.model_validate(notif)


@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    stmt = (
        update(StudentNotification)
        .where(StudentNotification.user_id == current_user.id, StudentNotification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "message": "All notifications marked as read."}

