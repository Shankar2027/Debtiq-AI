

# ⚡ DebtIQ™ — Automated Technical Debt Remediation Platform

DebtIQ™ is a production-hardened, full-stack AI Agentic framework engineered to automate code health audits, compute structural architectural debt, identify critical security vulnerabilities, and provide instant co-pilot refactoring patches.

Built with a high-performance **FastAPI** backend and a responsive **React (Vite)** dashboard, DebtIQ seamlessly ingests remote GitHub repositories, processes codebase files concurrently, and manages API rate constraints dynamically.

---

## 🛠️ The Tech Stack

DebtIQ utilizes a robust, decoupled multi-stage microservices layout to achieve lightning-fast repo analysis and resilient operations.

* **Frontend UI:** React (Vite) — Powers a high-speed, dark-themed Single Page Application (SPA) utilizing asynchronous network state management for real-time responsiveness.
* **Styling:** Tailwind CSS — Empowers a fully responsive dashboard grid system with custom flexbox layouts that scale down perfectly to mobile viewports.
* **Charts:** Recharts — Renders dynamic analytics, line graphs, and gauge visualizations tracking historical code quality metrics.
* **Backend API:** FastAPI + Uvicorn — High-performance, asynchronous ASGI Python framework enabling concurrent HTTP requests and non-blocking background workers.
* **Data Validation:** Pydantic v2 — Enforces strict compile-time type-safety schemas for structural data coming into and leaving the API layer.
* **Database Driver:** Asyncpg — A high-speed, asynchronous PostgreSQL client library designed specifically for handling heavy database connection pooling.
* **Database:** Cloud PostgreSQL — Acts as the relational persistence layer, tracking scan history tables, repo scores, and granular code vulnerability records.
* **AI Compute:** Groq Llama-3.1 Pipeline — Ultra-low latency inference engine running Llama-3.1 models for split-second, token-efficient architectural review.
* **DevOps / Proxy:** Nginx — Acts as a high-efficiency reverse proxy gateway, routing public traffic to the static frontend asset bundle while proxying `/api` paths internally.
* **Containerization:** Multi-Stage Docker — Packages the entire microservice ecosystem safely into a secure, non-root user image optimized for cloud environments.

---

## ✨ Core Engineering Architecture & Features

To truly understand how DebtIQ functions under the hood, here is the processing journey of a code repository scan:

1. **Concurrent Ingestion:** The backend connects directly to the GitHub API, pulling down full repository file trees and parsing files concurrently using asynchronous worker lanes.
2. **Multi-Key Round-Robin Token Pool:** To handle intense token demands without crashing, the AI pipeline dynamically rotates between 3 distinct Groq API keys. If a key hits a `429 Too Many Requests` limit, the engine automatically catches the exception, swaps the active key pointer, and safely retries the file batch.
3. **Self-Healing Parser Layer:** Heavy code payload responses can sometimes cut off. DebtIQ intercepts, handles, and structurally repairs truncated or malformed LLM responses on the fly before committing data to the database.
4. **Relational Sync:** Every completed scan compiles a localized codebase health score (0-100) mapped to four severity categories (`HEALTHY`, `MINOR`, `MAJOR`, `CRITICAL`) and logs the transaction metrics immediately into PostgreSQL.

---

## 🚀 Local Installation & How to Run

Follow these clear, step-by-step instructions to clone, install, and spin up the entire application inside your local development workspace.

### 📋 Prerequisites

Ensure you have the following installed on your machine:

* Node.js (v20.x or higher)
* Python (v3.11.x or higher)
* Git
* A live PostgreSQL database link (e.g., Supabase or a local instance)

---

### 📥 Step 1: Clone the Repository

Open your terminal window and clone the codebase:

```bash
git clone https://github.com/YOUR_USERNAME/DebtIQ.git
cd DebtIQ

```

---

### 🐍 Step 2: Set Up and Run the Backend Engine

1. Navigate into the backend directory:

```bash
cd backend

```

2. Initialize a clean Python Virtual Environment:

```bash
python -m venv venv

```

3. Activate the virtual environment:

* On Windows (PowerShell):

```powershell
.\venv\Scripts\Activate.ps1

```

* On Mac/Linux:

```bash
source venv/bin/activate

```

4. Install all the required Python libraries and database drivers:

```bash
pip install -r requirements.txt

```

5. Create a file named exactly `.env` inside this `backend/` folder and add your secret credentials:

```env
DATABASE_URL="postgresql://your_db_user:password@your_host:5432/your_db"
GROQ_API_KEY="gsk_your_primary_groq_key"
GROQ_API_KEY_BACKUP_A="gsk_your_backup_groq_key_1"
GROQ_API_KEY_BACKUP_B="gsk_your_backup_groq_key_2"

```

6. Boot up the live FastAPI production-ready development worker:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000

```

* The backend will now be live at: `http://127.0.0.1:8000`
* You can view interactive Swagger API documentation at: `http://127.0.0.1:8000/docs`

---

### ⚛️ Step 3: Set Up and Run the Frontend Interface

1. Open a new terminal window, navigate back to the project root directory, and move into the frontend folder:

```bash
cd frontend

```

2. Install all the required Node package dependencies:

```bash
npm install

```

3. Launch the Vite local asset server:

```bash
npm run dev

```

4. Open your browser and navigate to the address shown in your terminal (typically `http://localhost:5173`).

Your full-stack development instance is now completely active! You can input any public GitHub username/repository and track live analysis metrics on your local terminal.

---

## 🐳 Production Cloud Deployment (Docker)

This workspace features a highly optimized, multi-stage Dockerfile engineered to serve both microservices seamlessly out of a single container gateway.

### How the Production Container Architecture Works:

* **Stage 1 (Frontend Compiler):** Spins up a lightweight Alpine Node environment, downloads frontend dependencies, and runs `npm run build` to compile your React application into raw production-optimized static files (`/dist`).
* **Stage 2 (Backend Core & Proxy Gateway):** Sets up a Python Linux ecosystem, installs backend packages, and installs Nginx.
* **The Handshake Mapping:** It copies the static compiled frontend files straight into Nginx's path, writes a custom routing engine that intercepts `/api` paths and pushes them to FastAPI on Port 8000, while serving standard asset paths straight to React on Port 7860. This satisfies strict cloud platform non-root security parameters (UID 1000).

### Running with Docker Locally:

```bash
# 1. Build the unified image
docker build -t debtiq-app .

# 2. Run the image while passing your environmental variables
docker run -p 7860:7860 \
  -e DATABASE_URL="your_postgres_link" \
  -e GROQ_API_KEY="your_groq_key" \
  debtiq-app

```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
