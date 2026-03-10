from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi import staticfiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os

from src.internal.handlers.auth_handler import router as auth_router
from src.internal.repositories.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("starting up")
    await init_db()
    
    yield

    print("shutting down gracefully")
    from src.internal.repositories.sessions import engine
    await engine.dispose()
    print("connection closed")


app = FastAPI(title="piano-site")

app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404, 
        content={"message": "Endpoint not found"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)