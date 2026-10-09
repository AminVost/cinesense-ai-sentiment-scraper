"""Local inference service; no paid model API and no interactive startup prompt."""
import logging
import os
import threading
import time
from functools import lru_cache

import torch
from fastapi import FastAPI, HTTPException
from langdetect import DetectorFactory, LangDetectException, detect
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

DetectorFactory.seed = 0
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cinesense.ai")
app = FastAPI(title="CineSense sentiment inference")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
PERSIAN_LOCAL = os.getenv("PERSIAN_MODEL_PATH", "fine_tuned_model")
PERSIAN_BASE = os.getenv("PERSIAN_BASE_MODEL", "HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary")
MULTILINGUAL = os.getenv("MULTILINGUAL_MODEL", "nlptown/bert-base-multilingual-uncased-sentiment")
SUPPORTED_LANGUAGES = frozenset({"en", "de", "fr", "es", "it", "nl"})
_INFERENCE_LOCK = threading.RLock()


class Comment(BaseModel):
    id: int | str
    text: str = Field(min_length=1, max_length=12000)


class CommentRequest(BaseModel):
    comments: list[Comment] = Field(min_length=1, max_length=100)


def detect_language(text: str) -> str:
    letters = sum(character.isalpha() for character in text)
    persian_script = sum("\u0600" <= character <= "\u06ff" for character in text)
    if letters and persian_script / letters > 0.35:
        return "fa"
    try:
        language = detect(text)
        return language if language in SUPPORTED_LANGUAGES else "unsupported"
    except LangDetectException:
        return "unsupported"


def persian_model_name() -> str:
    return PERSIAN_LOCAL if os.path.isdir(PERSIAN_LOCAL) else PERSIAN_BASE


@lru_cache(maxsize=2)
def load_model(model_id: str):
    """Load lazily. Initial download comes from Hugging Face only when requested."""
    log.info("Loading sentiment model %s on %s", model_id, DEVICE)
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSequenceClassification.from_pretrained(model_id)
    model.to(DEVICE)
    model.eval()
    return tokenizer, model


def classify(texts: list[str], model_id: str, *, binary: bool):
    """Preserve input order; bound model batch size for CPU/memory stability."""
    with _INFERENCE_LOCK:
        tokenizer, model = load_model(model_id)
        predictions = []
        for offset in range(0, len(texts), 8):
            tokens = tokenizer(
                texts[offset:offset + 8],
                padding=True, truncation=True, max_length=512, return_tensors="pt",
            ).to(DEVICE)
            with torch.inference_mode():
                probabilities = torch.softmax(model(**tokens).logits, dim=-1).cpu().tolist()
            for values in probabilities:
                if binary:
                    negative, neutral, positive = values[0], 0.0, values[1]
                else:
                    # nlptown predicts 1–5 stars, not binary positive/negative.
                    negative, neutral, positive = sum(values[:2]), values[2], sum(values[3:])
                scores = {"Positive": positive, "Negative": negative}
                if not binary:
                    scores["Neutral"] = neutral
                label = max(scores, key=scores.get)
                predictions.append((label, positive, negative, neutral))
        return predictions


@app.get("/health")
def health():
    return {"status": "ok", "device": str(DEVICE), "models_loaded": load_model.cache_info().currsize}


@app.post("/analyze/")
def analyze_comments(request: CommentRequest):
    started = time.monotonic()
    results = [None] * len(request.comments)
    groups = {"fa": [], "international": []}

    for index, comment in enumerate(request.comments):
        language = detect_language(comment.text)
        if language == "fa":
            groups["fa"].append((index, comment, language))
        elif language in SUPPORTED_LANGUAGES:
            groups["international"].append((index, comment, language))
        else:
            results[index] = {
                "id": comment.id, "text": comment.text, "language": language,
                "sentiment": "Unclassified", "positive": None, "negative": None,
                "neutral": None, "model": None,
            }

    for group, entries in groups.items():
        if not entries:
            continue
        model_id = persian_model_name() if group == "fa" else MULTILINGUAL
        try:
            predictions = classify(
                [comment.text for _, comment, _ in entries],
                model_id, binary=(group == "fa"),
            )
        except Exception as error:
            log.exception("Inference unavailable for model %s", model_id)
            raise HTTPException(status_code=503, detail="Local sentiment model unavailable") from error

        for (index, comment, language), (label, positive, negative, neutral) in zip(entries, predictions):
            results[index] = {
                "id": comment.id, "text": comment.text, "language": language,
                "sentiment": label,
                "positive": f"{positive * 100:.2f}%",
                "negative": f"{negative * 100:.2f}%",
                "neutral": f"{neutral * 100:.2f}%",
                "model": model_id,
            }

    return {"processing_time": f"{time.monotonic() - started:.4f} seconds", "results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
