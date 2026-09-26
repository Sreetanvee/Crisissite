"""
Multimodal Evidence Fusion.

This is intentionally a transparent, explainable weighted combination of
per-modality scores - NOT a black-box trained fusion network. The weights
and formula are shown in the API response and in the UI so an operator can
see exactly how a score was produced.

    Multimodal Evidence Score (0-100) =
        100 * ( 0.40 * image_score
               + 0.25 * rainfall_score
               + 0.25 * sensor_score
               + 0.10 * incident_score )

Each per-modality score is itself a 0..1 normalized value derived from raw
readings (see _score_* helpers below). If a modality is missing, its weight
is redistributed proportionally among the remaining available modalities
rather than silently treated as 0 (which would understate risk) or ignored
(which would overstate confidence) - and this is flagged explicitly.

This module NEVER invents evidence: every score it outputs traces back to
a specific SatelliteImage / WeatherReading / SensorReading / IncidentReport
record, and evidence_refs lists exactly which ones were used.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List

WEIGHTS = {
    "image": 0.40,
    "rainfall": 0.25,
    "sensor": 0.25,
    "incident": 0.10,
}

LOW_CONFIDENCE_THRESHOLD = 60.0  # percent
CONFLICT_GAP_THRESHOLD = 0.40  # normalized 0..1 gap between modality scores


def score_rainfall(rainfall_mm: Optional[float]) -> Optional[float]:
    if rainfall_mm is None:
        return None
    # 0mm -> 0.0 ; 150mm+ -> 1.0 (roughly "extreme rainfall" territory)
    return max(0.0, min(1.0, rainfall_mm / 150.0))


def score_sensor(water_level_m: Optional[float], change_m_per_hr: Optional[float]) -> Optional[float]:
    if water_level_m is None:
        return None
    level_component = max(0.0, min(1.0, water_level_m / 6.0))  # 6m ~ severe
    rate_component = 0.0
    if change_m_per_hr is not None:
        rate_component = max(0.0, min(1.0, change_m_per_hr / 1.5))
    return max(0.0, min(1.0, 0.7 * level_component + 0.3 * rate_component))


def score_incident(report_count: int, has_flood_keywords: bool) -> Optional[float]:
    if report_count == 0:
        return None
    base = min(1.0, 0.25 + 0.2 * report_count)
    if has_flood_keywords:
        base = min(1.0, base + 0.25)
    return base


FLOOD_KEYWORDS = ["water", "flood", "submerged", "rising", "overflow", "evacuat", "roads"]


@dataclass
class FusionInput:
    zone_code: str
    image_score: Optional[float] = None       # 0..1, from ml/image_analysis.py
    image_ref: Optional[str] = None
    rainfall_mm: Optional[float] = None
    rainfall_ref: Optional[str] = None
    water_level_m: Optional[float] = None
    change_m_per_hr: Optional[float] = None
    sensor_ref: Optional[str] = None
    incident_texts: List[str] = field(default_factory=list)
    incident_refs: List[str] = field(default_factory=list)


@dataclass
class FusionResult:
    image_score: Optional[float]
    rainfall_score: Optional[float]
    sensor_score: Optional[float]
    incident_score: Optional[float]
    modalities_present: List[str]
    fusion_score: float          # 0..100
    confidence: float            # 0..100
    uncertainty: float           # 0..100
    status: str                  # OK | LOW_CONFIDENCE | CONFLICTING_EVIDENCE | LIMITED_EVIDENCE
    priority: str                # low | medium | high
    priority_reason: str
    evidence_refs: List[str]
    weight_breakdown: dict        # for the "show your work" UI panel


def run_fusion(inp: FusionInput) -> FusionResult:
    rainfall_score = score_rainfall(inp.rainfall_mm)
    sensor_score = score_sensor(inp.water_level_m, inp.change_m_per_hr)
    has_kw = any(any(k in t.lower() for k in FLOOD_KEYWORDS) for t in inp.incident_texts)
    incident_score = score_incident(len(inp.incident_texts), has_kw)
    image_score = inp.image_score

    scores = {
        "image": image_score,
        "rainfall": rainfall_score,
        "sensor": sensor_score,
        "incident": incident_score,
    }
    present = {k: v for k, v in scores.items() if v is not None}
    missing = [k for k, v in scores.items() if v is None]

    evidence_refs = []
    if inp.image_ref and image_score is not None:
        evidence_refs.append(inp.image_ref)
    if inp.rainfall_ref and rainfall_score is not None:
        evidence_refs.append(inp.rainfall_ref)
    if inp.sensor_ref and sensor_score is not None:
        evidence_refs.append(inp.sensor_ref)
    evidence_refs.extend([r for r in inp.incident_refs if incident_score is not None])

    if not present:
        return FusionResult(
            image_score=None, rainfall_score=None, sensor_score=None, incident_score=None,
            modalities_present=[], fusion_score=0.0, confidence=0.0, uncertainty=100.0,
            status="LIMITED_EVIDENCE", priority="low",
            priority_reason="No evidence available for this zone yet.",
            evidence_refs=[], weight_breakdown={},
        )

    # Redistribute missing modality weight proportionally among present ones.
    total_present_weight = sum(WEIGHTS[k] for k in present)
    effective_weights = {k: WEIGHTS[k] / total_present_weight for k in present}

    fusion_fraction = sum(present[k] * effective_weights[k] for k in present)
    fusion_score = round(fusion_fraction * 100, 1)

    weight_breakdown = {
        k: {
            "raw_score": round(present[k], 3),
            "original_weight": WEIGHTS[k],
            "effective_weight": round(effective_weights[k], 3),
            "contribution": round(present[k] * effective_weights[k] * 100, 2),
        }
        for k in present
    }

    # --- Confidence & uncertainty ---
    # Base confidence scales with how much of the full evidence set is
    # present (4 modalities = full evidence). Then adjust down for
    # cross-modality disagreement.
    evidence_completeness = len(present) / 4.0
    base_confidence = 55 + 45 * evidence_completeness  # 4/4 -> 100, 1/4 -> 66.25

    values = list(present.values())
    max_gap = max(values) - min(values) if len(values) > 1 else 0.0
    disagreement_penalty = max_gap * 40  # up to ~40 pts penalty on strong disagreement

    confidence = max(5.0, min(99.0, base_confidence - disagreement_penalty))
    confidence = round(confidence, 1)
    uncertainty = round(100 - confidence, 1)

    # --- Status ---
    status = "OK"
    if len(present) < 4:
        status = "LIMITED_EVIDENCE"
    if len(values) > 1 and max_gap >= CONFLICT_GAP_THRESHOLD:
        status = "CONFLICTING_EVIDENCE"
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        status = "LOW_CONFIDENCE" if status == "OK" else status  # keep conflict label if both true

    # --- Priority ---
    reasons = []
    priority_score = 0
    if fusion_score >= 70:
        priority_score += 2
        reasons.append("high multimodal evidence score")
    elif fusion_score >= 45:
        priority_score += 1
        reasons.append("moderate multimodal evidence score")

    if sensor_score is not None and inp.change_m_per_hr and inp.change_m_per_hr >= 0.8:
        priority_score += 2
        reasons.append("rapidly rising water level")

    if image_score is not None and image_score >= 0.75:
        priority_score += 1
        reasons.append("strong satellite flood signal")

    if status == "CONFLICTING_EVIDENCE":
        priority_score += 2
        reasons.append("modalities disagree - needs human adjudication")

    if status in ("LOW_CONFIDENCE", "LIMITED_EVIDENCE"):
        priority_score += 1
        reasons.append("low confidence / incomplete evidence - needs verification")

    if priority_score >= 4:
        priority = "high"
    elif priority_score >= 2:
        priority = "medium"
    else:
        priority = "low"

    if not reasons:
        reasons.append("routine monitoring")

    return FusionResult(
        image_score=image_score,
        rainfall_score=rainfall_score,
        sensor_score=sensor_score,
        incident_score=incident_score,
        modalities_present=list(present.keys()),
        fusion_score=fusion_score,
        confidence=confidence,
        uncertainty=uncertainty,
        status=status,
        priority=priority,
        priority_reason="; ".join(reasons),
        evidence_refs=evidence_refs,
        weight_breakdown=weight_breakdown,
    )


def build_summary(
    zone_name: str,
    result: FusionResult,
    rainfall_mm: Optional[float],
    water_level_m: Optional[float],
    change_m_per_hr: Optional[float],
    latest_incident_text: Optional[str],
    latest_incident_time: Optional[str],
    image_ref: Optional[str],
    sensor_ref: Optional[str],
    weather_ref: Optional[str],
    incident_ref: Optional[str],
) -> str:
    """Builds an evidence-linked natural language summary. Every clause is
    tied to a concrete value already computed elsewhere - nothing here is
    invented."""
    parts = []
    if result.image_score is not None:
        parts.append(
            f"satellite imagery indicates a flood likelihood of {result.image_score*100:.0f}% [{image_ref}]"
        )
    if rainfall_mm is not None:
        parts.append(f"rainfall is {rainfall_mm:.0f} mm [{weather_ref}]")
    if water_level_m is not None:
        change_txt = f", rising {change_m_per_hr:.1f} m/hour" if change_m_per_hr else ""
        parts.append(f"nearby water-level sensors read {water_level_m:.1f} m{change_txt} [{sensor_ref}]")
    if latest_incident_text:
        parts.append(f"an incident report from {latest_incident_time} states: \"{latest_incident_text}\" [{incident_ref}]")

    if not parts:
        return f"{zone_name} has no evidence recorded yet. Human review is required before any action."

    body = "; ".join(parts)
    lead = f"{zone_name} shows potential flooding." if result.fusion_score >= 45 else f"{zone_name} shows low-to-moderate flood indicators."
    tail = " Human verification is required."
    if result.status == "CONFLICTING_EVIDENCE":
        tail = " Evidence sources disagree; human verification is required to adjudicate."
    elif result.status in ("LOW_CONFIDENCE", "LIMITED_EVIDENCE"):
        tail = " Confidence is limited; human verification is required."
    return f"{lead} {body[0].upper() + body[1:]}.{tail}"
