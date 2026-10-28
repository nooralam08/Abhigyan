"""
Unit and integration tests for database initialization, Alembic migration execution,
and schema verification for production Render/Supabase deployments.
"""

import os
import tempfile
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.init_db import (
    init_database,
    is_placeholder_url,
    REQUIRED_TABLES,
    verify_and_ensure_tables,
)
from app.models.user import User
from app.models.institution import Institution
from app.models.setting import SystemSetting
from app.config import settings


@pytest.fixture
def temp_sqlite_db():
    """Create a temporary SQLite database file for testing migration execution."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_url = f"sqlite:///{path}"
    engine = create_engine(db_url)
    
    yield engine, path, db_url
    
    engine.dispose()
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def test_is_placeholder_url():
    """Verify detection of unconfigured placeholder database URLs."""
    assert is_placeholder_url("postgresql://postgres.PROJECT-REF:YOUR-PASSWORD@YOUR-POOLER-HOST:5432/postgres")
    assert is_placeholder_url("postgresql://postgres:YOUR-PASSWORD@localhost:5432/db")
    assert not is_placeholder_url("postgresql://postgres:SecretPassword123@db.supabase.co:5432/postgres")
    assert not is_placeholder_url("sqlite:///test.db")


def test_init_database_on_clean_db(temp_sqlite_db):
    """
    Verify that init_database executes the complete Alembic migration sequence
    from 001_initial to 007_add_complainant_user_id and creates all required tables.
    """
    engine, path, db_url = temp_sqlite_db

    # Initially empty database
    inspector = inspect(engine)
    assert len(inspector.get_table_names()) == 0

    # Execute initialization
    saved_url = settings.DATABASE_URL
    try:
        settings.DATABASE_URL = db_url
        result = init_database(target_engine=engine, seed=True, raise_on_error=True)
    finally:
        settings.DATABASE_URL = saved_url

    assert result["status"] == "success"

    # Verify all required tables are present
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for req_table in REQUIRED_TABLES:
        assert req_table in tables, f"Expected table '{req_table}' was not created by migrations."

    # Verify 'users' table columns
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    assert "id" in user_columns
    assert "name" in user_columns
    assert "email" in user_columns
    assert "role" in user_columns
    assert "password_hash" in user_columns

    # Verify 'complaints' table has added migration columns
    complaint_columns = {col["name"] for col in inspector.get_columns("complaints")}
    assert "complainant_user_id" in complaint_columns
    assert "ai_predicted_category" in complaint_columns

    # Verify baseline seeding populated users and settings
    SessionMaker = sessionmaker(bind=engine)
    with SessionMaker() as session:
        user_count = session.query(User).count()
        assert user_count > 0, "Users table should be seeded with initial baseline accounts."

        # Verify default admin account exists
        admin = session.query(User).filter(User.email == "member-sec@aicte-india.org").first()
        assert admin is not None
        assert admin.role == "Admin"
        assert admin.password_hash is not None

        # Verify global system settings exist
        global_setting = session.query(SystemSetting).filter(SystemSetting.key == "global").first()
        assert global_setting is not None
        assert global_setting.similarity_threshold == 75


def test_init_database_idempotency(temp_sqlite_db):
    """
    Verify that running init_database multiple times is completely idempotent
    and does not produce duplicate rows or schema mutation errors.
    """
    engine, path, db_url = temp_sqlite_db

    saved_url = settings.DATABASE_URL
    try:
        settings.DATABASE_URL = db_url
        result_1 = init_database(target_engine=engine, seed=True, raise_on_error=True)
        assert result_1["status"] == "success"

        SessionMaker = sessionmaker(bind=engine)
        with SessionMaker() as session:
            count_after_first = session.query(User).count()

        # Run initialization a second time
        result_2 = init_database(target_engine=engine, seed=True, raise_on_error=True)
        assert result_2["status"] == "success"

        with SessionMaker() as session:
            count_after_second = session.query(User).count()

        assert count_after_first == count_after_second, "Second initialization must not duplicate records."

    finally:
        settings.DATABASE_URL = saved_url


def test_init_database_handles_placeholder():
    """Verify that placeholder database URLs are safely skipped without throwing unhandled exceptions."""
    saved_url = settings.DATABASE_URL
    try:
        settings.DATABASE_URL = "postgresql://postgres:YOUR-PASSWORD@YOUR-SUPABASE-HOST:5432/postgres"
        result = init_database(raise_on_error=False)
        assert result["status"] == "skipped"
        assert result["reason"] == "placeholder_detected"

        with pytest.raises(ValueError):
            init_database(raise_on_error=True)
    finally:
        settings.DATABASE_URL = saved_url


def test_verify_and_ensure_tables_fallback(temp_sqlite_db):
    """Test that verify_and_ensure_tables creates missing tables via Base.metadata if needed."""
    engine, path, db_url = temp_sqlite_db

    # Fresh DB with no tables
    status = verify_and_ensure_tables(engine)
    assert status["all_required_present"] is True

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for req in REQUIRED_TABLES:
        assert req in tables


def test_check_database_connection_diagnostics(temp_sqlite_db):
    """Verify check_database_connection correctly diagnoses empty vs initialized schema."""
    from check_db import check_database_connection
    engine, path, db_url = temp_sqlite_db

    saved_url = settings.DATABASE_URL
    try:
        settings.DATABASE_URL = db_url

        # Empty database: check_db should report False (tables missing)
        assert check_database_connection(exit_on_error=False) is False

        # Initialize schema
        init_database(target_engine=engine, seed=True, raise_on_error=True)

        # Initialized database: check_db should report True (healthy)
        assert check_database_connection(exit_on_error=False) is True
    finally:
        settings.DATABASE_URL = saved_url


def test_fastapi_lifespan_integration(temp_sqlite_db):
    """Verify that FastAPI lifespan hook invokes database initialization cleanly."""
    from app.main import lifespan, app
    engine, path, db_url = temp_sqlite_db

    saved_url = settings.DATABASE_URL
    saved_skip = os.environ.get("SKIP_STARTUP_DB_INIT")
    os.environ.pop("SKIP_STARTUP_DB_INIT", None)
    try:
        settings.DATABASE_URL = db_url
        cm = lifespan(app)
        try:
            cm.__aenter__().send(None)
        except StopIteration:
            pass
        # Inspect that tables were created during lifespan startup
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert "users" in tables
        assert "complaints" in tables
        try:
            cm.__aexit__(None, None, None).send(None)
        except StopIteration:
            pass
    finally:
        settings.DATABASE_URL = saved_url
        if saved_skip is not None:
            os.environ["SKIP_STARTUP_DB_INIT"] = saved_skip

