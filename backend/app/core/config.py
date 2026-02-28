from typing import Final, Literal
from pydantic import Field, model_validator
from pydantic_settings import (
    BaseSettings, 
    SettingsConfigDict,
)

class Settings(BaseSettings):
    """Class to store all the settings of the application."""

    APP_ENV: Literal["development", "production"] = "development"
    DATABASE_URL: str
    DEEPINFRA_API_KEY: str

    # Logging settings
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def is_prod(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()