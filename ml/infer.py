"""Inference utility for FaceFrame hairstyle recommendations.

Examples:
  python ml/infer.py
  python ml/infer.py --json '{"face_shape":"oval",...}'
  python ml/infer.py --serve
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = BASE_DIR / "saved_model" / "faceframe_model.joblib"

FEATURE_COLUMNS = [
    "face_shape",
    "forehead_width_type",
    "cheekbone_width_type",
    "jaw_width_type",
    "face_length_type",
    "preferred_hair_length",
    "maintenance_level",
    "style_preference",
    "beard_preference",
]

SAMPLE_PAYLOAD = {
    "face_shape": "oval",
    "forehead_width_type": "balanced",
    "cheekbone_width_type": "balanced",
    "jaw_width_type": "narrow",
    "face_length_type": "long",
    "preferred_hair_length": "medium",
    "maintenance_level": "low",
    "style_preference": "classic",
    "beard_preference": "no_beard",
}


def normalize_value(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip().lower().replace("-", " ")
    text = "_".join(part for part in text.split() if part)
    return text


def parse_allowed_origins() -> list[str]:
    raw = os.getenv("FACEFRAME_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["*"]


def resolve_model_path(model_path: Path | str | None) -> Path:
    if model_path is None:
        return DEFAULT_MODEL_PATH

    path = Path(model_path).expanduser()
    if path.is_absolute():
        return path

    return (Path.cwd() / path).resolve()


def load_bundle(model_path: Path) -> dict[str, Any]:
    model_path = resolve_model_path(model_path)

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found at {model_path.resolve()}\n"
            "Run `python ml/train_model.py` before inference."
        )

    bundle = joblib.load(model_path)
    if "pipeline" not in bundle:
        raise ValueError("Model bundle is invalid: missing `pipeline`.")

    return bundle


def build_explanation(payload: dict[str, str], best_match: str) -> str:
    return (
        f"Recommended because your face shape appears {payload['face_shape']} "
        f"and you selected {payload['maintenance_level']} maintenance with "
        f"a {payload['style_preference']} style preference."
    )


def predict(payload: dict[str, Any], bundle: dict[str, Any]) -> dict[str, Any]:
    pipeline = bundle["pipeline"]

    cleaned = {key: normalize_value(payload.get(key)) for key in FEATURE_COLUMNS}
    missing = [key for key, value in cleaned.items() if not value]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")

    sample_df = pd.DataFrame([cleaned], columns=FEATURE_COLUMNS)

    best_match = pipeline.predict(sample_df)[0]
    alternatives: list[str] = []
    confidence = None

    classifier = pipeline.named_steps.get("classifier")
    if classifier is not None and hasattr(classifier, "predict_proba"):
        probabilities = pipeline.predict_proba(sample_df)[0]
        classes = list(classifier.classes_)
        ranked = sorted(zip(classes, probabilities), key=lambda item: item[1], reverse=True)

        best_match = ranked[0][0]
        confidence = float(ranked[0][1])
        alternatives = [item[0] for item in ranked[1:3]]

    response = {
        "best_match": best_match,
        "alternatives": alternatives,
        "explanation": build_explanation(cleaned, best_match),
    }

    if confidence is not None:
        response["confidence"] = confidence

    return response


def run_cli(payload_json: str | None, model_path: Path) -> None:
    bundle = load_bundle(model_path)
    payload = SAMPLE_PAYLOAD if payload_json is None else json.loads(payload_json)
    result = predict(payload, bundle)
    print(json.dumps(result, indent=2))


def run_api(model_path: Path, host: str, port: int) -> None:
    try:
        from fastapi import FastAPI, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn
    except ImportError as error:
        raise ImportError(
            "FastAPI or uvicorn is not installed. Run `pip install -r ml/requirements.txt`."
        ) from error

    bundle = load_bundle(model_path)
    allowed_origins = parse_allowed_origins()

    app = FastAPI(title="FaceFrame Inference API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "model_path": str(resolve_model_path(model_path)),
            "allowed_origins": allowed_origins,
        }

    @app.post("/recommend")
    def recommend(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return predict(payload, bundle)
        except Exception as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    uvicorn.run(app, host=host, port=port, reload=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FaceFrame inference utility")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH, help="Model path")
    parser.add_argument("--json", type=str, default=None, help="JSON string payload for quick test")
    parser.add_argument("--serve", action="store_true", help="Run FastAPI recommendation endpoint")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="FastAPI host")
    parser.add_argument("--port", type=int, default=8000, help="FastAPI port")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.serve:
        run_api(args.model, args.host, args.port)
    else:
        run_cli(args.json, args.model)


if __name__ == "__main__":
    main()
