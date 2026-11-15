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
- [Sharing and public posts](#sharing-and-public-posts)
- [Hosting a public demo](#hosting-a-public-demo)
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
- **Human risk override** — approval can set a new risk level, and the *Moderated posts* tab can change the risk of any published, approved or rejected post after the fact. The author is notified, the change is written to the audit log, and the original `Prediction` row is never edited.
- Filter the queue and moderated lists by risk level; the history shows each risk transition (e.g. high → medium).
- Resolution of user reports and a complete moderation history.
- Every action is written to an audit log and preserves the original model prediction.

### Sharing
- Share low/medium-risk public posts to X, Facebook, LinkedIn, WhatsApp or Telegram using official intent URLs, or copy a direct link.
- High-risk and non-public posts cannot be shared; the control is disabled with an explanation.
- Every published post has a public page at `/post/:id` so shared links work for signed-out visitors.
- Shared pages always show the model, confidence, timestamp and limitations text.

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

For a richer demo (six extra users, generated image posts, high-risk posts, an approved post whose risk was lowered and a rejected post), also run:

```bash
python manage.py seed_extra
```

Both seed commands are idempotent and safe to run again.

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

Open <http://localhost:5173>. The frontend calls the API on the **same origin**; the Vite dev server proxies `/api` and `/media` to Django on port 8000. To target a separate backend instead, create `frontend/.env`:

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

Optional additions from `seed_extra`:

| Username | Role | Demo content |
|---|---|---|
| `dummy` | User | High-risk post in the queue + a normal post |
| `emma` | User | Image post + a high-risk post |
| `frank` | User | Image post + a normal post |
| `grace` | User | Image post |
| `henry` | User | High-risk post |
| `isla` | User | High-risk post and a user report |

> These credentials are for the demo database only. Change or remove them before any public deployment.

---

## Sharing and public posts

- Only **low** and **medium** risk posts that are already public (`published` or `approved`) show an enabled Share button.
- High-risk posts show a locked button with an explanation. A moderator can lower the risk from *Moderation → Moderated posts*; the model prediction stays unchanged.
- The share menu opens the platform's official share intent (X, Facebook, LinkedIn, WhatsApp, Telegram) or copies `.../post/:id` to the clipboard. No developer API keys are required.
- `/post/:id` is public, so anyone with the link can read the post. It shows the author, risk badge, model name/version, confidence, timestamp and the limitations notice.

---

## Hosting a public demo

### Option A — temporary public URL (no account, ~1 minute)

This exposes your running local servers through a Cloudflare Quick Tunnel. The URL stays alive only while the tunnel process and this computer stay running.

1. Start the project normally (`start-project.bat`, or the backend and frontend windows).
2. Double-click **`start-public-tunnel.bat`** (or run `start-public-tunnel.bat` in Command Prompt).
3. Wait for a line like `https://something-random.trycloudflare.com` and share that address.

The tunnel points at Vite (`:5173`), which proxies `/api` and `/media` to Django, so the whole app works on one HTTPS origin. Alternative manual command:

```bat
cloudflared tunnel --url http://localhost:5173
```

### Option B — permanent deployment (Render, free tier)

The repository contains a production **Dockerfile** and a **`render.yaml`** blueprint that build the React app and serve it from Django (WhiteNoise + gunicorn) on one HTTPS domain.

1. Push this repository to GitHub (already done for this project).
2. Create a free account at <https://render.com> and connect GitHub.
3. Choose **New + → Blueprint**, select the repository, and apply the detected `render.yaml`.
4. Wait for the first build. It runs migrations and both seed commands, trains the four models, then starts gunicorn. The service URL (`https://<name>.onrender.com`) is your shareable link.
5. Open **Environment** if you need to change `TG_HIGH_RISK_THRESHOLD`, `TG_MEDIUM_RISK_ACTION`, etc.

The free blueprint uses SQLite inside the container, which is **ephemeral**: data resets whenever the service redeploys or restarts, and the demo content/models are recreated automatically. For persistent data, create a Render PostgreSQL instance and set `USE_SQLITE=0`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.

Any Docker host (Fly.io, Railway, a VPS) works the same way:

```bash
docker build -t truthguard .
docker run -p 8000:8000 -e DJANGO_DEBUG=0 -e DJANGO_SECRET_KEY=change-me truthguard
```

Then open <http://localhost:8000> — Django serves the SPA, API, media and admin from one port.

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

- Set `DJANGO_DEBUG=0`, a strong `DJANGO_SECRET_KEY`, and a restricted `DJANGO_ALLOWED_HOSTS`. Set `DJANGO_EXTRA_ALLOWED_HOSTS` for additional domains.
- `DJANGO_BEHIND_PROXY=1` (default) trusts `X-Forwarded-Proto` so HTTPS is detected correctly behind Render/Cloudflare.
- The Docker image runs `collectstatic` and WhiteNoise serves Django admin/API-doc assets; the React build is served from `frontend_dist` by `config/views.py`.
- User-uploaded media and model artifacts live on the container filesystem in the demo image. Use object storage or a persistent volume for real deployments.
- Use PostgreSQL (`USE_SQLITE=0`) for persistent data and proper backups.
- Replace the demo accounts and rotate all credentials. The demo seed commands are meant for evaluation, not production.
- Consider restricting social sharing, adding rate limits and reviewing the disclaimer before allowing public sign-ups.

---

## License / use

Built for academic demonstration. The source code is provided as-is for learning and evaluation. Do not use the risk score as the sole basis for moderation or publication decisions.
