"""Retrieval logic for RAG with subject filtering and cross-lingual concept grounding."""

from __future__ import annotations

import logging
from backend.config import get_settings
from backend.rag.embeddings import get_embeddings
from backend.rag.vector_store import get_vector_store
from backend.utils.language_detect import detect_script_language

logger = logging.getLogger(__name__)

# Cross-lingual technical keywords mapping for Kannada/Hindi queries against English documents
_CROSS_LINGUAL_TERMS: list[tuple[tuple[str, ...], str]] = [
    # Machine Learning concepts
    (("ಯಂತ್ರ ಕಲಿಕೆ", "ಮಶೀನ್ ಲರ್ನಿಂಗ್", "ಮಶಿನ್ ಲರ್ನಿಂಗ್", "ಕಲಿಕೆ", "मशीन लर्निंग", "मशीन सीख"), "machine learning artificial intelligence"),
    (("ಡೀಪ್ ಲರ್ನಿಂಗ್", "ಆಳವಾದ ಕಲಿಕೆ", "ಡಿಪ್ ಲರ್ನಿಂಗ್", "डीप लर्निंग", "गहन शिक्षण"), "deep learning neural network"),
    (("ನ್ಯೂರಲ್ ನೆಟ್‌ವರ್ಕ್", "ನ್ಯೂರಲ್ ಜಾಲ", "ನ್ಯೂರಾನ್", "न्यूरल नेटवर्क", "तंत्रिका नेटवर्क"), "neural networks perceptron backpropagation"),
    (("ಸೂಪರ್‌ವೈಸ್ಡ್", "ಮೇಲ್ವಿಚಾರಣೆಯ", "ಸೂಪರ್ವೈಸ್ಡ್", "सुपरवाइज्ड", "पर्यवेक्षित"), "supervised learning classification regression"),
    (("ಅನ್‌ಸೂಪರ್‌ವೈಸ್ಡ್", "ಮೇಲ್ವಿಚಾರಣೆಯಿಲ್ಲದ", "ಅನ್ಸೂಪರ್ವೈಸ್ಡ್", "अनसुपरवाइज्ड", "अपर्यवेक्षित"), "unsupervised learning clustering k-means"),
    (("ಓವರ್‌ಫಿಟ್ಟಿಂಗ್", "ಓವರ್ಫಿಟ್ಟಿಂಗ್", "ಅತಿಯಾದ ಹೊಂದಾಣಿಕೆ", "ओवरफिटिंग"), "overfitting regularization generalization"),
    (("ಗ್ರೇಡಿಯಂಟ್ ಡಿಸೆಂಟ್", "ಇಳಿಕೆ", "ಶ್ರೇಣೀಕೃತ", "ग्रेडिएंट डिसेंट", "ढाल वंश"), "gradient descent optimization loss function"),
    (("ತರಬೇತಿ", "ಟ್ರೈನಿಂಗ್", "ಮಾಡೆಲ್ ತರಬೇತಿ", "प्रशिक्षण", "ट्रेनिंग"), "model training dataset validation"),
    (("ಮೌಲ್ಯಮಾಪನ", "ಮೆಟ್ರಿಕ್ಸ್", "ನಿಖರತೆ", "मूल्यांकन", "सटीकता"), "evaluation metrics accuracy precision recall f1"),
    (("ಟ್ರಾನ್ಸ್‌ಫಾರ್ಮರ್", "ಅಟೆನ್ಷನ್", "ಎಲ್ಎಲ್ಎಂ", "ट्रांसफॉर्मर", "अटेंशन"), "transformer attention mechanism llm language model"),

    # DBMS concepts
    (("ಡೇಟಾಬೇಸ್", "ಡೇಟಾಬೇಸ್ ಎಂದರೇನು", "ದತ್ತಸಂಚಯ", "ದತ್ತಾಂಶ", "ಡೇಟಾ", "डेटाबेस", "डाटाबेस", "डेटा"), "database management systems dbms sql tables"),
    (("ರಿಲೇಶನಲ್", "ಸಂಬಂಧಿತ", "ಸಂಬಂಧಿ", "ರಿಲೇಷನಲ್", "रिलेशनल"), "relational database rdbms relational model foreign key"),
    (("ಎಸ್‌ಕ್ಯೂಎಲ್", "ಕ್ವೆರಿ", "ಪ್ರಶ್ನೆ", "SQL", "एसक्यूएल", "क्वेरी"), "sql structured query language select insert update"),
    (("ಆಸಿಡ್", "ವಹಿವಾಟು", "ಟ್ರಾನ್ಸಾಕ್ಷನ್", "ಅಣುತ್ವ", "ಸ್ಥಿರತೆ", "ವಿಶ್ವಾಸಾರ್ಹತೆ", "अम्ल", "ट्रांजेक्शन", "एसिड"), "acid properties atomicity consistency isolation durability transaction"),
    (("ಇಂಡೆಕ್ಸಿಂಗ್", "ಸೂಚ್ಯಂಕ", "ಇಂಡೆಕ್ಸ್", "ಇಂಡೆಕ್ಸ್‌ಗಳು", "अनुक्रमणिका", "इंडेक्सिंग"), "indexing b-tree query optimization performance"),
    (("ನಾರ್ಮಲೈಸೇಶನ್", "ಸಾಮಾನ್ಯೀಕರಣ", "ನಾರ್ಮಲೈಜೇಶನ್", "सामान्यीकरण", "नॉर्मलाइजेशन"), "normalization 1nf 2nf 3nf redundancy anomalies"),
]


def _expand_cross_lingual_query(query: str) -> str:
    """Enhance Kannada or Hindi queries with English concept terms for cross-lingual vector retrieval."""
    detected = detect_script_language(query)
    if detected not in ("kn", "hi"):
        return query

    matched_concepts: list[str] = []
    q_lower = query.lower()
    for triggers, eng_terms in _CROSS_LINGUAL_TERMS:
        if any(trigger in q_lower for trigger in triggers):
            matched_concepts.append(eng_terms)

    if matched_concepts:
        # Keep original query first, append matched English domain concepts
        expanded = f"{query} {' '.join(matched_concepts)}"
        logger.debug("Cross-lingual query expanded: '%s' -> '%s'", query, expanded)
        return expanded

    return query


def retrieve_context(query: str, subject: str | None = None) -> tuple[str, list[str]]:
    """Retrieve grounded context for query, filtering by subject where appropriate."""
    settings = get_settings()
    store = get_vector_store()

    if not store.is_available:
        return "", []

    search_query = _expand_cross_lingual_query(query)
    query_vector = get_embeddings().embed_query(search_query)
    hits = store.search(query_vector, top_k=settings.rag_top_k, subject=subject)

    if not hits:
        return "", []

    filtered = [h for h in hits if h["score"] >= settings.rag_score_threshold]
    if not filtered:
        # Fallback to top hits if semantic similarity is positive
        filtered = [h for h in hits[:2] if h.get("score", 0) > 0.20]

    if not filtered:
        return "", []

    context_parts = []
    sources = []
    seen_labels = set()

    for hit in filtered:
        source_label = (
            hit.get("source") or hit.get("source_file") or hit.get("topic") or "course material"
        )
        page = hit.get("page")
        subj = hit.get("subject")
        prefix = f"[{subj}] " if subj else ""
        label = f"{prefix}{source_label}" + (f" (p.{page})" if page else "")
        if label not in seen_labels:
            sources.append(label)
            seen_labels.add(label)
        context_parts.append(f"[{label}]\n{hit['text']}")

    return "\n\n".join(context_parts), sources
