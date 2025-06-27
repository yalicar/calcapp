from fastapi import FastAPI
from backend.routes import projects, validation
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="calcapp")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # o ["*"] para desarrollo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(projects.router)
app.include_router(validation.router)

