# TruthGuard

**Early Misinformation Risk Prediction Using Data Mining — "Think Before You Share."**

TruthGuard is a full-stack social platform where every post is analysed by a machine-learning model **before** it becomes visible. The model's prediction is mapped to a risk level that decides the post's fate: publish, publish with a warning, or hold for human moderation. Moderators see the complete prediction evidence and make the final call.

> **Academic project disclaimer:** TruthGuard is a research / coursework demonstration. Its risk prediction is decision support only — it is **not** a fact-checking authority. Always verify claims with primary sources.

---

## Table of contents

- [Features](#features)
- [How the risk pipeline works](#how-the-risk-pipeline-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Dataset policy](#dataset-policy)
- [API documentation](#api-documentation)
- [Limitations](#limitations)
- [Production notes](#production-notes)

---

## Features

### Publishing & prediction
- **Analyze before publishing** — get a live prediction with confidence, class probabilities, model name/version and timestamp before committing a post.
- **Automatic analysis on publish** — the active model runs server-side; the resulting `Prediction` record is immutable evidence.
- **Risk-based publishing policy** — low risk publishes immediately, medium risk publishes with a visible warning (configurable), high risk is held for moderation.
- **Full prediction transparency** — every risk badge can be traced back to the stored prediction (label, confidence, class probabilities, model version).

### Social platform
- Feed with risk badges, likes, comments, reports and notifications.
- User dashboard: own posts, recent predictions, reports, profile and settings.
- Author notifications when a moderator decides on their post.

### Moderation
- Queue of high-risk / reported content, with full model evidence side by side.
- Approve or reject posts with mandatory remarks.
- Resolution of user reports and a complete moderation history.
- Every action is written to an audit log and preserves the original model prediction.

### Administration & analytics
- Live platform analytics: posts, users, risk distribution, activity charts, moderation throughput.
- Dataset management: CSV/JSON upload, column mapping, validation & cleaning report, versioning, preview.
- Model management: train Decision Tree, Random Forest, Naive Bayes and Linear SVM; compare real metrics (accuracy, precision, recall, F1, confusion matrix); activate one model at a time.
- User management and searchable audit logs.

---

## How the risk pipeline works

1. The post text (title excluded) is preprocessed: lowercasing, punctuation removal, tokenisation, stop-word removal.
2. Text is vectorised with **TF-IDF** (unigrams + bigrams) inside a scikit-learn pipeline.
3. The **active** model predicts a label (`fake` / `real`) and a confidence score.
4. Risk mapping (`backend/apps/ml/prediction.py`):

   | Model output | Risk level | Default action |
   |---|---|---|
   | `real` | 🟢 **Low** | Publish |
   | `fake`, confidence < `TG_HIGH_RISK_THRESHOLD` (0.75) | 🟡 **Medium** | Publish with warning (configurable) |
   | `fake`, confidence ≥ `TG_HIGH_RISK_THRESHOLD` | 🔴 **High** | Hold for moderator review |

5. High-risk content stays `pending_review` and is **never public** until a moderator approves it. Moderators may also override the risk level; the original `Prediction` row is never modified, so the model's evidence remains auditable.

Only one model version can be active at a time. Activating a new version automatically deactivates the previous one.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide icons |
| Backend | Django 4.2, Django REST Framework, SimpleJWT, drf-spectacular, django-cors-headers |
| ML | scikit-learn 1.5, pandas, NumPy, NLTK (optional), joblib |
| Database | PostgreSQL (primary) · SQLite (development fallback) |
| Auth | JWT access/refresh tokens, role-based access control |

---

## Project structure

```
risk/
├─ backend/
│  ├─ apps/
│  │  ├─ accounts/      # users, profiles, JWT auth, admin user management
│  │  ├─ posts/         # posts, likes, comments, reports, notifications
│  │  ├─ ml/            # preprocessing, training, prediction, model versions
│  │  ├─ datasets/      # upload, validation, cleaning, versioning
│  │  ├─ moderation/    # queue, decisions, risk overrides, history
│  │  ├─ analytics/     # live platform analytics & exports
│  │  └─ core/          # audit log, shared permissions/utilities
│  ├─ config/           # settings, URLs, WSGI/ASGI
│  ├─ manage.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ api/           # typed API clients
│  │  ├─ components/    # layout, cards, moderation tables, modals
│  │  └─ pages/         # landing, auth, user, moderator, admin
│  ├─ package.json
│  └─ vite.config.ts
├─ .gitignore
└─ README.md
```

---

## Quick start

### Prerequisites
- Python **3.10+**
- Node.js **18+** and npm
- PostgreSQL **14+** (optional — the SQLite fallback is enough for a local demo)

### 1. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` (copy `backend/.env.example`) and set at minimum:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-string
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Quick local demo without PostgreSQL:
USE_SQLITE=1

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
TG_HIGH_RISK_THRESHOLD=0.75
TG_MEDIUM_RISK_ACTION=publish
```

Then apply migrations and seed the demo data:

```bash
python manage.py migrate
python manage.py seed_demo
```

`seed_demo` creates the demo accounts, a clearly-labelled **synthetic** sample dataset, trains all four classifiers through the real training pipeline, activates the best model by F1, and publishes demo posts through the real prediction workflow.

Start the API:

```bash
python manage.py runserver 8000
```

- API: <http://localhost:8000/api/>
- Swagger UI: <http://localhost:8000/api/docs/>
- Django admin: <http://localhost:8000/admin/>

> On Windows, `runserver --noreload` is recommended while editing backend code to avoid duplicate reloader processes.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The frontend defaults to `http://localhost:8000` as the API base URL; to change it, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Production build:

```bash
npm run build   # output in frontend/dist
```

### Windows: run without PowerShell

The scripts in the repository root are plain `.bat` files, so they work in **Command Prompt** or by **double-clicking** — no PowerShell needed.

**Easiest:** double-click **`start-project.bat`**. It opens two Command Prompt windows (backend + frontend), waits for them to boot, and opens <http://localhost:5173> in your browser.

You can also start each side separately by double-clicking:

- `start-backend.bat` — creates the virtualenv if needed, installs dependencies, migrates and runs Django on port 8000.
- `start-frontend.bat` — installs npm dependencies if needed and runs Vite on port 5173.

Or from Command Prompt:

```bat
cd /d C:\path\to\risk
start-backend.bat
start-frontend.bat
```

**Manual Command Prompt commands** (use two windows):

```bat
REM Window 1 - backend
cd /d C:\path\to\risk\backend
venv\Scripts\python.exe manage.py runserver 8000 --noreload

REM Window 2 - frontend
cd /d C:\path\to\risk\frontend
npm run dev
```

> **Important:** run the backend commands from `backend\` and the frontend commands from `frontend\`.
> `venv` lives inside `backend\`, and `package.json` lives inside `frontend\`. Running
> `venv\Scripts\python manage.py` or `npm run dev` from the repository root will fail with
> "module venv could not be loaded" / "Could not read package.json".

To stop the project, press `Ctrl+C` in both windows (or close them).

---

## Demo accounts

All demo accounts use the password **`TruthGuard#2026`**. Login accepts either username or email.

| Username | Email | Role | Purpose |
|---|---|---|---|
| `admin` | admin@truthguard.local | Administrator | Full admin: analytics, datasets, models, users, audit logs |
| `moderator` | moderator@truthguard.local | Moderator | Moderation queue, reports, risk overrides |
| `alice` | alice@example.com | User | Demo author (has published posts) |
| `bob` | bob@example.com | User | Demo author |
| `carol` | carol@example.com | User | Demo author (flagged content) |
| `dave` | dave@example.com | User | Demo author |

> These credentials are for the local demo database only. Change or remove them before any public deployment.

Optional additions (if present in the seed command output):

| Username | Role |
|---|---|
| `dummy`, `emma`, `frank`, `grace`, `henry`, `isla` | User |

---

## Dataset policy

- The repository ships **no third-party news datasets**. `seed_demo` generates a synthetic, patterned sample dataset locally so the full pipeline can be demonstrated without redistribution restrictions.
- Synthetic-data metrics are **not** real-world performance. The sample is trivially separable, so accuracy near 1.0 is expected and must not be presented as evidence of real-world accuracy.
- For a genuine evaluation, upload a legally obtained copy of **ISOT Fake News**, **LIAR** or **FakeNewsNet** through the admin dataset screen and map its text/label columns. The validation report shows dropped rows, duplicates, missing values and class distribution before training.

---

## API documentation

Interactive OpenAPI documentation is generated by drf-spectacular at:

- Schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`

Main endpoint groups:

| Prefix | Purpose |
|---|---|
| `/api/auth/` | register, login, refresh, logout, profile |
| `/api/posts/` | feed, own posts, detail, like, comment, report |
| `/api/predictions/` | analyze text before publishing |
| `/api/moderation/` | stats, queue, reports, approve/reject, risk override, history |
| `/api/models/` | list, train, compare, activate/deactivate |
| `/api/datasets/` | upload, validate, preview, versions |
| `/api/analytics/` | overview, risk distribution, activity, exports |
| `/api/admin/users/` | user administration |
| `/api/admin/audit-logs/` | audit trail |
| `/api/public/stats/` | public landing-page counters |

---

## Limitations

- The demo model is trained on synthetic template text. It learns surface patterns and will not generalise to real-world misinformation.
- Misinformation detection is inherently context-dependent; short posts, sarcasm, satire and quoted false claims are especially hard.
- Predictions are probabilistic. Confidence is the model's confidence in its label, **not** a guarantee of truth.
- The UI always shows the model name/version, timestamp, confidence and a limitations notice so users can judge the evidence.
- Sharing uses platform intent URLs (no developer API keys). Direct posting via OAuth would require app credentials for each platform and is out of scope.

---

## Production notes

- Set `DJANGO_DEBUG=0`, a strong `DJANGO_SECRET_KEY`, and a restricted `DJANGO_ALLOWED_HOSTS`.
- Use PostgreSQL (`USE_SQLITE=0`) and proper database credentials.
- Serve media and static files through a web server or object storage, not Django.
- Configure HTTPS, secure cookies, rate limiting and regular backups.
- Replace the demo accounts and rotate all credentials.

---

## License / use

Built for academic demonstration. The source code is provided as-is for learning and evaluation. Do not use the risk score as the sole basis for moderation or publication decisions.
