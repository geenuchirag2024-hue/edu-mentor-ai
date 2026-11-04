"""Teacher Analytics and Student Activity Tracking routes for Edu-Mentor AI V3.

Provides:
- Teacher overview metrics (active students, study hours, questions, avg AI latency)
- Student-level study time and engagement aggregation
- Real AI query logs with latency breakdown and source page tracking
- Latency percentiles (avg, median, p95, min, max)
- Active study session heartbeat tracking
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
import statistics

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_teacher
from backend.api.schemas.analytics import (
    LatencyStats,
    StudentActivitySummary,
    StudentQueryLogOut,
    StudySessionPingRequest,
    StudySessionPingResponse,
    TeacherOverviewAnalytics,
)
from backend.db.database import get_db
from backend.db.models import (
    AIQueryLog,
    Document,
    StudentActivity,
    StudySession,
    TeacherResource,
    User,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# =========================================================================
# Teacher Analytics Endpoints
# =========================================================================

@router.get("/teacher/overview", response_model=TeacherOverviewAnalytics)
async def get_teacher_overview(
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Calculate aggregated high-level metrics for the teacher dashboard."""
    # 1. Total students with recorded activity or sessions
    active_students_query = select(func.count(func.distinct(StudentActivity.user_id)))
    res = await db.execute(active_students_query)
    total_active = res.scalar() or 0

    # If no activities yet, fallback to registered student count
    if total_active == 0:
        reg_students_query = select(func.count(User.id)).where(User.role == "student")
        reg_res = await db.execute(reg_students_query)
        total_active = reg_res.scalar() or 0

    # 2. Total measured study hours
    study_seconds_query = select(func.coalesce(func.sum(StudySession.active_duration_seconds), 0))
    res = await db.execute(study_seconds_query)
    total_seconds = res.scalar() or 0
    total_hours = round(float(total_seconds) / 3600.0, 2)

    # 3. Total questions asked
    questions_query = select(func.count(AIQueryLog.id))
    res = await db.execute(questions_query)
    total_questions = res.scalar() or 0

    # 4. Average AI response latency (ms)
    avg_latency_query = select(func.coalesce(func.avg(AIQueryLog.total_latency_ms), 0))
    res = await db.execute(avg_latency_query)
    avg_latency_ms = int(res.scalar() or 0)

    # 5. Total published resources
    res_query = select(func.count(TeacherResource.id)).where(TeacherResource.is_published.is_(True))
    res_res = await db.execute(res_query)
    published_count = res_res.scalar() or 0

    return TeacherOverviewAnalytics(
        total_active_students=total_active,
        total_study_hours=total_hours,
        total_questions_asked=total_questions,
        avg_ai_response_time_ms=avg_latency_ms,
        total_resources_published=published_count,
    )


@router.get("/teacher/students", response_model=list[StudentActivitySummary])
async def list_student_analytics(
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed learning time and query engagement per registered student."""
    students_query = select(User).where(User.role == "student").order_by(User.full_name.asc())
    res = await db.execute(students_query)
    students = res.scalars().all()

    summaries = []
    for s in students:
        # Total study time & sessions count
        sess_query = select(
            func.coalesce(func.sum(StudySession.active_duration_seconds), 0),
            func.count(StudySession.id),
        ).where(StudySession.user_id == s.id)
        sess_res = await db.execute(sess_query)
        total_sec, sess_cnt = sess_res.first() or (0, 0)

        # Questions count & avg latency
        q_query = select(
            func.count(AIQueryLog.id),
            func.coalesce(func.avg(AIQueryLog.total_latency_ms), 0),
        ).where(AIQueryLog.user_id == s.id)
        q_res = await db.execute(q_query)
        q_cnt, avg_lat = q_res.first() or (0, 0)

        # Last active timestamp
        last_act_query = (
            select(StudentActivity.created_at)
            .where(StudentActivity.user_id == s.id)
            .order_by(StudentActivity.created_at.desc())
            .limit(1)
        )
        last_res = await db.execute(last_act_query)
        last_active = last_res.scalar_one_or_none()

        summaries.append(
            StudentActivitySummary(
                student_id=s.id,
                full_name=s.full_name,
                email=s.email,
                total_study_seconds=int(total_sec),
                sessions_count=int(sess_cnt),
                questions_count=int(q_cnt),
                avg_response_latency_ms=int(avg_lat),
                last_active=last_active,
            )
        )

    return summaries


@router.get("/teacher/students/{student_id}/history", response_model=list[StudentQueryLogOut])
async def get_student_query_history(
    student_id: int,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Inspect query history, responses, and measured latencies for a specific student."""
    student = await db.get(User, student_id)
    if not student or student.role != "student":
        raise HTTPException(status_code=404, detail="Student not found.")

    query = (
        select(AIQueryLog)
        .where(AIQueryLog.user_id == student_id)
        .order_by(AIQueryLog.created_at.desc())
        .limit(100)
    )
    res = await db.execute(query)
    logs = res.scalars().all()

    result = []
    for log in logs:
        sources_list: list[int] = []
        if log.sources_json:
            try:
                sources_list = json.loads(log.sources_json)
            except Exception:
                sources_list = []

        result.append(
            StudentQueryLogOut(
                id=log.id,
                student_name=student.full_name,
                subject=log.subject,
                question=log.question,
                answer=log.answer,
                sources=sources_list,
                retrieval_latency_ms=log.retrieval_latency_ms,
                generation_latency_ms=log.generation_latency_ms,
                total_latency_ms=log.total_latency_ms,
                status=log.status,
                created_at=log.created_at,
            )
        )
    return result


@router.get("/teacher/latency", response_model=LatencyStats)
async def get_latency_analytics(
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Calculate actual response-time percentiles, fastest, slowest, and failed counts."""
    query = select(AIQueryLog.total_latency_ms, AIQueryLog.status)
    res = await db.execute(query)
    rows = res.all()

    if not rows:
        return LatencyStats(
            avg_ms=0,
            median_ms=0,
            p95_ms=0,
            min_ms=0,
            max_ms=0,
            failed_count=0,
            total_queries=0,
        )

    latencies = [r[0] for r in rows if r[0] is not None and r[0] > 0]
    failed_count = sum(1 for r in rows if r[1] != "success")

    if not latencies:
        return LatencyStats(
            avg_ms=0,
            median_ms=0,
            p95_ms=0,
            min_ms=0,
            max_ms=0,
            failed_count=failed_count,
            total_queries=len(rows),
        )

    latencies.sort()
    avg_val = int(statistics.mean(latencies))
    median_val = int(statistics.median(latencies))
    p95_idx = int(len(latencies) * 0.95)
    p95_val = latencies[min(p95_idx, len(latencies) - 1)]
    min_val = latencies[0]
    max_val = latencies[-1]

    return LatencyStats(
        avg_ms=avg_val,
        median_ms=median_val,
        p95_ms=p95_val,
        min_ms=min_val,
        max_ms=max_val,
        failed_count=failed_count,
        total_queries=len(rows),
    )


@router.get("/teacher/queries", response_model=list[StudentQueryLogOut])
async def list_recent_queries(
    subject: str | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve recent queries across all students with optional subject and status filters."""
    query = (
        select(AIQueryLog, User.full_name)
        .join(User, AIQueryLog.user_id == User.id)
        .order_by(AIQueryLog.created_at.desc())
    )

    if subject and subject.strip() and subject.lower() != "all":
        query = query.where(AIQueryLog.subject.ilike(f"%{subject.strip()}%"))

    if status_filter and status_filter.strip() and status_filter.lower() != "all":
        query = query.where(AIQueryLog.status == status_filter.strip())

    query = query.limit(limit)
    res = await db.execute(query)
    rows = res.all()

    result = []
    for log, name in rows:
        sources_list: list[int] = []
        if log.sources_json:
            try:
                sources_list = json.loads(log.sources_json)
            except Exception:
                sources_list = []

        result.append(
            StudentQueryLogOut(
                id=log.id,
                student_name=name,
                subject=log.subject,
                question=log.question,
                answer=log.answer,
                sources=sources_list,
                retrieval_latency_ms=log.retrieval_latency_ms,
                generation_latency_ms=log.generation_latency_ms,
                total_latency_ms=log.total_latency_ms,
                status=log.status,
                created_at=log.created_at,
            )
        )
    return result


# =========================================================================
# Student Study Session Tracking Endpoints
# =========================================================================

@router.post("/study-session/ping", response_model=StudySessionPingResponse)
async def ping_study_session(
    payload: StudySessionPingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Heartbeat ping from student UI.
    Records active study time incrementally without fabricating duration.
    """
    session_uuid = payload.session_uuid.strip()
    if not session_uuid:
        raise HTTPException(status_code=400, detail="Missing session_uuid.")

    query = select(StudySession).where(
        StudySession.session_uuid == session_uuid,
        StudySession.user_id == current_user.id,
    )
    res = await db.execute(query)
    sess = res.scalars().first()

    now = datetime.now()

    if not sess:
        # Create a new session
        sess = StudySession(
            session_uuid=session_uuid,
            user_id=current_user.id,
            start_time=now,
            last_active_time=now,
            active_duration_seconds=10,  # initial credit
            is_closed=False,
        )
        db.add(sess)

        # Log session start activity
        activity = StudentActivity(
            user_id=current_user.id,
            event_type="study_session_start",
            session_uuid=session_uuid,
        )
        db.add(activity)
        await db.commit()
        await db.refresh(sess)
        return StudySessionPingResponse(
            session_uuid=sess.session_uuid,
            active_duration_seconds=sess.active_duration_seconds,
            status="created",
        )

    # Session exists: calculate elapsed delta
    delta = (now - sess.last_active_time).total_seconds()

    # If last active was > 15 minutes ago, close old session and mark as closed
    if delta > 900:
        sess.is_closed = True
        sess.end_time = sess.last_active_time
        await db.commit()
        return StudySessionPingResponse(
            session_uuid=sess.session_uuid,
            active_duration_seconds=sess.active_duration_seconds,
            status="expired",
        )

    # Increment active duration reasonably (up to 45 seconds per ping to prevent fabrication)
    increment = min(int(delta), 45)
    if increment > 0:
        sess.active_duration_seconds += increment

    sess.last_active_time = now
    await db.commit()

    return StudySessionPingResponse(
        session_uuid=sess.session_uuid,
        active_duration_seconds=sess.active_duration_seconds,
        status="active",
    )

