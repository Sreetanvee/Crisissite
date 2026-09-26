"""
Generates synthetic aerial/satellite-style tile images for demo purposes.

These are procedurally generated PNGs, NOT real satellite imagery. They
exist purely so the app has actual image files to run the (also real, but
heuristic) analysis code in image_analysis.py against, producing genuinely
computed - not hand-typed - flood_probability values for the demo dataset.

Every generated file is written under backend/data/satellite/ and every
place it is referenced in the UI is labeled "DEMO / SIMULATED IMAGERY".
"""
import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TILE_SIZE = 256


def _base_terrain(rng: random.Random) -> np.ndarray:
    """Dry land / vegetation base: green-brown mix with noise."""
    base = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.float32)
    veg = np.array([70, 110, 55], dtype=np.float32)
    soil = np.array([120, 100, 70], dtype=np.float32)
    for y in range(TILE_SIZE):
        mix = rng.random()
        base[y, :, :] = veg * mix + soil * (1 - mix)
    noise = np.random.normal(0, 12, base.shape)
    return np.clip(base + noise, 0, 255)


def generate_flood_tile(severity: float, seed: int) -> Image.Image:
    """
    severity: 0.0 (dry) .. 1.0 (severely flooded) - controls how much of the
    tile is painted with water-like coloring, and how murky it looks.
    """
    rng = random.Random(seed)
    np.random.seed(seed)
    arr = _base_terrain(rng)

    water_color = np.array([60, 80, 95], dtype=np.float32)  # murky flood water
    mask = np.zeros((TILE_SIZE, TILE_SIZE), dtype=np.float32)

    # Grow a few irregular "flood pool" blobs whose combined coverage
    # approximates the requested severity.
    n_blobs = 2 + int(severity * 4)
    target_coverage = severity
    img_mask = Image.new("L", (TILE_SIZE, TILE_SIZE), 0)
    draw = ImageDraw.Draw(img_mask)
    for _ in range(n_blobs):
        cx = rng.randint(0, TILE_SIZE)
        cy = rng.randint(0, TILE_SIZE)
        rx = rng.randint(int(20 + 60 * severity), int(40 + 90 * severity))
        ry = rng.randint(int(20 + 60 * severity), int(40 + 90 * severity))
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    blurred = img_mask.filter(ImageFilter.GaussianBlur(radius=8))
    mask = np.asarray(blurred).astype(np.float32) / 255.0
    mask = np.clip(mask * (0.5 + target_coverage), 0, 1)

    mask3 = np.repeat(mask[:, :, None], 3, axis=2)
    composed = arr * (1 - mask3) + water_color * mask3

    # A little haze/cloud texture for realism
    haze = np.random.normal(0, 4, composed.shape)
    composed = np.clip(composed + haze, 0, 255).astype(np.uint8)

    return Image.fromarray(composed, mode="RGB")


def ensure_tile_file(path: str, severity: float, seed: int) -> None:
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = generate_flood_tile(severity, seed)
    img.save(path, "PNG")
