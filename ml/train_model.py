"""Train FaceFrame hairstyle recommendation baseline model.

Usage:
  python ml/train_model.py
  python ml/train_model.py --data ml/data/hairstyle_recommender_starter_dataset.xlsx
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier

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
TARGET_COLUMN = "recommended_hairstyle"

DEFAULT_DATA_PATH = Path("ml/data/hairstyle_recommender_starter_dataset.xlsx")
DEFAULT_MODEL_PATH = Path("ml/saved_model/faceframe_model.joblib")

COLUMN_ALIASES = {
    "face_shape": ["face_shape"],
    "forehead_width_type": ["forehead_width_type", "forehead_width"],
    "cheekbone_width_type": [
        "cheekbone_width_type",
        "cheekbone_width",
        "cheekbone_prominence",
    ],
    "jaw_width_type": ["jaw_width_type", "jaw_width", "jaw_type"],
    "face_length_type": ["face_length_type", "face_length_ratio_band", "face_length"],
    "preferred_hair_length": ["preferred_hair_length", "desired_length", "hair_length"],
    "maintenance_level": ["maintenance_level"],
    "style_preference": ["style_preference", "style_vibe", "look_preference"],
    "beard_preference": ["beard_preference", "beard_type", "facial_hair_preference"],
    TARGET_COLUMN: [TARGET_COLUMN, "best_hairstyle", "hairstyle_recommendation"],
}

DEFAULT_FEATURE_VALUES = {
    "style_preference": "classic",
    "beard_preference": "no_beard",
}

VALUE_MAPPERS = {
    "forehead_width_type": {
        "low": "narrow",
        "narrow": "narrow",
        "small": "narrow",
        "medium": "balanced",
        "mid": "balanced",
        "balanced": "balanced",
        "high": "wide",
        "wide": "wide",
        "broad": "wide",
    },
    "cheekbone_width_type": {
        "low": "narrow",
        "narrow": "narrow",
        "medium": "balanced",
        "balanced": "balanced",
        "high": "wide",
        "wide": "wide",
        "prominent": "wide",
    },
    "jaw_width_type": {
        "narrow": "narrow",
        "slim": "narrow",
        "soft": "narrow",
        "balanced": "balanced",
        "medium": "balanced",
        "wide": "wide",
        "broad": "wide",
        "strong": "wide",
    },
    "face_length_type": {
        "short": "short",
        "compact": "short",
        "balanced": "balanced",
        "medium": "balanced",
        "long": "long",
        "elongated": "long",
    },
    "preferred_hair_length": {
        "short": "short",
        "medium": "medium",
        "mid": "medium",
        "long": "long",
    },
}


def normalize_column_name(column_name: str) -> str:
    return str(column_name).strip().lower().replace(" ", "_")


def normalize_category(value: object) -> str:
    if pd.isna(value):
        return ""

    text = str(value).strip().lower()
    text = "_".join(part for part in text.replace("-", " ").split() if part)
    return text


def resolve_source_column(df: pd.DataFrame, canonical_column: str) -> str | None:
    candidates = COLUMN_ALIASES.get(canonical_column, [canonical_column])
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    return None


def apply_value_mappers(df: pd.DataFrame) -> pd.DataFrame:
    mapped = df.copy()
    for column, lookup in VALUE_MAPPERS.items():
        if column in mapped.columns:
            mapped[column] = mapped[column].map(lambda value: lookup.get(value, value))
    return mapped


def load_dataset(data_path: Path) -> pd.DataFrame:
    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset file not found at {data_path.resolve()}\n"
            "Place your Excel file there or pass --data with the correct path."
        )

    df = pd.read_excel(data_path, sheet_name="Dataset", engine="openpyxl")
    df = df.rename(columns=normalize_column_name)

    relevant = pd.DataFrame()
    resolved_columns: dict[str, str] = {}
    missing_required: list[str] = []

    for canonical_column in FEATURE_COLUMNS + [TARGET_COLUMN]:
        source_column = resolve_source_column(df, canonical_column)

        if source_column:
            relevant[canonical_column] = df[source_column]
            resolved_columns[canonical_column] = source_column
            continue

        if canonical_column in DEFAULT_FEATURE_VALUES:
            default_value = DEFAULT_FEATURE_VALUES[canonical_column]
            relevant[canonical_column] = default_value
            resolved_columns[canonical_column] = f"<default:{default_value}>"
            continue

        missing_required.append(canonical_column)

    if missing_required:
        raise ValueError(
            "Missing required columns in Dataset sheet after alias lookup: "
            f"{missing_required}\nAvailable columns: {list(df.columns)}"
        )

    for column in FEATURE_COLUMNS + [TARGET_COLUMN]:
        relevant[column] = relevant[column].map(normalize_category)

    relevant = apply_value_mappers(relevant)

    # Drop fully blank and incomplete rows.
    relevant = relevant.replace("", pd.NA)
    relevant = relevant.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()

    before_dedup = len(relevant)
    relevant = relevant.drop_duplicates().reset_index(drop=True)
    after_dedup = len(relevant)

    print("Resolved input columns:")
    for canonical_name, source_name in resolved_columns.items():
        print(f"  - {canonical_name} <- {source_name}")

    print(f"Rows after cleaning: {after_dedup} (removed {before_dedup - after_dedup} duplicates)")
    return relevant


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                FEATURE_COLUMNS,
            )
        ],
        remainder="drop",
    )

    classifier = DecisionTreeClassifier(
        random_state=42,
        max_depth=10,
        min_samples_leaf=2,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def train_model(df: pd.DataFrame, model_path: Path) -> None:
    x = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    can_stratify = y.value_counts().min() >= 2 and y.nunique() > 1

    x_train, x_val, y_train, y_val = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y if can_stratify else None,
    )

    pipeline = build_pipeline()
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_val)
    accuracy = accuracy_score(y_val, y_pred)

    print(f"Validation accuracy: {accuracy:.4f}")
    print("\nClassification report:")
    print(classification_report(y_val, y_pred, zero_division=0))

    print("\nSample predictions:")
    preview = x_val.copy().reset_index(drop=True)
    preview["actual"] = y_val.reset_index(drop=True)
    preview["predicted"] = pd.Series(y_pred)
    print(preview.head(5).to_string(index=False))

    model_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "pipeline": pipeline,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
    }
    joblib.dump(bundle, model_path)
    print(f"\nSaved model bundle to: {model_path.resolve()}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train FaceFrame DecisionTree baseline.")
    parser.add_argument(
        "--data",
        type=Path,
        default=DEFAULT_DATA_PATH,
        help="Path to Excel dataset file.",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=DEFAULT_MODEL_PATH,
        help="Path to save trained model bundle.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset = load_dataset(args.data)
    train_model(dataset, args.model_out)


if __name__ == "__main__":
    main()
