"""This module defines configuration dataclasses and a loader for JSON config files.
"""
from dataclasses import dataclass
from typing import Any, Dict, Optional
import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

@dataclass
class AppConfig:
    """Application configuration settings."""
    host: str = "0.0.0.0"
    port: int = 5000
    debug: bool = False


@dataclass
class LoggingConfig:
    """Logging configuration settings."""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


@dataclass
class Config:
    """Top-level configuration dataclass."""
    app: AppConfig
    logging: LoggingConfig


def _default_config_path() -> Path:
    return Path(__file__).parent / "config.json"


def load_config(path: Optional[str] = None) -> Config:
    """Load configuration from a JSON file and return a `Config` dataclass.

    Args:
        path: Optional path to a JSON config file. If omitted, `backend/config.json`
              located next to this module will be used.
    Returns:
        Config: Populated config dataclass.
    """
    cfg_path = Path(path) if path else _default_config_path()
    raw: Dict[str, Any] = {}
    try:
        with cfg_path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        # Return defaults if config file is missing
        logger.warning(
            "Configuration file %s not found, using default configuration.", str(cfg_path)
        )
        default_config = Config(app=AppConfig(), logging=LoggingConfig())
        return default_config

    app_dict = raw.get("app", {})
    log_dict = raw.get("logging", {})

    app_cfg = AppConfig(
        host=app_dict.get("host", "0.0.0.0"),
        port=int(app_dict.get("port", 5000)),
        debug=bool(app_dict.get("debug", False)),
    )

    logging_cfg = LoggingConfig(
        level=str(log_dict.get("level", "INFO")),
        format=str(log_dict.get("format", LoggingConfig.format)),
    )

    return Config(app=app_cfg, logging=logging_cfg)


# Module-level config object populated on import for easy access
try:
    config: Config = load_config()
except (FileNotFoundError, json.JSONDecodeError, ValueError, KeyError):
    # In case of any unexpected error during load, fall back to defaults
    config = Config(app=AppConfig(), logging=LoggingConfig())
    logger.exception("Failed to load configuration, using defaults.")
