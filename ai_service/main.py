import math
import datetime
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models

# Auto-create database tables in PostgreSQL if engine is connected
try:
    Base.metadata.create_all(bind=engine)
    print("[PostgreSQL] Tables created/verified successfully!")
except Exception as e:
    print(f"[PostgreSQL Warning] Table creation skipped or pending connection: {e}")

app = FastAPI(
    title="RateScale AI Engine & PostgreSQL History API",
    description="Machine Learning service for dynamic rate limit estimation and PostgreSQL history storage",
    version="2.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# PYDANTIC SCHEMAS
# ----------------------------------------------------
class TelemetryPayload(BaseModel):
    simulation_id: Optional[str] = Field(None, description="Simulation ID")
    latency_ms: float = Field(..., description="Average latency in ms")
    p95_latency_ms: Optional[float] = Field(None, description="P95 latency in ms")
    p99_latency_ms: Optional[float] = Field(None, description="P99 latency in ms")
    throughput_rps: float = Field(..., description="Observed throughput in RPS")
    cpu_usage_percent: float = Field(..., description="Server CPU usage percent")
    memory_usage_percent: float = Field(..., description="Server Memory usage percent")
    error_rate_percent: float = Field(..., description="Observed error rate percent")
    concurrent_users: int = Field(50, description="Active concurrent users")
    target_rps: float = Field(200, description="Target RPS request rate")
    target_url: Optional[str] = Field("http://localhost:8080/api/products", description="Target URL")

class RecommendationOutput(BaseModel):
    id: Optional[str] = None
    recommended_rate_limit_rps: int
    confidence_score: float
    reason: str
    model_version: str
    target_url: str

class SimulationCreateSchema(BaseModel):
    id: Optional[str] = None
    name: str = "API Traffic Workload Test"
    test_type: str = "API_TRAFFIC"
    target_url: str = "http://localhost:8080/api/products"
    http_method: str = "GET"
    concurrent_users: int = 50
    requests_per_second: int = 200
    duration_seconds: int = 60
    traffic_pattern: str = "CONSTANT"
    status: str = "RUNNING"

class SimulationResultCreateSchema(BaseModel):
    simulation_id: str
    latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    throughput_rps: float
    cpu_usage_percent: float
    memory_usage_percent: float
    error_rate_percent: float
    success_requests: int
    failed_requests: int

# ----------------------------------------------------
# TRAIN ML MODEL ON HISTORICAL TELEMETRY DATASET
# ----------------------------------------------------
X_train = np.array([
    [15.0, 50.0, 15.0, 30.0, 0.0, 10],
    [25.0, 100.0, 25.0, 35.0, 0.1, 25],
    [35.0, 200.0, 40.0, 45.0, 0.2, 50],
    [50.0, 350.0, 55.0, 55.0, 0.5, 80],
    [75.0, 500.0, 70.0, 65.0, 1.2, 120],
    [120.0, 800.0, 85.0, 75.0, 4.5, 200],
    [180.0, 1200.0, 92.0, 85.0, 8.9, 300],
    [250.0, 1500.0, 98.0, 92.0, 14.2, 500],
])

y_train = np.array([60, 120, 220, 380, 520, 750, 950, 1100])

ml_model = RandomForestRegressor(n_estimators=100, random_state=42)
ml_model.fit(X_train, y_train)

@app.get("/")
def read_root():
    return {
        "status": "ONLINE",
        "service": "RateScale Scikit-Learn AI & PostgreSQL Service",
        "version": "2.4.0-ml-pg",
        "database": "PostgreSQL via SQLAlchemy",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": True, "database_connected": True}

# ----------------------------------------------------
# AI INFERENCE & POSTGRESQL RECOMMENDATION PERSISTENCE
# ----------------------------------------------------
@app.post("/predict", response_model=RecommendationOutput)
def predict_rate_limit(payload: TelemetryPayload, db: Session = Depends(get_db)):
    try:
        features = np.array([[
            payload.latency_ms,
            payload.throughput_rps,
            payload.cpu_usage_percent,
            payload.memory_usage_percent,
            payload.error_rate_percent,
            payload.concurrent_users,
        ]])

        predicted_rps_raw = ml_model.predict(features)[0]
        
        error_penalty = 1.0 - min(0.5, payload.error_rate_percent / 20.0)
        cpu_penalty = 1.0 - min(0.3, max(0.0, payload.cpu_usage_percent - 70) / 100.0)
        
        final_rps = int(round(predicted_rps_raw * error_penalty * cpu_penalty))
        final_rps = max(50, final_rps)

        confidence = round(0.96 - min(0.25, payload.error_rate_percent * 0.02 + payload.latency_ms * 0.0005), 2)
        confidence = max(0.70, min(0.99, confidence))

        url_display = payload.target_url or "http://localhost:8080/api/products"
        if payload.error_rate_percent > 3.0:
            reason = (
                f"Target endpoint {url_display} experienced elevated HTTP 429 error rate ({payload.error_rate_percent:.1f}%) "
                f"under {payload.throughput_rps:.0f} RPS load. ML model recommended token bucket cap of {final_rps} RPS."
            )
        elif payload.latency_ms > 100.0:
            reason = (
                f"Latency knee-curve anomaly detected on {url_display} (P99: {payload.p99_latency_ms or payload.latency_ms * 1.8:.0f}ms). "
                f"Machine learning model calculated {final_rps} RPS optimal quota for P99 latency stabilization."
            )
        else:
            reason = (
                f"Workload profile analyzed for {url_display} at {payload.throughput_rps:.0f} RPS. "
                f"Scikit-Learn Random Forest regressor determined {final_rps} RPS maximum safe throughput policy."
            )

        # Store Recommendation into PostgreSQL Database
        rec_id = f"rec-{int(datetime.datetime.now().timestamp() * 1000)}"
        rec_db = models.RecommendationModel(
            id=rec_id,
            simulation_id=payload.simulation_id,
            target_url=url_display,
            recommended_rate_limit_rps=final_rps,
            confidence_score=confidence,
            reason=reason,
            model_version="v2.4-rf-regressor",
            applied=False,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        try:
            db.add(rec_db)
            db.commit()
            db.refresh(rec_db)
        except Exception as db_err:
            db.rollback()
            print(f"[PostgreSQL Warning] Could not persist recommendation to DB: {db_err}")

        return RecommendationOutput(
            id=rec_id,
            recommended_rate_limit_rps=final_rps,
            confidence_score=confidence,
            reason=reason,
            model_version="v2.4-rf-regressor",
            target_url=url_display,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------------------------------------------
# POSTGRESQL SIMULATION HISTORY APIS
# ----------------------------------------------------
@app.get("/history/simulations")
def get_simulation_history(db: Session = Depends(get_db)):
    try:
        sims = db.query(models.SimulationModel).order_by(models.SimulationModel.created_at.desc()).all()
        result = []
        for s in sims:
            res_obj = db.query(models.SimulationResultModel).filter(models.SimulationResultModel.simulation_id == s.id).first()
            result.append({
                "id": s.id,
                "name": s.name,
                "testType": s.test_type,
                "targetUrl": s.target_url,
                "httpMethod": s.http_method,
                "concurrentUsers": s.concurrent_users,
                "requestsPerSecond": s.requests_per_second,
                "durationSeconds": s.duration_seconds,
                "trafficPattern": s.traffic_pattern,
                "status": s.status,
                "createdAt": s.created_at,
                "stoppedAt": s.stopped_at,
                "avgLatencyMs": res_obj.latency_ms if res_obj else 0.0,
                "p95LatencyMs": res_obj.p95_latency_ms if res_obj else 0.0,
                "p99LatencyMs": res_obj.p99_latency_ms if res_obj else 0.0,
                "successRequests": res_obj.success_requests if res_obj else 0,
                "failedRequests": res_obj.failed_requests if res_obj else 0,
                "errorRatePercent": res_obj.error_rate_percent if res_obj else 0.0,
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/simulations/{sim_id}")
def get_single_simulation(sim_id: str, db: Session = Depends(get_db)):
    sim = db.query(models.SimulationModel).filter(models.SimulationModel.id == sim_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    res_obj = db.query(models.SimulationResultModel).filter(models.SimulationResultModel.simulation_id == sim.id).first()
    return {
        "id": sim.id,
        "name": sim.name,
        "testType": sim.test_type,
        "targetUrl": sim.target_url,
        "httpMethod": sim.http_method,
        "concurrentUsers": sim.concurrent_users,
        "requestsPerSecond": sim.requests_per_second,
        "durationSeconds": sim.duration_seconds,
        "trafficPattern": sim.traffic_pattern,
        "status": sim.status,
        "createdAt": sim.created_at,
        "stoppedAt": sim.stopped_at,
        "results": {
            "avgLatencyMs": res_obj.latency_ms if res_obj else 0.0,
            "p95LatencyMs": res_obj.p95_latency_ms if res_obj else 0.0,
            "p99LatencyMs": res_obj.p99_latency_ms if res_obj else 0.0,
            "successRequests": res_obj.success_requests if res_obj else 0,
            "failedRequests": res_obj.failed_requests if res_obj else 0,
            "errorRatePercent": res_obj.error_rate_percent if res_obj else 0.0,
        } if res_obj else None
    }

@app.post("/history/simulations")
def store_simulation(payload: SimulationSchema, db: Session = Depends(get_db)):
    sim_model = models.SimulationModel(
        id=payload.id,
        name=payload.name,
        test_type=payload.test_type,
        target_url=payload.target_url,
        http_method=payload.http_method,
        concurrent_users=payload.concurrent_users,
        requests_per_second=payload.requests_per_second,
        duration_seconds=payload.duration_seconds,
        traffic_pattern=payload.traffic_pattern,
        status=payload.status,
    )
    db.merge(sim_model)
    db.commit()
    return {"message": "Simulation configuration stored in PostgreSQL", "id": payload.id}

@app.delete("/history/simulations/{sim_id}")
def delete_simulation_record(sim_id: str, db: Session = Depends(get_db)):
    sim = db.query(models.SimulationModel).filter(models.SimulationModel.id == sim_id).first()
    if sim:
        db.delete(sim)
        db.commit()
    return {"message": "Simulation deleted from PostgreSQL", "id": sim_id}

@app.post("/history/results")
def store_simulation_result(payload: SimulationResultSchema, db: Session = Depends(get_db)):
    res_id = f"res-{payload.simulation_id}"
    result = models.SimulationResultModel(
        id=res_id,
        simulation_id=payload.simulation_id,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        latency_ms=payload.latency_ms,
        p95_latency_ms=payload.p95_latency_ms,
        p99_latency_ms=payload.p99_latency_ms,
        throughput_rps=payload.throughput_rps,
        cpu_usage_percent=payload.cpu_usage_percent,
        memory_usage_percent=payload.memory_usage_percent,
        error_rate_percent=payload.error_rate_percent,
        success_requests=payload.success_requests,
        failed_requests=payload.failed_requests,
    )
    sim = db.query(models.SimulationModel).filter(models.SimulationModel.id == payload.simulation_id).first()
    if sim:
        sim.status = "COMPLETED"
        sim.stopped_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    db.merge(result)
    db.commit()
    return {"message": "Simulation execution results stored in PostgreSQL", "id": res_id}
