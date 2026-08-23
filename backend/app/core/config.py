import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NexaSphere AI BI Assistant"
    PORT: int = 5050
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "gemini")
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.5-flash")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    class Config:
        env_file = ".env"

settings = Settings()
