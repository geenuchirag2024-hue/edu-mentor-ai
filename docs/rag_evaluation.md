# RAG Evaluation Benchmark

Test voice/text queries after ingesting ML PDFs. Target: answers cite ingested content.

## Sample Questions
1. What is supervised learning?
2. Explain the bias-variance tradeoff.
3. What is gradient descent?
4. How do you evaluate a classification model?
5. What causes overfitting?

## Metrics
- Source citation present in answer
- Factual accuracy vs PDF content
- Hallucination rate vs Phase 1 baseline

Run benchmark after `python scripts/ingest_ml_content.py`.
