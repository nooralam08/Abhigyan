# Abhigyan

**Integrated Dashboard for Monitoring, Tracking, and AI-Based Classification of Institution-Related Complaint Cases Across AICTE Bureaus & Cells**

*Smart India Hackathon (SIH) — All India Council for Technical Education (AICTE)*

- **Repository:** [https://github.com/nooralam08/Abhigyan](https://github.com/nooralam08/Abhigyan)
- **Primary Branch:** `main`

A specialized governance portal prototype engineered for the All India Council for Technical Education (AICTE) to monitor, cross-reference, and track institution-related grievances across AICTE bureaus and cells—specifically highlighting the **Regulation Bureau (RB)** and the **Public Grievance Redressal Cell (PGRC)**.

> **Demonstration Notice:** All complaint records, match scores, SLA thresholds, and resolution metrics in this prototype are demonstration data and do not represent verified AICTE policy, live records, or official government data.

---

## 1. System Overview & Architecture

Abhigyan is a specialized institutional governance and grievance redressal platform engineered for the All India Council for Technical Education (AICTE). It provides end-to-end docket intake, AI-assisted advisory routing, cross-bureau overlap detection, SLA surveillance, and immutable audit trails across AICTE administrative divisions.

### System Architecture

```mermaid
graph TD
    Client["React 18 + Vite SPA<br/>(TailwindCSS, TypeScript)"]
    API["FastAPI Backend<br/>(REST API, JWT, RBAC)"]
    DB[("PostgreSQL Database<br/>(Alembic Migrations)")]
    ML["NLP Classifier Service<br/>(TF-IDF + Logistic Regression)"]
    Rules["Statutory Routing Rules<br/>(Multi-Bureau Resolution)"]
    Overlaps["Cross-Bureau Overlap Engine<br/>(Dynamic Thresholds & History)"]
    Settings["Persistent System Settings<br/>(SLA & Sensitivity Sync)"]

    Client -->|REST & Bearer JWT| API
    API -->|ORM Transactions| DB
    API -->|Advisory Ingestion| ML
    ML -->|Category & Raw Probabilities| Rules
    Rules -->|Suggested Bureau & Review Flags| API
    API -->|Overlap Queries & Reviews| Overlaps
    API -->|Authoritative SLA & Settings| Settings
    API -->|Advisory Recommendations| Client
```

### Core Architecture Highlights

1. **AI-Based Advisory Classification**: Real-time debounced machine learning preview that analyzes complaint subject and narrative text. Predicts category, bureau, and statutory urgency without automatically forcing suggestions onto the complainant.
2. **Hybrid Bureau Routing Engine**: Combines statistical NLP (scikit-learn Logistic Regression) with AICTE administrative domain heuristics to map complaints to the correct Bureau (Approval, Regulation, PGRC, Academic, Skill, Executive Office).
3. **Cross-Bureau Overlap Detection & Manual Officer Review**: Rule-based cross-referencing identifies duplicate or related complaints filed simultaneously across RB, PGRC, and other bureaus for the same institution. Linked complaints preserve independent dockets with mutual references with zero destructive auto-merging.
4. **Dynamic Threshold Filtering & History Preservation**: The global similarity threshold dynamically filters open candidate pairs. Historical officer decisions (`linked`, `dismissed`, `deferred`) remain permanently preserved and are never reverted to "pending" when thresholds change.
5. **Fine-Grained Role-Based Access Control (RBAC)**: Enforces strict data isolation among 4 distinct role tiers:
   - **System Admin**: System-wide authority, cross-bureau reassignment, policy settings, analytics, status override with audit note.
   - **Bureau Admin**: Scoped strictly to cases within their authorized Bureau jurisdiction (e.g., PGRC), intra-bureau officer assignment, bureau overlap review.
   - **Handling Officer**: Scoped strictly to assigned dockets or their Bureau cell; drives investigation lifecycle.
   - **Student / Complainant**: Self-service intake and docket tracking; strictly isolated to own submissions.
6. **Chronological Audit Trail & Immutable Timelines**: Every case intake, status transition, officer reassignment, and remark generates a timestamped database timeline event with actor verification derived directly from verified JWT tokens.
7. **Statutory SLA Surveillance Engine & Persistent Settings**: Dynamic resolution windows calculated from grievance priority (Critical: 3 days, High: 7 days, Medium: 14 days) and stored in PostgreSQL, with warning indicators for overdue cases.
8. **Institution Directory & Risk Profiles**: Campus registry showing grievance density, active case counts, and risk levels per institution.

---

## 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 | Vite 5 build tool, SPA architecture |
| **Frontend Language** | TypeScript 5 | Strict typing across models, API contracts, and components |
| **Styling & Design** | Tailwind CSS 3 | Custom AICTE institutional navy palette, responsive layout |
| **Icons & Visuals** | Lucide React, Recharts | Data visualizations, trend graphs, and SVG iconography |
| **Backend Framework** | FastAPI | High-performance Python async REST API, OpenAPI docs |
| **ORM & Database** | SQLAlchemy 2 + PostgreSQL | Relational schema, ACID transactions, connection pooling |
| **Database Migrations**| Alembic (revisions 001–006)| Version-controlled schema migrations |
| **Machine Learning** | scikit-learn + joblib | TF-IDF Vectorizer + Multinomial Logistic Regression |
| **Security & Auth** | PyJWT + Bcrypt | Stateless Bearer JWT tokens, role-based route dependencies |
| **Testing** | pytest, Node.js Test Runner | 81 backend tests + 67 frontend tests |

---

## 3. Machine Learning Pipeline & Advisory Integration

### Architecture & Non-Overriding Design Principle

The AI classification engine uses a scikit-learn pipeline consisting of a `TfidfVectorizer` (sublinear TF, unigram + bigram, 5,000 max features) and L-BFGS `LogisticRegression` models trained across 9 official AICTE complaint categories:

- Fee Regulation & Unauthorised Charges
- Faculty Norms & Shortage
- Infrastructure Deficit & Safety
- Admission & Counseling Irregularities
- Certificate & Transcript Delay
- Curriculum & Examination Irregularities
- Unapproved Courses & Bogus Programs
- Harassment & Anti-Ragging
- Skill Certification & Stipend Schemes

> [!IMPORTANT]
> **Advisory Disclaimer & Ethical Human-in-the-Loop Safeguards**:
> - AI suggestions are **strictly advisory** and do NOT constitute an official AICTE decision.
> - The application **never fabricates predictions** or automatically overrides user decisions. Users retain full freedom to select or change category, bureau, and priority dropdowns at any time.
> - When confidence is below the configured threshold (`AI_CONFIDENCE_THRESHOLD=0.40`) or multi-bureau ambiguity is detected, the system flags `needsManualReview = true` to mandate human officer scrutiny.

### Model Evaluation Benchmark (Held-Out Stratified Test Split)

| Evaluation Target | Method / Architecture | Accuracy | Macro F1 | Performance Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Category** (9 Classes) | TF-IDF + Logistic Regression | **72.2%** | **0.6974** | Strong baseline on distinctive terminology |
| **Bureau** (Direct ML) | TF-IDF + Logistic Regression | **44.4%** | **0.1713** | Limited on raw text due to multi-bureau keywords |
| **Bureau** (Hybrid Rules+ML)| Administrative Domain Heuristics | **83.3%** | **0.7337** | **+38.9% accuracy gain** through domain routing |
| **Priority** (4 Classes) | TF-IDF + Logistic Regression | **38.9%** | **0.1726** | Biased to majority class; priority requires external calendar context |

*(Evaluated on 180 synthetic complaints generated for prototype evaluation. See [backend/ml/artifacts/evaluation_report.md](file:///d:/Projects/Abhigyan/backend/ml/artifacts/evaluation_report.md) for full confusion matrices and class distributions).*

---

## 4. Demo Credentials (Development & Demonstration Only)

All seeded demo accounts are configured with the default demonstration password:

```
AicteDemo@2026
```

| Role Persona | Display Name | Email / Login ID | Bureau Jurisdiction | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Dr. S. Mehta | `member-sec@aicte-india.org` | All Bureaus (System-wide) | `AicteDemo@2026` |
| **Bureau Admin** | Dr. Priya Nair | `priya.nair@aicte-india.org` | PGRC Bureau | `AicteDemo@2026` |
| **Bureau Admin** | Anita Verma | `anita.verma@aicte-india.org` | Regulation Bureau (RB) | `AicteDemo@2026` |
| **Handling Officer** | Rajesh Kumar | `rajesh.kumar@aicte-india.org` | PGRC Scrutiny Cell | `AicteDemo@2026` |
| **Handling Officer** | Suresh Patel | `suresh.patel@aicte-india.org` | Approval Bureau Cell | `AicteDemo@2026` |
| **Student / Citizen** | Rohit Sharma | `rohit.sharma@student.edu.in` | Self-Service Complainant | `AicteDemo@2026` |

> **Quick Access:** In development mode (`DEMO_AUTH_ENABLED=True`), the login screen also provides convenient one-click demo login buttons for each role perspective.

---

## 5. Setup & Execution Guide (Windows PowerShell)

### Prerequisites

- **Node.js**: v18.x or v20.x LTS
- **Python**: v3.10, v3.11, or v3.12
- **PostgreSQL**: v14, v15, v16, or v18 running locally on port 5432
- **Git**

---

### Step 1: Clone Repository

```powershell
git clone https://github.com/nooralam08/Abhigyan.git
cd Abhigyan
```

---

### Step 2: Backend Setup & Virtual Environment

1. Navigate to the `backend/` directory or run from the repository root:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install backend dependencies:
   ```powershell
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

3. Configure Supabase and environment variables:
   - In the Supabase dashboard, open your project and select **Connect**.
   - Copy the **Session pooler** connection string. It works from IPv4-only local networks; use the exact host, port, and username Supabase provides.
   - Copy the example environment file to `backend/.env`:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
   Open `backend/.env` and set `DATABASE_URL` to the copied connection string. Replace its password placeholder with your Supabase database password. If the password contains reserved URL characters (such as `@`, `:`, `/`, `?`, or `#`), percent-encode them. Keep this file private; it is ignored by Git.
   ```ini
   DATABASE_URL=postgresql://postgres.PROJECT-REF:YOUR-PASSWORD@YOUR-POOLER-HOST:5432/postgres?sslmode=require
   CORS_ORIGINS=http://localhost:5173,http://localhost:4173
   ENVIRONMENT=development
   API_PREFIX=/api
   JWT_SECRET_KEY=your-secure-random-secret-key-min-32-chars
   ACCESS_TOKEN_EXPIRE_MINUTES=120
   DEMO_AUTH_ENABLED=True
   AI_CONFIDENCE_THRESHOLD=0.40
   ```

4. Verify database connectivity (this command only checks the connection; Supabase creates the project database for you):
   ```powershell
   python backend/check_db.py
   ```

5. Apply the schema migrations to your Supabase project:
   ```powershell
   cd backend
   alembic upgrade head
   cd ..
   ```

6. Optional: seed demo records. Do this only for a new/empty project or if you want the demo accounts and sample cases in your Supabase database:
   ```powershell
   python backend/app/seed.py
   ```

7. (Optional) Retrain or evaluate Machine Learning models:
   ```powershell
   python backend/ml/train_model.py
   python backend/ml/evaluate_model.py
   ```

8. Start FastAPI backend server:
   ```powershell
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   The backend API is accessible at:
   - Base API: `http://localhost:8000/api`
   - Interactive Swagger API Docs: `http://localhost:8000/docs`
   - ReDoc Documentation: `http://localhost:8000/redoc`
   - Health Check: `http://localhost:8000/api/health`

---

### Step 3: Frontend Setup & Startup

Open a new PowerShell terminal at the project root (`Abhigyan/`):

1. Install frontend dependencies:
   ```powershell
   npm install
   ```

2. (Optional) Configure API Base URL:
   Defaults to `https://abhigyann.onrender.com/api` (Production Render backend). To customize for local development, create a `.env` in the root:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

3. Start development server:
   ```powershell
   npm run dev
   ```
   Access the web application at `http://localhost:5173/`.

4. Production Build & Preview:
   ```powershell
   npm run build
   npm run preview
   ```

---

## 6. Automated Verification & Testing Suites

### Running Backend Tests (`pytest`)

Run all 81 unit, integration, RBAC, workflow, and evaluation tests:

```powershell
.\.venv\Scripts\python -m pytest backend/tests -v
```

Test suites cover:
- `tests/test_complete_audit_workflows.py`: Complete Student, Officer, Bureau Admin, Super Admin workflows and error guards.
- `tests/test_auth_rbac.py`: JWT login, password verification, token expiration, demo-login isolation, and case access authorization.
- `tests/test_complaint_workflows.py`: Status transitions, permitted lifecycle paths, assignment rollback, and timeline actor auditing.
- `tests/test_overlaps.py`: Cross-bureau overlap detection, sensitivity threshold filtering, manual confirmation persistence, role gating.
- `tests/test_settings.py`: Authoritative system settings, Admin update persistence, SLA hierarchy validation, and threshold candidate filtering.
- `tests/test_ai_complaint_integration.py`: Live classification preview, non-override creation, missing model fallbacks.
- `tests/test_ai_classifier.py`: Text preprocessing, model loading, thresholding, rule-based bureau resolution.
- `tests/test_model_evaluation.py`: Reproducible stratified splits, zero data leakage checks, metric math validity.
- `tests/test_institutions.py` & `tests/test_health.py`: Registry queries, search filters, and database connectivity.

### Real-Database Live Verifications

Execute end-to-end integration verifications against live PostgreSQL:

```powershell
.\.venv\Scripts\python backend/verify_live_phase2c.py
```

### Running Frontend Tests (`node:test`)

Run all 67 frontend automated integration tests against the live API:

```powershell
npm test
```

### TypeScript Compilation Check

```powershell
npx tsc --noEmit
```

---

## 7. Repository File Structure

```
Abhigyan/
├── backend/
│   ├── alembic/                    # Alembic database migration scripts
│   │   ├── versions/               # Revisions 001 through 006
│   │   └── env.py                  # Alembic migration runner configuration
│   ├── app/
│   │   ├── models/                 # SQLAlchemy ORM models (User, Institution, Complaint, Timeline, Overlap, Setting)
│   │   ├── routers/                # FastAPI endpoints (health, auth, institutions, complaints, overlaps, settings)
│   │   ├── schemas/                # Pydantic validation schemas & response contracts
│   │   ├── services/
│   │   │   └── ai_classifier.py    # Lazy-loading AI classifier & statutory routing engine
│   │   ├── auth.py                 # JWT validation, password hashing, RBAC check_case_access
│   │   ├── config.py               # Application settings via pydantic-settings
│   │   ├── database.py             # SQLAlchemy sessionmaker & engine
│   │   ├── main.py                 # FastAPI application factory & router inclusion
│   │   └── seed.py                 # Idempotent demo database seeding
│   ├── ml/
│   │   ├── artifacts/              # Local model weights (.joblib, metadata.json, evaluation_report.md)
│   │   ├── evaluate_model.py       # Standalone stratified evaluation benchmark
│   │   ├── generate_dataset.py     # Synthetic dataset generator
│   │   ├── train_model.py          # TF-IDF + LogisticRegression training pipeline
│   │   └── training_data.csv       # Labeled synthetic complaint examples (180 rows)
│   ├── tests/                      # Automated pytest test suites (81 tests)
│   ├── alembic.ini                 # Alembic configuration
│   ├── check_db.py                 # Database connectivity & creation verification
│   ├── requirements.txt            # Python dependencies
│   └── verify_live_phase2c.py      # End-to-end live database verification script
├── src/
│   ├── api/                        # Frontend API clients (auth, complaints, overlaps, settings, client)
│   │   └── __tests__/              # Automated test suites (67 tests)
│   ├── components/                 # UI components and layouts
│   │   ├── layout/                 # AppLayout, Sidebar, TopBar
│   │   ├── ComplaintTable.tsx      # Sortable complaint directory
│   │   └── ui.tsx                  # Shared design system components
│   ├── pages/                      # Page views (Dashboard, Complaints, Overlaps, Settings, etc.)
│   ├── types.ts                    # TypeScript domain interfaces
│   ├── data.ts                     # Workflow rules, transition logic, and mock fallbacks
│   ├── App.tsx                     # Top-level state management & view routing
│   └── main.tsx                    # React DOM entry point
├── .env.example                    # Root environment template
├── .gitignore                      # Git exclusion rules (ignores .env, caches, venv, dist)
├── package.json                    # Node dependencies and scripts
├── tailwind.config.js              # Institutional navy styling theme
├── tsconfig.json                   # TypeScript compiler options
└── vite.config.ts                  # Vite build configuration
```

---

## 8. Known Demonstration Boundaries & Limitations

To maintain strict submission integrity, the following boundaries are disclosed:

1. **Email Alerts & Auto-Escalation:** The email alert and automated SLA escalation controls in Settings are demonstrable configuration toggles stored in the database. Background celery/cron workers and live SMTP relay servers are not attached in this prototype.
2. **AI Overlap Match Scoring:** Overlap similarity scores (0–100%) are computed via deterministic string matching, institutional ID intersection, and category analysis rather than live vector database embeddings.
3. **Document Attachments:** Uploaded supporting grievance documents in Case Details are retained within client state/storage and are not uploaded to an external object store (e.g. AWS S3).
4. **Synthetic Model Training Data:** The ML classifier prototype is trained on 180 synthetic complaint examples for architectural demonstration. Real-world operational deployment requires training on anonymized institutional complaint dossiers, continuous drift monitoring, and periodic recalibration.
