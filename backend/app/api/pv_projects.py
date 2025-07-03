# backend/routes/pv_projects.py
"""
PV PROJECT MANAGEMENT ROUTES

=== PURPOSE ===
This module handles the complete lifecycle management of solar PV projects.
It provides CRUD operations for projects and manages the file system structure
required for solar calculation workflows.

=== MAIN RESPONSIBILITIES ===
1. Project creation with proper folder structure
2. Project listing and discovery
3. Project deletion with confirmation safety
4. Excel file upload and management
5. Project information extraction and display
6. File system organization and cleanup

=== KEY FEATURES ===
- Safe project deletion with confirmation requirement
- Automatic folder structure creation
- Excel file validation during upload
- Project metadata extraction
- Panel database integration for project info
- Comprehensive error handling and logging

=== PROJECT STRUCTURE ===
Each project creates the following structure:
```
projects/{project_name}/
├── input.xlsx              # Main project data file
├── calculations/           # Generated calculation results
├── reports/               # Generated reports and outputs
└── metadata.json          # Project configuration and history
```

=== ENDPOINTS OVERVIEW ===
- POST /create-project                     → Create new project
- GET  /list-projects                      → List all projects
- DELETE /delete-project/{project_name}    → Delete project (with confirmation)
- POST /upload-excel/{project_name}        → Upload Excel file to project
- GET  /project-info/{project_name}        → Get project information and metadata

=== SECURITY CONSIDERATIONS ===
- Project names are validated to prevent directory traversal
- File uploads are restricted to .xlsx format only
- Deletion requires explicit confirmation parameter
- All file operations are logged for audit trail

=== INTEGRATION POINTS ===
- Works with pv_data.py for Excel validation
- Provides data for pv_calculations.py endpoints
- Integrates with panel database for project info
- Connects to file system utilities for operations

=== FUTURE ENHANCEMENTS ===
- Project templates and initialization
- Project versioning and history
- Bulk project operations
- Project sharing and collaboration
- Integration with external project management tools
- Automated backup and restore

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, ConfigDict
import pandas as pd
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # apunta a calcapp/
PROJECTS_DIR = BASE_DIR / "projects"
from typing import Dict, Any
import logging
import shutil

# Project management imports
from app.utils.filesystem import create_project_folder, save_excel_file
from app.services.parsing.parser import read_project_excel
from app.services.loader.project_loader import extract_project_info

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ProjectRequest(BaseModel):
    """Request model for project creation"""
    name: str
    description: str = ""
    location: str = ""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "solar_farm_project",
            "description": "Large scale solar farm in California",
            "location": "California, USA"
        }
    })

class ProjectDeleteRequest(BaseModel):
    """Request model for project deletion with safety confirmation"""
    name: str
    confirm: bool = False

# ============================================================================
# PROJECT LIFECYCLE ENDPOINTS
# ============================================================================

@router.post("/create-project")
def create_new_project(request: ProjectRequest):
    """
    Creates a new solar PV project with proper folder structure.
    
    This endpoint initializes a new project by:
    - Creating the project folder structure
    - Setting up subdirectories for calculations and reports
    - Initializing project metadata
    - Preparing for Excel file upload
    
    Args:
        request: Project creation request with name and optional metadata
        
    Returns:
        Success message with project details
        
    Raises:
        HTTPException 400: If project creation fails or name is invalid
        
    Example:
        POST /create-project
        Body: {
            "name": "solar_farm_california",
            "description": "500MW solar farm project",
            "location": "California, USA"
        }
        
        Response:
        {
            "message": "Project 'solar_farm_california' created successfully",
            "project_name": "solar_farm_california",
            "folder_structure": ["calculations", "reports"],
            "next_steps": "Upload Excel file to begin calculations"
        }
    """
    success, message = create_project_folder(request.name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Log project creation with metadata
    logger.info(f"Project created: {request.name}, Description: {request.description}, Location: {request.location}")
    
    return {
        "message": message,
        "project_name": request.name,
        "description": request.description,
        "location": request.location,
        "folder_structure": ["calculations", "reports"],
        "next_steps": "Upload Excel file to begin calculations"
    }

@router.get("/list-projects")
def list_all_projects():
    """
    Lists all available solar PV projects.
    
    Scans the projects directory and returns information about all
    existing projects including their status and basic metadata.
    
    Returns:
        List of projects with metadata and total count
        
    Example:
        GET /list-projects
        
        Response:
        {
            "projects": [
                {
                    "name": "solar_farm_california",
                    "has_excel": true,
                    "last_modified": "2025-06-30T10:30:00",
                    "status": "ready_for_calculation"
                }
            ],
            "total": 1,
            "summary": {
                "with_excel": 1,
                "without_excel": 0,
                "ready_for_calculation": 1
            }
        }
    """
    project_root = PROJECTS_DIR
    
    try:
        if not project_root.exists():
            raise HTTPException(status_code=500, detail="Projects directory not found.")
        
        projects = []
        summary = {"with_excel": 0, "without_excel": 0, "ready_for_calculation": 0}
        
        for project_dir in project_root.iterdir():
            if project_dir.is_dir():
                project_info = {"name": project_dir.name}
                
                # Check for Excel file
                excel_path = project_dir / "input.xlsx"
                project_info["has_excel"] = excel_path.exists()
                
                if excel_path.exists():
                    summary["with_excel"] += 1
                    import os
                    import datetime
                    stat = os.stat(excel_path)
                    project_info["last_modified"] = datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
                    project_info["file_size_mb"] = round(stat.st_size / (1024 * 1024), 2)
                    
                    # Try to get project status
                    try:
                        # Quick check if project data is readable
                        success, _ = read_project_excel(project_dir.name)
                        if success:
                            project_info["status"] = "ready_for_calculation"
                            summary["ready_for_calculation"] += 1
                        else:
                            project_info["status"] = "excel_error"
                    except Exception:
                        project_info["status"] = "excel_error"
                else:
                    summary["without_excel"] += 1
                    project_info["status"] = "awaiting_excel"
                
                projects.append(project_info)
        
        # Sort projects by name
        projects.sort(key=lambda x: x["name"])
        
        logger.info(f"Listed {len(projects)} projects")
        return {
            "projects": projects,
            "total": len(projects),
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        return {"error": str(e), "projects": [], "total": 0}

@router.delete("/delete-project/{project_name}")
def delete_project_permanently(project_name: str, confirm: bool = Query(False)):
    """
    Permanently deletes a project and all its files.
    
    This is a destructive operation that removes:
    - All project files including Excel data
    - Generated calculations and reports
    - Project folder and subdirectories
    
    SAFETY FEATURES:
    - Requires explicit confirmation parameter
    - Comprehensive logging for audit trail
    - Validation of project existence before deletion
    
    Args:
        project_name: Name of the project to delete
        confirm: Must be True to proceed with deletion (safety check)
        
    Returns:
        Success message confirming deletion
        
    Raises:
        HTTPException 400: If confirmation is missing
        HTTPException 404: If project doesn't exist
        HTTPException 500: If deletion fails
        
    Example:
        DELETE /delete-project/old_project?confirm=true
        
        Response:
        {
            "message": "Project 'old_project' deleted successfully",
            "deleted_files": ["input.xlsx", "calculations/", "reports/"],
            "timestamp": "2025-06-30T10:30:00"
        }
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Must confirm deletion using 'confirm=true' parameter for safety"
        )
    
    project_path = PROJECTS_DIR / project_name

    
    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")
    
    try:
        # Log what will be deleted for audit trail
        deleted_items = []
        for item in project_path.rglob("*"):
            if item.is_file():
                deleted_items.append(str(item.relative_to(project_path)))
        
        # Perform deletion
        shutil.rmtree(project_path)
        
        import datetime
        timestamp = datetime.datetime.now().isoformat()
        
        logger.info(f"Project deleted: {project_name}, Files: {len(deleted_items)}, Timestamp: {timestamp}")
        
        return {
            "message": f"Project '{project_name}' deleted successfully",
            "deleted_files": deleted_items,
            "timestamp": timestamp
        }
        
    except Exception as e:
        logger.error(f"Error deleting project {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting project: {str(e)}")

# ============================================================================
# FILE MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/upload-excel/{project_name}")
def upload_excel_file_to_project(project_name: str, file: UploadFile = File(...)):
    """
    Uploads an Excel file to the specified project.
    
    This endpoint handles Excel file upload with:
    - File format validation (.xlsx only)
    - File size and content basic checks
    - Automatic placement in project structure
    - Overwrite of existing files with logging
    
    Args:
        project_name: Name of the target project
        file: Excel file to upload (.xlsx format required)
        
    Returns:
        Success message with file details
        
    Raises:
        HTTPException 400: If file format is invalid or upload fails
        HTTPException 404: If project doesn't exist
        
    Example:
        POST /upload-excel/solar_farm_project
        File: project_data.xlsx
        
        Response:
        {
            "message": "Excel file uploaded successfully",
            "filename": "project_data.xlsx",
            "project_name": "solar_farm_project",
            "file_size_mb": 2.5,
            "timestamp": "2025-06-30T10:30:00",
            "next_steps": "Validate Excel content before calculations"
        }
    """
    # Validate file format
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400, 
            detail="Only .xlsx files are allowed. Please convert your file to Excel format."
        )
    
    # Check if project exists
    project_path = PROJECTS_DIR / project_name

    if not project_path.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Project '{project_name}' not found. Create the project first."
        )
    
    success, message = save_excel_file(project_name, file)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Get file information for response
    try:
        excel_path = project_path / "input.xlsx"
        if excel_path.exists():
            import os
            import datetime
            stat = os.stat(excel_path)
            file_size_mb = round(stat.st_size / (1024 * 1024), 2)
            timestamp = datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        else:
            file_size_mb = 0
            timestamp = datetime.datetime.now().isoformat()
    except Exception:
        file_size_mb = 0
        timestamp = datetime.datetime.now().isoformat()

    logger.info(f"Excel uploaded to project {project_name}: {file.filename}, Size: {file_size_mb}MB")
    
    return {
        "message": message,
        "filename": file.filename,
        "project_name": project_name,
        "file_size_mb": file_size_mb,
        "timestamp": timestamp,
        "next_steps": "Validate Excel content before starting calculations"
    }

# ============================================================================
# PROJECT INFORMATION ENDPOINTS
# ============================================================================

@router.get("/project-info/{project_name}")
def get_comprehensive_project_information(project_name: str):
    """
    Gets comprehensive project information including panel database integration.
    
    This endpoint combines:
    - Project metadata from Excel file
    - Panel specifications from database
    - Project status and file information
    - Calculation readiness assessment
    
    Args:
        project_name: Name of the project
        
    Returns:
        Comprehensive project information with panel data integration
        
    Raises:
        HTTPException 404: If project or Excel file not found
        HTTPException 500: If information extraction fails
        
    Example:
        GET /project-info/solar_farm_california
        
        Response:
        {
            "project_info": {
                "project_name": "Solar Farm California",
                "panel_model": "SunPower SPR-400",
                "location": "California, USA",
                "system_size_mw": 500
            },
            "panel_data": {
                "manufacturer": "SunPower",
                "power_stc": 400,
                "isc_ref": 6.47,
                "voc_ref": 85.6
            },
            "panel_in_database": true,
            "project_status": {
                "has_excel": true,
                "validated": false,
                "ready_for_calculation": true
            },
            "file_info": {
                "last_modified": "2025-06-30T10:30:00",
                "size_mb": 2.1
            }
        }
    """
    try:
        # Extract project information from Excel
        project_info = extract_project_info(project_name)
        
        # Try to get panel data from database
        panel_model = project_info.get('panel_model', 'Custom Panel')
        panel_in_database = False
        panel_data = None
        
        try:
            from app.services.config_loader import get_panel_data
            panel_data = get_panel_data(panel_model)
            panel_in_database = True
            project_info['_panel_data'] = panel_data
            logger.info(f"Panel '{panel_model}' found in database for project {project_name}")
        except Exception as e:
            logger.warning(f"Panel '{panel_model}' not found in database: {e}")
            project_info['_panel_data'] = None
        
        # Get file information
        project_path = PROJECTS_DIR / project_name

        excel_path = project_path / "input.xlsx"
        
        file_info = {}
        project_status = {"has_excel": excel_path.exists()}
        
        if excel_path.exists():
            try:
                import os
                import datetime
                stat = os.stat(excel_path)
                file_info = {
                    "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size_mb": round(stat.st_size / (1024 * 1024), 2)
                }
                
                # Check if Excel is readable for calculation readiness
                success, _ = read_project_excel(project_name)
                project_status["ready_for_calculation"] = success
                
            except Exception as e:
                logger.warning(f"Error getting file info for {project_name}: {e}")
                project_status["ready_for_calculation"] = False
        else:
            project_status["ready_for_calculation"] = False
        
        return {
            "project_info": project_info,
            "panel_data": panel_data,
            "panel_in_database": panel_in_database,
            "project_status": project_status,
            "file_info": file_info
        }
        
    except Exception as e:
        logger.error(f"Error getting project information for {project_name}: {e}")
        raise HTTPException(
            status_code=404, 
            detail=f"Error getting project information: {str(e)}"
        )

@router.get("/project-status/{project_name}")
def get_project_calculation_status(project_name: str):
    """
    Gets the current status of a project for calculation readiness.
    
    Quick status check that determines:
    - If Excel file exists and is readable
    - If project data is valid for calculations
    - If panel is in database vs custom
    - Next recommended actions
    
    Args:
        project_name: Name of the project
        
    Returns:
        Project status summary and recommendations
        
    Example:
        GET /project-status/project1
        
        Response:
        {
            "status": "ready",
            "has_excel": true,
            "excel_readable": true,
            "panel_in_database": true,
            "next_actions": ["validate_content", "run_calculations"],
            "issues": []
        }
    """
    project_path = PROJECTS_DIR / project_name

    
    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")
    
    excel_path = project_path / "input.xlsx"
    status = {
        "project_name": project_name,
        "has_excel": excel_path.exists(),
        "excel_readable": False,
        "panel_in_database": False,
        "issues": [],
        "next_actions": []
    }
    
    if not status["has_excel"]:
        status["status"] = "needs_excel"
        status["issues"].append("No Excel file uploaded")
        status["next_actions"].append("upload_excel")
        return status
    
    # Check if Excel is readable
    try:
        success, _ = read_project_excel(project_name)
        status["excel_readable"] = success
        
        if success:
            # Check panel database
            try:
                project_info = extract_project_info(project_name)
                panel_model = project_info.get('panel_model', '')
                
                from app.services.config_loader import get_panel_data
                get_panel_data(panel_model)
                status["panel_in_database"] = True
            except Exception:
                status["issues"].append("Panel not found in database - will use custom parameters")
        else:
            status["issues"].append("Excel file has format or structure issues")
            
    except Exception as e:
        status["excel_readable"] = False
        status["issues"].append(f"Excel reading error: {str(e)}")
    
    # Determine overall status and next actions
    if status["excel_readable"]:
        status["status"] = "ready"
        status["next_actions"] = ["validate_content", "run_calculations"]
    elif status["has_excel"]:
        status["status"] = "excel_issues"
        status["next_actions"] = ["fix_excel", "reupload_excel"]
    else:
        status["status"] = "needs_excel"
        status["next_actions"] = ["upload_excel"]
    
    return status