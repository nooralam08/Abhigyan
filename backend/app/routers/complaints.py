import logging
import math
import random
import threading
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_

status = http_status

from app.database import get_db
from app.models.complaint import Complaint
from app.models.institution import Institution
from app.models.user import User
from app.models.timeline import ComplaintTimeline
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintRead,
    ComplaintListResponse,
    ComplaintStatusUpdate,
    ComplaintAssignmentUpdate,
    TimelineNoteCreate,
    ComplaintClassifyRequest,
    ComplaintClassifyResponse,
)
from app.schemas.timeline import TimelineEventRead
from app.auth import get_current_user, check_case_access
from app.services.ai_classifier import classify_complaint

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/complaints", tags=["Complaints"])

# Permitted status transitions per workflow rules (AICTE Complaint Lifecycle)
PERMITTED_STATUS_TRANSITIONS = {
    "Pending": ["In Progress", "Escalated"],
    "In Progress": ["Escalated", "Resolved"],
    "Escalated": ["In Progress", "Resolved"],
    "Resolved": [],
}

def get_sla_days(priority: str, db: Optional[Session] = None) -> int:
    p = priority.lower()
    if db is not None:
        try:
            from app.models.setting import SystemSetting
            setting = db.query(SystemSetting).filter(SystemSetting.key == "global").first()
            if setting:
                if p == "critical":
                    return max(1, setting.sla_critical)
                elif p == "high":
                    return max(1, setting.sla_high)
                elif p == "medium":
                    return max(1, setting.sla_medium)
                elif p == "low":
                    return max(setting.sla_medium + 7, 21)
        except Exception:
            pass

    if p == "critical":
        return 3
    elif p == "high":
        return 7
    elif p == "medium":
        return 14
    elif p == "low":
        return 21
    return 14

_assignment_lock = threading.Lock()

def assign_least_loaded_officer(db: Session, bureau: str) -> Optional[User]:
    """
    Select an eligible active handling officer using least-loaded assignment.
    1. Filter users with role='Officer', status='Active', and bureau matching complaint's bureau (or 'All').
    2. Count currently assigned, unresolved complaints (status != 'Resolved') for each eligible officer.
    3. Choose the officer with the lowest workload.
    4. Deterministic tie-breaker: officer least recently assigned a case (by Complaint.created_at timestamp),
       then deterministic by officer.id.
    5. Returns None if no active eligible officer exists.
    """
    bureau_clean = bureau.strip().upper()
    try:
        users_query = db.query(User).filter(
            User.role == "Officer",
            func.lower(User.status) == "active",
            or_(func.upper(User.bureau) == bureau_clean, func.upper(User.bureau) == "ALL")
        )
        raw_users = users_query.all()
    except Exception:
        try:
            raw_users = db.query(User).all()
        except Exception:
            raw_users = []

    # In-memory safety filter in case mock DB session does not evaluate SQL filters
    eligible_officers = [
        u for u in raw_users
        if getattr(u, "role", None) == "Officer"
        and (getattr(u, "status", None) or "").lower() == "active"
        and (getattr(u, "bureau", None) or "").upper() in (bureau_clean, "ALL")
    ]

    if not eligible_officers:
        return None

    # Fetch complaints to compute workload and last assignment time
    try:
        complaints_query = db.query(Complaint).filter(
            func.lower(Complaint.status) != "resolved"
        )
        unresolved_complaints = complaints_query.all()
    except Exception:
        try:
            unresolved_complaints = [
                c for c in db.query(Complaint).all()
                if (getattr(c, "status", None) or "").lower() != "resolved"
            ]
        except Exception:
            unresolved_complaints = []

    try:
        all_complaints_query = db.query(Complaint)
        all_complaints = all_complaints_query.all()
    except Exception:
        all_complaints = unresolved_complaints

    officer_stats = []
    for officer in eligible_officers:
        # 1. Count unresolved complaints assigned to this officer
        matching_unresolved = [
            c for c in unresolved_complaints
            if (
                getattr(c, "assigned_user_id", None) == officer.id
                or (not getattr(c, "assigned_user_id", None) and (getattr(c, "officer", "") or "").lower() == officer.name.lower())
            )
            and (getattr(c, "status", "") or "").lower() != "resolved"
        ]
        workload = len(matching_unresolved)

        # 2. Find latest assignment timestamp for deterministic rotating tie-breaker
        officer_all_assigned = [
            c for c in all_complaints
            if (
                getattr(c, "assigned_user_id", None) == officer.id
                or (not getattr(c, "assigned_user_id", None) and (getattr(c, "officer", "") or "").lower() == officer.name.lower())
            )
        ]

        last_ts = -1.0
        if officer_all_assigned:
            timestamps = []
            for c in officer_all_assigned:
                created_dt = getattr(c, "created_at", None)
                if created_dt is not None:
                    if hasattr(created_dt, "tzinfo") and created_dt.tzinfo is not None:
                        timestamps.append(created_dt.timestamp())
                    elif isinstance(created_dt, datetime):
                        timestamps.append(created_dt.replace(tzinfo=timezone.utc).timestamp())
                    elif isinstance(created_dt, str):
                        try:
                            timestamps.append(datetime.fromisoformat(created_dt).timestamp())
                        except Exception:
                            pass
                date_str = getattr(c, "date", None)
                if date_str and isinstance(date_str, str):
                    try:
                        timestamps.append(datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
                    except Exception:
                        pass
            if timestamps:
                last_ts = max(timestamps)

        officer_stats.append((workload, last_ts, str(officer.id), officer))

    # Sort by minimum workload first, then earliest last assignment (least recently assigned first), then officer.id
    officer_stats.sort(key=lambda item: (item[0], item[1], item[2]))
    return officer_stats[0][3]

def get_default_officer(bureau: str, db: Optional[Session] = None) -> str:
    """
    Backwards compatibility helper: resolves default officer name.
    Delegates to fair least-loaded automatic assignment if db session is provided;
    otherwise returns neutral 'Unassigned'. Never hardcodes Rajesh Kumar.
    """
    if db is not None:
        officer = assign_least_loaded_officer(db, bureau)
        if officer:
            return officer.name
    return "Unassigned"

def get_default_next_action(status_val: str, bureau: str) -> str:
    s = status_val.lower()
    if s == "pending":
        return f"Jurisdiction verification and preliminary scrutiny by {bureau} Cell"
    elif s == "in progress":
        return "Examine institution counter-affidavit and verify official registers"
    elif s == "escalated":
        return "Convene expedited joint hearing with institution management"
    elif s == "resolved":
        return "Final compliance order signed and archived"
    return f"Routine administrative review by {bureau} Cell"

def map_complaint_to_read(c: Complaint) -> ComplaintRead:
    timeline_items = [
        TimelineEventRead(
            id=t.id,
            complaintId=t.complaint_id,
            label=t.label,
            date=t.date,
            by=t.by,
            role=t.role,
            note=t.note,
            userId=t.user_id,
            createdAt=t.created_at,
        )
        for t in getattr(c, "timeline_events", [])
    ]
    return ComplaintRead(
        id=c.id,
        institutionId=c.institution_id,
        institutionPermanentId=c.institution_permanent_id,
        bureau=c.bureau,
        category=c.category,
        priority=c.priority,
        status=c.status,
        officer=c.officer,
        assignedUserId=c.assigned_user_id,
        complainantUserId=getattr(c, "complainant_user_id", None),
        date=c.date,
        due=c.due,
        title=c.title,
        description=c.description,
        complainantType=c.complainant_type,
        complainantName=c.complainant_name,
        complainantEmail=c.complainant_email,
        complainantPhone=c.complainant_phone,
        remarks=c.remarks,
        nextAction=c.next_action,
        lastActionDate=c.last_action_date,
        institutionName=c.institution.name if c.institution else None,
        createdAt=c.created_at,
        updatedAt=c.updated_at,
        timeline=timeline_items,
        aiPredictedCategory=getattr(c, "ai_predicted_category", None),
        aiPredictedBureau=getattr(c, "ai_predicted_bureau", None),
        aiPredictedPriority=getattr(c, "ai_predicted_priority", None),
        aiConfidence=getattr(c, "ai_confidence", None),
        aiNeedsManualReview=getattr(c, "ai_needs_manual_review", None),
        aiModelVersion=getattr(c, "ai_model_version", None),
        aiClassificationRun=getattr(c, "ai_classification_run", None),
    )

@router.post("", response_model=ComplaintRead, status_code=status.HTTP_201_CREATED)
def create_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create and persist a new grievance complaint in PostgreSQL.
    Requires authentication. If logged in as Complainant, enforces complainant identity.
    Validates institution existence, applies statutory SLA due dates, bureau routing defaults,
    and records the initial creation events in the chronological timeline.
    """
    # 1. Verify that referenced institution exists
    inst = db.query(Institution).filter(Institution.id == complaint_in.institutionId).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Institution with ID '{complaint_in.institutionId}' does not exist in the AICTE registry."
        )

    # 2. Case ID resolution or generation
    case_id = complaint_in.id
    if not case_id or not case_id.strip():
        prefix = "AB" if complaint_in.bureau == "Approval" else ("ACD" if complaint_in.bureau == "Academic" else complaint_in.bureau)
        for _ in range(100):
            candidate = f"{prefix}-2026-{random.randint(1000, 9999)}"
            if not db.query(Complaint).filter(Complaint.id == candidate).first():
                case_id = candidate
                break
        if not case_id:
            case_id = f"{prefix}-2026-{int(datetime.now(timezone.utc).timestamp()) % 10000:04d}"
    else:
        case_id = case_id.strip()
        expected_prefix = "AB" if complaint_in.bureau == "Approval" else ("ACD" if complaint_in.bureau == "Academic" else complaint_in.bureau)
        if not case_id.startswith(f"{expected_prefix}-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Case ID '{case_id}' does not match Bureau prefix '{expected_prefix}'."
            )
        existing = db.query(Complaint).filter(Complaint.id.ilike(case_id)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Complaint with Case ID '{case_id}' already exists."
            )

    # 3. Officer assignment - Authoritative server-side assignment
    assigned_user: Optional[User] = None
    officer_name: str = "Unassigned"
    assigned_user_id: Optional[str] = None

    with _assignment_lock:
        if current_user and current_user.role in ("Admin", "BureauAdmin"):
            # Check if an explicit authorized manual assignment was requested
            req_officer = complaint_in.officer.strip() if complaint_in.officer and complaint_in.officer.strip() else None
            if req_officer and req_officer.lower() != "unassigned":
                cand_user = db.query(User).filter(User.name.ilike(req_officer)).first()
                if not cand_user:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Officer '{req_officer}' was not found in AICTE user registry."
                    )
                if cand_user.status and cand_user.status.lower() != "active":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Officer '{cand_user.name}' is inactive and cannot be assigned cases."
                    )
                if cand_user.role not in ("Officer", "BureauAdmin", "Admin"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"User '{cand_user.name}' has role '{cand_user.role}' and is not eligible for case assignment."
                    )
                if current_user.role == "BureauAdmin" and current_user.bureau != "All":
                    if cand_user.bureau != "All" and cand_user.bureau.upper() != current_user.bureau.upper():
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Restricted: Bureau Admin cannot assign case to officer in {cand_user.bureau} Bureau."
                        )
                assigned_user = cand_user
                officer_name = cand_user.name
                assigned_user_id = cand_user.id
            elif req_officer and req_officer.lower() == "unassigned":
                assigned_user = None
                officer_name = "Unassigned"
                assigned_user_id = None
            else:
                assigned_user = assign_least_loaded_officer(db, complaint_in.bureau)
                if assigned_user:
                    officer_name = assigned_user.name
                    assigned_user_id = assigned_user.id
                else:
                    officer_name = "Unassigned"
                    assigned_user_id = None
        else:
            # Complainants or public unauthenticated submissions MUST NEVER self-assign officers.
            # Perform server-side fair least-loaded automatic distribution.
            assigned_user = assign_least_loaded_officer(db, complaint_in.bureau)
            if assigned_user:
                officer_name = assigned_user.name
                assigned_user_id = assigned_user.id
            else:
                officer_name = "Unassigned"
                assigned_user_id = None

    # 4. Complainant identity verification: Never trust client to spoof identity
    if current_user.role == "Complainant":
        complainant_name = current_user.name
        complainant_email = current_user.email
        complainant_phone = complaint_in.complainantPhone.strip() if complaint_in.complainantPhone and complaint_in.complainantPhone.strip() else (current_user.phone or None)
        complainant_user_id = current_user.id
        intake_user_id = current_user.id
    else:
        complainant_name = complaint_in.complainantName.strip() if complaint_in.complainantName and complaint_in.complainantName.strip() else current_user.name
        complainant_email = complaint_in.complainantEmail.strip() if complaint_in.complainantEmail and complaint_in.complainantEmail.strip() else current_user.email
        complainant_phone = complaint_in.complainantPhone.strip() if complaint_in.complainantPhone and complaint_in.complainantPhone.strip() else None
        existing_comp_user = db.query(User).filter(func.lower(User.email) == complainant_email.lower()).first() if complainant_email else None
        complainant_user_id = existing_comp_user.id if existing_comp_user else None
        intake_user_id = None

    # 5. Server-generated Filing Date & Due Date SLA - NEVER trust client
    server_now = datetime.now(timezone.utc)
    date_val = server_now.strftime("%Y-%m-%d")
    sla_days = get_sla_days(complaint_in.priority, db=db)
    due_val = (server_now + timedelta(days=sla_days)).strftime("%Y-%m-%d")

    # 6. Permanent ID
    perm_id = complaint_in.institutionPermanentId.strip() if complaint_in.institutionPermanentId and complaint_in.institutionPermanentId.strip() else inst.aicte_id

    # 7. Workflow status, next action & last action date - Safe initial status ALWAYS "Pending"
    status_val = "Pending"
    next_action_val = get_default_next_action(status_val, complaint_in.bureau)
    last_action_date_val = date_val

    # 7b. Server-side AI classification advisory (runs quietly; never overrides user input)
    ai_predicted_cat = None
    ai_predicted_bur = None
    ai_predicted_prio = None
    ai_conf = None
    ai_needs_review = False
    ai_version = None
    ai_run = False

    try:
        ai_res = classify_complaint(complaint_in.title, complaint_in.description)
        if ai_res and ai_res.get("status") == "success":
            ai_predicted_cat = ai_res.get("category")
            ai_predicted_bur = ai_res.get("bureau")
            ai_predicted_prio = ai_res.get("priority")
            ai_conf = ai_res.get("confidence")
            ai_needs_review = bool(ai_res.get("needs_manual_review", False))
            ai_version = ai_res.get("model_version")
            ai_run = True
        elif ai_res and ai_res.get("status") in ("unavailable", "error"):
            ai_needs_review = True
            ai_version = ai_res.get("model_version")
    except Exception as e:
        logger.warning(f"AI classifier exception during complaint creation: {e}", exc_info=True)
        ai_needs_review = True

    # 8. Instantiate and save model along with initial timeline events in one transaction
    new_complaint = Complaint(
        id=case_id,
        institution_id=inst.id,
        institution_permanent_id=perm_id,
        bureau=complaint_in.bureau,
        category=complaint_in.category.strip(),
        priority=complaint_in.priority,
        status=status_val,
        officer=officer_name,
        assigned_user_id=assigned_user_id,
        date=date_val,
        due=due_val,
        title=complaint_in.title.strip(),
        description=complaint_in.description.strip(),
        complainant_user_id=complainant_user_id,
        complainant_type=complaint_in.complainantType or "General Public",
        complainant_name=complainant_name,
        complainant_email=complainant_email,
        complainant_phone=complainant_phone,
        remarks=complaint_in.remarks.strip() if complaint_in.remarks else None,
        next_action=next_action_val,
        last_action_date=last_action_date_val,
        ai_predicted_category=ai_predicted_cat,
        ai_predicted_bureau=ai_predicted_bur,
        ai_predicted_priority=ai_predicted_prio,
        ai_confidence=ai_conf,
        ai_needs_manual_review=ai_needs_review,
        ai_model_version=ai_version,
        ai_classification_run=ai_run,
    )

    try:
        db.add(new_complaint)
        db.flush()

        # Record initial creation events in timeline
        now_hm = datetime.now(timezone.utc).strftime("%H:%M")
        event_intake = ComplaintTimeline(
            complaint_id=new_complaint.id,
            label="Complaint registered and verified on AICTE portal",
            date=f"{date_val} {now_hm}",
            by=f"{complainant_name} ({new_complaint.complainant_type})",
            role="Complainant",
            note="Portal intake verified; acknowledgement issued to complainant.",
            user_id=intake_user_id,
        )
        db.add(event_intake)

        allocation_by = f"{current_user.name} ({current_user.designation})" if current_user.role != "Complainant" else "Central Allocation Engine"
        allocation_role = current_user.role if current_user.role != "Complainant" else "Admin"

        if assigned_user:
            timeline_label = f"Assigned to {officer_name} ({new_complaint.bureau} Bureau)"
            timeline_note = f"Initial statutory assignment to {new_complaint.bureau} Bureau based on category: {new_complaint.category}."
        else:
            timeline_label = f"Case registered in {new_complaint.bureau} Bureau (Pending Officer Allocation)"
            timeline_note = f"Initial statutory intake to {new_complaint.bureau} Bureau. No active handling officer currently available; pending administrative allocation."

        event_allocation = ComplaintTimeline(
            complaint_id=new_complaint.id,
            label=timeline_label,
            date=f"{date_val} {now_hm}",
            by=allocation_by,
            role=allocation_role,
            note=timeline_note,
            user_id=assigned_user_id,
        )
        db.add(event_allocation)

        db.commit()
        db.refresh(new_complaint)
    except Exception:
        db.rollback()
        raise

    return map_complaint_to_read(new_complaint)

@router.get("", response_model=ComplaintListResponse)
def list_complaints(
    search: Optional[str] = Query(None, description="Search term matching Case ID, title, description, or complainant"),
    bureau: Optional[str] = Query(None, description="Filter by Bureau (e.g. PGRC, RB, Approval)"),
    status: Optional[str] = Query(None, description="Filter by Status (e.g. Pending, In Progress, Resolved, Escalated)"),
    priority: Optional[str] = Query(None, description="Filter by Priority (e.g. Critical, High, Medium, Low)"),
    category: Optional[str] = Query(None, description="Filter by Category"),
    institutionId: Optional[str] = Query(None, alias="institutionId", description="Filter by Institution internal ID"),
    officer: Optional[str] = Query(None, description="Filter by assigned officer name"),
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(20, ge=1, le=100, alias="pageSize", description="Page size limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List registered grievance complaints with multi-parameter search, filtering and pagination.
    Applies role-based access scoping:
    - Complainant: Only views grievances submitted by themselves.
    - BureauAdmin: Scoped to their authorized Bureau (or all if All).
    - Officer: Scoped to assigned cases or their Bureau cell.
    - Admin: System-wide access across all Bureaus.
    """
    query = db.query(Complaint)

    # 1. Role-based scoping
    if current_user.role == "Complainant":
        query = query.filter(
            or_(
                Complaint.complainant_user_id == current_user.id,
                Complaint.complainant_email.ilike(current_user.email.strip()),
            )
        )
    elif current_user.role == "BureauAdmin":
        if current_user.bureau != "All":
            if bureau and bureau.strip() and bureau.lower() != "all" and bureau.strip().upper() != current_user.bureau.upper():
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Bureau Admin jurisdiction is {current_user.bureau}; cannot query {bureau} Bureau."
                )
            query = query.filter(Complaint.bureau.ilike(current_user.bureau))
    elif current_user.role == "Officer":
        query = query.filter(
            or_(
                Complaint.assigned_user_id == current_user.id,
                and_(
                    Complaint.assigned_user_id.is_(None),
                    Complaint.officer.ilike(current_user.name.strip()),
                ),
            )
        )

    # 2. General filtering
    if bureau and bureau.strip() and bureau.lower() != "all" and current_user.role != "BureauAdmin":
        query = query.filter(Complaint.bureau.ilike(bureau.strip()))

    if status and status.strip() and status.lower() != "all":
        query = query.filter(Complaint.status.ilike(status.strip()))

    if priority and priority.strip() and priority.lower() != "all":
        query = query.filter(Complaint.priority.ilike(priority.strip()))

    if category and category.strip() and category.lower() != "all":
        query = query.filter(Complaint.category.ilike(f"%{category.strip()}%"))

    if institutionId and institutionId.strip() and institutionId.lower() != "all":
        query = query.filter(Complaint.institution_id == institutionId.strip())

    if officer and officer.strip() and officer.lower() != "all":
        query = query.filter(Complaint.officer.ilike(f"%{officer.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Complaint.id.ilike(term),
                Complaint.title.ilike(term),
                Complaint.description.ilike(term),
                Complaint.complainant_name.ilike(term),
                Complaint.institution_permanent_id.ilike(term),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / pageSize) if total > 0 else 0
    records = query.order_by(Complaint.date.desc(), Complaint.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    items = [map_complaint_to_read(c) for c in records]

    return ComplaintListResponse(
        items=items,
        total=total,
        page=page,
        pageSize=pageSize,
        totalPages=total_pages
    )

@router.post("/classify", response_model=ComplaintClassifyResponse)
def preview_classify_complaint(
    payload: ComplaintClassifyRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generate AI-based complaint classification advisory predictions without persisting to the database.
    Returns predicted category, suggested bureau, priority, model confidence, and manual review recommendation.
    Does not modify any complaints or system state.
    """
    threshold = payload.confidenceThreshold
    kwargs = {}
    if threshold is not None:
        kwargs["confidence_threshold"] = threshold

    try:
        result = classify_complaint(
            title=payload.title,
            description=payload.description,
            **kwargs
        )
    except Exception as e:
        logger.error(f"Classification preview error: {e}", exc_info=True)
        return ComplaintClassifyResponse(
            category=None,
            bureau=None,
            priority=None,
            confidence=0.0,
            priorityConfidence=0.0,
            needsManualReview=True,
            modelVersion="error",
            advisoryNotice="AI classification is advisory only.",
            status="error",
            reviewReasons=[f"inference_exception: {str(e)}"],
        )

    if not result:
        return ComplaintClassifyResponse(
            category=None,
            bureau=None,
            priority=None,
            confidence=0.0,
            priorityConfidence=0.0,
            needsManualReview=True,
            modelVersion="unavailable",
            advisoryNotice="AI classification is advisory only.",
            status="unavailable",
            reviewReasons=["model_service_unavailable"],
        )

    return ComplaintClassifyResponse(
        category=result.get("category"),
        bureau=result.get("bureau"),
        priority=result.get("priority"),
        confidence=result.get("confidence"),
        priorityConfidence=result.get("priority_confidence"),
        needsManualReview=bool(result.get("needs_manual_review", False)),
        modelVersion=result.get("model_version"),
        advisoryNotice=result.get("advisory_notice", "AI classification is advisory only."),
        status=result.get("status", "success"),
        reviewReasons=result.get("review_reasons", []),
    )

@router.get("/{id}", response_model=ComplaintRead)
def get_complaint(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a single grievance complaint by its internal ID or Case ID.
    Enforces role-based and Bureau-scoped access control.
    """
    complaint = db.query(Complaint).filter(Complaint.id.ilike(id.strip())).first()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID or Case ID '{id}' was not found."
        )

    check_case_access(current_user, complaint, action="view")

    return map_complaint_to_read(complaint)

@router.get("/{id}/timeline", response_model=List[TimelineEventRead])
def get_complaint_timeline(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve chronological audit history timeline events for a complaint.
    Enforces role-based access control.
    """
    complaint = db.query(Complaint).filter(Complaint.id.ilike(id.strip())).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID or Case ID '{id}' was not found."
        )

    check_case_access(current_user, complaint, action="view")

    events = db.query(ComplaintTimeline).filter(
        ComplaintTimeline.complaint_id == complaint.id
    ).order_by(ComplaintTimeline.id.asc()).all()

    return [
        TimelineEventRead(
            id=t.id,
            complaintId=t.complaint_id,
            label=t.label,
            date=t.date,
            by=t.by,
            role=t.role,
            note=t.note,
            userId=t.user_id,
            createdAt=t.created_at,
        )
        for t in events
    ]

@router.post("/{id}/timeline", response_model=TimelineEventRead, status_code=status.HTTP_201_CREATED)
def add_complaint_timeline_note(
    id: str,
    payload: TimelineNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Append an authorized investigation milestone, note, or complainant update to the complaint timeline.
    Enforces role-based case access:
    - Complainant: Only on own case.
    - Officer: Only on explicitly assigned case.
    - BureauAdmin: Only on cases in authorized Bureau.
    - Admin: System-wide authority.
    """
    complaint = db.query(Complaint).filter(Complaint.id.ilike(id.strip())).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID or Case ID '{id}' was not found."
        )

    check_case_access(current_user, complaint, action="add_remark")

    now_dt = datetime.now(timezone.utc)
    date_val = now_dt.strftime("%Y-%m-%d %H:%M")
    today_date = now_dt.strftime("%Y-%m-%d")

    if payload.label and payload.label.strip():
        action_label = payload.label.strip()
    elif current_user.role == "Complainant":
        action_label = "Supplementary Statement / Complainant Update Logged"
    else:
        action_label = "Investigation Action & Inquiry Milestone Logged"

    event = ComplaintTimeline(
        complaint_id=complaint.id,
        label=action_label,
        date=date_val,
        by=f"{current_user.name} ({current_user.designation or current_user.role})",
        role=current_user.role,
        note=payload.note.strip(),
        user_id=current_user.id,
    )

    try:
        complaint.last_action_date = today_date
        db.add(event)
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise

    return TimelineEventRead(
        id=event.id if event.id is not None else 1,
        complaintId=event.complaint_id,
        label=event.label,
        date=event.date,
        by=event.by,
        role=event.role,
        note=event.note,
        userId=event.user_id,
        createdAt=event.created_at if event.created_at is not None else now_dt,
    )

@router.patch("/{id}/status", response_model=ComplaintRead)
@router.post("/{id}/status", response_model=ComplaintRead)
def update_complaint_status(
    id: str,
    payload: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update complaint status, remarks and next action, recording a chronological timeline event
    within the same database transaction.
    Enforces role permissions, Bureau jurisdiction, and permitted workflow status transitions.
    """
    complaint = db.query(Complaint).filter(Complaint.id.ilike(id.strip())).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID or Case ID '{id}' was not found."
        )

    # Enforce case authorization (Complainant -> 403, BureauAdmin cross-bureau -> 403, Officer not assigned/different bureau -> 403)
    check_case_access(current_user, complaint, action="update_status")

    target_status = payload.status

    # --- Admin override path ---
    # System Admin may bypass the normal workflow table ONLY when:
    #   (a) an explicit, non-blank overrideReason is provided, AND
    #   (b) the current status is not already Resolved (re-open from Resolved requires override).
    # If the transition is in the normal permitted table, the override path is NOT needed.
    override_reason = (payload.overrideReason or "").strip()
    is_admin_override = (
        current_user.role == "Admin"
        and bool(override_reason)
        and target_status not in PERMITTED_STATUS_TRANSITIONS.get(complaint.status, [])
    )

    if complaint.status == target_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Complaint is already in '{target_status}' status."
        )

    if complaint.status == "Resolved" and not is_admin_override:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Case is Resolved and closed. Status transitions from 'Resolved' are not permitted "
                "under normal workflow rules. System Admin may override by supplying a non-empty overrideReason."
            )
        )

    permitted = PERMITTED_STATUS_TRANSITIONS.get(complaint.status, [])
    if target_status not in permitted and not is_admin_override:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Status transition from '{complaint.status}' to '{target_status}' is not permitted. "
                f"Permitted transitions: {', '.join(permitted) if permitted else 'None (Case Closed)'}. "
                "System Admin may override by supplying a non-empty overrideReason."
            )
        )

    # Actor identity strictly derived from the authenticated user
    actor_user_id = current_user.id
    actor_name = current_user.name
    actor_role = current_user.role

    # Atomic transaction: update complaint and insert timeline event
    try:
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

        complaint.status = target_status
        complaint.last_action_date = today_date

        if payload.remarks is not None:
            complaint.remarks = payload.remarks.strip()

        if payload.nextAction is not None and payload.nextAction.strip():
            complaint.next_action = payload.nextAction.strip()
        else:
            complaint.next_action = get_default_next_action(target_status, complaint.bureau)

        if is_admin_override:
            action_label = f"[Admin Override] Status set to {target_status} from {complaint.status}"
        elif target_status == "Resolved":
            action_label = "Case investigation concluded & Marked Resolved"
        else:
            action_label = f"Status transitioned to {target_status}"

        note_parts = []
        if payload.note and payload.note.strip():
            note_parts.append(payload.note.strip())
        elif payload.remarks and payload.remarks.strip():
            note_parts.append(payload.remarks.strip())
        if is_admin_override:
            note_parts.append(f"Admin Override Reason: {override_reason}")
        note_text = " | ".join(note_parts) if note_parts else None

        timeline_event = ComplaintTimeline(
            complaint_id=complaint.id,
            label=action_label,
            date=now_str,
            by=actor_name,
            role=actor_role,
            note=note_text,
            user_id=actor_user_id,
        )
        db.add(timeline_event)
        db.commit()
        db.refresh(complaint)
    except Exception:
        db.rollback()
        raise

    return map_complaint_to_read(complaint)

@router.put("/{id}/assign", response_model=ComplaintRead)
@router.patch("/{id}/assign", response_model=ComplaintRead)
@router.post("/{id}/assign", response_model=ComplaintRead)
def assign_complaint(
    id: str,
    payload: ComplaintAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign or reassign a complaint to an eligible user/Bureau and record in the timeline
    within the same database transaction.
    Enforces role permissions, Bureau jurisdiction, and authentic timeline actor integrity.
    """
    complaint = db.query(Complaint).filter(Complaint.id.ilike(id.strip())).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID or Case ID '{id}' was not found."
        )

    # Enforce assignment authorization (Complainant -> 403, Officer -> 403, BureauAdmin cross-bureau -> 403, Admin -> OK)
    check_case_access(current_user, complaint, action="assign")

    if not payload.userId and not payload.officer and not payload.bureau:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify at least a userId, officer name, or bureau to update assignment."
        )

    target_officer = complaint.officer
    target_user_id = complaint.assigned_user_id
    target_bureau = payload.bureau or complaint.bureau

    # If BureauAdmin, ensure target bureau remains within their authority
    if current_user.role == "BureauAdmin" and current_user.bureau != "All":
        if payload.bureau and payload.bureau.strip().upper() != complaint.bureau.upper():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Restricted: Bureau Admin can only transfer cases originating in their authorized Bureau ({current_user.bureau}).",
            )

    # 1. Resolve user by userId if provided
    resolved_user: Optional[User] = None
    if payload.userId and payload.userId.strip():
        resolved_user = db.query(User).filter(User.id == payload.userId.strip()).first()
        if not resolved_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with ID '{payload.userId}' was not found in AICTE user registry."
            )
        if resolved_user.status.lower() != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User '{resolved_user.name}' is inactive and cannot be assigned cases."
            )
        if resolved_user.role not in ("Officer", "BureauAdmin", "Admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User '{resolved_user.name}' has role '{resolved_user.role}' and is not eligible for case assignment."
            )
        if current_user.role == "BureauAdmin" and current_user.bureau != "All":
            if resolved_user.bureau != "All" and resolved_user.bureau.upper() != current_user.bureau.upper():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Restricted: Bureau Admin cannot assign case to officer in {resolved_user.bureau} Bureau.",
                )
        target_officer = resolved_user.name
        target_user_id = resolved_user.id
        # Preserve the complaint's existing bureau unless:
        #   - caller explicitly passed a bureau AND did NOT set preserveBureau=True, OR
        #   - preserveBureau is not set (falsy) — legacy: officer's home bureau wins
        if not payload.bureau and not payload.preserveBureau and resolved_user.bureau != "All":
            target_bureau = resolved_user.bureau

    # 2. Or resolve by officer name if provided
    elif payload.officer and payload.officer.strip():
        if payload.officer.strip().lower() == "unassigned":
            target_officer = "Unassigned"
            target_user_id = None
        else:
            resolved_user = db.query(User).filter(User.name.ilike(payload.officer.strip())).first()
            if not resolved_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Officer '{payload.officer}' was not found in AICTE user registry."
                )
            if resolved_user.status.lower() != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Officer '{resolved_user.name}' is inactive and cannot be assigned cases."
                )
            if resolved_user.role not in ("Officer", "BureauAdmin", "Admin"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User '{resolved_user.name}' has role '{resolved_user.role}' and is not eligible for case assignment."
                )
            if current_user.role == "BureauAdmin" and current_user.bureau != "All":
                if resolved_user.bureau != "All" and resolved_user.bureau.upper() != current_user.bureau.upper():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Restricted: Bureau Admin cannot assign case to officer in {resolved_user.bureau} Bureau.",
                    )
            target_officer = resolved_user.name
            target_user_id = resolved_user.id
            if not payload.bureau and not payload.preserveBureau and resolved_user.bureau != "All":
                target_bureau = resolved_user.bureau

    prev_officer = complaint.officer
    prev_bureau = complaint.bureau

    # Generate timeline label
    is_officer_changed = (target_officer != prev_officer)
    is_bureau_changed = (target_bureau != prev_bureau)

    if is_officer_changed and is_bureau_changed:
        action_label = f"Case reassigned from {prev_officer} ({prev_bureau} Bureau) to {target_officer} ({target_bureau} Bureau)"
    elif is_officer_changed:
        action_label = f"Investigating officer reassigned from {prev_officer} to {target_officer}"
    elif is_bureau_changed:
        action_label = f"Case transferred from {prev_bureau} Bureau to {target_bureau} Bureau"
    else:
        action_label = f"Case assignment confirmed for {target_officer} ({target_bureau} Bureau)"

    # Atomic transaction: update complaint and insert timeline event
    try:
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

        complaint.officer = target_officer
        complaint.assigned_user_id = target_user_id
        complaint.bureau = target_bureau
        complaint.last_action_date = today_date

        reason_text = payload.reason.strip() if payload.reason and payload.reason.strip() else f"Administrative case assignment within {target_bureau} Bureau."

        timeline_event = ComplaintTimeline(
            complaint_id=complaint.id,
            label=action_label,
            date=now_str,
            by=current_user.name,
            role=current_user.role,
            note=f"Administrative Justification: {reason_text}",
            user_id=current_user.id,
        )
        db.add(timeline_event)
        db.commit()
        db.refresh(complaint)
    except Exception:
        db.rollback()
        raise

    return map_complaint_to_read(complaint)
