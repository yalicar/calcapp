from fastapi import APIRouter, HTTPException
from pathlib import Path
import os

from backend.services.parser import read_project_excel
from backend.services.validator import (
    validate_project_info,
    validate_dc_string_circuits,
    validate_dc_cn1_circuits,
    validate_ac_circuits,
    validate_mv_circuits,
)

router = APIRouter()

@router.get("/validate-content/{project_name}")
def validate_content(project_name: str):
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    errors = []

    try:
        errors += validate_project_info(xl.parse("project_info"))
        errors += validate_dc_string_circuits(xl.parse("dc_string_circuits"))
        errors += validate_dc_cn1_circuits(xl.parse("dc_cn1_circuits"))
        errors += validate_ac_circuits(xl.parse("ac_circuits"))
        errors += validate_mv_circuits(xl.parse("mv_circuits"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    if errors:
        # Eliminar el archivo si hay errores
        file_path = Path(f"backend/projects/{project_name}/input.xlsx")
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=errors)

    return {"message": "Contenido del Excel válido."}

@router.get("/get-excel-data/{project_name}")
def get_excel_data(project_name: str):
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        data = {
            "project_info": xl.parse("project_info").fillna("").to_dict(orient="records"),
            "dc_string_circuits": xl.parse("dc_string_circuits").fillna("").to_dict(orient="records"),
            "dc_cn1_circuits": xl.parse("dc_cn1_circuits").fillna("").to_dict(orient="records"),
            "ac_circuits": xl.parse("ac_circuits").fillna("").to_dict(orient="records"),
            "mv_circuits": xl.parse("mv_circuits").fillna("").to_dict(orient="records"),
        }
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer el archivo: {str(e)}")
