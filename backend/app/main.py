import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import RequestResponseEndpoint

from app.api.courier import router as courier_router
from app.api.link_access import router as link_access_router
from app.api.order_export import router as order_export_router
from app.api.orders import router as orders_router
from app.api.pathao import router as pathao_router
from app.api.public_orders import router as public_orders_router
from app.api.routes import router as api_router
from app.api.seller import router as seller_router
from app.api.sms import router as sms_router
from app.api.structured_retention import router as structured_retention_router
from app.api.transactions import router as transactions_router
from app.core.auth import get_request_id
from app.core.auth_diagnostics import rejection_reason
from app.core.config import settings
from app.core.database import DurableStorageUnavailableError, check_database_readiness
from app.core.public_admission import PublicAdmissionMiddleware
from app.core.tokens import check_link_encryption_readiness
from app.models.seller import ErrorBody, ErrorFieldItem, StandardErrorResponse
from app.services.evidence_store import init_evidence_storage
from app.services.payment_marker_protection import check_payment_marker_readiness

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(
        f"Starting {settings.PROJECT_NAME} in {settings.ENV} mode (durable_storage={settings.is_durable_mode})..."
    )
    if settings.is_durable_mode:
        readiness = await check_database_readiness()
        if not readiness.is_ready:
            logger.error(f"Durable storage startup check failed: {readiness.diagnostic}")
            raise DurableStorageUnavailableError(
                message=f"Durable storage initialization failed: {readiness.diagnostic}"
            )
        logger.info("Durable storage verified: database connection and schema inventory are ready.")
        await check_link_encryption_readiness()
        logger.info("Order link encryption verified: application key and existing record compatibility are ready.")
        await check_payment_marker_readiness()
        logger.info("Payment marker protection verified: dedicated secret and marker bindings are ready.")
    if settings.is_durable_mode or settings.ENV == "development":
        init_evidence_storage()
        logger.info("Evidence storage verified: durable local folder initialized.")
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Dev Template API powered by FastAPI, with optional Neon Postgres and Google Gemini integrations.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


@app.middleware("http")
async def protect_public_responses(request: Request, call_next: RequestResponseEndpoint) -> Response:
    response = await call_next(request)
    if request.url.path.startswith((f"{settings.API_PREFIX}/public/orders", f"{settings.API_PREFIX}/seller/")):
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Referrer-Policy"] = "no-referrer"
    return response

# CORS setup
app.add_middleware(PublicAdmissionMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After", "X-Seller-Auth-Reason"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = get_request_id(request.headers.get("x-request-id"))
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        code = str(exc.detail["code"])
        message = str(exc.detail.get("message", "An error occurred"))
        fields = exc.detail.get("fields")
        err_fields = [ErrorFieldItem(**f) for f in fields] if fields else None
        resp_model = StandardErrorResponse(
            error=ErrorBody(code=code, message=message, fields=err_fields),
            detail=message,
            request_id=request_id,
        )
        headers = {"X-Seller-Auth-Reason": rejection_reason(message)} if (
            exc.status_code == 401 and code == 'UNAUTHORIZED'
        ) else None
        return JSONResponse(status_code=exc.status_code, content=resp_model.model_dump(), headers=headers)

    resp_model = StandardErrorResponse(
        error=ErrorBody(code="HTTP_ERROR", message=str(exc.detail)),
        detail=exc.detail,
        request_id=request_id,
    )
    return JSONResponse(status_code=exc.status_code, content=resp_model.model_dump())


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = get_request_id(request.headers.get("x-request-id"))
    is_public_order = request.url.path.startswith(f"{settings.API_PREFIX}/public/orders")
    is_courier_settings = request.url.path.startswith(f"{settings.API_PREFIX}/seller/courier/pathao")
    fields = [
        ErrorFieldItem(
            field=".".join(str(loc) for loc in err["loc"] if loc != "body"),
            code=err["type"],
            # Custom validators can include the raw phone/address in their message.
            message="Invalid value" if is_courier_settings or is_public_order and err["type"] == "value_error" else str(err["msg"]),
        )
        for err in exc.errors()
    ]
    resp_model = StandardErrorResponse(
        error=ErrorBody(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            fields=fields,
        ),
        detail=(None if is_courier_settings or is_public_order or request.url.path.startswith(
                    f"{settings.API_PREFIX}/seller/transactions/sms-"
                )
                else jsonable_encoder(exc.errors())),
        request_id=request_id,
    )
    return JSONResponse(status_code=422, content=resp_model.model_dump())


# Include routes
app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(seller_router, prefix=settings.API_PREFIX)
app.include_router(structured_retention_router, prefix=settings.API_PREFIX)
app.include_router(order_export_router, prefix=settings.API_PREFIX)
app.include_router(orders_router, prefix=settings.API_PREFIX)
app.include_router(courier_router, prefix=settings.API_PREFIX)
app.include_router(pathao_router, prefix=settings.API_PREFIX)
app.include_router(link_access_router, prefix=settings.API_PREFIX)
# Literal SMS paths must precede the receipt-ID route.
app.include_router(sms_router, prefix=settings.API_PREFIX)
app.include_router(transactions_router, prefix=settings.API_PREFIX)
app.include_router(public_orders_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, access_log=False)
