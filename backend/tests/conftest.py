import sys
import os
import pytest

# Ensure standard test executions do not attempt connecting to live DB on lifespan
os.environ.setdefault("SKIP_STARTUP_DB_INIT", "1")

from fastapi.testclient import TestClient

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.main import app
from app.models.user import User
from app.auth import get_current_user

MOCK_ADMIN_USER = User(
    id="u1",
    name="Dr. S. Mehta",
    email="member-sec@aicte-india.org",
    role="Admin",
    designation="Member Secretary & System Admin",
    bureau="All",
    avatar_text="SM",
    phone="+91 11 2958 1000",
    status="Active",
    department="Executive Administration",
    password_hash="mock_hash",
)

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(autouse=True)
def default_auth_override():
    app.dependency_overrides[get_current_user] = lambda: MOCK_ADMIN_USER
    yield
    app.dependency_overrides.pop(get_current_user, None)
