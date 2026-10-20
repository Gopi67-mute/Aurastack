"""Application logging, configured once at startup with the standard library.

Uvicorn configures only its own loggers ("uvicorn", "uvicorn.error",
"uvicorn.access") and leaves the root logger without handlers, so without
this the app's INFO records (generation claims and outcomes, migrations) are
silently dropped. Only the "app" logger hierarchy is touched: uvicorn's own
output and configuration are left exactly as they are.
"""

import logging

APP_LOGGER_NAME = "app"
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging(level: int = logging.INFO) -> None:
    """Emit the app's records at `level` and above. Safe to call repeatedly."""

    app_logger = logging.getLogger(APP_LOGGER_NAME)
    app_logger.setLevel(level)

    # Already configured (a reload or second import), or the root logger
    # already emits records (e.g. uvicorn --log-config, or a test harness):
    # another handler here would print every record twice.
    if app_logger.handlers or logging.getLogger().handlers:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    app_logger.addHandler(handler)
