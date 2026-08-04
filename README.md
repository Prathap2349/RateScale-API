# 🚀 RateScale — Intelligent API Gateway Rate Limit & Traffic Simulator

RateScale is an enterprise-grade, AI-driven API Gateway rate-limiting, visual queue algorithm sandbox, and synthetic workload traffic simulator. It features a **React 18 TypeScript frontend**, a **Node.js Express backend**, a **Python FastAPI Machine Learning engine (Scikit-Learn RandomForest)**, and **PostgreSQL 18 relational persistence via SQLAlchemy**.

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client["🎨 React 18 Frontend (Port 5173 / Vite)"] -->|HTTP API & WebSockets| NodeServer["⚙️ Express Backend Server (Port 8080)"]
    NodeServer -->|Synthetic Load Engine| TargetEndpoint["🎯 Target API Workload Sandbox"]
    NodeServer -->|Telemetry & Sync POST| PythonAI["🧠 Python FastAPI AI Engine (Port 8000)"]
    PythonAI -->|Scikit-Learn ML Model| RateLimitPolicy["⚡ Recommended Token Bucket RPS"]
    PythonAI -->|SQLAlchemy ORM| PostgresDB[("🐘 PostgreSQL Database (ratescale_db)")]
```

---

## 🛠️ Technology Stack

* **Frontend**: React 18, TypeScript, Vite v8, Tailwind CSS v4, TanStack React Query v5, Framer Motion, Zod, Lucide Icons.
* **Backend**: Node.js v20, Express.js, WebSockets (`ws`), JWT Auth, `bcryptjs`, Rate Limit, Helmet, SQLite3 WAL fallback.
* **AI & Machine Learning**: Python 3.14, FastAPI, Uvicorn, Scikit-Learn (`RandomForestRegressor`), NumPy.
* **Database Layer**: PostgreSQL 18 (managed via pgAdmin 4), SQLAlchemy 2.0 ORM, `psycopg2-binary`, SQLite with local JSON backup persistence.

---

## 🌟 Premium Features Implemented

### 🛡️ 1. Active Defender Shield (Dynamic Auto-Throttling)
* **Real-time Latency Check**: Evaluates rolling average latency from active simulated request streams.
* **Intelligent Throttling**: If latency breaches the 150ms threshold or failure rates rise, the engine dynamically engages the shield and throttles traffic load by 50% in real-time.
* **Status Badges**: Interactive table displays showing Glowing Alert statuses (`[🛡️ Shield]`, `[Throttled]`) to easily flag running overloads.

### 🎛️ 2. Algorithmic Policy Sandbox
* **Visual Queue Animation**: View request packets flowing through limiters to understand bucket structures.
* **Dynamic Sliders**: Refine incoming load (RPS), queue capacity, and refill rates in real-time.
* **Core Limiter Algorithms**:
  * **Token Bucket**: Refills tokens at a constant rate, allowing burst capacity.
  * **Leaky Bucket**: Renders a funnel leaking requests at a steady speed, dropping overflows instantly.
  * **Fixed Window**: Tracks request limits inside 1-second fixed timeframes.

### 🔮 3. AI Sandbox Playground
* **Manual Workload Modeling**: Input target URLs, HTTP methods, Peak Load, SLA Latency bounds, and traffic shapes.
* **Dual-AI Model Consensus**: Side-by-side card comparing:
  1. **Primary Classifier (FastAPI/Scikit-Learn)**: RandomForest-derived capacity thresholding.
  2. **Secondary Reviewer (Llama 3.3)**: LLM semantic validation and database lock prevention.
* **Agreement Gauge**: Computes percentage consensus and auto-lowers confidence scores dynamically when models disagree.
* **Gateway Rule Dispatcher**: Apply recommended limits directly to gateway configurations.

---

## ⚡ Quick Start (1 Command)

Run the complete 3-service platform with a single terminal command:

```bash
./start.sh
```

Open your browser at **`http://localhost:5173`**!

---

## 💾 Resilient Local Storage & DB Persistence
If native SQLite C++ binary dependencies fail to compile on your system architecture, the platform automatically fallbacks to an in-memory database store that **persists database records dynamically to `backend/src/config/database_store.json`**.
* This guarantees that your created accounts, configuration data, and simulation histories **survive system restarts and page refreshes**!
* User login states are securely saved inside `localStorage` to keep you logged in permanently.

---

## 💻 Manual Setup & Startup Guide

If you prefer to start each service in separate terminal windows:

### 1️⃣ Start Python AI & PostgreSQL Engine (Port 8000)
```bash
cd ai_service
source venv/bin/activate
pip install -r requirements.txt
python create_tables.py
uvicorn main:app --port 8000 --reload
```

### 2️⃣ Start Express Node.js Backend Engine (Port 8080)
```bash
cd backend
npm install
npm start
```

### 3️⃣ Start React Frontend Web App (Port 5173)
```bash
cd frontend
npm install
npm run dev
```

---

## 🐘 PostgreSQL Database & pgAdmin Setup

### Database Configuration (`ai_service/.env`)
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_PGADMIN_PASSWORD
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=ratescale_db

DATABASE_URL=postgresql://postgres:YOUR_PGADMIN_PASSWORD@127.0.0.1:5432/ratescale_db
```

### SQL Inspection in pgAdmin 4
Connect to `ratescale_db` in pgAdmin and execute:

```sql
-- View all stored traffic simulation runs
SELECT * FROM simulations ORDER BY created_at DESC;

-- View execution metrics (Passed/Failed requests, Avg/P99 latency)
SELECT * FROM simulation_results;

-- View AI-generated rate limiting recommendations
SELECT * FROM recommendations;
```

---

## 🧠 AI Rate Limiting Machine Learning Engine

The Python service utilizes a **Scikit-Learn Random Forest Regressor** model trained to detect latency knee-curves. It evaluates 6 telemetry features:
1. `latency_ms`
2. `p95_latency_ms` / `p99_latency_ms`
3. `throughput_rps`
4. `cpu_usage_percent`
5. `memory_usage_percent`
6. `error_rate_percent`

### Gateway Exporter Support
Exports generated policies directly to:
* **Nginx** (`limit_req_zone`)
* **Kong API Gateway** (`rate-limiting`)
* **Cloudflare WAF** (`rate_limiting`)
* **Envoy Proxy** (`local_rate_limit`)
