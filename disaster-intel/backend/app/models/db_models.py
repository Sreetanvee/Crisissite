"""
SQLAlchemy ORM models.

Tables: operators, events, zones, satellite_images, weather_readings,
sensor_readings, incident_reports, detections, reviews.

All geographic fields use plain lat/lon floats (WGS84) for MVP simplicity;
a production system would use PostGIS / geography types.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import relationship
from app.database import Base


class Operator(Base):
    __tablename__ = "operators"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, default="reviewer")  # reviewer | supervisor | admin
    created_at = Column(DateTime, default=datetime.utcnow)

    reviews = relationship("Review", back_populates="operator")


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    disaster_type = Column(String, default="flood")
    status = Column(String, default="active")  # active | resolved | archived
    region = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    is_demo = Column(Boolean, default=True)

    zones = relationship("Zone", back_populates="event", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True)
    zone_code = Column(String, unique=True, index=True)  # e.g. "F-03"
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String)
    lat = Column(Float)
    lon = Column(Float)
    radius_m = Column(Float, default=800)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="zones")
    satellite_images = relationship("SatelliteImage", back_populates="zone", cascade="all, delete-orphan")
    weather_readings = relationship("WeatherReading", back_populates="zone", cascade="all, delete-orphan")
    sensor_readings = relationship("SensorReading", back_populates="zone", cascade="all, delete-orphan")
    incident_reports = relationship("IncidentReport", back_populates="zone", cascade="all, delete-orphan")
    detections = relationship("Detection", back_populates="zone", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="zone", cascade="all, delete-orphan")


class SatelliteImage(Base):
    __tablename__ = "satellite_images"
    id = Column(Integer, primary_key=True)
    image_code = Column(String, unique=True, index=True)  # e.g. "IMG-023"
    zone_id = Column(Integer, ForeignKey("zones.id"))
    lat = Column(Float)
    lon = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)  # relative path under /data/satellite
    flood_probability = Column(Float, default=0.0)  # computed by ml/image_analysis.py
    analysis_confidence = Column(Float, default=0.0)
    is_demo = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="satellite_images")


class WeatherReading(Base):
    __tablename__ = "weather_readings"
    id = Column(Integer, primary_key=True)
    reading_code = Column(String, unique=True, index=True)  # e.g. "W-22"
    zone_id = Column(Integer, ForeignKey("zones.id"))
    lat = Column(Float)
    lon = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    rainfall_mm = Column(Float, default=0.0)
    temperature_c = Column(Float, default=0.0)
    humidity_pct = Column(Float, default=0.0)
    wind_kmh = Column(Float, default=0.0)
    is_demo = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="weather_readings")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id = Column(Integer, primary_key=True)
    sensor_code = Column(String, unique=True, index=True)  # e.g. "S-104"
    zone_id = Column(Integer, ForeignKey("zones.id"))
    lat = Column(Float)
    lon = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    water_level_m = Column(Float, default=0.0)
    change_m_per_hr = Column(Float, default=0.0)
    is_demo = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="sensor_readings")


class IncidentReport(Base):
    __tablename__ = "incident_reports"
    id = Column(Integer, primary_key=True)
    report_code = Column(String, unique=True, index=True)  # e.g. "IR-018"
    zone_id = Column(Integer, ForeignKey("zones.id"))
    text = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    lat = Column(Float)
    lon = Column(Float)
    source = Column(String, default="citizen_report")
    is_demo = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="incident_reports")


class Detection(Base):
    """
    A single multimodal fusion result for a zone at a point in time.
    This is the output of app/ml/fusion.py - never hand-authored.
    """
    __tablename__ = "detections"
    id = Column(Integer, primary_key=True)
    zone_id = Column(Integer, ForeignKey("zones.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)

    image_score = Column(Float, nullable=True)
    rainfall_score = Column(Float, nullable=True)
    sensor_score = Column(Float, nullable=True)
    incident_score = Column(Float, nullable=True)

    modalities_present = Column(String, default="")  # comma list e.g. "image,rainfall,sensor,incident"
    fusion_score = Column(Float, default=0.0)  # 0-100, "Multimodal Evidence Score"
    confidence = Column(Float, default=0.0)  # 0-100
    uncertainty = Column(Float, default=0.0)  # 0-100, = 100 - confidence (evidence-completeness adjusted)

    status = Column(String, default="OK")  # OK | LOW_CONFIDENCE | CONFLICTING_EVIDENCE | LIMITED_EVIDENCE
    priority = Column(String, default="low")  # low | medium | high
    priority_reason = Column(Text, default="")

    summary_text = Column(Text, default="")
    evidence_refs = Column(String, default="")  # comma list of codes referenced

    zone = relationship("Zone", back_populates="detections")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True)
    zone_id = Column(Integer, ForeignKey("zones.id"))
    operator_id = Column(Integer, ForeignKey("operators.id"), nullable=True)
    status = Column(String, default="pending")  # pending | reviewed | more_data_requested
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    zone = relationship("Zone", back_populates="reviews")
    operator = relationship("Operator", back_populates="reviews")
