from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import set_request_id

logger = logging.getLogger("atlas.request")

REQUEST_ID_HEADER = "X-Request-Id"


class RequestIdLoggingMiddleware(BaseHTTPMiddleware):
    """Assigns a request ID (reusing the caller's if provided) and logs one structured line per
    request: method, path, status, duration. The ID is echoed back in the response header so a
    desktop/mobile client can correlate a failed call with a server-side log line.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        set_request_id(request_id)
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "request failed: %s %s (%.2fms)",
                request.method,
                request.url.path,
                duration_ms,
            )
            set_request_id(None)
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "%s %s -> %d (%.2fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        set_request_id(None)
        return response
