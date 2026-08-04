#!/bin/bash

echo "===================================================="
echo "🚀 Starting RateScale Complete Platform (1 Command)"
echo "===================================================="

# Clean up any lingering processes on ports 8000, 8080, and 5173
lsof -ti :8000 -ti :8080 -ti :5173 | xargs kill -9 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Start Python AI & PostgreSQL Service (Port 8000)
echo "🧠 Starting Python AI Engine on http://127.0.0.1:8000..."
cd "$SCRIPT_DIR/ai_service"
if [ -d "venv" ]; then
  source venv/bin/activate
  uvicorn main:app --port 8000 --host 127.0.0.1 > /dev/null 2>&1 &
fi

# 2. Start Express Backend (Port 8080)
echo "⚙️ Starting Express Backend Engine on http://localhost:8080..."
cd "$SCRIPT_DIR/backend"
node server.cjs > /dev/null 2>&1 &

# 3. Start React Frontend (Port 5173)
echo "🎨 Starting React Frontend UI on http://localhost:5173..."
cd "$SCRIPT_DIR/frontend"
npx vite --host 0.0.0.0 --port 5173 > /dev/null 2>&1 &

echo "===================================================="
echo "✅ All 3 services are online!"
echo "🌐 Open React Web App: http://localhost:5173"
echo "⚙️ Backend API: http://localhost:8080"
echo "===================================================="

# 4. Automatically open the browser
sleep 1
echo "🚀 Opening browser..."
open "http://localhost:5173" || xdg-open "http://localhost:5173" || start "http://localhost:5173" 2>/dev/null &

wait
