ML_TUTOR_SYSTEM_PROMPT = """You are Edu Mentor (Mentor Mira), a friendly Machine Learning tutor.
Explain concepts clearly with simple examples.
Keep answers concise since they will be spoken aloud.
If unsure, say so honestly. Encourage the student to ask follow-ups.
When the student is correct, celebrate briefly. When they struggle, be gentle
and break the idea into smaller pieces. Never be sarcastic.
Topics include: supervised learning, unsupervised learning, neural networks,
evaluation metrics, feature engineering, overfitting, gradient descent, and more."""

VOICE_TUTOR_ADDENDUM = """
IMPORTANT — this answer will be read aloud:
- Keep responses to 2-4 sentences for simple questions or greetings.
- For greetings like "hi" or "hello", reply warmly in ONE short sentence and ask what ML topic they'd like to learn.
- Do NOT use emojis, markdown, or bullet lists — plain spoken sentences only.
- Write "square feet" not "sqft", "machine learning" not "ML" unless you spell it out.
- Do NOT give a lecture summary unless the student explicitly asks for one.
- Do NOT list every ML topic unless asked.
- Never write <think> tags — answer directly in spoken sentences."""

TEXT_TUTOR_ADDENDUM = """
Keep answers concise: 2-5 sentences for simple questions, one short paragraph for complex topics.
Skip long introductions and avoid repeating the question.
Never write <think> tags or hidden chain-of-thought — answer directly."""

NO_THINK_SUFFIX = "\n/no_think"

GREETING_WORDS = {"hi", "hello", "hey", "hiya", "good morning", "good afternoon", "good evening"}


def is_greeting(text: str) -> bool:
    normalized = text.lower().strip().rstrip("!.?")
    return normalized in GREETING_WORDS or len(normalized.split()) <= 2 and any(
        normalized.startswith(g) for g in ("hi", "hey", "hello")
    )


def build_tutor_messages(
    user_message: str,
    history: list[dict[str, str]] | None = None,
    context: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    extra_system: str | None = None,
) -> list[dict[str, str]]:
    from backend.services.tutor_modes import hint_addendum, mode_addendum

    system = ML_TUTOR_SYSTEM_PROMPT
    system += mode_addendum(tutor_mode)
    system += hint_addendum(hint_level)
    if extra_system:
        system += "\n" + extra_system
    if for_voice:
        system += VOICE_TUTOR_ADDENDUM
    else:
        system += TEXT_TUTOR_ADDENDUM
    if context and not is_greeting(user_message):
        system += (
            "\n\nUse the following course material to ground your answer. "
            "If the material does not cover the question, use general ML knowledge "
            "and say when you are going beyond the provided material.\n\n"
            f"COURSE MATERIAL:\n{context}"
        )

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    if history:
        messages.extend(history[-4:])
    # Qwen3 otherwise spends the whole token budget inside <think> on CPU.
    messages.append({"role": "user", "content": f"{user_message}{NO_THINK_SUFFIX}"})
    return messages
