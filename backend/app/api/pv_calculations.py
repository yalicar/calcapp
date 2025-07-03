# backend/routes/pv_calculations.py
"""
PV STRING & CIRCUIT CALCULATIONS ROUTES

=== PURPOSE ===
This module handles all photovoltaic string and circuit calculations with different
normative standards (IEC, NEC, Custom). It's the core calculation engine for the
solar PV system design application.

=== MAIN RESPONSIBILITIES ===
1. String calculations with normative standards (IEC, NEC, Custom)
2. Custom parameter calculations for specialized scenarios
3. Configuration management (available standards and panels)
4. Integration with panel database and normative rules
5. Legacy calculation support for backward compatibility

=== KEY FEATURES ===
- Multi-standard calculations (IEC/NEC/Custom)
- Panel database integration
- Custom parameter override capability
- Structured calculation results with metadata
- Error handling and validation
- Performance metrics and logging

=== ENDPOINTS OVERVIEW ===
- GET  /calculate-strings/{project_name}           → Standard calculations
- POST /calculate-strings-custom/{project_name}    → Custom parameter calculations
- GET  /available-standards                        → List calculation standards
- GET  /available-panels                           → List panel database
- GET  /calculate-strings-legacy/{project_name}    → Legacy compatibility

=== DEPENDENCIES ===
- Project data from Excel files (via pv_data.py operations)
- Panel database (backend/configs/panel_database.yaml)
- Normative configurations (backend/configs/normativas.yaml)
- String calculation engine (backend/services/string_calculator.py)

=== FUTURE ENHANCEMENTS ===
- Machine learning optimization suggestions
- Real-time calculation updates
- Batch calculation processing
- Advanced normative rule engines
- Integration with external design tools

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import pandas as pd
from typing import Optional, Dict, Any
import logging
from app.models.string_params import StringCalculationParams
from app.utils.filesystem import load_excel_sheet
from app.services.loader.project_loader import extract_project_info
from app.services.parsing.parser import read_project_excel




# Configuration and calculation imports
from app.services.config_loader import (
    build_calculation_config,
    get_available_normativas,
    get_available_panels,
    load_yaml_config
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# STRING CALCULATION ENDPOINTS
# ============================================================================

@router.get("/calculate-strings/{project_name}")
def calculate_strings_with_standards(
    project_name: str, 
    circuit_type: str = Query("dc_strings", description="Circuit type: dc_strings, level_1_dc, ac_circuits, mv_circuits"),
    normative: str = Query("IEC", description="Standard: IEC, NEC, CUSTOM")
):
    """
    Calculates PV strings using normative standards and panel database.
    
    This is the main calculation endpoint that combines:
    - Panel specifications from database
    - Normative rules (IEC/NEC/Custom)
    - Project-specific parameters
    - Circuit data from Excel
    
    Args:
        project_name: Name of the project containing Excel data
        circuit_type: Type of circuit to calculate (dc_strings, level_1_dc, ac_circuits, mv_circuits)
        normative: Calculation standard to apply (IEC, NEC, CUSTOM)
        
    Returns:
        Comprehensive calculation results including:
        - Individual circuit calculations
        - Panel information used
        - Applied parameters
        - Summary statistics
        - Metadata for traceability
        
    Raises:
        HTTPException: If calculation fails, data is invalid, or files not found
        
    Example:
        GET /calculate-strings/solar_farm_project?circuit_type=dc_strings&normative=IEC
    """
    try:
        # 1. Load project information from Excel
        project_info = extract_project_info(project_name)
        logger.info(f"Project loaded: {project_info.get('project_name', 'N/A')}, Panel: {project_info.get('panel_model', 'N/A')}")
        
        # 2. Validate and load circuit data
        sheet_mapping = {
            "dc_strings": "dc_string_circuits",
            "level_1_dc": "dc_cn1_circuits", 
            "ac_circuits": "ac_circuits",
            "mv_circuits": "mv_circuits"
        }
        
        if circuit_type not in sheet_mapping:
            raise HTTPException(status_code=400, detail=f"Invalid circuit type: {circuit_type}")
        
        sheet_name = sheet_mapping[circuit_type]
        df = load_excel_sheet(project_name, sheet_name=sheet_name)
        
        if len(df) == 0:
            raise HTTPException(status_code=400, detail=f"No data in sheet {sheet_name}")
        
        # 3. Build calculation configuration (panel + normative)
        config = build_calculation_config(
            project_info=project_info,
            normativa=normative,
            custom_params=None
        )
        
        logger.info(f"Configuration built: Panel {config['_metadata']['panel_model']}, Standard {normative}")
        
        # 4. Execute string calculations
        from app.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config, circuit_type)
        
        # 5. Build comprehensive response
        response = {
            "project_name": project_name,
            "circuit_type": circuit_type,
            "normative": normative,
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
        
        logger.info(f"Calculation completed: {len(results)} circuits processed")
        return response
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        logger.error(f"Unexpected error in calculation: {e}")
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.post("/calculate-strings-custom/{project_name}")
def calculate_strings_with_custom_parameters(
    project_name: str, 
    params: StringCalculationParams,
    circuit_type: str = Query("dc_strings", description="Circuit type"),
    normative: str = Query("CUSTOM", description="Base standard")
):
    """
    Calculates PV strings with fully custom parameters.
    
    This endpoint allows complete override of calculation parameters,
    useful for specialized scenarios or advanced engineering analysis.
    
    Args:
        project_name: Name of the project
        params: Custom calculation parameters (cable, installation, corrections)
        circuit_type: Type of circuit to calculate
        normative: Base standard for calculation (usually CUSTOM)
        
    Returns:
        Calculation results with applied custom parameters
        
    Raises:
        HTTPException: If calculation fails or parameters are invalid
        
    Example:
        POST /calculate-strings-custom/project1?circuit_type=dc_strings
        Body: {custom StringCalculationParams}
    """
    try:
        # 1. Load project information
        project_info = extract_project_info(project_name)
        
        # 2. Load circuit data based on type
        sheet_mapping = {
            "dc_strings": "dc_string_circuits",
            "level_1_dc": "dc_cn1_circuits",
            "ac_circuits": "ac_circuits", 
            "mv_circuits": "mv_circuits"
        }
        
        sheet_name = sheet_mapping.get(circuit_type, "dc_string_circuits")
        df = load_excel_sheet(project_name, sheet_name=sheet_name)
        
        # 3. Convert Pydantic model to configuration dictionary
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
        
        # 4. Build configuration with custom parameter override
        config = build_calculation_config(
            project_info=project_info,
            normativa=normative,
            custom_params=custom_params
        )
        
        # 5. Execute calculations with custom config
        from app.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config, circuit_type)
        
        # 6. Structured response with custom parameter tracking
        response = {
            "project_name": project_name,
            "circuit_type": circuit_type,
            "normative": normative,
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
        logger.error(f"Error in custom calculation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/available-standards")
def get_available_calculation_standards():
    """
    Gets the list of available calculation standards/normatives.
    
    Returns all supported calculation standards with their descriptions
    and default selection for the frontend.
    
    Returns:
        Available standards dictionary with default selection
        
    Example Response:
        {
            "standards": {
                "IEC": {"name": "IEC 62548", "description": "International standard"},
                "NEC": {"name": "NEC 690", "description": "US National Electrical Code"},
                "CUSTOM": {"name": "Custom", "description": "User-defined parameters"}
            },
            "default": "IEC"
        }
    """
    try:
        normativas = get_available_normativas()
        return {
            "standards": normativas,
            "default": "IEC"
        }
    except Exception as e:
        logger.error(f"Error getting standards: {e}")
        # Fallback configuration if YAML files are missing
        return {
            "standards": {
                "IEC": {"name": "IEC (Fallback)", "description": "International standard"},
                "CUSTOM": {"name": "Custom", "description": "Custom configuration"}
            },
            "default": "IEC"
        }

@router.get("/available-panels")
def get_available_panel_database():
    """
    Gets the list of available solar panels in the database.
    
    Returns all panels from the panel database with their specifications.
    Used by frontend for panel selection and automatic parameter loading.
    
    Returns:
        Available panels dictionary with total count
        
    Example Response:
        {
            "panels": {
                "SunPower SPR-400": {
                    "manufacturer": "SunPower",
                    "model": "SPR-400",
                    "power_stc": 400,
                    "isc_ref": 6.5
                }
            },
            "total": 150
        }
    """
    try:
        panels = get_available_panels()
        return {
            "panels": panels,
            "total": len(panels)
        }
    except Exception as e:
        logger.error(f"Error getting panels: {e}")
        # Fallback if panel database is not available
        return {
            "panels": {"Custom Panel": {"manufacturer": "Custom", "model": "User defined"}},
            "total": 1
        }

# ============================================================================
# LEGACY COMPATIBILITY ENDPOINTS
# ============================================================================

@router.get("/calculate-strings-legacy/{project_name}")
def calculate_strings_legacy_mode(project_name: str):
    """
    Legacy calculation endpoint for backward compatibility.
    
    This endpoint maintains compatibility with older frontend versions
    that expect the original calculation format and structure.
    
    WARNING: This endpoint will be deprecated in future versions.
    New implementations should use /calculate-strings/ endpoint.
    
    Args:
        project_name: Name of the project
        
    Returns:
        Legacy format calculation results
        
    Raises:
        HTTPException: If calculation fails
        
    Deprecated: Use /calculate-strings/ instead
    """
    try:
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        config = load_yaml_config("backend/configs/string_config.yaml")
        from app.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config)
        
        logger.warning(f"Legacy calculation used for {project_name}. Consider migrating to new endpoint.")
        return results
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# Agregar al final de backend/app/api/pv_calculations.py

from app.models.norm_params import NormParametersResponse, SaveNormParametersRequest
from app.services.loader.project_norm_service import project_norm_service
from app.services.config_loader import get_available_normativas

@router.get("/norm-parameters/{norm_name}", response_model=NormParametersResponse)
def get_norm_parameters(
    norm_name: str,
    project_name: Optional[str] = Query(None, description="Nombre del proyecto para cargar overrides específicos")
):
    """
    Obtiene los parámetros de una normativa, con overrides del proyecto si existen.
    
    Args:
        norm_name: Nombre de la normativa (IEC, NEC, PERSONALIZADA)
        project_name: Opcional - nombre del proyecto para cargar parámetros personalizados
    
    Returns:
        Parámetros de la normativa (base + overrides del proyecto si existen)
    """
    try:
        norm_name_upper = norm_name.upper()
        
        # Validar que la normativa existe
        available_norms = get_available_normativas()
        if norm_name_upper not in available_norms:
            available_list = list(available_norms.keys())
            raise HTTPException(
                status_code=404, 
                detail=f"Normativa '{norm_name}' no encontrada. Disponibles: {available_list}"
            )
        
        if project_name:
            # Cargar parámetros con overrides del proyecto
            effective_params = project_norm_service.get_effective_parameters(project_name, norm_name_upper)
        else:
            # Cargar solo parámetros base
            from app.services.config_loader import format_norm_parameters_for_ui
            effective_params = format_norm_parameters_for_ui(norm_name_upper)
            effective_params['has_project_overrides'] = False
        
        logger.info(f"Parámetros de normativa '{norm_name_upper}' devueltos para proyecto {project_name or 'N/A'}")
        return effective_params
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo parámetros: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/project-parameters/{project_name}")
def save_project_norm_parameters(
    project_name: str,
    request: SaveNormParametersRequest
):
    """
    Guarda parámetros de normativa personalizados para un proyecto específico.
    
    Args:
        project_name: Nombre del proyecto
        request: Parámetros modificados a guardar
    
    Returns:
        Confirmación de guardado
    """
    try:
        success = project_norm_service.save_project_overrides(
            project_name=project_name,
            base_norm=request.base_norm,
            modified_parameters=request.modified_parameters
        )
        
        if success:
            return {
                "message": f"Parámetros guardados exitosamente para proyecto {project_name}",
                "project_name": project_name,
                "base_norm": request.base_norm,
                "parameters_count": len(request.modified_parameters)
            }
        else:
            raise HTTPException(status_code=500, detail="Error guardando parámetros")
            
    except Exception as e:
        logger.error(f"Error guardando parámetros del proyecto {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error guardando: {str(e)}")

@router.get("/project-parameters/{project_name}")
def get_project_norm_parameters(project_name: str):
    """
    Obtiene los parámetros personalizados de un proyecto (solo los overrides).
    
    Args:
        project_name: Nombre del proyecto
    
    Returns:
        Overrides del proyecto o null si no existen
    """
    try:
        overrides = project_norm_service.load_project_overrides(project_name)
        
        if overrides:
            return {
                "has_overrides": True,
                "project_name": project_name,
                "base_norm": overrides.base_norm,
                "modified_parameters": overrides.modified_parameters,
                "last_modified": overrides.last_modified,
                "parameters_count": len(overrides.modified_parameters)
            }
        else:
            return {
                "has_overrides": False,
                "project_name": project_name,
                "message": "No hay parámetros personalizados para este proyecto"
            }
            
    except Exception as e:
        logger.error(f"Error obteniendo overrides del proyecto {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.delete("/project-parameters/{project_name}")
def reset_project_norm_parameters(project_name: str):
    """
    Elimina los parámetros personalizados de un proyecto (resetear a valores por defecto).
    
    Args:
        project_name: Nombre del proyecto
    
    Returns:
        Confirmación de reset
    """
    try:
        success = project_norm_service.delete_project_overrides(project_name)
        
        if success:
            return {
                "message": f"Parámetros reseteados a valores por defecto para proyecto {project_name}",
                "project_name": project_name
            }
        else:
            raise HTTPException(status_code=500, detail="Error reseteando parámetros")
            
    except Exception as e:
        logger.error(f"Error reseteando parámetros del proyecto {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
# Agregar estos endpoints a app/api/pv_calculations.py

from app.services.loader.project_norm_service import project_norm_service
from app.services.config_loader import format_norm_parameters_for_ui, get_available_normativas
from app.models.norm_params import SaveNormParametersRequest

@router.get("/projects/{project_name}/normative-parameters")
def get_project_normative_parameters(
    project_name: str, 
    normative: str = Query("IEC", description="Base normative: IEC, NEC, PERSONALIZADA")
):
    """
    Obtiene los parámetros de normativa para un proyecto (base + overrides personalizados)
    
    Args:
        project_name: Nombre del proyecto
        normative: Normativa base a usar
        
    Returns:
        Parámetros estructurados para la UI, incluyendo overrides del proyecto
    """
    try:
        # Obtener parámetros efectivos (base + overrides del proyecto)
        effective_params = project_norm_service.get_effective_parameters(project_name, normative)
        
        logger.info(f"Parámetros de normativa obtenidos para proyecto {project_name}")
        return effective_params
        
    except ValueError as e:
        logger.error(f"Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error obteniendo parámetros de normativa: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo parámetros: {str(e)}")

@router.put("/projects/{project_name}/normative-parameters")
def save_project_normative_parameters(
    project_name: str,
    request: SaveNormParametersRequest
):
    """
    Guarda parámetros de normativa personalizados para un proyecto
    
    Args:
        project_name: Nombre del proyecto
        request: Parámetros modificados y normativa base
        
    Returns:
        Confirmación de guardado exitoso
    """
    try:
        # Guardar overrides del proyecto
        success = project_norm_service.save_project_overrides(
            project_name=project_name,
            base_norm=request.base_norm,
            modified_parameters=request.modified_parameters
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Error guardando configuración")
        
        logger.info(f"Parámetros de normativa guardados para proyecto {project_name}")
        return {
            "success": True,
            "message": f"Configuración personalizada guardada para proyecto {project_name}",
            "project_name": project_name,
            "base_norm": request.base_norm,
            "modified_count": len(request.modified_parameters)
        }
        
    except ValueError as e:
        logger.error(f"Error de validación: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error guardando parámetros: {e}")
        raise HTTPException(status_code=500, detail=f"Error guardando parámetros: {str(e)}")

@router.delete("/projects/{project_name}/normative-parameters")
def reset_project_normative_parameters(project_name: str):
    """
    Elimina los overrides de normativa del proyecto (vuelve a configuración base)
    
    Args:
        project_name: Nombre del proyecto
        
    Returns:
        Confirmación de reset exitoso
    """
    try:
        success = project_norm_service.delete_project_overrides(project_name)
        
        if not success:
            raise HTTPException(status_code=500, detail="Error eliminando configuración personalizada")
        
        logger.info(f"Configuración personalizada eliminada para proyecto {project_name}")
        return {
            "success": True,
            "message": f"Configuración personalizada eliminada para proyecto {project_name}",
            "project_name": project_name
        }
        
    except Exception as e:
        logger.error(f"Error eliminando parámetros personalizados: {e}")
        raise HTTPException(status_code=500, detail=f"Error eliminando parámetros: {str(e)}")

@router.get("/normatives")
def get_available_normatives():
    """
    Obtiene la lista de normativas disponibles
    
    Returns:
        Lista de normativas con información básica
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

@router.get("/normatives/{normative}/parameters")
def get_base_normative_parameters(normative: str):
    """
    Obtiene los parámetros base de una normativa (sin overrides de proyecto)
    
    Args:
        normative: Nombre de la normativa (IEC, NEC, PERSONALIZADA)
        
    Returns:
        Parámetros base de la normativa estructurados para UI
    """
    try:
        params = format_norm_parameters_for_ui(normative)
        logger.info(f"Parámetros base de normativa {normative} obtenidos exitosamente")
        return params
        
    except ValueError as e:
        logger.error(f"Normativa no válida: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error obteniendo parámetros base: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo parámetros: {str(e)}")

@router.get("/projects/{project_name}/normative-status")
def get_project_normative_status(project_name: str):
    """
    Obtiene el estado de configuración de normativa de un proyecto
    
    Args:
        project_name: Nombre del proyecto
        
    Returns:
        Estado de configuración (tiene overrides, cuántos, etc.)
    """
    try:
        has_overrides = project_norm_service.has_project_overrides(project_name)
        
        result = {
            "project_name": project_name,
            "has_custom_config": has_overrides,
            "config_file_exists": has_overrides
        }
        
        if has_overrides:
            overrides = project_norm_service.load_project_overrides(project_name)
            if overrides:
                result.update({
                    "base_norm": overrides.base_norm,
                    "last_modified": overrides.last_modified,
                    "modified_parameters_count": len(overrides.modified_parameters),
                    "version": overrides.version
                })
        
        return result
        
    except Exception as e:
        logger.error(f"Error obteniendo estado de normativa: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo estado: {str(e)}")