import logging

from fastapi import FastAPI

from app.api.router import api_router
from app.config import get_settings
from app.middleware import setup_middleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

setup_middleware(app)
app.include_router(api_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy", "version": settings.APP_VERSION}
