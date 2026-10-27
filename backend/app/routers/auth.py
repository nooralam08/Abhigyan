import uuid
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.complaint import Complaint
from app.schemas.auth import LoginRequest, DemoLoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserProfileRead
from app.auth import (
    create_access_token,
    verify_password,
    hash_password,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_user_profile_read(user: User, db: Session) -> UserProfileRead:
    """Build UserProfileRead schema including current active assigned cases count."""
    active_count = db.query(func.count(Complaint.id)).filter(
        or_(
            Complaint.assigned_user_id == user.id,
            and_(Complaint.assigned_user_id.is_(None), func.lower(Complaint.officer) == func.lower(user.name))
        ),
        Complaint.status != "Resolved"
    ).scalar() or 0

    return UserProfileRead(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        designation=user.designation,
        bureau=user.bureau,
        avatarText=user.avatar_text,
        phone=user.phone or "",
        status=user.status,
        department=user.department,
        activeCasesCount=active_count,
    )

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user using their email and password.
    Returns a signed JWT bearer token and user profile.
    """
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status and user.status.lower() != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account '{user.name}' is currently {user.status}. Please contact the administrator.",
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has no credentials configured. Please contact administrator or use demo login in development.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_claims = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "bureau": user.bureau,
        "name": user.name,
    }
    access_token = create_access_token(data=token_claims, expires_delta=expires_delta)

    return TokenResponse(
        accessToken=access_token,
        tokenType="bearer",
        expiresIn=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=get_user_profile_read(user, db),
    )

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Public registration endpoint for Complainants (citizens/students/faculty/parents).
    The server strictly forces role="Complainant", status="Active", and bureau="All".
    Client-supplied role or bureau fields are never accepted, preventing privilege escalation.
    Hashes password via bcrypt and returns a signed JWT token and user profile for immediate login.
    """
    email_clean = payload.email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{email_clean}' is already registered.",
        )

    # Compute avatar initials from name
    name_parts = payload.name.strip().split()
    if len(name_parts) >= 2:
        avatar_text = (name_parts[0][0] + name_parts[-1][0]).upper()
    elif len(name_parts) == 1 and len(name_parts[0]) >= 2:
        avatar_text = name_parts[0][:2].upper()
    else:
        avatar_text = "CP"

    user_id = f"c-{uuid.uuid4().hex[:12]}"
    complainant_type = payload.complainantType or "General Public"

    new_user = User(
        id=user_id,
        name=payload.name.strip(),
        email=email_clean,
        role="Complainant",  # Strictly server-assigned
        designation=f"{complainant_type} Complainant",
        bureau="All",
        avatar_text=avatar_text,
        phone=payload.phone.strip() if payload.phone else "",
        status="Active",
        department="Complainant / Citizen Portal",
        password_hash=hash_password(payload.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_claims = {
        "sub": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "bureau": new_user.bureau,
        "name": new_user.name,
    }
    access_token = create_access_token(data=token_claims, expires_delta=expires_delta)

    return TokenResponse(
        accessToken=access_token,
        tokenType="bearer",
        expiresIn=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=get_user_profile_read(new_user, db),
    )

@router.post("/demo-login", response_model=TokenResponse)
def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)):
    """
    Development-only demo login flow.
    Strictly isolated and disabled when DEMO_AUTH_ENABLED is False or environment is production.
    Resolves existing active users from the database.
    """
    if not settings.DEMO_AUTH_ENABLED or settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo authentication is disabled in this environment. Standard credentials login is required.",
        )

    user: Optional[User] = None

    if payload.userId and payload.userId.strip():
        user = db.query(User).filter(User.id == payload.userId.strip()).first()
    elif payload.email and payload.email.strip():
        user = db.query(User).filter(func.lower(User.email) == payload.email.strip().lower()).first()
    elif payload.role and payload.role.strip():
        target_role = payload.role.strip()
        user = db.query(User).filter(
            User.role.ilike(target_role),
            User.status == "Active",
            User.id.like("u%")
        ).order_by(User.id.asc()).first()
        if not user:
            user = db.query(User).filter(
                User.role.ilike(target_role),
                User.status == "Active"
            ).order_by(User.id.asc()).first()
    else:
        # Default to primary admin profile if no specific user requested
        user = db.query(User).filter(User.role == "Admin", User.status == "Active").first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified demo user profile does not exist in the database.",
        )

    if user.status and user.status.lower() != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account '{user.name}' is currently {user.status} and cannot be logged in.",
        )

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_claims = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "bureau": user.bureau,
        "name": user.name,
    }
    access_token = create_access_token(data=token_claims, expires_delta=expires_delta)

    return TokenResponse(
        accessToken=access_token,
        tokenType="bearer",
        expiresIn=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=get_user_profile_read(user, db),
    )

@router.get("/me", response_model=UserProfileRead)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return profile information for the currently authenticated user.
    """
    return get_user_profile_read(current_user, db)
