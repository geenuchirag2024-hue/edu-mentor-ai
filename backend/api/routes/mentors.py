from fastapi import APIRouter
from backend.services.mentor_registry import get_mentor, list_mentors

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


@router.get("")
async def get_all_mentors():
    return list_mentors()


@router.get("/{mentor_id}")
async def get_mentor_details(mentor_id: str):
    return get_mentor(mentor_id)
