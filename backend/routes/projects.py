from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import numpy as np
from pathlib import Path

from backend.models.string_params import StringCalculationParams
from backend.services import parser, string_calculator
from backend.utils.filesystem import load_excel_sheet
from backend.services.config_loader import load_yaml_config
from backend.services.string_calculator import calculate_all_strings
from backend.utils.filesystem import create_project_folder, save_excel_file
from backend.services.parser import read_project_excel

router = APIRouter()

class ProjectRequest(BaseModel):
    name: str

@router.post("/create-project")
def create_project(request: ProjectRequest):
    success, message = create_project_folder(request.name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@router.post("/upload-excel/{project_name}")
def upload_excel(project_name: str, file: UploadFile = File(...)):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are allowed.")
    
    success, message = save_excel_file(project_name, file)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"message": message}

@router.get("/read-excel/{project_name}")
def read_excel(project_name: str):
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg  # ExcelFile

    try:
        def safe_parse(sheet_name):
            df = xl.parse(sheet_name).replace({np.nan: None, np.inf: None, -np.inf: None})
            return df.head(3).to_dict(orient="records")

        preview = {
            "project_info": safe_parse("project_info"),
            "dc_string_circuits": safe_parse("dc_string_circuits"),
            "ac_circuits": safe_parse("ac_circuits"),
            # Descomenta si tienes esta hoja
            # "correction_factors": safe_parse("correction_factors")
        }

        return preview

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel: {str(e)}")


@router.get("/validate-excel/{project_name}")
def validate_excel(project_name: str):
    success, result = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=result)
    return {"message": "Excel structure is valid."}

@router.get("/calculate-strings/{project_name}")
def calculate_strings(project_name: str):
    try:
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        config = load_yaml_config("backend/configs/string_config.yaml")
        results = calculate_all_strings(df, config)
        return results
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/calculate-strings/{project_name}/custom")
def calculate_custom_strings(project_name: str, params: StringCalculationParams):
    project_dir = f"backend/projects/{project_name}"
    input_file = f"{project_dir}/input.xlsx"

    try:
        df = parser.load_string_circuits(input_file)
        config = parser.load_project_info(input_file)

        # Sobrescribir los parámetros con los que vienen del frontend
        config["isc_ref"] = params.isc_ref
        config["isc_correction"] = params.isc_correction
        config["number_of_parallel_strings"] = params.number_of_parallel_strings
        config["cable"]["material"] = params.cable_material
        config["cable"]["max_temp"] = params.cable_max_temp
        config["installation"]["method"] = params.method
        config["installation"]["layout"] = params.layout
        config["installation"]["separation"] = "yes" if params.separation else "no"
        config["installation"]["depth_cm"] = params.depth_cm
        config["correction_factors"]["ambient_temperature"]["current_ambient"] = params.current_ambient
        config["voltage_drop"]["reference_voltage"] = params.reference_voltage
        config["voltage_drop"]["max_percentage"] = params.max_voltage_drop_pct

        return string_calculator.calculate_all_strings(df, config)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/list-projects")
def list_projects():
    project_root = Path(__file__).parent.parent / "projects"
    try:
        return [f.name for f in project_root.iterdir() if f.is_dir()]
    except Exception as e:
        return {"error": str(e)}