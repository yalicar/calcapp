from backend.services.calculation import string_calculator
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any
import logging

# Importaciones actuales (mantener compatibilidad)
from backend.models.string_params import StringCalculationParams
from backend.services import parser
from backend.utils.filesystem import load_excel_sheet
from backend.services.calculation.string_calculator import calculate_all_strings
from backend.utils.filesystem import create_project_folder, save_excel_file
from backend.services.parser import read_project_excel

# Nuevas importaciones para sistema de normativas y paneles
from backend.services.config_loader import (
    build_calculation_config,
    get_available_normativas,
    get_available_panels,
    load_yaml_config
)

logger = logging.getLogger(__name__)
router = APIRouter()

class ProjectRequest(BaseModel):
    name: str

# Función auxiliar para extraer project_info del Excel ya cargado
def extract_project_info(project_name: str) -> Dict[str, Any]:
    """Extrae la información del proyecto desde Excel usando tu sistema existente"""
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise ValueError(f"Error leyendo Excel: {xl_or_msg}")
    
    xl = xl_or_msg
    try:
        df = xl.parse("project_info")
        if len(df) == 0:
            raise ValueError("La hoja project_info está vacía")
        
        # Convertir primera fila a diccionario
        project_info = df.iloc[0].to_dict()
        
        # Limpiar valores NaN
        cleaned_info = {}
        for key, value in project_info.items():
            if pd.isna(value):
                cleaned_info[key] = None
            else:
                cleaned_info[key] = value
        
        logger.info(f"Información del proyecto '{project_name}' extraída exitosamente")
        return cleaned_info
    
    except Exception as e:
        logger.error(f"Error extrayendo project_info: {e}")
        raise ValueError(f"Error procesando project_info: {str(e)}")

# Endpoints existentes (mantener compatibilidad)
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
            "dc_cn1_circuits": safe_parse("dc_cn1_circuits"),
            "ac_circuits": safe_parse("ac_circuits"),
            "mv_circuits": safe_parse("mv_circuits"),
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

@router.get("/list-projects")
def list_projects():
    project_root = Path(__file__).parent.parent / "projects"
    try:
        return [f.name for f in project_root.iterdir() if f.is_dir()]
    except Exception as e:
        return {"error": str(e)}

# Nuevos endpoints con sistema de normativas y paneles
@router.get("/calculate-strings/{project_name}")
def calculate_strings_with_normativa(
    project_name: str, 
    circuit_type: str = Query("dc_strings", description="Tipo de circuito: dc_strings, level_1_dc, ac_circuits, mv_circuits"),
    normativa: str = Query("IEC", description="Normativa: IEC, NEC, PERSONALIZADA")
):
    """
    Calcula strings usando el nuevo sistema de normativas y paneles
    
    Args:
        project_name: Nombre del proyecto
        circuit_type: Tipo de circuito a calcular
        normativa: Normativa a aplicar (IEC, NEC, PERSONALIZADA)
    """
    try:
        # 1. Cargar información del proyecto usando tu sistema existente
        project_info = extract_project_info(project_name)
        logger.info(f"Proyecto cargado: {project_info.get('project_name', 'N/A')}, Panel: {project_info.get('panel_model', 'N/A')}")
        
        # 2. Cargar datos de circuitos usando tu función existente load_excel_sheet
        sheet_mapping = {
            "dc_strings": "dc_string_circuits",
            "level_1_dc": "dc_cn1_circuits", 
            "ac_circuits": "ac_circuits",
            "mv_circuits": "mv_circuits"
        }
        
        if circuit_type not in sheet_mapping:
            raise HTTPException(status_code=400, detail=f"Tipo de circuito no válido: {circuit_type}")
        
        sheet_name = sheet_mapping[circuit_type]
        df = load_excel_sheet(project_name, sheet_name=sheet_name)
        
        if len(df) == 0:
            raise HTTPException(status_code=400, detail=f"No hay datos en la hoja {sheet_name}")
        
        # 3. Construir configuración combinando panel + normativa
        config = build_calculation_config(
            project_info=project_info,
            normativa=normativa,
            custom_params=None
        )
        
        logger.info(f"Configuración construida: Panel {config['_metadata']['panel_model']}, Normativa {normativa}")
        
        # 4. Ejecutar cálculos
        results = calculate_all_strings(df, config, circuit_type)
        
        # 5. Construir respuesta estructurada
        response = {
            "project_name": project_name,
            "circuit_type": circuit_type,
            "normativa": normativa,
            "panel_info": {
                "model": project_info.get('panel_model', 'N/A'),
                "isc": config.get('isc_ref', 0),
                "power": config.get('power_stc', 0)
            },
            "calculation_params": {
                "isc_correction": config.get('isc_correction', 1.25),
                "cable_material": config['cable']['material'],
                "installation_method": config['installation']['method'],
                "max_voltage_drop": config['voltage_drop']['max_percentage']
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r])
            },
            "metadata": config['_metadata']
        }
        
        logger.info(f"Cálculo completado: {len(results)} circuitos procesados")
        return response
        
    except ValueError as e:
        logger.error(f"Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.error(f"Archivo no encontrado: {e}")
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        logger.error(f"Error inesperado en cálculo: {e}")
        raise HTTPException(status_code=500, detail=f"Error en cálculo: {str(e)}")

@router.post("/calculate-strings/{project_name}/custom")
def calculate_custom_strings_with_normativa(
    project_name: str, 
    params: StringCalculationParams,
    circuit_type: str = Query("dc_strings", description="Tipo de circuito"),
    normativa: str = Query("PERSONALIZADA", description="Normativa base")
):
    """
    Calcula strings con parámetros personalizados usando el nuevo sistema
    """
    try:
        # 1. Cargar información del proyecto usando tu sistema existente
        project_info = extract_project_info(project_name)
        
        # 2. Cargar datos de circuitos usando tu función existente
        sheet_mapping = {
            "dc_strings": "dc_string_circuits",
            "level_1_dc": "dc_cn1_circuits",
            "ac_circuits": "ac_circuits", 
            "mv_circuits": "mv_circuits"
        }
        
        sheet_name = sheet_mapping.get(circuit_type, "dc_string_circuits")
        df = load_excel_sheet(project_name, sheet_name=sheet_name)
        
        # 3. Convertir StringCalculationParams a diccionario de parámetros custom
        custom_params = {
            "cable_material": params.cable_material,
            "cable_max_temp": params.cable_max_temp,
            "method": params.method,
            "layout": params.layout,
            "separation": params.separation,
            "depth_cm": params.depth_cm,
            "current_ambient": params.current_ambient,
            "reference_voltage": params.reference_voltage,
            "max_voltage_drop_pct": params.max_voltage_drop_pct,
            "isc_correction": params.isc_correction,
            "number_of_parallel_strings": params.number_of_parallel_strings
        }
        
        # 4. Construir configuración con parámetros personalizados
        config = build_calculation_config(
            project_info=project_info,
            normativa=normativa,
            custom_params=custom_params
        )
        
        # 5. Ejecutar cálculos
        results = calculate_all_strings(df, config, circuit_type)
        
        # 6. Respuesta estructurada
        response = {
            "project_name": project_name,
            "circuit_type": circuit_type,
            "normativa": normativa,
            "custom_params": custom_params,
            "panel_info": {
                "model": project_info.get('panel_model', 'N/A'),
                "isc": config.get('isc_ref', 0),
                "power": config.get('power_stc', 0)
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r])
            },
            "metadata": config['_metadata']
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error en cálculo personalizado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoints de apoyo para el frontend
@router.get("/normativas")
def get_normativas():
    """Obtiene la lista de normativas disponibles"""
    try:
        normativas = get_available_normativas()
        return {
            "normativas": normativas,
            "default": "IEC"
        }
    except Exception as e:
        logger.error(f"Error obteniendo normativas: {e}")
        return {
            "normativas": {
                "IEC": {"name": "IEC (Fallback)", "description": "Estándar internacional"},
                "PERSONALIZADA": {"name": "Personalizada", "description": "Configuración personalizada"}
            },
            "default": "IEC"
        }

@router.get("/panels")
def get_panels():
    """Obtiene la lista de paneles disponibles en la base de datos"""
    try:
        panels = get_available_panels()
        return {
            "panels": panels,
            "total": len(panels)
        }
    except Exception as e:
        logger.error(f"Error obteniendo paneles: {e}")
        return {
            "panels": {"Panel Personalizado": {"manufacturer": "Personalizado", "model": "Definido por usuario"}},
            "total": 1
        }

@router.get("/project-info/{project_name}")
def get_project_info(project_name: str):
    """Obtiene la información completa del proyecto incluyendo datos del panel"""
    try:
        project_info = extract_project_info(project_name)
        
        # Intentar obtener datos del panel si está en la base de datos
        panel_model = project_info.get('panel_model', 'Panel Personalizado')
        
        try:
            from backend.services.config_loader import get_panel_data
            panel_data = get_panel_data(panel_model)
            project_info['_panel_data'] = panel_data
        except Exception as e:
            logger.warning(f"Panel '{panel_model}' no encontrado en base de datos: {e}")
            project_info['_panel_data'] = None
        
        return {
            "project_info": project_info,
            "panel_in_database": project_info['_panel_data'] is not None
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo información del proyecto: {e}")
        raise HTTPException(status_code=404, detail=f"Error obteniendo información del proyecto: {str(e)}")

# Endpoints legacy (mantener compatibilidad temporal)
@router.get("/calculate-strings-legacy/{project_name}")
def calculate_strings_legacy(project_name: str):
    """Endpoint legacy para compatibilidad con frontend actual"""
    try:
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        config = load_yaml_config("backend/configs/string_config.yaml")
        results = calculate_all_strings(df, config)
        return results
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))