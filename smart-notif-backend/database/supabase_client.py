import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


def _get_required_env(var_name: str) -> str:
	value = os.getenv(var_name)
	if not value:
		raise RuntimeError(f"Missing required environment variable: {var_name}")
	return value


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
	"""Create and cache a single Supabase client for the application lifecycle."""
	supabase_url = _get_required_env("SUPABASE_URL")
	supabase_key = _get_required_env("SUPABASE_ANON_KEY")
	return create_client(supabase_url, supabase_key)
