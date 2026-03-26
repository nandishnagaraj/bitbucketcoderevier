from __future__ import annotations
import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _clean_url(value: str) -> str:
    return value.strip().rstrip("/")


def _redirect_uri(env_name: str, default_path: str, public_api_base_url: str) -> str:
    explicit = _clean_url(os.getenv(env_name, ""))
    if explicit:
        return explicit
    if public_api_base_url:
        return f"{public_api_base_url}{default_path}"
    return f"http://localhost:8000{default_path}"


def _default_cookie_settings(frontend_url: str, public_api_base_url: str) -> tuple[str, bool]:
    if not frontend_url or not public_api_base_url:
        return ("lax", False)
    frontend_host = urlparse(frontend_url).netloc
    api_host = urlparse(public_api_base_url).netloc
    if frontend_host and api_host and frontend_host != api_host and public_api_base_url.startswith("https://"):
        # Cross-site cookies for tunnel callbacks need SameSite=None; Secure.
        return ("none", True)
    return ("lax", False)

class Settings(BaseModel):
    github_base_url: str = os.getenv("GITHUB_BASE_URL", "https://github.com").rstrip("/")
    github_client_id: str = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    public_api_base_url: str = _clean_url(os.getenv("PUBLIC_API_BASE_URL", ""))
    github_redirect_uri: str = _redirect_uri("GITHUB_REDIRECT_URI", "/auth/callback", public_api_base_url)
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    bitbucket_client_id: str = os.getenv("BITBUCKET_CLIENT_ID", "")
    bitbucket_client_secret: str = os.getenv("BITBUCKET_CLIENT_SECRET", "")
    bitbucket_redirect_uri: str = _redirect_uri("BITBUCKET_REDIRECT_URI", "/auth/bitbucket/callback", public_api_base_url)
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3003").rstrip("/")
    allow_pat_fallback: bool = os.getenv("ALLOW_PAT_FALLBACK", "true").lower() == "true"
    session_secret: str = os.getenv("SESSION_SECRET", "change-me")
    session_cookie_samesite: str = os.getenv("SESSION_COOKIE_SAMESITE", _default_cookie_settings(frontend_url, public_api_base_url)[0]).strip().lower()
    session_cookie_secure: bool = _bool_env("SESSION_COOKIE_SECURE", _default_cookie_settings(frontend_url, public_api_base_url)[1])

    azure_openai_api_key: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    azure_openai_endpoint: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_openai_deployment: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
    azure_openai_api_version: str = os.getenv("AZURE_OPENAI_API_VERSION", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

settings = Settings()
