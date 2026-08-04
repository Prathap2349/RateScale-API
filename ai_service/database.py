import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables from .env file
load_dotenv()

# Get Database URL from environment or default to IPv4 127.0.0.1 PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:5432/ratescale_db"
)

# SQLite fallback URL if user tests locally without PostgreSQL
SQLITE_FALLBACK_URL = "sqlite:///./ratescale_db.sqlite"

engine = None
SessionLocal = None
Base = declarative_base()

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print(f"[Database] SQLAlchemy engine initialized with URL: {DATABASE_URL}")
except Exception as e:
    print(f"[Database Warning] Unable to initialize engine for {DATABASE_URL}: {e}")
    # Fallback to SQLite
    engine = create_engine(SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
