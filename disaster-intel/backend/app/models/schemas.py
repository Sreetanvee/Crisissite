from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class EventOut(BaseModel):
    id: int
    name: str
    disaster_type: str
    status: str
    region: str
    created_at: datetime
    updated_at: datetime
    is_demo: bool

    class Config:
        from_attributes = True


class SatelliteImageOut(BaseModel):
    id: int
    image_code: str
    zone_id: int
    lat: float
    lon: float
    timestamp: datetime
    filename: str
    flood_probability: float
    analysis_confidence: float
    is_demo: bool

    class Config:
        from_attributes = True


class WeatherReadingOut(BaseModel):
    id: int
    reading_code: str
    zone_id: int
    lat: float
    lon: float
    timestamp: datetime
    rainfall_mm: float
    temperature_c: float
    humidity_pct: float
    wind_kmh: float
    is_demo: bool

    class Config:
        from_attributes = True


class SensorReadingOut(BaseModel):
    id: int
    sensor_code: str
    zone_id: int
    lat: float
    lon: float
    timestamp: datetime
    water_level_m: float
    change_m_per_hr: float
    is_demo: bool

    class Config:
        from_attributes = True


class IncidentReportOut(BaseModel):
    id: int
    report_code: str
    zone_id: int
    text: str
    timestamp: datetime
    lat: float
    lon: float
    source: str
    is_demo: bool

    class Config:
        from_attributes = True


class DetectionOut(BaseModel):
    id: int
    zone_id: int
    timestamp: datetime
    image_score: Optional[float]
    rainfall_score: Optional[float]
    sensor_score: Optional[float]
    incident_score: Optional[float]
    modalities_present: str
    fusion_score: float
    confidence: float
    uncertainty: float
    status: str
    priority: str
    priority_reason: str
    summary_text: str
    evidence_refs: str

    class Config:
        from_attributes = True


class ZoneOut(BaseModel):
    id: int
    zone_code: str
    event_id: int
    name: str
    lat: float
    lon: float
    radius_m: float
    description: str

    class Config:
        from_attributes = True


class ZoneDetailOut(BaseModel):
    zone: ZoneOut
    latest_detection: Optional[DetectionOut]
    satellite_images: List[SatelliteImageOut]
    weather_readings: List[WeatherReadingOut]
    sensor_readings: List[SensorReadingOut]
    incident_reports: List[IncidentReportOut]


class ReviewQueueItem(BaseModel):
    zone_id: int
    zone_code: str
    zone_name: str
    lat: float
    lon: float
    priority: str
    priority_reason: str
    confidence: float
    uncertainty: float
    fusion_score: float
    status: str
    main_evidence: str
    timestamp: datetime
    review_status: str


class ReviewCreate(BaseModel):
    zone_id: int
    operator_name: Optional[str] = "Demo Operator"
    status: str  # reviewed | more_data_requested
    notes: Optional[str] = ""


class ReviewOut(BaseModel):
    id: int
    zone_id: int
    status: str
    notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelinePoint(BaseModel):
    timestamp: datetime
    rainfall_mm: Optional[float] = None
    water_level_m: Optional[float] = None
    fusion_score: Optional[float] = None
    confidence: Optional[float] = None
    label: Optional[str] = None


class EvaluationResult(BaseModel):
    available: bool
    message: str
    baseline_image_only: Optional[dict] = None
    baseline_weather_sensor_only: Optional[dict] = None
    multimodal_fusion: Optional[dict] = None
    notes: List[str] = []
