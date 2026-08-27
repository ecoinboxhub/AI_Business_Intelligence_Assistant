import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NexaSphere AI BI Assistant"
    PORT: int = 5050
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "gemini")
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.5-flash")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Comma-separated browser-origin allowlist for CORS. Native mobile apps
    # send no Origin header and are unaffected.
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "*",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
