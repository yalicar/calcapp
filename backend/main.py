from fastapi import FastAPI
from backend.routes import pv_calculations, pv_data, pv_projects
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Solar PV Calculation System",
    description="Advanced solar photovoltaic system calculation and analysis platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules with prefixes for organization
app.include_router(
    pv_projects.router, 
    prefix="/projects", 
    tags=["Project Management"]
)

app.include_router(
    pv_data.router, 
    prefix="/data", 
    tags=["Data Validation & Extraction"]
)

app.include_router(
    pv_calculations.router, 
    prefix="/calculations", 
    tags=["PV Calculations"]
)

# Health check endpoint
@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {
        "status": "healthy",
        "service": "Solar PV Calculation System",
        "version": "1.0.0",
        "modules": ["pv_projects", "pv_data", "pv_calculations"]
    }

# Root endpoint with API information
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
            "4. GET /calculations/calculate-strings/{project_name} → Run calculations"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)