from __future__ import annotations
import logging
import colorlog

from app.core.config import settings

LOG_FORMAT = (
    "%(log_color)s%(levelname)-8s%(reset)s "
    "%(cyan)s%(asctime)s%(reset)s "
    "%(blue)s[%(name)s]%(reset)s "
    "%(message)s"
)

LOG_COLORS = {
    "DEBUG": "cyan",
    "INFO": "green",
    "WARNING": "yellow",
    "ERROR": "red",
    "CRITICAL": "bold_red",
}

def get_logger(
    name: str,
    level: int | str = settings.LOG_LEVEL,
) -> logging.Logger:

    logger = logging.getLogger(name)

    if logger.handlers:
        return logger 
    
    logger.setLevel(level)

    handler = colorlog.StreamHandler()
    handler.setFormatter(
        colorlog.ColoredFormatter(
            LOG_FORMAT,
            datefmt=DATEFMT,
            log_colors=LOG_COLORS,
            reset=True,
            style="%",
        )
    )
    logger.addHandler(handler)
    logger.propagate = False
    
    return logger