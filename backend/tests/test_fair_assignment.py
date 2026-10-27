import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models.user import User
from app.models.complaint import Complaint
from app.models.timeline import ComplaintTimeline
from app.models.institution import Institution
from app.auth import get_current_user, check_case_access, hash_password
from app.routers.complaints import (
    assign_least_loaded_officer,
    get_default_officer,
)

TEST_PASSWORD_HASH = hash_password("ValidSecurePass@2026")

MOCK_INSTITUTION = Institution(
    id="i1",
    aicte_id="1-4821039",
    name="Sunrise Institute of Technology",
    city="Pune",
    state="Maharashtra",
    type="Engineering",
    approved="2009",
    contact_email="principal@sunrise-tech.edu.in",
    contact_phone="+91 20 2748 9901",
    risk_level="High"
)

# Test Officers
OFFICER_RAJESH = User(
    id="u2",
    name="Rajesh Kumar",
    email="rajesh.kumar@aicte-india.org",
    role="Officer",
    designation="Senior Grievance Officer, PGRC",
    bureau="PGRC",
    status="Active",
    department="PGRC",
    password_hash=TEST_PASSWORD_HASH,
)

OFFICER_ARUN = User(
    id="u6",
    name="Dr. Arun Sharma",
    email="arun.sharma@aicte-india.org",
    role="Officer",
    designation="Ombudsman & Grievance Officer, PGRC",
    bureau="PGRC",
    status="Active",
    department="PGRC",
    password_hash=TEST_PASSWORD_HASH,
)

OFFICER_PRIYA = User(
    id="u7",
    name="Dr. Priya Nair",
    email="priya.officer@aicte-india.org",
    role="Officer",
    designation="Grievance Officer, PGRC",
    bureau="PGRC",
    status="Active",
    department="PGRC",
    password_hash=TEST_PASSWORD_HASH,
)

OFFICER_INACTIVE = User(
    id="u_inactive",
    name="Inactive Officer",
    email="inactive@aicte-india.org",
    role="Officer",
    designation="Inactive Officer",
    bureau="PGRC",
    status="Inactive",
    department="PGRC",
    password_hash=TEST_PASSWORD_HASH,
)

OFFICER_ON_LEAVE = User(
    id="u_leave",
    name="On Leave Officer",
    email="leave@aicte-india.org",
    role="Officer",
    designation="On Leave Officer",
    bureau="PGRC",
    status="On Leave",
    department="PGRC",
    password_hash=TEST_PASSWORD_HASH,
)

OFFICER_APPROVAL = User(
    id="u5",
    name="Suresh Patel",
    email="suresh.patel@aicte-india.org",
    role="Officer",
    designation="Scrutiny Officer, Approval Bureau",
    bureau="Approval",
    status="Active",
    department="Approval",
    password_hash=TEST_PASSWORD_HASH,
)

USER_ADMIN = User(
    id="u1",
    name="Dr. S. Mehta",
    email="member-sec@aicte-india.org",
    role="Admin",
    designation="Member Secretary & System Admin",
    bureau="All",
    status="Active",
    department="Executive Administration",
    password_hash=TEST_PASSWORD_HASH,
)

USER_CITIZEN = User(
    id="u0",
    name="Rohit Sharma",
    email="rohit.sharma@student.edu.in",
    role="Complainant",
    designation="Student",
    bureau="PGRC",
    status="Active",
    department="Citizen",
    password_hash=TEST_PASSWORD_HASH,
)


class MockQuery:
    def __init__(self, items):
        self.items = list(items)

    def filter(self, *args, **kwargs):
        if not args:
            return self
        matched = list(self.items)
        for arg in args:
            if hasattr(arg, "left") and hasattr(arg, "right") and hasattr(arg.right, "value"):
                col = getattr(arg.left, "name", None)
                if col in ("id", "name"):
                    target_val = str(arg.right.value).strip().lower()
                    matched = [x for x in matched if str(getattr(x, col, "")).strip().lower() == target_val]
        return MockQuery(matched)

    def order_by(self, *args):
        return self

    def all(self):
        return list(self.items)

    def first(self):
        return self.items[0] if self.items else None

    def count(self):
        return len(self.items)


class FairAssignmentMockSession:
    def __init__(self, users=None, complaints=None, timelines=None):
        self.users = list(users) if users is not None else [
            OFFICER_RAJESH,
            OFFICER_ARUN,
            OFFICER_PRIYA,
            OFFICER_INACTIVE,
            OFFICER_ON_LEAVE,
            OFFICER_APPROVAL,
            USER_ADMIN,
            USER_CITIZEN,
        ]
        self.complaints = list(complaints) if complaints is not None else []
        self.timelines = list(timelines) if timelines is not None else []
        self.added = []
        self.committed = False

    def query(self, model):
        if model == User:
            return MockQuery(self.users)
        elif model == Complaint:
            return MockQuery(self.complaints)
        elif model == ComplaintTimeline:
            return MockQuery(self.timelines)
        elif model == Institution:
            return MockQuery([MOCK_INSTITUTION])
        return MockQuery([])

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, Complaint):
            if not hasattr(obj, "timeline_events") or obj.timeline_events is None:
                obj.timeline_events = []
            if not hasattr(obj, "institution"):
                obj.institution = MOCK_INSTITUTION
            self.complaints.append(obj)
        elif isinstance(obj, ComplaintTimeline):
            if not getattr(obj, "id", None):
                obj.id = len(self.timelines) + 1
            self.timelines.append(obj)
            for c in self.complaints:
                if c.id == obj.complaint_id:
                    if not hasattr(c, "timeline_events") or c.timeline_events is None:
                        c.timeline_events = []
                    c.timeline_events.append(obj)

    def flush(self):
        pass

    def commit(self):
        self.committed = True

    def rollback(self):
        pass

    def refresh(self, obj):
        pass


def test_least_loaded_officer_selection():
    """Verify least-loaded officer is selected when workloads differ."""
    # Rajesh has 3 unresolved cases
    c_rajesh = [
        Complaint(id=f"PGRC-R-{i}", bureau="PGRC", status="Pending", assigned_user_id="u2", officer="Rajesh Kumar")
        for i in range(3)
    ]
    # Arun has 1 unresolved case
    c_arun = [
        Complaint(id="PGRC-A-1", bureau="PGRC", status="In Progress", assigned_user_id="u6", officer="Dr. Arun Sharma")
    ]
    # Priya has 2 unresolved cases
    c_priya = [
        Complaint(id=f"PGRC-P-{i}", bureau="PGRC", status="Under Review", assigned_user_id="u7", officer="Dr. Priya Nair")
        for i in range(2)
    ]

    db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN, OFFICER_PRIYA],
        complaints=c_rajesh + c_arun + c_priya,
    )

    selected = assign_least_loaded_officer(db, "PGRC")
    assert selected is not None
    assert selected.id == "u6", "Should select Arun Sharma (load=1) instead of Rajesh (load=3) or Priya (load=2)"
    assert selected.name == "Dr. Arun Sharma"


def test_rajesh_kumar_not_preferentially_selected():
    """Verify Rajesh Kumar is not selected when other eligible officers are less loaded."""
    # Seed condition: Rajesh Kumar has 4 active cases, Arun Sharma has 0 active cases
    complaints = [
        Complaint(id=f"PGRC-{i}", bureau="PGRC", status="Pending", assigned_user_id="u2", officer="Rajesh Kumar")
        for i in range(4)
    ]
    db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN],
        complaints=complaints,
    )

    selected = assign_least_loaded_officer(db, "PGRC")
    assert selected is not None
    assert selected.id == "u6"
    assert selected.name == "Dr. Arun Sharma"
    assert selected.name != "Rajesh Kumar"


def test_fair_rotating_distribution_over_repeated_submissions():
    """Verify ties are distributed evenly across eligible officers."""
    # 3 eligible officers with 0 complaints initially
    db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN, OFFICER_PRIYA],
        complaints=[],
    )

    assigned_officers = []
    # Submit 6 complaints in sequence
    for i in range(6):
        officer = assign_least_loaded_officer(db, "PGRC")
        assert officer is not None
        assigned_officers.append(officer.id)
        # Create complaint with timestamp reflecting the assignment
        now = datetime.now(timezone.utc) + timedelta(minutes=i)
        new_c = Complaint(
            id=f"CASE-{i}",
            bureau="PGRC",
            status="Pending",
            assigned_user_id=officer.id,
            officer=officer.name,
            created_at=now,
            date=now.strftime("%Y-%m-%d"),
        )
        db.add(new_c)

    # Each of the 3 officers must have received exactly 2 complaints!
    assert assigned_officers.count("u2") == 2, "Rajesh Kumar must receive exactly 2 cases"
    assert assigned_officers.count("u6") == 2, "Dr. Arun Sharma must receive exactly 2 cases"
    assert assigned_officers.count("u7") == 2, "Dr. Priya Nair must receive exactly 2 cases"


def test_resolved_cases_do_not_count_towards_workload():
    """Resolved complaints must not count as active workload."""
    # Rajesh has 10 resolved cases and 1 active case
    c_rajesh_resolved = [
        Complaint(id=f"PGRC-R-RES-{i}", bureau="PGRC", status="Resolved", assigned_user_id="u2", officer="Rajesh Kumar")
        for i in range(10)
    ]
    c_rajesh_active = [
        Complaint(id="PGRC-R-ACT-1", bureau="PGRC", status="In Progress", assigned_user_id="u2", officer="Rajesh Kumar")
    ]
    # Arun has 2 active cases
    c_arun_active = [
        Complaint(id=f"PGRC-A-ACT-{i}", bureau="PGRC", status="Pending", assigned_user_id="u6", officer="Dr. Arun Sharma")
        for i in range(2)
    ]

    db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN],
        complaints=c_rajesh_resolved + c_rajesh_active + c_arun_active,
    )

    selected = assign_least_loaded_officer(db, "PGRC")
    assert selected is not None
    # Rajesh has active=1, Arun has active=2. Rajesh should be chosen!
    assert selected.id == "u2"
    assert selected.name == "Rajesh Kumar"


def test_inactive_and_wrong_bureau_officers_excluded():
    """Inactive/On Leave and wrong bureau officers must be excluded from assignment."""
    db = FairAssignmentMockSession(
        users=[
            OFFICER_INACTIVE,  # status="Inactive"
            OFFICER_ON_LEAVE,  # status="On Leave"
            OFFICER_APPROVAL,  # bureau="Approval"
            OFFICER_RAJESH,    # bureau="PGRC", status="Active", load=5
        ],
        complaints=[
            Complaint(id=f"PGRC-{i}", bureau="PGRC", status="Pending", assigned_user_id="u2", officer="Rajesh Kumar")
            for i in range(5)
        ],
    )

    selected = assign_least_loaded_officer(db, "PGRC")
    assert selected is not None
    # Even though Rajesh has 5 cases, he is the ONLY active, eligible PGRC officer
    assert selected.id == "u2"
    assert selected.name == "Rajesh Kumar"


def test_unassigned_fallback_when_no_active_officers():
    """When no active officer is eligible for a bureau, assignment returns None / 'Unassigned'."""
    db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN],  # Both PGRC
        complaints=[],
    )

    # SB Bureau has no officers in this DB
    selected = assign_least_loaded_officer(db, "SB")
    assert selected is None

    default_name = get_default_officer("SB", db=db)
    assert default_name == "Unassigned"


def test_authoritative_id_access_enforcement():
    """Officer access check must enforce assigned_user_id over stale officer display name."""
    # Case was reassigned from Rajesh to Arun, but display name wasn't updated or is stale
    stale_complaint = Complaint(
        id="CASE-STALE-1",
        bureau="PGRC",
        status="In Progress",
        assigned_user_id="u6",  # Arun Sharma is authoritative
        officer="Rajesh Kumar",   # Stale name
    )

    # Arun Sharma (u6) MUST have access (no exception)
    check_case_access(OFFICER_ARUN, stale_complaint)

    # Rajesh Kumar (u2) MUST NOT have access despite name matching (HTTPException 403)
    with pytest.raises(HTTPException) as exc_info:
        check_case_access(OFFICER_RAJESH, stale_complaint)
    assert exc_info.value.status_code == 403


def test_api_complaint_creation_least_loaded_integration():
    """Verify complaint creation via API applies fair automatic assignment server-side."""
    # Setup session with Arun (0 cases) and Rajesh (3 cases)
    pgrc_cases = [
        Complaint(id=f"PGRC-SEED-{i}", bureau="PGRC", status="Pending", assigned_user_id="u2", officer="Rajesh Kumar")
        for i in range(3)
    ]
    mock_db = FairAssignmentMockSession(
        users=[OFFICER_RAJESH, OFFICER_ARUN, USER_CITIZEN],
        complaints=pgrc_cases,
    )

    def override_get_db():
        yield mock_db

    def override_get_current_user():
        return USER_CITIZEN

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        client = TestClient(app)
        payload = {
            "title": "Unfair fee hike reported by students",
            "description": "Fee regulation violation in third year curriculum fee structure.",
            "bureau": "PGRC",
            "category": "Fee Regulation",
            "priority": "High",
            "institutionId": "i1",
            "institutionPermanentId": "1-4821039",
            "complainantType": "Student",
            "complainantName": "Rohit Sharma",
            "complainantEmail": "rohit.sharma@student.edu.in",
            "complainantPhone": "+91 98765 43210",
        }

        response = client.post("/api/complaints/", json=payload)
        assert response.status_code == 201, f"Failed: {response.text}"
        data = response.json()

        # Must be assigned to Arun Sharma (least loaded) with authoritative ID
        assert data["assignedUserId"] == "u6", "Must be assigned to Dr. Arun Sharma (u6)"
        assert data["officer"] == "Dr. Arun Sharma"
        assert data["bureau"] == "PGRC"

        # Check timeline recorded the assignment
        timeline = data.get("timeline", [])
        assignment_events = [t for t in timeline if "Assigned to Dr. Arun Sharma" in t.get("label", "")]
        assert len(assignment_events) >= 1, "Timeline must record allocation to Dr. Arun Sharma"
    finally:
        app.dependency_overrides.clear()


def test_api_complaint_creation_unassigned_fallback():
    """Verify complaint creation falls back to Unassigned when no officer is available."""
    mock_db = FairAssignmentMockSession(
        users=[USER_CITIZEN],  # No officers
        complaints=[],
    )

    def override_get_db():
        yield mock_db

    def override_get_current_user():
        return USER_CITIZEN

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        client = TestClient(app)
        payload = {
            "title": "Curriculum standards deficiency",
            "description": "Outdated syllabus without modern laboratory modules.",
            "bureau": "Academic",
            "category": "Curriculum",
            "priority": "Medium",
            "institutionId": "i1",
            "institutionPermanentId": "1-4821039",
            "complainantType": "Student",
            "complainantName": "Rohit Sharma",
            "complainantEmail": "rohit.sharma@student.edu.in",
            "complainantPhone": "+91 98765 43210",
        }

        response = client.post("/api/complaints/", json=payload)
        assert response.status_code == 201, f"Failed: {response.text}"
        data = response.json()

        assert data["assignedUserId"] is None
        assert data["officer"] == "Unassigned"

        timeline = data.get("timeline", [])
        pending_events = [t for t in timeline if "Pending Officer Allocation" in t.get("label", "")]
        assert len(pending_events) >= 1, "Timeline must record pending officer allocation"
    finally:
        app.dependency_overrides.clear()


def test_api_manual_reassignment_authoritative():
    """Verify authorized admin can reassign case, updating ID and officer display name atomically."""
    existing_case = Complaint(
        id="PGRC-2026-9999",
        institution_id="i1",
        bureau="PGRC",
        category="Fee Regulation",
        priority="High",
        officer="Rajesh Kumar",
        assigned_user_id="u2",
        status="Pending",
        date="2026-10-10",
        due="2026-10-30",
        title="Excess exam fees",
        description="Students asked to pay extra for question paper printing.",
        complainant_name="Citizen",
        complainant_email="citizen@gov.in",
    )

    mock_db = FairAssignmentMockSession(
        users=[USER_ADMIN, OFFICER_RAJESH, OFFICER_ARUN],
        complaints=[existing_case],
    )

    def override_get_db():
        yield mock_db

    def override_get_current_user():
        return USER_ADMIN

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        client = TestClient(app)
        payload = {
            "officer": "Dr. Arun Sharma",
            "reason": "Workload balancing re-allocation",
        }

        response = client.put(f"/api/complaints/{existing_case.id}/assign", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()

        assert data["officer"] == "Dr. Arun Sharma"
        assert data["assignedUserId"] == "u6"
        assert existing_case.assigned_user_id == "u6"
        assert existing_case.officer == "Dr. Arun Sharma"
    finally:
        app.dependency_overrides.clear()
