import uuid
from collections import defaultdict

from backend.api.schemas.chat import ChatMessage


class ConversationStore:
    """In-memory conversation history keyed by session_id."""

    def __init__(self) -> None:
        self._sessions: dict[str, list[ChatMessage]] = defaultdict(list)

    def get_or_create_session(self, session_id: str | None) -> str:
        sid = session_id or str(uuid.uuid4())
        self._sessions.setdefault(sid, [])
        return sid

    def get_history(self, session_id: str) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in self._sessions[session_id]]

    def append(self, session_id: str, role: str, content: str) -> None:
        self._sessions[session_id].append(ChatMessage(role=role, content=content))


conversation_store = ConversationStore()
