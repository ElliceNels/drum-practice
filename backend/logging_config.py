"""Simple logging bootstrap that uses values from the module-level `config`.
"""
import logging
from typing import Optional


def configure_logging(config: Optional[object] = None) -> None:
    """Configure logging using values from `config`.

    The `config` object is expected to have a `logging` attribute with
    `level` and `format` members (strings). If `config` is None, this
    function is a no-op.
    """
    if config is None:
        return

    level_name = getattr(config.logging, "level", "INFO")
    fmt = getattr(config.logging, "format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    try:
        level = getattr(logging, level_name.upper())
    except AttributeError:
        level = logging.INFO

    logging.basicConfig(level=level, format=fmt)
    logging.getLogger().setLevel(level)
