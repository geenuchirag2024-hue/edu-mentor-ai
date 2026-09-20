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
        process_text_query,
        request.message,
        request.session_id,
        False,
        request.tutor_mode,
        request.hint_level,
        request.learner_id,
        request.use_notes,
    )
    return ChatResponse(
        answer=result["answer"],
        session_id=result["session_id"],
        sources=result["sources"],
        emotion=result.get("emotion", "confident"),
        gesture=result.get("gesture", "point"),
        response_type=result.get("response_type", "explanation"),
    )


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        event_queue: queue.Queue[tuple[str, object]] = queue.Queue()

        def produce() -> None:
            try:
                sid, token_iter, sources = stream_text_query(
                    request.message,
                    request.session_id,
                    False,
                    request.tutor_mode,
                    request.hint_level,
                    request.learner_id,
                    request.use_notes,
                )
                event_queue.put(("meta", {"session_id": sid, "sources": sources}))
                answer_parts: list[str] = []
                for token in token_iter:
                    answer_parts.append(token)
                    event_queue.put(("token", token))
                answer = "".join(answer_parts).strip()
                finalize_text_query(
                    sid, request.message, answer, learner_id=request.learner_id
                )
                from backend.services.mascot_cues import infer_mascot_cues

                cues = infer_mascot_cues(
                    answer,
                    tutor_mode=request.tutor_mode,
                    user_message=request.message,
                    hint_level=request.hint_level,
                )
                event_queue.put(
                    (
                        "done",
                        {"session_id": sid, "sources": sources, **cues},
                    )
                )
            except Exception as exc:
                event_queue.put(("error", str(exc)))

        threading.Thread(target=produce, daemon=True).start()

        sid = request.session_id or ""
        sources: list[str] = []
        while True:
            try:
                kind, payload = await asyncio.to_thread(event_queue.get, True, 90)
            except queue.Empty:
                yield f"data: {json.dumps({'token': 'Sorry, that took too long on this machine. Try a shorter question.'})}\n\n"
                yield f"data: {json.dumps({'done': True, 'session_id': sid or 'timeout', 'sources': sources})}\n\n"
                break
            if kind == "meta":
                assert isinstance(payload, dict)
                sid = str(payload.get("session_id") or sid)
                sources = list(payload.get("sources") or [])
                continue
            if kind == "error":
                yield f"data: {json.dumps({'token': f'Sorry, generation failed: {payload}'})}\n\n"
                yield f"data: {json.dumps({'done': True, 'session_id': sid or 'error', 'sources': sources})}\n\n"
                break
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
