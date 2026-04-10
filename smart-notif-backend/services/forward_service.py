from twilio.rest import Client
from dotenv import load_dotenv
import os

load_dotenv()


def send_sms(to_number: str, message: str) -> dict:
	client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
	msg = client.messages.create(
		body=message,
		from_=os.getenv("TWILIO_PHONE_NUMBER"),
		to=to_number,
	)
	return {"provider_message_id": msg.sid, "status": msg.status}


def send_whatsapp(to_number: str, message: str) -> dict:
	client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
	msg = client.messages.create(
		body=message,
		from_=os.getenv("TWILIO_WHATSAPP_NUMBER"),
		to=f"whatsapp:{to_number}",
	)
	return {"provider_message_id": msg.sid, "status": msg.status}


def build_forward_message(app_name: str, content: str, reply_template: str) -> str:
	return f"[NotifyAI] {app_name}: {content}\nSuggested reply: {reply_template}"


def forward_notification(channel: str, to_number: str, message: str, content: str | None = None) -> dict:
	# Backward compatibility: if older callers pass app_name/content instead of prebuilt message,
	# reinterpret inputs and format the notification message.
	if content is not None:
		message = f"[NotifyAI] {message}: {content}"
	if channel == "whatsapp":
		return send_whatsapp(to_number, message)
	return send_sms(to_number, message)
