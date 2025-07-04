from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Módulos principales
from app.api import pv_projects, pv_data

# Nuevo router modular para cálculos (IEC, NEC, parámetros, status)
from app.api.calculations import router as calculations_router

app = FastAPI(
    title="Solar PV Calculation System",
    description="Advanced solar photovoltaic system calculation and analysis platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ------------------------------------------------------------------------------
# CORS Middleware (para desarrollo local con frontend React u otros)
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Ajustar si cambia el frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Registro de routers principales
# ------------------------------------------------------------------------------

# Gestión de proyectos
app.include_router(
    pv_projects.router,
    prefix="/projects",
    tags=["Project Management"]
)

# Validación y extracción de datos desde Excel
app.include_router(
    pv_data.router,
    prefix="/data",
    tags=["Data Validation & Extraction"]
)

# Cálculos (IEC, NEC, gestión de normativas)
app.include_router(
    calculations_router,
    prefix="/calculations"
    # Los tags vienen de cada subrouter (IEC, NEC, Parameters, Status)
)

# ------------------------------------------------------------------------------
# Endpoints básicos
# ------------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {
        "status": "healthy",
        "service": "Solar PV Calculation System",
        "version": "1.0.0",
        "modules": ["projects", "data", "calculations"]
    }

@app.get("/")
def read_root():
    """
    Root endpoint providing API overview and available routes.
    """
    return {
        "message": "Solar PV Calculation System API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health_check": "/health",
        "available_modules": {
            "projects": "/projects - Project lifecycle management",
            "data": "/data - Excel data validation and extraction",
            "calculations": "/calculations - PV string and circuit calculations"
        },
        "example_workflows": [
            "1. POST /projects/create-project → Create new project",
            "2. POST /projects/upload-excel/{project_name} → Upload Excel file",
            "3. GET /data/validate-excel-content/{project_name} → Validate data",
            "4. GET /calculations/iec/calculate-strings/{project_name} → Run IEC string calculation",
            "5. GET /calculations/nec/calculate-strings/{project_name} → Run NEC string calculation"
        ]
    }

# ------------------------------------------------------------------------------
# Ejecutar con: python backend/app/main.py
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
