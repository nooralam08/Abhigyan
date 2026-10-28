import sys
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers.health import router as health_router
from app.routers.institutions import router as institutions_router
from app.routers.complaints import router as complaints_router
from app.routers.auth import router as auth_router
from app.routers.overlaps import router as overlaps_router
from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.routers.analytics import router as analytics_router

logger = logging.getLogger("abhigyan.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler: automatically verifies connectivity, runs Alembic migrations
    to head, and ensures required tables and baseline seed data exist on container startup.
    """
    import os
    if os.environ.get("SKIP_STARTUP_DB_INIT") == "1":
        logger.info("Startup database initialization skipped via SKIP_STARTUP_DB_INIT")
        yield
        return

    try:
        from app.init_db import init_database
        logger.info("Verifying and initializing database schema on startup...")
        init_database(seed=True, raise_on_error=False)
    except Exception as exc:
        logger.warning("Startup database initialization notification: %s", exc)
    yield


is_testing = "pytest" in sys.modules or os.environ.get("TESTING") == "1"

app = FastAPI(
    title="Abhigyan AICTE Complaint Monitoring & Tracking API",
    description="Backend API for AICTE Institution Complaint Monitoring, SLA Surveillance & Cross-Bureau Redressal",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=None if is_testing else lifespan,
)

# Configure CORS for local Vite development and preview servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under configured API prefix (/api)
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(users_router, prefix=settings.API_PREFIX)
app.include_router(institutions_router, prefix=settings.API_PREFIX)
app.include_router(complaints_router, prefix=settings.API_PREFIX)
app.include_router(overlaps_router, prefix=settings.API_PREFIX)
app.include_router(settings_router, prefix=settings.API_PREFIX)
app.include_router(analytics_router, prefix=settings.API_PREFIX)

@app.get("/", tags=["Root"])
def root():
    return {
        "service": "Abhigyan Complaint Monitoring API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "institutions": f"{settings.API_PREFIX}/institutions",
        "complaints": f"{settings.API_PREFIX}/complaints",
        "users": f"{settings.API_PREFIX}/users",
        "analytics": f"{settings.API_PREFIX}/analytics",
    }
