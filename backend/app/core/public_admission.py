"""Bound public ingress before routing; one aggregate quota per application worker."""

import math
from time import monotonic
from uuid import uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.models.seller import ErrorBody, StandardErrorResponse


class PublicAdmissionMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.window_start = monotonic()
        self.requests = 0

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        prefix = f"{settings.API_PREFIX}/public/orders"
        path = scope.get("path", "")
        if scope["type"] != "http" or not (path == prefix or path.startswith(prefix + "/")):
            await self.app(scope, receive, send)
            return

        now = monotonic()
        window = settings.PUBLIC_REQUEST_WINDOW_SECONDS
        if now - self.window_start >= window:
            self.window_start, self.requests = now, 0
        if self.requests >= settings.PUBLIC_REQUESTS_PER_WINDOW:
            retry = max(1, math.ceil(window - (now - self.window_start)))
            await self.reject(scope, receive, send, 429, "PUBLIC_RATE_LIMITED",
                              f"Too many requests. Retry after {retry} seconds.", retry)
            return
        # No awaits between testing and reserving the slot on this event loop.
        self.requests += 1
        limit = (settings.PUBLIC_UPLOAD_MAX_BYTES if path.rstrip("/").endswith("/evidence")
                 else settings.PUBLIC_REQUEST_MAX_BYTES)
        headers = scope.get("headers", [])
        for name, value in headers:
            if name == b"content-length":
                try:
                    oversized = int(value) > limit
                except ValueError:
                    oversized = False
                if oversized:
                    await self.too_large(scope, receive, send)
                    return

        # Keep only a bounded body, counting actual bytes even for missing/false lengths.
        # Routing (including dependencies and storage work) starts only after admission.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > limit:
                await self.too_large(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)

    async def too_large(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self.reject(scope, receive, send, 413, "PUBLIC_BODY_TOO_LARGE",
                          "Request is too large. Reduce the request or screenshot size and retry.")

    async def reject(self, scope: Scope, receive: Receive, send: Send, status: int,
                     code: str, message: str, retry: int | None = None) -> None:
        headers = {"Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer"}
        if retry is not None:
            headers["Retry-After"] = str(retry)
        payload = StandardErrorResponse(error=ErrorBody(code=code, message=message),
                                        detail=message, request_id=str(uuid4()))
        response = JSONResponse(status_code=status, headers=headers, content=payload.model_dump())
        await response(scope, receive, send)
