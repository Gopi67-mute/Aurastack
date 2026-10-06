"""configure_logging: emits app records without disturbing uvicorn or duplicating output."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from app.core.logging_config import APP_LOGGER_NAME, configure_logging


@contextmanager
def _unconfigured(root_handlers: list[logging.Handler]) -> Iterator[logging.Logger]:
    """A fresh "app" logger and the given root handlers, restored afterwards.

    Entered inside each test: pytest attaches its own capture handlers to the
    root logger for the duration of the test call.
    """

    app_logger = logging.getLogger(APP_LOGGER_NAME)
    root = logging.getLogger()
    saved = (app_logger.level, list(app_logger.handlers), list(root.handlers))
    app_logger.handlers[:] = []
    root.handlers[:] = root_handlers
    try:
        yield app_logger
    finally:
        app_logger.setLevel(saved[0])
        app_logger.handlers[:] = saved[1]
        root.handlers[:] = saved[2]


def test_adds_one_handler_and_is_idempotent() -> None:
    with _unconfigured([]) as app_logger:
        configure_logging()
        configure_logging()

        assert app_logger.level == logging.INFO
        assert len(app_logger.handlers) == 1
        assert logging.getLogger("app.services.generation_service").isEnabledFor(logging.INFO)


def test_defers_to_an_already_configured_root_logger() -> None:
    with _unconfigured([logging.NullHandler()]) as app_logger:
        configure_logging()

        assert app_logger.handlers == []
        assert app_logger.level == logging.INFO


def test_leaves_uvicorn_loggers_untouched() -> None:
    uvicorn_logger = logging.getLogger("uvicorn.error")
    before = (uvicorn_logger.level, list(uvicorn_logger.handlers), uvicorn_logger.propagate)

    with _unconfigured([]):
        configure_logging()

    assert (uvicorn_logger.level, list(uvicorn_logger.handlers), uvicorn_logger.propagate) == before
