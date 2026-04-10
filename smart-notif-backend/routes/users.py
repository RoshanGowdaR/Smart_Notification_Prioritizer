from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from database.supabase_client import get_supabase_client

router = APIRouter(tags=["users"])


class UserUpsertRequest(BaseModel):
	user_id: UUID
	username: str
	email_id: EmailStr
	ph_num: Optional[str] = None


class UserResponse(BaseModel):
	user_id: UUID
	username: str
	email_id: EmailStr
	ph_num: Optional[str] = None


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_user(user_id: UUID) -> UserResponse:
	supabase = get_supabase_client()
	result = supabase.table("users").select("user_id,username,email_id,ph_num").eq("user_id", str(user_id)).limit(1).execute()
	row = (result.data or [None])[0]
	if not row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	return UserResponse.model_validate(row)


@router.post("/upsert", response_model=UserResponse, status_code=status.HTTP_200_OK)
def upsert_user(payload: UserUpsertRequest) -> UserResponse:
	supabase = get_supabase_client()
	result = (
		supabase.table("users")
		.upsert(
			{
				"user_id": str(payload.user_id),
				"username": payload.username,
				"email_id": payload.email_id,
				"ph_num": payload.ph_num,
			},
			on_conflict="user_id",
		)
		.execute()
	)
	row = (result.data or [None])[0]
	if not row:
		raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upsert user")
	return UserResponse.model_validate(row)
