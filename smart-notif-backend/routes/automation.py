from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models.schemas import AutomationRequest, AutomationResponse
from services.forward_service import build_forward_message, forward_notification
from services.ranking_service import compute_notification_score

router = APIRouter(tags=["automation"])


class AutomationTriggerResponse(BaseModel):
	automation: AutomationResponse
	ranking_score: float
	forward_status: str
	provider_message_id: str


@router.post(
	"/trigger",
	response_model=AutomationTriggerResponse,
	status_code=status.HTTP_201_CREATED,
)
def trigger_automation(payload: AutomationRequest) -> AutomationTriggerResponse:
	supabase = get_supabase_client()
	threshold = float(os.getenv("FORWARDING_SCORE_THRESHOLD", "0.6"))

	notif_result = (
		supabase.table("notifications")
		.select("*")
		.eq("notif_id", str(payload.notif_id))
		.eq("user_id", str(payload.user_id))
		.limit(1)
		.execute()
	)
	notif = (notif_result.data or [None])[0]
	if not notif:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

	if bool(notif.get("is_seen", False)):
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Notification already seen; forwarding only allowed for unseen notifications.",
		)

	user_result = (
		supabase.table("users")
		.select("ph_num")
		.eq("user_id", str(payload.user_id))
		.limit(1)
		.execute()
	)
	user_row = (user_result.data or [None])[0]
	if not user_row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

	priority_result = (
		supabase.table("priority")
		.select("priority_id, priority_apps, ranking_weights")
		.eq("priority_id", str(payload.priority_id))
		.eq("user_id", str(payload.user_id))
		.limit(1)
		.execute()
	)
	priority_row = (priority_result.data or [None])[0]
	if not priority_row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Priority profile not found.")

	priority_apps = priority_row.get("priority_apps") or {}
	ranking_weights = priority_row.get("ranking_weights") or {}
	app_weight = float(priority_apps.get(notif["app_name"], 1.0))
	ranking_score = compute_notification_score(
		app_weight=app_weight,
		received_at=notif["received_at"],
		category=notif["category"],
		ranking_weights=ranking_weights,
	)

	if ranking_score < threshold:
		raise HTTPException(
			status_code=status.HTTP_412_PRECONDITION_FAILED,
			detail=f"Notification ranking score {ranking_score:.4f} below threshold {threshold:.4f}.",
		)

	message = build_forward_message(
		app_name=notif["app_name"],
		content=notif["content"],
		reply_template=payload.reply_template,
	)
	dispatch = forward_notification(payload.channel, user_row["ph_num"], message)

	insert_payload = {
		"user_id": str(payload.user_id),
		"notif_id": str(payload.notif_id),
		"priority_id": str(payload.priority_id),
		"channel": payload.channel.value,
		"reply_template": payload.reply_template,
		"triggered_at": datetime.now(timezone.utc).isoformat(),
	}
	automation_result = supabase.table("automation").insert(insert_payload).execute()
	automation_row = (automation_result.data or [None])[0]
	if not automation_row:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Automation record insert returned no data.",
		)

	return AutomationTriggerResponse(
		automation=AutomationResponse.model_validate(automation_row),
		ranking_score=round(ranking_score, 4),
		forward_status=dispatch["status"],
		provider_message_id=dispatch["provider_message_id"],
	)


@router.get(
	"/{user_id}",
	response_model=list[AutomationResponse],
	status_code=status.HTTP_200_OK,
)
def get_automation_history(user_id: UUID) -> list[AutomationResponse]:
	supabase = get_supabase_client()
	result = (
		supabase.table("automation")
		.select("*")
		.eq("user_id", str(user_id))
		.order("triggered_at", desc=True)
		.execute()
	)
	rows = result.data or []
	return [AutomationResponse.model_validate(row) for row in rows]
