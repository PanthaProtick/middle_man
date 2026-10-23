import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.orders import router as orders_router
from app.api.routes import router as api_router
from app.api.seller import router as seller_router
from app.core.auth import get_request_id
from app.core.config import settings
from app.models.seller import ErrorBody, ErrorFieldItem, StandardErrorResponse

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENV} mode...")
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

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        return JSONResponse(status_code=exc.status_code, content=resp_model.model_dump())

    resp_model = StandardErrorResponse(
        error=ErrorBody(code="HTTP_ERROR", message=str(exc.detail)),
        detail=exc.detail,
        request_id=request_id,
    )
    return JSONResponse(status_code=exc.status_code, content=resp_model.model_dump())


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = get_request_id(request.headers.get("x-request-id"))
    fields = [
        ErrorFieldItem(
            field=".".join(str(loc) for loc in err["loc"] if loc != "body"),
            code=err["type"],
            message=str(err["msg"]),
        )
        for err in exc.errors()
    ]
    resp_model = StandardErrorResponse(
        error=ErrorBody(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            fields=fields,
        ),
        detail=jsonable_encoder(exc.errors()),
        request_id=request_id,
    )
    return JSONResponse(status_code=422, content=resp_model.model_dump())


# Include routes
app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(seller_router, prefix=settings.API_PREFIX)
app.include_router(orders_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
