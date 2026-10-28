import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from sqlalchemy.engine import URL, make_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql://postgres:YOUR-PASSWORD@YOUR-SUPABASE-HOST:5432/postgres?sslmode=require",
        description="Supabase PostgreSQL connection URL from the project Connect dialog"
    )
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:4173,https://abhigyann.vercel.app",
        description="Comma-separated allowed CORS origins"
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Application Environment"
    )
    API_PREFIX: str = Field(
        default="/api",
        description="Base API path prefix"
    )
    JWT_SECRET_KEY: str = Field(
        default="abhigyan-development-insecure-secret-key-change-in-prod-2026",
        description="Secret key for JWT token signing"
    )
    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="JWT hashing algorithm"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=120,
        description="Token lifetime in minutes"
    )
    DEMO_AUTH_ENABLED: bool = Field(
        default=True,
        description="Enable development-only demo-login flow. Must be False in production."
    )
    DEFAULT_SEED_PASSWORD: str = Field(
        default="AicteDemo@2026",
        description="Default initial password for seeded demo accounts"
    )

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(ROOT_DIR, ".env"),
            os.path.join(BASE_DIR, ".env"),
            ".env",
            "backend/.env",
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def sqlalchemy_database_url(self) -> URL:
        """Return a SQLAlchemy URL using psycopg2 and encrypted PostgreSQL transport."""
        url = make_url(self.DATABASE_URL)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+psycopg2")
        elif url.drivername == "sqlite" or url.drivername.startswith("sqlite"):
            return url
        elif url.drivername != "postgresql+psycopg2":
            raise ValueError("DATABASE_URL must use PostgreSQL (postgresql:// or postgresql+psycopg2://).")

        query = dict(url.query)
        # Remote Supabase connections require SSL (sslmode=require).
        # Local development and test suites against localhost loopback default to sslmode=disable unless explicitly set.
        is_local = (url.host or "").lower() in {"localhost", "127.0.0.1", "::1"}
        query.setdefault("sslmode", "disable" if is_local else "require")
        return url.set(query=query)

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
