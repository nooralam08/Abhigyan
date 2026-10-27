from datetime import datetime, timedelta, timezone
from typing import List, Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.complaint import Complaint

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/login",
    auto_error=False
)

def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt with a generated salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token with expiration."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"iat": now, "exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency: Extract and verify the authenticated User from the Bearer JWT token.
    Raises HTTP 401 if token is missing, invalid, or expired.
    Raises HTTP 403 if user account is deactivated.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials in token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account does not exist or has been removed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status and user.status.lower() != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account '{user.name}' is currently {user.status} and cannot perform operations.",
        )

    return user

def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory: Ensure the authenticated user possesses one of the specified roles.
    """
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{current_user.role}' is not authorized. Permitted roles: {', '.join(allowed_roles)}.",
            )
        return current_user
    return role_dependency

def check_case_access(user: User, complaint: Complaint, action: str = "view") -> None:
    """
    Enforce fine-grained role-based and Bureau-scoped access control on a complaint case.
    Supported actions: 'view', 'update_status', 'assign', 'add_remark'.
    Raises HTTPException(403) on unauthorized attempts.
    """
    # 1. Complainant role enforcement: Must match authenticated complainant user ID or email
    if user.role == "Complainant":
        user_id_match = bool(
            getattr(complaint, "complainant_user_id", None)
            and complaint.complainant_user_id == user.id
        )
        user_email_match = bool(
            complaint.complainant_email
            and complaint.complainant_email.strip().lower() == user.email.strip().lower()
        )
        if not (user_id_match or user_email_match):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Complainants are only authorized to access complaints submitted by themselves.",
            )
        if action in ("view", "add_remark"):
            return
        elif action == "update_status":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Complainants cannot modify official docket status.",
            )
        elif action == "assign":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Complainants do not hold administrative case assignment permissions.",
            )

    # 2. Admin role: System-wide authority
    if user.role == "Admin":
        return

    # 3. BureauAdmin role: Scoped to their Bureau (or 'All')
    if user.role == "BureauAdmin":
        is_same_bureau = (user.bureau == "All" or complaint.bureau.upper() == user.bureau.upper())
        if not is_same_bureau:
            if action == "assign":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Bureau Admin is authorized only for {user.bureau} cases. Docket {complaint.id} belongs to {complaint.bureau}.",
                )
            elif action == "update_status":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Docket belongs to {complaint.bureau}; your administrative jurisdiction is {user.bureau}.",
                )
            elif action == "add_remark":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Docket belongs to {complaint.bureau}; your administrative jurisdiction is {user.bureau}.",
                )
            else: # view
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Case belongs to {complaint.bureau}; your administrative jurisdiction is {user.bureau}.",
                )
        return

    # 4. Officer role: Scoped strictly to cases explicitly assigned to that officer
    if user.role == "Officer":
        if action == "assign":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Handling Officers cannot directly reassign cases. Submit an explicit reassignment request through the workflow.",
            )

        if complaint.assigned_user_id:
            is_assigned = (complaint.assigned_user_id == user.id)
        else:
            is_assigned = bool(complaint.officer and complaint.officer.strip().lower() == user.name.strip().lower())

        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Restricted: Handling Officer is neither assigned to docket {complaint.id} nor authorized to access unassigned cases.",
            )
        return

    # Unrecognized role
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access forbidden: Unrecognized user role '{user.role}'.",
    )

