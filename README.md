# Smart Notification Prioritizer

## Run the project

### 1) Backend (FastAPI)

Open Terminal 1 (PowerShell) and run:

C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend" --host 127.0.0.1 --port 8001

Backend health check:

Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health | Select-Object -ExpandProperty Content

### 2) Frontend (Vite + React)

Open Terminal 2 (PowerShell) and run:

npm --prefix "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-frontend" run dev

Open:

http://localhost:5173/dashboard

### 3) ngrok (for Twilio WhatsApp webhook)

Open Terminal 3 and run:

ngrok http 127.0.0.1:8001

Set Twilio WhatsApp incoming webhook URL to:

https://YOUR-NGROK-DOMAIN/automation/whatsapp-reply

### 4) Optional frontend build check

npm --prefix "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-frontend" run build

### 5) Backend unit tests (for CI/CD)

Run all backend tests:

C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\.venv\Scripts\python.exe -m pytest "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\tests" -q

Run specific feature tests:

C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\.venv\Scripts\python.exe -m pytest "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\tests\test_notifications_today_only.py" "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\tests\test_sync_sources.py" -q
