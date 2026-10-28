"""
Abhigyan Production Database Initialization & Migration Engine.
Applies Alembic schema migrations and ensures required database tables and essential seed data exist.
Safe and idempotent: never drops tables or overwrites existing production records.
"""

import logging
import os
import sys
from typing import Dict, Any, Optional

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from alembic.config import Config
from alembic import command

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.config import settings
from app.models.base import Base
from app.models.user import User
from app.models.institution import Institution
from app.models.complaint import Complaint
from app.models.timeline import ComplaintTimeline
from app.models.overlap import ComplaintOverlap, ComplaintOverlapHistory
from app.models.setting import SystemSetting
from app.seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("abhigyan.init_db")

REQUIRED_TABLES = {
    "users",
    "institutions",
    "complaints",
    "complaint_timelines",
    "complaint_overlaps",
    "complaint_overlap_history",
    "system_settings",
}


def is_placeholder_url(url_str: str) -> bool:
    """Check if the configured database URL contains template placeholders."""
    markers = ("YOUR-PASSWORD", "YOUR-SUPABASE-HOST", "YOUR-POOLER-HOST", "PROJECT-REF")
    return any(marker in url_str for marker in markers)


def run_alembic_migrations(target_engine=None) -> None:
    """Run Alembic migrations up to head programmatically."""
    ini_path = os.path.join(BASE_DIR, "alembic.ini")
    script_location = os.path.join(BASE_DIR, "alembic")

    if not os.path.exists(ini_path):
        raise FileNotFoundError(f"Alembic configuration not found at {ini_path}")

    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", script_location)
    # configparser requires escaping '%' as '%%' to prevent BasicInterpolation errors
    safe_url = str(settings.sqlalchemy_database_url).replace("%", "%%")
    alembic_cfg.set_main_option("sqlalchemy.url", safe_url)

    logger.info("Executing Alembic migrations (upgrade head)...")
    if target_engine is not None:
        with target_engine.connect() as conn:
            alembic_cfg.attributes["connection"] = conn
            command.upgrade(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")


def verify_and_ensure_tables(target_engine) -> Dict[str, Any]:
    """
    Inspect existing tables. If any required model tables are missing despite migrations,
    apply Base.metadata.create_all as a non-destructive safeguard.
    """
    inspector = inspect(target_engine)
    existing_tables = set(inspector.get_table_names())
    missing = REQUIRED_TABLES - existing_tables

    if missing:
        logger.warning("Tables missing after migration attempt: %s. Applying Base.metadata.create_all...", missing)
        Base.metadata.create_all(bind=target_engine)
        inspector = inspect(target_engine)
        existing_tables = set(inspector.get_table_names())

    return {
        "existing_tables": sorted(list(existing_tables)),
        "all_required_present": REQUIRED_TABLES.issubset(existing_tables),
    }


def seed_if_empty(session: Session) -> Dict[str, int]:
    """
    Check if users table is empty. If empty or partially populated, run idempotent seed.
    Guarantees that default administrative users and system settings exist so login works.
    """
    user_count = session.query(User).count()
    inst_count = session.query(Institution).count()
    setting_count = session.query(SystemSetting).count()

    logger.info(
        "Current record counts - Users: %d, Institutions: %d, Settings: %d",
        user_count,
        inst_count,
        setting_count,
    )

    if user_count == 0 or setting_count == 0 or inst_count == 0:
        logger.info("Essential baseline records missing. Executing idempotent seed_demo_data...")
        seed_demo_data(session)
        user_count = session.query(User).count()
        inst_count = session.query(Institution).count()
        setting_count = session.query(SystemSetting).count()

    return {
        "users": user_count,
        "institutions": inst_count,
        "settings": setting_count,
    }


def init_database(
    target_engine=None,
    seed: bool = True,
    raise_on_error: bool = False,
) -> Dict[str, Any]:
    """
    Main database initialization entrypoint:
    1. Validates connection parameters.
    2. Runs Alembic migrations to head.
    3. Confirms table presence (including 'users').
    4. Seeds baseline administrative accounts and settings if not present.
    """
    db_url_str = str(settings.DATABASE_URL)
    if is_placeholder_url(db_url_str):
        msg = "DATABASE_URL contains unconfigured template placeholders. Skipping database migration."
        logger.warning(msg)
        if raise_on_error:
            raise ValueError(msg)
        return {"status": "skipped", "reason": "placeholder_detected"}

    created_internal_engine = False
    if target_engine is None:
        try:
            db_url_obj = settings.sqlalchemy_database_url
            engine_kwargs = {"pool_pre_ping": True}
            if db_url_obj.drivername.startswith("postgresql"):
                engine_kwargs.update({
                    "pool_size": 3,
                    "max_overflow": 2,
                    "connect_args": {"connect_timeout": 5},
                })
            target_engine = create_engine(db_url_obj, **engine_kwargs)
            created_internal_engine = True
        except Exception as exc:
            logger.error("Failed to create engine: %s", exc)
            if raise_on_error:
                raise
            return {"status": "error", "error": str(exc)}

    try:
        # Test basic connection first
        with target_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to database.")

        # 1. Run Alembic migrations
        run_alembic_migrations(target_engine)

        # 2. Verify all required tables exist
        table_status = verify_and_ensure_tables(target_engine)
        if not table_status["all_required_present"]:
            raise RuntimeError(f"Database initialization failed to create required tables: {REQUIRED_TABLES}")

        # 3. Seed baseline records if needed
        counts = {}
        if seed:
            SessionMaker = sessionmaker(bind=target_engine, autocommit=False, autoflush=False)
            with SessionMaker() as session:
                counts = seed_if_empty(session)

        logger.info("Database successfully initialized. Tables: %s", table_status["existing_tables"])
        return {
            "status": "success",
            "tables": table_status["existing_tables"],
            "counts": counts,
        }

    except Exception as exc:
        logger.error("Database initialization failed: %s", exc, exc_info=True)
        if raise_on_error:
            raise
        return {"status": "error", "error": str(exc)}
    finally:
        if created_internal_engine and target_engine is not None:
            target_engine.dispose()


if __name__ == "__main__":
    logger.info("Running standalone database initialization...")
    result = init_database(raise_on_error=True)
    logger.info("Result: %s", result)
    sys.exit(0 if result.get("status") == "success" else 1)
