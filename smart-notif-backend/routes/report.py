from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from database.supabase_client import get_supabase_client
from models.schemas import ReportRequest, ReportResponse
from services.ranking_service import update_bandit_after_report

router = APIRouter(tags=["report"])


class ReportLogResponse(BaseModel):
	report: ReportResponse
	updated_app_weights: dict[str, float]


@router.post(
	"/log",
	response_model=ReportLogResponse,
	status_code=status.HTTP_201_CREATED,
)
def log_report_action(payload: ReportRequest) -> ReportLogResponse:
	supabase = get_supabase_client()

	notification_result = (
		supabase.table("notifications")
		.select("notif_id, app_name, user_id")
		.eq("notif_id", str(payload.notif_id))
		.limit(1)
		.execute()
	)
	notif_row = (notification_result.data or [None])[0]
	if not notif_row:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Notification not found for report logging.",
		)

	if notif_row["user_id"] != str(payload.user_id):
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Notification does not belong to this user.",
		)

	insert_payload = {
		"user_id": str(payload.user_id),
		"notif_id": str(payload.notif_id),
		"action_taken": payload.action_taken.value,
		"ranking_score": float(payload.ranking_score),
		"timestamp": datetime.now(timezone.utc).isoformat(),
	}

	try:
		insert_result = supabase.table("report").insert(insert_payload).execute()
		report_row = (insert_result.data or [None])[0]
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to insert report log: {exc}",
		) from exc

	if not report_row:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Report insert returned no data.",
		)

	try:
		updated_weights = update_bandit_after_report(
			user_id=payload.user_id,
			app_name=notif_row["app_name"],
			action_taken=payload.action_taken,
		)
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Report was logged but bandit update failed: {exc}",
		) from exc

	return ReportLogResponse(
		report=ReportResponse.model_validate(report_row),
		updated_app_weights=updated_weights,
	)


@router.get(
	"/{user_id}",
	response_model=list[ReportResponse],
	status_code=status.HTTP_200_OK,
)
def get_user_reports(user_id: UUID) -> list[ReportResponse]:
	supabase = get_supabase_client()

	try:
		result = (
			supabase.table("report")
			.select("*")
			.eq("user_id", str(user_id))
			.order("timestamp", desc=True)
			.execute()
		)
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to fetch report history: {exc}",
		) from exc

	rows = result.data or []
	return [ReportResponse.model_validate(row) for row in rows]
