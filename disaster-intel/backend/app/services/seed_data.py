"""
Builds a clearly-labeled DEMO/SIMULATED dataset:

  - 1 active flood event
  - 10 geographic zones (Hyderabad-area coordinates, used only as a
    plausible demo backdrop)
  - 24 sensor readings, 24 weather readings, 12 incident reports
  - 14 synthetic aerial tiles analyzed by app/ml/image_analysis.py
  - A per-zone time series (5 timestamps) run through the real fusion
    engine (app/services/fusion.py) to populate `detections`, so every
    number shown in the UI is actually computed, not hand-typed.

Every record has is_demo=True and the frontend must always show a
"DEMO DATA" badge alongside it. The code is structured so a real CSV/JSON
feed or real imagery can be substituted by writing to the same tables via
the same fusion pipeline.
"""
import os
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models.db_models import (
    Operator, Event, Zone, SatelliteImage, WeatherReading, SensorReading,
    IncidentReport, Detection, Review,
)
from app.ml.image_generator import ensure_tile_file, TILE_SIZE
from app.ml.image_analysis import analyze_flood_tile
from app.services.fusion import FusionInput, run_fusion, build_summary

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
SATELLITE_DIR = os.path.join(DATA_DIR, "satellite")

BASE_TIME = datetime(2026, 9, 26, 8, 0, 0)
TIME_STEPS = [BASE_TIME + timedelta(hours=h) for h in (0, 2, 4, 6, 8)]  # 08,10,12,14,16

# (name, lat, lon, target_severity 0..1, incident texts to attach at the end)
ZONE_DEFS = [
    ("Riverside District",      17.4239, 78.4738, 0.92, [
        "Water has entered residential roads near Zone A.",
        "Family reports ground floor flooding, requesting evacuation assistance.",
    ]),
    ("Lakeview Colony",         17.4435, 78.3772, 0.81, [
        "Local shop owners report rising water near the lake embankment.",
    ]),
    ("Old Town Market",         17.3753, 78.4744, 0.74, [
        "Market vendors moving stock to higher ground, ankle-deep water on main street.",
    ]),
    ("Industrial Belt South",   17.3204, 78.5450, 0.63, [
        "Drainage overflow reported near warehouse access road.",
    ]),
    ("Northside Suburbs",       17.5140, 78.4620, 0.55, [
        "Storm drains backing up along Northside main avenue.",
    ]),
    ("University Quarter",      17.4570, 78.3487, 0.47, [
        "Students report waterlogging near campus gate 2, passable on foot.",
    ]),
    ("Central Business Park",   17.4126, 78.4482, 0.38, [
        "Parking basement of Tower 3 reports minor seepage.",
    ]),
    ("Hillside Terrace",        17.3900, 78.5050, 0.22, [
        "No flooding observed, road crew doing routine drain check.",
    ]),
    ("East Ring Road",          17.4650, 78.5510, 0.18, [
        "Minor pooling reported after afternoon showers, road still open.",
    ]),
    ("Airport Approach Road",   17.2403, 78.4294, 0.12, [
        "Approach road clear, no water reported by ground staff.",
    ]),
]


def _severity_to_rainfall(sev: float, step_frac: float) -> float:
    # Rainfall ramps up over the day toward the zone's target severity.
    peak = 20 + sev * 160
    return round(peak * step_frac + random.uniform(-4, 4), 1)


def _severity_to_water_level(sev: float, step_frac: float) -> float:
    base = 0.8 + sev * 5.2
    return round(0.5 + base * step_frac + random.uniform(-0.1, 0.1), 2)


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if db.query(Event).first():
            print("Database already seeded - skipping.")
            return

        operator = Operator(name="Demo Operator", role="reviewer")
        db.add(operator)

        event = Event(
            name="Simulated Monsoon Flood Event - Sept 2026",
            disaster_type="flood",
            status="active",
            region="Hyderabad Metro Area (simulated)",
            created_at=BASE_TIME,
            updated_at=TIME_STEPS[-1],
            is_demo=True,
        )
        db.add(event)
        db.flush()

        sensor_counter = 100
        weather_counter = 1
        incident_counter = 1
        image_counter = 1

        for zi, (name, lat, lon, sev, incidents) in enumerate(ZONE_DEFS, start=1):
            zone = Zone(
                zone_code=f"F-{zi:02d}",
                event_id=event.id,
                name=name,
                lat=lat,
                lon=lon,
                radius_m=700 + sev * 500,
                description=f"{name}: simulated flood-monitoring zone, target severity {sev:.2f} (demo).",
            )
            db.add(zone)
            db.flush()

            # ---- Weather readings across the day (>=2 per zone => 20+) ----
            weather_rows = []
            for si, ts in enumerate(TIME_STEPS):
                frac = si / (len(TIME_STEPS) - 1)
                wr = WeatherReading(
                    reading_code=f"W-{weather_counter:02d}",
                    zone_id=zone.id,
                    lat=lat + random.uniform(-0.003, 0.003),
                    lon=lon + random.uniform(-0.003, 0.003),
                    timestamp=ts,
                    rainfall_mm=max(0.0, _severity_to_rainfall(sev, frac)),
                    temperature_c=round(27 - sev * 2 + random.uniform(-1, 1), 1),
                    humidity_pct=round(65 + sev * 25 + random.uniform(-3, 3), 1),
                    wind_kmh=round(10 + sev * 20 + random.uniform(-3, 3), 1),
                    is_demo=True,
                )
                db.add(wr)
                weather_rows.append(wr)
                weather_counter += 1

            # ---- Sensor readings across the day ----
            sensor_rows = []
            prev_level = 0.5
            for si, ts in enumerate(TIME_STEPS):
                frac = si / (len(TIME_STEPS) - 1)
                level = max(0.2, _severity_to_water_level(sev, frac))
                change = round(level - prev_level, 2) if si > 0 else 0.0
                sr = SensorReading(
                    sensor_code=f"S-{sensor_counter}",
                    zone_id=zone.id,
                    lat=lat + random.uniform(-0.002, 0.002),
                    lon=lon + random.uniform(-0.002, 0.002),
                    timestamp=ts,
                    water_level_m=level,
                    change_m_per_hr=change,
                    is_demo=True,
                )
                db.add(sr)
                sensor_rows.append(sr)
                prev_level = level
                sensor_counter += 1

            # ---- Incident reports (only in back half of the day) ----
            incident_rows = []
            for j, text in enumerate(incidents):
                ts = TIME_STEPS[min(2 + j, len(TIME_STEPS) - 1)] + timedelta(minutes=random.randint(0, 50))
                ir = IncidentReport(
                    report_code=f"IR-{incident_counter:03d}",
                    zone_id=zone.id,
                    text=text,
                    timestamp=ts,
                    lat=lat + random.uniform(-0.004, 0.004),
                    lon=lon + random.uniform(-0.004, 0.004),
                    source=random.choice(["citizen_report", "field_team", "social_media"]),
                    is_demo=True,
                )
                db.add(ir)
                incident_rows.append(ir)
                incident_counter += 1

            # ---- Satellite tiles: one mid-day, one late-day for higher severity zones ----
            image_rows = []
            tile_times = [TIME_STEPS[2]] if sev < 0.5 else [TIME_STEPS[2], TIME_STEPS[4]]
            for ts in tile_times:
                fname = f"tile_{image_counter:03d}.png"
                fpath = os.path.join(SATELLITE_DIR, fname)
                ensure_tile_file(fpath, severity=sev, seed=1000 + image_counter)
                analysis = analyze_flood_tile(fpath)
                img = SatelliteImage(
                    image_code=f"IMG-{image_counter:03d}",
                    zone_id=zone.id,
                    lat=lat + random.uniform(-0.001, 0.001),
                    lon=lon + random.uniform(-0.001, 0.001),
                    timestamp=ts,
                    filename=f"satellite/{fname}",
                    flood_probability=analysis["flood_probability"],
                    analysis_confidence=analysis["analysis_confidence"],
                    is_demo=True,
                )
                db.add(img)
                image_rows.append(img)
                image_counter += 1

            db.flush()

            # ---- Run fusion at each timestep to build the timeline ----
            for si, ts in enumerate(TIME_STEPS):
                wr = weather_rows[si]
                sr = sensor_rows[si]
                # image evidence only "arrives" once a tile exists at/near this ts
                available_images = [im for im in image_rows if im.timestamp <= ts]
                img_ref = None
                img_score = None
                if available_images:
                    latest_img = available_images[-1]
                    img_ref = latest_img.image_code
                    img_score = latest_img.flood_probability
                available_incidents = [ir for ir in incident_rows if ir.timestamp <= ts]

                fusion_in = FusionInput(
                    zone_code=zone.zone_code,
                    image_score=img_score,
                    image_ref=img_ref,
                    rainfall_mm=wr.rainfall_mm,
                    rainfall_ref=wr.reading_code,
                    water_level_m=sr.water_level_m,
                    change_m_per_hr=sr.change_m_per_hr,
                    sensor_ref=sr.sensor_code,
                    incident_texts=[ir.text for ir in available_incidents],
                    incident_refs=[ir.report_code for ir in available_incidents],
                )
                result = run_fusion(fusion_in)

                latest_incident = available_incidents[-1] if available_incidents else None
                summary = build_summary(
                    zone_name=f"Zone {zone.zone_code}",
                    result=result,
                    rainfall_mm=wr.rainfall_mm,
                    water_level_m=sr.water_level_m,
                    change_m_per_hr=sr.change_m_per_hr,
                    latest_incident_text=latest_incident.text if latest_incident else None,
                    latest_incident_time=latest_incident.timestamp.strftime("%H:%M") if latest_incident else None,
                    image_ref=img_ref,
                    sensor_ref=sr.sensor_code,
                    weather_ref=wr.reading_code,
                    incident_ref=latest_incident.report_code if latest_incident else None,
                )

                det = Detection(
                    zone_id=zone.id,
                    timestamp=ts,
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

            # Seed a pending review row so the queue has something to act on.
            db.add(Review(zone_id=zone.id, status="pending", notes=""))

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
