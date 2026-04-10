from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class NotificationCategory(str, Enum):
	work = "work"
	social = "social"
	promo = "promo"
	system = "system"


class ChannelType(str, Enum):
	whatsapp = "whatsapp"
	sms = "sms"


class ReportAction(str, Enum):
	clicked = "clicked"
	dismissed = "dismissed"
	forwarded = "forwarded"


class BaseSchema(BaseModel):
	model_config = ConfigDict(from_attributes=True)


class UserRequest(BaseSchema):
	username: str = Field(..., min_length=1, max_length=100)
	email_id: EmailStr
	ph_num: str = Field(..., min_length=7, max_length=20)


class UserResponse(BaseSchema):
	user_id: UUID
	username: str
	email_id: EmailStr
	ph_num: str
	created_at: datetime


class NotificationRequest(BaseSchema):
	user_id: UUID
	app_name: str = Field(..., min_length=1, max_length=100)
	content: str = Field(..., min_length=1)
	category: NotificationCategory
	is_seen: bool = False
	received_at: datetime


class NotificationResponse(BaseSchema):
	notif_id: UUID
	user_id: UUID
	app_name: str
	content: str
	category: NotificationCategory
	is_seen: bool
	received_at: datetime


class PriorityRequest(BaseSchema):
	user_id: UUID
	priority_apps: dict[str, int] = Field(default_factory=dict)
	keyword_rules: dict[str, dict[str, int]] = Field(default_factory=dict)
	ranking_weights: dict[str, float] = Field(default_factory=dict)


class PriorityResponse(BaseSchema):
	priority_id: UUID
	user_id: UUID
	priority_apps: dict[str, int]
	keyword_rules: dict[str, dict[str, int]] = Field(default_factory=dict)
	ranking_weights: dict[str, float]
	updated_at: datetime


class AutomationRequest(BaseSchema):
	user_id: UUID
	notif_id: UUID
	priority_id: UUID
	channel: ChannelType
	reply_template: str = Field(..., min_length=1)


class AutomationResponse(BaseSchema):
	auto_id: UUID
	user_id: UUID
	notif_id: UUID
	priority_id: UUID
	channel: ChannelType
	reply_template: str
	triggered_at: datetime


class ReportRequest(BaseSchema):
	user_id: UUID
	notif_id: UUID
	action_taken: ReportAction
	ranking_score: float


class ReportResponse(BaseSchema):
	report_id: UUID
	user_id: UUID
	notif_id: UUID
	action_taken: ReportAction
	ranking_score: float
	timestamp: datetime
