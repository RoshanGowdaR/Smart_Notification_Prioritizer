import os
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client

router = APIRouter(tags=["auth"])


class GoogleOAuthRequest(BaseModel):
	redirect_to: str | None = None


class GoogleOAuthURLResponse(BaseModel):
	oauth_url: str
	auth_url: str


class LogoutRequest(BaseModel):
	user_id: str | None = None


class LogoutResponse(BaseModel):
	message: str


def _extract_auth_url(oauth_result: Any) -> str | None:
	if isinstance(oauth_result, dict):
		return oauth_result.get("url")

	direct_url = getattr(oauth_result, "url", None)
	if direct_url:
		return direct_url

	data = getattr(oauth_result, "data", None)
	if isinstance(data, dict):
		return data.get("url")

	return None


def _build_google_oauth_response(redirect_to: str | None = None) -> GoogleOAuthURLResponse:
	supabase = get_supabase_client()
	resolved_redirect = redirect_to or os.getenv("FRONTEND_URL", "http://localhost:5174")

	try:
		oauth_result = supabase.auth.sign_in_with_oauth(
			{
				"provider": "google",
				"options": {
					"redirect_to": resolved_redirect,
					"scopes": "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
					"query_params": {
						"access_type": "offline",
						"prompt": "consent select_account",
						"include_granted_scopes": "true",
					},
				},
			}
		)
		auth_url = _extract_auth_url(oauth_result)
		if not auth_url:
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail="Failed to generate Google OAuth URL from Supabase.",
			)

		return GoogleOAuthURLResponse(oauth_url=auth_url, auth_url=auth_url)
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Google OAuth initialization failed: {exc}",
		) from exc


@router.get("/google", response_model=GoogleOAuthURLResponse, status_code=status.HTTP_200_OK)
def google_oauth_get(redirect_to: str | None = None) -> GoogleOAuthURLResponse:
	return _build_google_oauth_response(redirect_to)


@router.post("/google", response_model=GoogleOAuthURLResponse, status_code=status.HTTP_200_OK)
def google_oauth_post(payload: GoogleOAuthRequest) -> GoogleOAuthURLResponse:
	return _build_google_oauth_response(payload.redirect_to)


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
def logout(_payload: LogoutRequest | None = None) -> LogoutResponse:
	return LogoutResponse(message="logged out")
