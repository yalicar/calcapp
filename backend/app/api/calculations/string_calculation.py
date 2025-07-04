# backend/app/api/calculations/string_calculation.py

from fastapi import APIRouter, HTTPException
import logging
from app.services.loader.project_loader import extract_project_info
from app.services.config_loader import build_calculation_config
from app.services.calculation.string_calculator import calculate_all_strings
from app.utils.filesystem import load_excel_sheet

router = APIRouter()
logger = logging.getLogger(__name__)

# ==============================================================================
# 📘 Endpoint IEC - Cálculo de strings con normativa IEC
# ==============================================================================
@router.get("/calculate-iec-strings/{project_name}")
def calculate_iec_strings(project_name: str):
    """
    Calcula únicamente strings (dc_strings) usando normativa IEC para un proyecto.
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[IEC] Proyecto cargado: {project_name}, panel: {project_info.get('panel_model')}")

        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="No hay datos en la hoja 'dc_string_circuits'.")

        config = build_calculation_config(
            project_info=project_info,
            normativa="IEC",
            project_name=project_name
        )
        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        logger.info(f"[IEC] Configuración generada: Panel {config['_metadata']['panel_model']}")
        if config['_metadata'].get('normativa_config', {}).get('has_project_overrides'):
            count = config['_metadata']['normativa_config']['overrides_info'].get("modified_count", 0)
            logger.info(f"[IEC] Overrides aplicados: {count} parámetros modificados")

        results = calculate_all_strings(df, config, circuit_type="dc_strings")

        return {
            "project_name": project_name,
            "circuit_type": "dc_strings",
            "normative": "IEC",
            "has_project_overrides": config['_metadata']['normativa_config'].get('has_project_overrides', False),
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

    except ValueError as e:
        logger.error(f"[IEC] Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.error(f"[IEC] Archivo no encontrado: {e}")
        raise HTTPException(status_code=404, detail="Proyecto o archivo Excel no encontrado")
    except Exception as e:
        logger.error(f"[IEC] Error inesperado: {e}")
        raise HTTPException(status_code=500, detail=f"Error en cálculo IEC: {str(e)}")


# ==============================================================================
# 📙 Endpoint NEC - Cálculo de strings con normativa NEC
# ==============================================================================
@router.get("/calculate-nec-strings/{project_name}")
def calculate_nec_strings(project_name: str):
    """
    Calcula los circuitos string DC usando la normativa NEC.
    Considera overrides específicos del proyecto si existen.
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[NEC] Proyecto cargado: {project_info.get('project_name')}, Panel: {project_info.get('panel_model')}")

        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="La hoja dc_string_circuits está vacía.")

        config = build_calculation_config(
            project_info=project_info,
            normativa="NEC",
            project_name=project_name
        )

        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        results = calculate_all_strings(df, config, circuit_type="dc_strings")

        return {
            "project_name": project_name,
            "normative": "NEC",
            "circuit_type": "dc_strings",
            "has_project_overrides": config['_metadata'].get('normativa_config', {}).get('has_project_overrides', False),
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

    except FileNotFoundError as e:
        logger.error(f"[NEC] Archivo no encontrado: {e}")
        raise HTTPException(status_code=404, detail="Proyecto o archivo Excel no encontrado")
    except ValueError as e:
        logger.error(f"[NEC] Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[NEC] Error inesperado: {e}")
        raise HTTPException(status_code=500, detail=f"Error en cálculo NEC: {str(e)}")
