# backend/app/api/calculations/string_calculation.py

from fastapi import APIRouter, HTTPException
import logging
from app.services.loader.project_loader import extract_project_info
from app.services.config_loader import build_calculation_config
from app.services.calculation.string_calculator import calculate_all_strings
from app.utils.filesystem import load_excel_sheet

router = APIRouter()
logger = logging.getLogger(__name__)

# 🔥 NUEVA FUNCIÓN: Extraer factores reales usados en el cálculo
def extract_real_factors_from_config(config: dict) -> dict:
    """
    Extrae los factores reales que se usaron en el cálculo desde la configuración.
    
    Args:
        config: Configuración completa del cálculo
        
    Returns:
        dict: Factores reales extraídos
    """
    try:
        factors = {}
        
        # 1. Factores de corrección
        correction_factors = config.get('correction_factors', {})
        factors['parallel_strings'] = correction_factors.get('parallel_strings', 1)
        factors['isc_safety_factor'] = correction_factors.get('isc_safety_factor', 1.25)
        
        # 2. Parámetros de instalación
        installation = config.get('installation', {})
        factors['installation_method'] = installation.get('method', 'conduit')
        factors['installation_depth'] = installation.get('depth_cm', 50)
        
        # 3. Parámetros de temperatura
        temp_correction = config.get('temperature_correction', {})
        factors['ambient_design_temp'] = temp_correction.get('ambient_design', 25)
        
        # 4. Cable
        cable = config.get('cable', {})
        factors['cable_material'] = cable.get('material', 'copper')
        factors['cable_max_temp'] = cable.get('max_temp', 90)
        
        # 5. Caída de tensión
        voltage_drop = config.get('voltage_drop', {})
        factors['max_voltage_drop_pct'] = voltage_drop.get('max_percentage', 5)
        
        # 6. Información de overrides
        metadata = config.get('_metadata', {})
        normativa_config = metadata.get('normativa_config', {})
        factors['has_project_overrides'] = normativa_config.get('has_project_overrides', False)
        factors['overrides_source'] = normativa_config.get('overrides_source', 'none')
        
        logger.info(f"🔥 Factores reales extraídos: parallel_strings={factors['parallel_strings']}, ambient_temp={factors['ambient_design_temp']}")
        
        return factors
        
    except Exception as e:
        logger.error(f"Error extrayendo factores reales: {e}")
        return {}

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

        # 🔥 NUEVO: Extraer factores reales usados
        real_factors = extract_real_factors_from_config(config)

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
                "max_voltage_drop": config['voltage_drop']['max_percentage'],
                # 🔥 NUEVOS: Factores reales extraídos desde la configuración
                "parallel_strings": real_factors.get('parallel_strings', 1),
                "installation_depth": real_factors.get('installation_depth', 50),
                "ambient_design_temp": real_factors.get('ambient_design_temp', 25),
                "cable_max_temp": real_factors.get('cable_max_temp', 90),
                "overrides_source": real_factors.get('overrides_source', 'none')
            },
            # 🔥 NUEVO: Sección dedicada a factores de cálculo detallados
            "calculation_factors": real_factors,
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

        # 🔥 NUEVO: Extraer factores reales usados también para NEC
        real_factors = extract_real_factors_from_config(config)

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
                "max_voltage_drop": config['voltage_drop']['max_percentage'],
                # 🔥 NUEVOS: Factores reales extraídos desde la configuración
                "parallel_strings": real_factors.get('parallel_strings', 1),
                "installation_depth": real_factors.get('installation_depth', 50),
                "ambient_design_temp": real_factors.get('ambient_design_temp', 25),
                "cable_max_temp": real_factors.get('cable_max_temp', 90),
                "overrides_source": real_factors.get('overrides_source', 'none')
            },
            # 🔥 NUEVO: Sección dedicada a factores de cálculo detallados
            "calculation_factors": real_factors,
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