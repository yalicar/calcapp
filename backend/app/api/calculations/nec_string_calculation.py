from fastapi import APIRouter, HTTPException
import logging
from app.services.loader.project_loader import extract_project_info
from app.services.config_loader import build_calculation_config
from app.services.calculation.string_calculator import calculate_all_strings
from app.utils.filesystem import load_excel_sheet

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/calculate-nec-strings/{project_name}")
def calculate_nec_strings(project_name: str):
    """
    Calcula los circuitos string DC usando la normativa NEC.
    Considera overrides específicos del proyecto si existen.

    Args:
        project_name: Nombre del proyecto

    Returns:
        Resultados de cálculo por string, junto con parámetros y metadatos
    """
    try:
        # 1. Extraer información del proyecto desde Excel
        project_info = extract_project_info(project_name)
        logger.info(f"🔍 NEC: Proyecto cargado: {project_info.get('project_name')}, Panel: {project_info.get('panel_model')}")

        # 2. Cargar hoja específica de strings
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="La hoja dc_string_circuits está vacía.")

        # 3. Construir configuración NEC (incluye posibles overrides)
        config = build_calculation_config(
            project_info=project_info,
            normativa="NEC",
            project_name=project_name
        )

        # 4. Ejecutar cálculo de strings
        results = calculate_all_strings(df, config, circuit_type="dc_strings")

        # 5. Armar respuesta detallada
        response = {
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

        logger.info(f"✅ NEC calculation finalizada: {len(results)} circuitos procesados")
        return response

    except FileNotFoundError as e:
        logger.error(f"Archivo no encontrado: {e}")
        raise HTTPException(status_code=404, detail="Proyecto o archivo Excel no encontrado")
    except ValueError as e:
        logger.error(f"Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error inesperado en cálculo NEC: {e}")
        raise HTTPException(status_code=500, detail=f"Error en cálculo NEC: {str(e)}")
