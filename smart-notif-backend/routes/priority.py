from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from database.supabase_client import get_supabase_client
from models.schemas import PriorityRequest, PriorityResponse

router = APIRouter(tags=["priority"])


@router.get(
	"/{user_id}",
	response_model=PriorityResponse,
	status_code=status.HTTP_200_OK,
)
def get_user_priority(user_id: UUID) -> PriorityResponse:
	supabase = get_supabase_client()

	try:
		result = (
			supabase.table("priority")
			.select("*")
			.eq("user_id", str(user_id))
			.order("updated_at", desc=True)
			.limit(1)
			.execute()
		)
		row = (result.data or [None])[0]
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to fetch priority settings: {exc}",
		) from exc

	if not row:
		default_row = {
			"user_id": str(user_id),
			"priority_apps": {"Gmail": 1, "Google Calendar": 1},
			"keyword_rules": {"Gmail": {}, "Google Calendar": {}},
			"ranking_weights": {"urgency": 0.4, "recency": 0.3, "category": 0.3},
			"updated_at": datetime.now(timezone.utc).isoformat(),
		}
		try:
			insert_result = supabase.table("priority").insert(default_row).execute()
		except Exception as exc:
			# Backward-compatible fallback when keyword_rules column is not migrated yet.
			if "keyword_rules" not in str(exc):
				raise
			fallback_row = {**default_row}
			fallback_row.pop("keyword_rules", None)
			insert_result = supabase.table("priority").insert(fallback_row).execute()
		row = (insert_result.data or [None])[0]
		if not row:
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail="Failed to initialize priority settings for user.",
			)

	row.setdefault("keyword_rules", {"Gmail": {}, "Google Calendar": {}})

	return PriorityResponse(**row)


@router.post(
	"/set",
	response_model=PriorityResponse,
	status_code=status.HTTP_200_OK,
)
def set_user_priority(payload: PriorityRequest, response: Response) -> PriorityResponse:
	supabase = get_supabase_client()

	try:
		existing_result = (
			supabase.table("priority")
			.select("priority_id")
			.eq("user_id", str(payload.user_id))
			.order("updated_at", desc=True)
			.limit(1)
			.execute()
		)
		existing_row = (existing_result.data or [None])[0]
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to check existing priority settings: {exc}",
		) from exc

	update_payload = {
		"user_id": str(payload.user_id),
		"priority_apps": payload.priority_apps,
		"keyword_rules": payload.keyword_rules,
		"ranking_weights": payload.ranking_weights,
		"updated_at": datetime.now(timezone.utc).isoformat(),
	}

	try:
		if existing_row:
			try:
				result = (
					supabase.table("priority")
					.update(update_payload)
					.eq("priority_id", existing_row["priority_id"])
					.execute()
				)
			except Exception as exc:
				if "keyword_rules" not in str(exc):
					raise
				fallback_payload = {**update_payload}
				fallback_payload.pop("keyword_rules", None)
				result = (
					supabase.table("priority")
					.update(fallback_payload)
					.eq("priority_id", existing_row["priority_id"])
					.execute()
				)
			row = (result.data or [None])[0]
			response.status_code = status.HTTP_200_OK
		else:
			try:
				result = supabase.table("priority").insert(update_payload).execute()
			except Exception as exc:
				if "keyword_rules" not in str(exc):
					raise
				fallback_payload = {**update_payload}
				fallback_payload.pop("keyword_rules", None)
				result = supabase.table("priority").insert(fallback_payload).execute()
			row = (result.data or [None])[0]
			response.status_code = status.HTTP_201_CREATED
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to save priority settings: {exc}",
		) from exc

	if not row:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Priority operation returned no data.",
		)

	row.setdefault("keyword_rules", payload.keyword_rules or {"Gmail": {}, "Google Calendar": {}})

	return PriorityResponse.model_validate(row)
