"""
Evaluation pipeline for the flood-detection components.

IMPORTANT - READ BEFORE TRUSTING THESE NUMBERS
------------------------------------------------
There is no real, independently-labeled flood dataset wired into this MVP.
To keep the evaluation pipeline honest, this module:

  1. Generates a synthetic held-out test set (tiles + paired weather/sensor
     readings) with KNOWN ground-truth labels baked in at generation time.
  2. Actually RUNS the real heuristic image classifier
     (app/ml/image_analysis.py) and the real fusion scoring
     (app/services/fusion.py) against that test set.
  3. Computes accuracy / precision / recall / F1 / confusion matrix with
     scikit-learn from the ACTUAL predictions vs. the known synthetic
     labels - nothing here is a hardcoded or fabricated number.

These numbers describe how the heuristic performs on synthetic demo data,
which is NOT representative of real-world satellite/sensor performance.
They exist to demonstrate the evaluation pipeline end-to-end. Before any
real deployment, this must be re-run against a real, independently
labeled, geographically diverse flood dataset.
"""
import os
import random
import tempfile
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
)

from app.ml.image_generator import generate_flood_tile
from app.ml.image_analysis import analyze_flood_tile
from app.services.fusion import score_rainfall, score_sensor

N_TEST_SAMPLES = 60
IMAGE_THRESHOLD = 0.5
WEATHER_SENSOR_THRESHOLD = 0.5
FUSION_THRESHOLD = 0.5


def _confusion_dict(y_true, y_pred):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    return {
        "true_negative": int(tn), "false_positive": int(fp),
        "false_negative": int(fn), "true_positive": int(tp),
    }


def _metrics(y_true, y_pred):
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 3),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 3),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 3),
        "f1_score": round(f1_score(y_true, y_pred, zero_division=0), 3),
        "confusion_matrix": _confusion_dict(y_true, y_pred),
        "n_samples": len(y_true),
    }


def run_evaluation(seed: int = 42) -> dict:
    rng = random.Random(seed)

    y_true = []
    image_preds, ws_preds, fusion_preds = [], [], []

    with tempfile.TemporaryDirectory() as tmp:
        for i in range(N_TEST_SAMPLES):
            true_flooded = 1 if rng.random() < 0.45 else 0
            severity = rng.uniform(0.55, 0.95) if true_flooded else rng.uniform(0.0, 0.35)
            # small amount of label noise on the non-image modalities to
            # simulate real-world imperfect correlation between rainfall/
            # sensor readings and the ground-truth flood outcome
            rainfall = max(0, rng.gauss(30 + severity * 130, 15))
            water_level = max(0, rng.gauss(0.5 + severity * 5, 0.6))
            change = max(0, rng.gauss(severity * 1.2, 0.3))

            tile_path = os.path.join(tmp, f"t_{i}.png")
            generate_flood_tile(severity, seed=seed * 1000 + i).save(tile_path)
            analysis = analyze_flood_tile(tile_path)

            rain_score = score_rainfall(rainfall) or 0.0
            sensor_score = score_sensor(water_level, change) or 0.0
            ws_combined = 0.5 * rain_score + 0.5 * sensor_score

            fusion_combined = (
                0.55 * analysis["flood_probability"] + 0.45 * ws_combined
            )  # simplified 2-modality fusion for eval (no incident/text modality in synthetic set)

            y_true.append(true_flooded)
            image_preds.append(1 if analysis["flood_probability"] >= IMAGE_THRESHOLD else 0)
            ws_preds.append(1 if ws_combined >= WEATHER_SENSOR_THRESHOLD else 0)
            fusion_preds.append(1 if fusion_combined >= FUSION_THRESHOLD else 0)

    return {
        "available": True,
        "message": (
            "Evaluated on a synthetic, internally-generated held-out test set "
            f"({N_TEST_SAMPLES} samples) with known ground-truth labels. "
            "This demonstrates the evaluation pipeline only - it is NOT a "
            "measure of real-world performance. Re-run against a real, "
            "independently labeled dataset before any operational use."
        ),
        "baseline_image_only": _metrics(y_true, image_preds),
        "baseline_weather_sensor_only": _metrics(y_true, ws_preds),
        "multimodal_fusion": _metrics(y_true, fusion_preds),
        "notes": [
            "Test data is procedurally generated (synthetic tiles + simulated weather/sensor pairs), not real imagery.",
            "Image classifier is a lightweight color-index heuristic, not a trained neural network.",
            "Incident-report modality is excluded from this synthetic evaluation (no synthetic text generator with reliable ground truth).",
            "Class balance, thresholds, and noise levels are fixed by this script and can be changed as real data becomes available.",
        ],
    }
