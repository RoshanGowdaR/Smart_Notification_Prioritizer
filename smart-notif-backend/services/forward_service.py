from twilio.rest import Client
from dotenv import load_dotenv
import os

load_dotenv()


def _normalize_phone(value: str) -> str:
	raw = str(value or "").strip().replace("whatsapp:", "")
	digits = "".join(ch for ch in raw if ch.isdigit())
	if not digits:
		return raw
	return f"+{digits}"


def send_sms(to_number: str, message: str) -> dict:
	client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
	normalized_to = _normalize_phone(to_number)
	msg = client.messages.create(
		body=message,
		from_=os.getenv("TWILIO_PHONE_NUMBER"),
		to=normalized_to,
	)
	return {"sid": msg.sid, "status": msg.status}


def send_whatsapp(to_number: str, message: str) -> dict:
	client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
	normalized_to = _normalize_phone(to_number)
	msg = client.messages.create(
		body=message,
		from_=os.getenv("TWILIO_WHATSAPP_NUMBER"),
		to=f"whatsapp:{normalized_to}",
	)
	return {"sid": msg.sid, "status": msg.status}


def forward_notification(channel: str, to_number: str, app_name: str, content: str) -> dict:
	message = f"[NotifyAI] {app_name}: {content}"
	if channel == "whatsapp":
		return send_whatsapp(to_number, message)
	return send_sms(to_number, message)
