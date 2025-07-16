# normative_status.py

from fastapi import APIRouter, HTTPException
from pathlib import Path
import logging

# Servicios
from app.services.loader.project_norm_service import project_norm_service
from app.services.config_loader import get_available_normativas

# Logger
logger = logging.getLogger(__name__)

# Router para endpoints relacionados al estado general de normativas
router = APIRouter()

# ------------------------------------------------------------------------------
# [1] Estado de configuración normativa de un proyecto específico
# ------------------------------------------------------------------------------

STAGES = ["dc_strings", "level_1_dc", "ac_circuits", "mv_circuits"]

@router.get("/projects/{project_name}/normative-status")
def get_project_normative_status(project_name: str):
    try:
        result = {
            "project_name": project_name,
            "has_custom_config": False,
            "stages": {}
        }

        # 🔧 CAMBIAR ESTA LÍNEA:
        base_path = Path("backend/projects") / project_name / "normativas"  # Agregar "backend/"
        found_any = False

        for stage in STAGES:
            file_path = base_path / f"{stage}.yaml"
            exists = file_path.exists()
            result["stages"][stage] = {
                "override_exists": exists,
                "path": str(file_path) if exists else None
            }
            if exists:
                found_any = True

        result["has_custom_config"] = found_any
        return result

    except Exception as e:
        logger.error(f"Error verificando configuración de normativa para {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking normative status: {str(e)}")
    
# ------------------------------------------------------------------------------
# [2] Listado global de normativas base disponibles en el sistema
# ------------------------------------------------------------------------------

@router.get("/normatives/available")
def get_available_normatives():
    """
    Retorna la lista de normativas disponibles para los cálculos eléctricos.

    Returns:
        dict:
            - normatives: Información de todas las normativas (IEC, NEC, CUSTOM)
            - default: Normativa por defecto ("IEC")
    """
    try:
        normativas = get_available_normativas()
        logger.info("Lista de normativas obtenida exitosamente")
        return {
            "normatives": normativas,
            "default": "IEC"
        }

    except Exception as e:
        logger.error(f"Error obteniendo normativas: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo normativas: {str(e)}")
