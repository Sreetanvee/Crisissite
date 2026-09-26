"""
Lightweight, locally-runnable "flood likelihood" estimator for aerial/satellite
tiles.

WHAT THIS IS
------------
A transparent, explainable heuristic classifier - not a deep neural network.
It looks at the color composition of an image tile and estimates how much of
the tile looks like standing / muddy flood water versus dry land, vegetation,
or built-up area. This is a legitimate, well-established remote-sensing
technique (color-index water detection, related to NDWI-style approaches)
made simple enough to run instantly on a laptop with no GPU.

WHAT THIS IS NOT
----------------
This is NOT a trained deep-learning segmentation model. We do not claim it
is. All predictions produced by this module must be labeled in the UI as
coming from a "lightweight heuristic classifier" running on DEMO/SIMULATED
imagery, not a production remote-sensing model.

The function below operates on REAL pixel data of whatever image is passed
in - nothing is hardcoded. Swap in real satellite tiles and it will produce
a real (if simplistic) result on them.
"""
from __future__ import annotations
import numpy as np
from PIL import Image


def _to_array(image_path: str) -> np.ndarray:
    img = Image.open(image_path).convert("RGB")
    return np.asarray(img).astype(np.float32)


def analyze_flood_tile(image_path: str) -> dict:
    """
    Estimate flood likelihood for a single image tile.

    Returns a dict with:
      - flood_probability: 0..1, fraction-weighted water-likeness score
      - water_pixel_fraction: 0..1, share of pixels classified as water-like
      - analysis_confidence: 0..1, how much signal is present (very dark or
        very uniform images -> lower confidence, since color-index methods
        degrade on such tiles)
    """
    arr = _to_array(image_path)
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Muddy/turbid flood water tends to be darker, with blue/green channels
    # close to or slightly above red, and overall lower saturation than
    # vegetation (which is green-dominant) or bare soil/roads (which are
    # red/grey dominant with higher brightness).
    brightness = (r + g + b) / 3.0
    blue_green_dominance = ((b + g) / 2.0) - r  # positive => water-ish
    low_saturation = 255.0 - (np.max(arr, axis=2) - np.min(arr, axis=2))

    water_score = (
        0.55 * np.clip(blue_green_dominance / 60.0, -1, 1)
        + 0.25 * np.clip((140 - brightness) / 140.0, -1, 1)
        + 0.20 * np.clip((low_saturation - 150) / 105.0, -1, 1)
    )
    water_mask = water_score > 0.15
    water_pixel_fraction = float(np.mean(water_mask))

    # Weight the raw fraction by mean "water-ness" intensity in flagged
    # pixels so a few extremely water-like pixels don't get diluted the
    # same as borderline ones.
    if water_pixel_fraction > 0:
        intensity = float(np.mean(water_score[water_mask]))
    else:
        intensity = 0.0

    flood_probability = float(np.clip(water_pixel_fraction * (0.6 + 0.4 * intensity) * 1.35, 0.0, 1.0))

    # Confidence heuristic: very low-contrast / near-uniform tiles (e.g.
    # heavy cloud cover, sensor saturation) give the color-index method
    # less reliable signal.
    contrast = float(np.std(brightness))
    coverage_confidence = float(np.clip(contrast / 45.0, 0.15, 1.0))

    return {
        "flood_probability": round(flood_probability, 4),
        "water_pixel_fraction": round(water_pixel_fraction, 4),
        "analysis_confidence": round(coverage_confidence, 4),
    }
