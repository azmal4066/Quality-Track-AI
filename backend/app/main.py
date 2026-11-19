import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.core.config import get_settings
from app.api import inspection, system, analytics, products, defects, reports, assistant, employees, settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="QualityTrack AI API", version="0.2.0", docs_url="/docs")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().origins,
                   allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

for r in (system.router, inspection.router, analytics.router, products.router, defects.router, reports.router, assistant.router, employees.router, settings.router):
    app.include_router(r)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.getLogger("app").exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
