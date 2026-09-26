import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.services.seed_data import seed

app = FastAPI(
    title="Disaster Intelligence & Human Review Platform API",
    description=(
        "Decision-support API for simulated flood impact assessment. "
        "This system NEVER makes autonomous operational decisions - every "
        "result requires human review."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(os.path.join(DATA_DIR, "satellite"), exist_ok=True)
app.mount("/static", StaticFiles(directory=DATA_DIR), name="static")


@app.on_event("startup")
def on_startup():
    seed()


@app.get("/")
def root():
    return {
        "service": "Disaster Intelligence & Human Review Platform",
        "status": "ok",
        "notice": "Decision-support only. Human review required before any operational action.",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
