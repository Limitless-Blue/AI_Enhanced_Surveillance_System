from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    uploads_dir: Path = Path(__file__).parent.parent.parent / "uploads"

    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "AI_Enhanced_Service"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Telegram
    telegram_bot_token: str = ""
    telegram_default_chat_id: str = ""

    # Gmail SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # ntfy
    ntfy_base_url: str = "https://ntfy.sh"
    ntfy_default_topic: str = "ai-surveillance-alerts"

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
