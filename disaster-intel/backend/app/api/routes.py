from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import db_models as m
from app.models import schemas as s
from app.services.evaluation import run_evaluation

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------- events ---
@router.get("/events", response_model=List[s.EventOut])
def list_events(db: Session = Depends(get_db)):
    return db.query(m.Event).order_by(desc(m.Event.updated_at)).all()


# ----------------------------------------------------------------- zones ---
def _latest_detection(db: Session, zone_id: int) -> Optional[m.Detection]:
    return (
        db.query(m.Detection)
        .filter(m.Detection.zone_id == zone_id)
        .order_by(desc(m.Detection.timestamp))
        .first()
    )


@router.get("/zones", response_model=List[s.ZoneOut])
def list_zones(event_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(m.Zone)
    if event_id:
        q = q.filter(m.Zone.event_id == event_id)
    return q.all()


@router.get("/zones/{zone_id}", response_model=s.ZoneDetailOut)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(m.Zone).filter(m.Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(404, "Zone not found")
    latest = _latest_detection(db, zone_id)
    return s.ZoneDetailOut(
        zone=zone,
        latest_detection=latest,
        satellite_images=db.query(m.SatelliteImage).filter(m.SatelliteImage.zone_id == zone_id).order_by(m.SatelliteImage.timestamp).all(),
        weather_readings=db.query(m.WeatherReading).filter(m.WeatherReading.zone_id == zone_id).order_by(m.WeatherReading.timestamp).all(),
        sensor_readings=db.query(m.SensorReading).filter(m.SensorReading.zone_id == zone_id).order_by(m.SensorReading.timestamp).all(),
        incident_reports=db.query(m.IncidentReport).filter(m.IncidentReport.zone_id == zone_id).order_by(m.IncidentReport.timestamp).all(),
    )


# --------------------------------------------------------------- weather ---
@router.get("/weather", response_model=List[s.WeatherReadingOut])
def list_weather(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(m.WeatherReading)
    if zone_id:
        q = q.filter(m.WeatherReading.zone_id == zone_id)
    return q.order_by(m.WeatherReading.timestamp).all()


# --------------------------------------------------------------- sensors ---
@router.get("/sensors", response_model=List[s.SensorReadingOut])
def list_sensors(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(m.SensorReading)
    if zone_id:
        q = q.filter(m.SensorReading.zone_id == zone_id)
    return q.order_by(m.SensorReading.timestamp).all()


# ------------------------------------------------------------- incidents ---
@router.get("/incidents", response_model=List[s.IncidentReportOut])
def list_incidents(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(m.IncidentReport)
    if zone_id:
        q = q.filter(m.IncidentReport.zone_id == zone_id)
    return q.order_by(m.IncidentReport.timestamp).all()


# ------------------------------------------------------------ detections ---
@router.get("/detections", response_model=List[s.DetectionOut])
def list_detections(zone_id: Optional[int] = None, latest_only: bool = True, db: Session = Depends(get_db)):
    if zone_id and not latest_only:
        return db.query(m.Detection).filter(m.Detection.zone_id == zone_id).order_by(m.Detection.timestamp).all()
    if zone_id and latest_only:
        d = _latest_detection(db, zone_id)
        return [d] if d else []
    # all zones, latest per zone
    zones = db.query(m.Zone).all()
    out = []
    for z in zones:
        d = _latest_detection(db, z.id)
        if d:
            out.append(d)
    return out


# ------------------------------------------------------------ review Q ---
@router.get("/review-queue", response_model=List[s.ReviewQueueItem])
def review_queue(db: Session = Depends(get_db)):
    zones = db.query(m.Zone).all()
    items = []
    priority_rank = {"high": 0, "medium": 1, "low": 2}
    for z in zones:
        det = _latest_detection(db, z.id)
        if not det:
            continue
        review = (
            db.query(m.Review)
            .filter(m.Review.zone_id == z.id)
            .order_by(desc(m.Review.updated_at))
            .first()
        )
        main_evidence_bits = []
        if det.image_score is not None:
            main_evidence_bits.append(f"Satellite: {det.image_score*100:.0f}%")
        if det.sensor_score is not None:
            main_evidence_bits.append(f"Water level score: {det.sensor_score*100:.0f}%")
        if det.rainfall_score is not None:
            main_evidence_bits.append(f"Rainfall score: {det.rainfall_score*100:.0f}%")
        if det.incident_score is not None:
            main_evidence_bits.append("Incident reports present")
        items.append(
            s.ReviewQueueItem(
                zone_id=z.id,
                zone_code=z.zone_code,
                zone_name=z.name,
                lat=z.lat,
                lon=z.lon,
                priority=det.priority,
                priority_reason=det.priority_reason,
                confidence=det.confidence,
                uncertainty=det.uncertainty,
                fusion_score=det.fusion_score,
                status=det.status,
                main_evidence=", ".join(main_evidence_bits) if main_evidence_bits else "No evidence yet",
                timestamp=det.timestamp,
                review_status=review.status if review else "pending",
            )
        )
    items.sort(key=lambda it: (priority_rank.get(it.priority, 3), -it.fusion_score))
    return items


# --------------------------------------------------------------- reviews ---
@router.post("/reviews", response_model=s.ReviewOut)
def create_review(payload: s.ReviewCreate, db: Session = Depends(get_db)):
    zone = db.query(m.Zone).filter(m.Zone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(404, "Zone not found")

    operator = db.query(m.Operator).filter(m.Operator.name == payload.operator_name).first()
    if not operator:
        operator = m.Operator(name=payload.operator_name or "Demo Operator", role="reviewer")
        db.add(operator)
        db.flush()

    existing = (
        db.query(m.Review)
        .filter(m.Review.zone_id == payload.zone_id)
        .order_by(desc(m.Review.updated_at))
        .first()
    )
    if existing and existing.status == "pending":
        existing.status = payload.status
        existing.notes = payload.notes or ""
        existing.operator_id = operator.id
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    review = m.Review(
        zone_id=payload.zone_id,
        operator_id=operator.id,
        status=payload.status,
        notes=payload.notes or "",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# -------------------------------------------------------------- timeline ---
@router.get("/timeline/{zone_id}", response_model=List[s.TimelinePoint])
def timeline(zone_id: int, db: Session = Depends(get_db)):
    dets = (
        db.query(m.Detection)
        .filter(m.Detection.zone_id == zone_id)
        .order_by(m.Detection.timestamp)
        .all()
    )
    weather = {w.timestamp: w for w in db.query(m.WeatherReading).filter(m.WeatherReading.zone_id == zone_id).all()}
    sensors = {sr.timestamp: sr for sr in db.query(m.SensorReading).filter(m.SensorReading.zone_id == zone_id).all()}

    points = []
    for d in dets:
        w = weather.get(d.timestamp)
        sr = sensors.get(d.timestamp)
        label = "normal"
        if d.priority == "high":
            label = "high review priority"
        elif d.status == "CONFLICTING_EVIDENCE":
            label = "conflicting evidence"
        elif d.fusion_score >= 60:
            label = "possible flooding detected"
        elif d.fusion_score >= 35:
            label = "conditions worsening"
        points.append(
            s.TimelinePoint(
                timestamp=d.timestamp,
                rainfall_mm=w.rainfall_mm if w else None,
                water_level_m=sr.water_level_m if sr else None,
                fusion_score=d.fusion_score,
                confidence=d.confidence,
                label=label,
            )
        )
    return points


# --------------------------------------------------------------- analyze ---
@router.post("/analyze")
def analyze(zone_id: int, db: Session = Depends(get_db)):
    """
    Re-runs multimodal fusion for a zone using its latest available
    readings and stores a fresh Detection row. Useful for a "re-analyze
    this zone" button once new data has come in.
    """
    from app.services.fusion import FusionInput, run_fusion, build_summary

    zone = db.query(m.Zone).filter(m.Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(404, "Zone not found")

    latest_img = db.query(m.SatelliteImage).filter(m.SatelliteImage.zone_id == zone_id).order_by(desc(m.SatelliteImage.timestamp)).first()
    latest_weather = db.query(m.WeatherReading).filter(m.WeatherReading.zone_id == zone_id).order_by(desc(m.WeatherReading.timestamp)).first()
    latest_sensor = db.query(m.SensorReading).filter(m.SensorReading.zone_id == zone_id).order_by(desc(m.SensorReading.timestamp)).first()
    incidents = db.query(m.IncidentReport).filter(m.IncidentReport.zone_id == zone_id).order_by(m.IncidentReport.timestamp).all()

    fusion_in = FusionInput(
        zone_code=zone.zone_code,
        image_score=latest_img.flood_probability if latest_img else None,
        image_ref=latest_img.image_code if latest_img else None,
        rainfall_mm=latest_weather.rainfall_mm if latest_weather else None,
        rainfall_ref=latest_weather.reading_code if latest_weather else None,
        water_level_m=latest_sensor.water_level_m if latest_sensor else None,
        change_m_per_hr=latest_sensor.change_m_per_hr if latest_sensor else None,
        sensor_ref=latest_sensor.sensor_code if latest_sensor else None,
        incident_texts=[i.text for i in incidents],
        incident_refs=[i.report_code for i in incidents],
    )
    result = run_fusion(fusion_in)
    latest_incident = incidents[-1] if incidents else None
    summary = build_summary(
        zone_name=f"Zone {zone.zone_code}",
        result=result,
        rainfall_mm=latest_weather.rainfall_mm if latest_weather else None,
        water_level_m=latest_sensor.water_level_m if latest_sensor else None,
        change_m_per_hr=latest_sensor.change_m_per_hr if latest_sensor else None,
        latest_incident_text=latest_incident.text if latest_incident else None,
        latest_incident_time=latest_incident.timestamp.strftime("%H:%M") if latest_incident else None,
        image_ref=latest_img.image_code if latest_img else None,
        sensor_ref=latest_sensor.sensor_code if latest_sensor else None,
        weather_ref=latest_weather.reading_code if latest_weather else None,
        incident_ref=latest_incident.report_code if latest_incident else None,
    )
    det = m.Detection(
        zone_id=zone.id,
        timestamp=datetime.utcnow(),
        image_score=result.image_score,
        rainfall_score=result.rainfall_score,
        sensor_score=result.sensor_score,
        incident_score=result.incident_score,
        modalities_present=",".join(result.modalities_present),
        fusion_score=result.fusion_score,
        confidence=result.confidence,
        uncertainty=result.uncertainty,
        status=result.status,
        priority=result.priority,
        priority_reason=result.priority_reason,
        summary_text=summary,
        evidence_refs=",".join(result.evidence_refs),
    )
    db.add(det)
    db.commit()
    db.refresh(det)
    return {
        "detection": s.DetectionOut.model_validate(det),
        "weight_breakdown": result.weight_breakdown,
    }


# ------------------------------------------------------------ evaluation ---
_eval_cache = {"result": None}


@router.get("/evaluation", response_model=s.EvaluationResult)
def evaluation():
    if _eval_cache["result"] is None:
        _eval_cache["result"] = run_evaluation()
    return _eval_cache["result"]
