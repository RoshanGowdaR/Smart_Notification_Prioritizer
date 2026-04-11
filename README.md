# Smart Notification Prioritizer

## Run the project

### Backend (FastAPI)

Run from PowerShell:

```powershell
C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON_backend_wt\smart-notif-backend" --host 127.0.0.1 --port 8001
```

Backend health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health | Select-Object -ExpandProperty Content
```

### Frontend (Vite + React)

Run from PowerShell:

```powershell
npm --prefix "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-frontend" run dev
```

Open the URL shown in terminal (currently `http://localhost:5176`).

### Optional build check

```powershell
npm --prefix "C:\Users\gowda\OneDrive\Desktop\BCE_HACKTHON\smart-notif-frontend" run build
```
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
