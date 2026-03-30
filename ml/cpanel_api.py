"""WSGI app for cPanel Passenger deployment.

Usage on cPanel:
- Point passenger_wsgi.py to `app` in this module.
- Configure FACEFRAME_MODEL_PATH and FACEFRAME_ALLOWED_ORIGINS env vars.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, make_response, request

from .infer import load_bundle, predict

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = BASE_DIR / "saved_model" / "faceframe_model.joblib"


def parse_allowed_origins() -> list[str]:
    raw = os.getenv("FACEFRAME_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return ["*"]

    return [item.strip() for item in raw.split(",") if item.strip()] or ["*"]


def resolve_model_path() -> Path:
    raw = os.getenv("FACEFRAME_MODEL_PATH", "").strip()
    if not raw:
        return DEFAULT_MODEL_PATH

    path = Path(raw).expanduser()
    if path.is_absolute():
        return path

    return (BASE_DIR / path).resolve()


def is_origin_allowed(origin: str, allowlist: list[str]) -> bool:
    if not origin:
        return False
    if "*" in allowlist:
        return True
    return origin in allowlist


ALLOWED_ORIGINS = parse_allowed_origins()
MODEL_PATH = resolve_model_path()

try:
    BUNDLE = load_bundle(MODEL_PATH)
    STARTUP_ERROR = ""
except Exception as error:  # pragma: no cover - startup diagnostics
    BUNDLE = None
    STARTUP_ERROR = str(error)

app = Flask(__name__)


@app.after_request
def apply_cors(response):  # type: ignore[override]
    origin = request.headers.get("Origin", "")

    if is_origin_allowed(origin, ALLOWED_ORIGINS):
        response.headers["Access-Control-Allow-Origin"] = origin
    elif "*" in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response


@app.get("/health")
def health() -> Any:
    return jsonify(
        {
            "status": "ok" if not STARTUP_ERROR else "degraded",
            "model_path": str(MODEL_PATH),
            "allowed_origins": ALLOWED_ORIGINS,
            "startup_error": STARTUP_ERROR or None,
        }
    )


@app.route("/recommend", methods=["POST", "OPTIONS"])
def recommend() -> Any:
    if request.method == "OPTIONS":
        return make_response(("", 204))

    if STARTUP_ERROR:
        return jsonify({"detail": f"Model not ready: {STARTUP_ERROR}"}), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"detail": "Invalid JSON body."}), 400

    try:
        result = predict(payload, BUNDLE)
        return jsonify(result)
    except Exception as error:
        return jsonify({"detail": str(error)}), 400
