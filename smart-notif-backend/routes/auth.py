import os
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from database.supabase_client import get_supabase_client

router = APIRouter(tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

GOOGLE_SCOPES = [
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/calendar.readonly",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
]


class GoogleOAuthURLResponse(BaseModel):
	oauth_url: str


class LogoutRequest(BaseModel):
	user_id: str


class LogoutResponse(BaseModel):
	message: str


def _required_env(var_name: str) -> str:
	value = os.getenv(var_name)
	if not value:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Missing required environment variable: {var_name}",
		)
	return value


@router.get("/google", response_model=GoogleOAuthURLResponse, status_code=status.HTTP_200_OK)
def get_google_oauth_url() -> GoogleOAuthURLResponse:
	client_id = _required_env("GOOGLE_CLIENT_ID")
	redirect_uri = _required_env("GOOGLE_REDIRECT_URI")

	query = urlencode(
		{
			"client_id": client_id,
			"redirect_uri": redirect_uri,
			"response_type": "code",
			"scope": " ".join(GOOGLE_SCOPES),
			"access_type": "offline",
			"prompt": "consent",
		},
	)

	return GoogleOAuthURLResponse(oauth_url=f"{GOOGLE_AUTH_URL}?{query}")


@router.get("/callback", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
def google_oauth_callback(code: str = Query(...)) -> RedirectResponse:
	client_id = _required_env("GOOGLE_CLIENT_ID")
	client_secret = _required_env("GOOGLE_CLIENT_SECRET")
	redirect_uri = _required_env("GOOGLE_REDIRECT_URI")
	frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")

	token_response = requests.post(
		GOOGLE_TOKEN_URL,
		data={
			"client_id": client_id,
			"client_secret": client_secret,
			"code": code,
			"redirect_uri": redirect_uri,
			"grant_type": "authorization_code",
		},
		timeout=20,
	)

	if token_response.status_code != status.HTTP_200_OK:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Failed to exchange Google code: {token_response.text}",
		)

	access_token = token_response.json().get("access_token")
	if not access_token:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Google token exchange did not return access_token.",
		)

	profile_response = requests.get(
		GOOGLE_USERINFO_URL,
		headers={"Authorization": f"Bearer {access_token}"},
		timeout=20,
	)

	if profile_response.status_code != status.HTTP_200_OK:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Failed to fetch Google user profile: {profile_response.text}",
		)

	profile = profile_response.json()
	google_sub = str(profile.get("id", "")).strip()
	name = str(profile.get("name", "")).strip() or "Google User"
	email = str(profile.get("email", "")).strip()

	if not google_sub or not email:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Google profile missing required id/email fields.",
		)

	supabase = get_supabase_client()
	supabase.table("users").upsert(
		{
			"user_id": google_sub,
			"username": name,
			"email_id": email,
		},
		on_conflict="user_id",
	).execute()

	redirect_query = urlencode(
		{
			"user_id": google_sub,
			"username": name,
			"email": email,
		}
	)
	return RedirectResponse(url=f"{frontend_url}/dashboard?{redirect_query}")


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
def logout(_payload: LogoutRequest) -> LogoutResponse:
	return LogoutResponse(message="logged out")
