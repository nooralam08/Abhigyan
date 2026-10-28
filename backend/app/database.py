from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings

db_url_obj = settings.sqlalchemy_database_url
engine_kwargs = {
    "pool_pre_ping": True,
    "echo": (settings.ENVIRONMENT == "development"),
}
if db_url_obj.drivername.startswith("postgresql"):
    engine_kwargs.update({
        "pool_recycle": 1800,
        "pool_size": 5,
        "max_overflow": 5,
    })

engine = create_engine(db_url_obj, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
