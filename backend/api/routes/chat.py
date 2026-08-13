import asyncio
import json
import queue
import threading

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.api.schemas.chat import ChatRequest, ChatResponse
from backend.services.assistant_pipeline import (
    finalize_text_query,
    process_text_query,
    stream_text_query,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    result = await asyncio.to_thread(
        process_text_query, request.message, request.session_id
    )
    return ChatResponse(
        answer=result["answer"],
        session_id=result["session_id"],
        sources=result["sources"],
    )


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        event_queue: queue.Queue[tuple[str, object]] = queue.Queue()

        def produce() -> None:
            sid, token_iter, sources = stream_text_query(
                request.message, request.session_id
            )
            answer_parts: list[str] = []
            for token in token_iter:
                answer_parts.append(token)
                event_queue.put(("token", token))
            answer = "".join(answer_parts).strip()
            finalize_text_query(sid, request.message, answer)
            event_queue.put(("done", {"session_id": sid, "sources": sources}))

        threading.Thread(target=produce, daemon=True).start()

        while True:
            kind, payload = await asyncio.to_thread(event_queue.get)
            if kind == "token":
                yield f"data: {json.dumps({'token': payload})}\n\n"
                continue

            meta = payload
            assert isinstance(meta, dict)
            yield f"data: {json.dumps({'done': True, **meta})}\n\n"
            break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
