from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    yolo_model_path: str = "ml/weights/best.pt"
    model_version: str = "unversioned"
    allowed_origins: str = "http://localhost:5173"
    max_upload_mb: int = 10
    pass_max_confidence: float = 0.30
    fail_min_confidence: float = 0.60
    demo_mode_enabled: bool = False
    ai_api_key: str = ""
    ai_api_url: str = "https://api.anthropic.com/v1/messages"
    ai_model: str = ""

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
