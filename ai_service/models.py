import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class SimulationModel(Base):
    __tablename__ = "simulations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, default="usr-master-001")
    name = Column(String, nullable=False)
    test_type = Column(String, default="API_TRAFFIC")
    target_url = Column(String, nullable=False)
    http_method = Column(String, default="GET")
    concurrent_users = Column(Integer, default=50)
    requests_per_second = Column(Integer, default=200)
    duration_seconds = Column(Integer, default=60)
    traffic_pattern = Column(String, default="CONSTANT")
    status = Column(String, default="RUNNING")
    created_at = Column(String, default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    stopped_at = Column(String, nullable=True)

    results = relationship("SimulationResultModel", back_populates="simulation", cascade="all, delete-orphan")

class SimulationResultModel(Base):
    __tablename__ = "simulation_results"

    id = Column(String, primary_key=True, index=True)
    simulation_id = Column(String, ForeignKey("simulations.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(String, default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    latency_ms = Column(Float, default=0.0)
    p95_latency_ms = Column(Float, default=0.0)
    p99_latency_ms = Column(Float, default=0.0)
    throughput_rps = Column(Float, default=0.0)
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)
    error_rate_percent = Column(Float, default=0.0)
    success_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)

    simulation = relationship("SimulationModel", back_populates="results")

class RecommendationModel(Base):
    __tablename__ = "recommendations"

    id = Column(String, primary_key=True, index=True)
    simulation_id = Column(String, nullable=True)
    target_url = Column(String, nullable=False)
    recommended_rate_limit_rps = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    model_version = Column(String, default="v2.4-rf-regressor")
    applied = Column(Boolean, default=False)
    created_at = Column(String, default=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
