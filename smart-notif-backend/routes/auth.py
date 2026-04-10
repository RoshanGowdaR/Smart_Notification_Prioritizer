import os
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from database.supabase_client import get_supabase_client

router = APIRouter(tags=["auth"])


class GoogleOAuthRequest(BaseModel):
	redirect_to: str | None = Field(default=None)


class GoogleOAuthResponse(BaseModel):
	provider: str
	auth_url: str
	oauth_url: str


class LogoutRequest(BaseModel):
	access_token: str | None = None
	refresh_token: str | None = None


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


def _build_google_oauth_response(redirect_to: str | None) -> GoogleOAuthResponse:
	supabase = get_supabase_client()
	redirect_to = redirect_to or os.getenv("GOOGLE_REDIRECT_URI")

	if not redirect_to:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="GOOGLE_REDIRECT_URI is not configured.",
		)

	try:
		oauth_result = supabase.auth.sign_in_with_oauth(
			{
				"provider": "google",
				"options": {"redirect_to": redirect_to},
			}
		)
		auth_url = _extract_auth_url(oauth_result)

		if not auth_url:
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail="Failed to generate Google OAuth URL from Supabase.",
			)

		return GoogleOAuthResponse(provider="google", auth_url=auth_url, oauth_url=auth_url)
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Google OAuth initialization failed: {exc}",
		) from exc


@router.post(
	"/google",
	response_model=GoogleOAuthResponse,
	status_code=status.HTTP_200_OK,
)
def google_oauth_login_post(payload: GoogleOAuthRequest) -> GoogleOAuthResponse:
	return _build_google_oauth_response(payload.redirect_to)


@router.get(
	"/google",
	response_model=GoogleOAuthResponse,
	status_code=status.HTTP_200_OK,
)
def google_oauth_login_get(redirect_to: str | None = None) -> GoogleOAuthResponse:
	return _build_google_oauth_response(redirect_to)


@router.post(
	"/logout",
	response_model=LogoutResponse,
	status_code=status.HTTP_200_OK,
)
def logout(payload: LogoutRequest) -> LogoutResponse:
	supabase = get_supabase_client()

	try:
		if payload.access_token and payload.refresh_token:
			supabase.auth.set_session(payload.access_token, payload.refresh_token)

		supabase.auth.sign_out()
		return LogoutResponse(message="Logged out successfully.")
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Logout failed: {exc}",
		) from exc
