from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar

_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id_ctx.get()


def set_request_id(request_id: str | None) -> None:
    _request_id_ctx.set(request_id)


class _RequestIdFilter(logging.Filter):
    """Injects the current request's ID (if any) into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True


class _JsonFormatter(logging.Formatter):
    """One JSON object per line - easy to grep, pipe into a log aggregator, or read raw.

    Deliberately not using a third-party JSON logging library: Atlas is a local-first, mostly
    offline app, and stdlib logging + a small formatter covers everything needed here without
    another pip dependency.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(*, level: int = logging.INFO) -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Idempotent: FastAPI's reload/test-client lifecycle can call this more than once in a
    # single process, and duplicate handlers would duplicate every log line.
    root_logger.handlers.clear()

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(_JsonFormatter())
    handler.addFilter(_RequestIdFilter())
    root_logger.addHandler(handler)
