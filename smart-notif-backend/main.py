from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.automation import router as automation_router
from routes.notifications import router as notifications_router
from routes.priority import router as priority_router
from routes.report import router as report_router
from routes.users import router as users_router

load_dotenv()


def _parse_cors_origins(raw_origins: str | None) -> list[str]:
	if not raw_origins:
		return [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:5175",
			"http://127.0.0.1:5175",
		]
	return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


app = FastAPI(
	title=os.getenv("APP_NAME", "Smart Notification Prioritizer API"),
	version="1.0.0",
	description="Backend API for ranking and forwarding high-priority notifications.",
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=_parse_cors_origins(os.getenv("APP_CORS_ORIGINS")),
	allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(notifications_router, prefix="/notifications")
app.include_router(priority_router, prefix="/priority")
app.include_router(automation_router, prefix="/automation")
app.include_router(report_router, prefix="/report")
app.include_router(users_router, prefix="/users")


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> dict[str, str]:
	return {"status": "ok"}
