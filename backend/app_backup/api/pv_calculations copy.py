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
- Panel database (configs/panel_database.yaml)
- Normative configurations (configs/normativas.yaml)
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
import os
# ============================================================================

# Configuration and calculation imports
from app.services.config_loader import (
    build_calculation_config,
    get_available_normativas,
    get_available_panels,
    load_yaml_config,
    format_norm_parameters_for_ui
)

# Normative parameter management imports
try:
    from app.models.norm_params import NormParametersResponse, SaveNormParametersRequest
    from app.services.loader.project_norm_service import project_norm_service
except ImportError as e:
    logger.warning(f"Some normative imports not available: {e}")

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
    Now supports project-specific normative overrides.
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
        
        # 3. Build calculation configuration (panel + normative + project overrides)
        config = build_calculation_config(
            project_info=project_info,
            normativa=normative,
            project_name=project_name,  # Support for project overrides
            custom_params=None
        )

        # ✅ NUEVO: Agregar project_name al config para string calculations
        if circuit_type == "dc_strings" and normative == "PERSONALIZADA":
            config["project_name"] = project_name
            config["_metadata"]["project_name"] = project_name
        
        logger.info(f"Configuration built: Panel {config['_metadata']['panel_model']}, Standard {normative}")
        
        # Log si hay overrides del proyecto
        if config['_metadata'].get('normativa_config', {}).get('has_project_overrides'):
            overrides_info = config['_metadata']['normativa_config'].get('overrides_info', {})
            logger.info(f"Using project overrides: {overrides_info.get('modified_count', 0)} parameters modified")
        
        # 4. Execute string calculations
        from app.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config, circuit_type)
        
        # 5. Build comprehensive response
        response = {
            "project_name": project_name,
            "circuit_type": circuit_type,
            "normative": normative,
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
# NORMATIVE PARAMETER MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/projects/{project_name}/normative-parameters")
def get_project_normative_parameters(
    project_name: str, 
    normative: str = Query("IEC", description="Base normative: IEC, NEC, PERSONALIZADA"),
    circuit_type: str = Query("dc_strings", description="Circuit type: dc_strings, level_1_dc, ac_circuits, mv_circuits")  # ✅ NUEVO
):
    """
    Obtiene los parámetros de normativa para un proyecto y etapa específica.
    Si es la primera vez que se accede a la etapa, inicializa desde normativa base.
    
    Args:
        project_name: Nombre del proyecto
        normative: Normativa base a usar (IEC, NEC, PERSONALIZADA)
        circuit_type: Tipo de circuito/etapa (dc_strings, level_1_dc, ac_circuits, mv_circuits)
        
    Returns:
        Parámetros estructurados para la UI, específicos para la etapa
    """
    try:
        # ✅ NUEVO: Verificar si existe configuración específica para esta etapa
        stage_config_dir = f"projects/{project_name}/normativas"
        stage_config_file = f"{stage_config_dir}/{circuit_type}.yaml"
        
        logger.info(f"Loading normative for {project_name} - {circuit_type} - {normative}")
        
        # ✅ Si no existe la configuración de la etapa, inicializarla
        if not os.path.exists(stage_config_file):
            logger.info(f"First time accessing {circuit_type} for {project_name} - initializing from base {normative}")
            
            # Crear directorio si no existe
            os.makedirs(stage_config_dir, exist_ok=True)
            
            # Inicializar configuración de etapa desde normativa base
            success = initialize_stage_normative(project_name, circuit_type, normative)
            
            if not success:
                logger.error(f"Failed to initialize {circuit_type} normative for {project_name}")
                raise HTTPException(status_code=500, detail=f"Failed to initialize {circuit_type} normative")
        
        # ✅ Cargar configuración específica de la etapa para la UI
        effective_params = load_stage_normative_for_ui(project_name, circuit_type, normative)
        
        logger.info(f"Normative parameters for {circuit_type} loaded successfully for project {project_name}")
        return effective_params
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting normative parameters for {circuit_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting parameters: {str(e)}")
    
# ✅ NUEVA FUNCIÓN: Inicializar configuración de etapa
def initialize_stage_normative(project_name: str, circuit_type: str, base_normative: str) -> bool:
    """
    Inicializa la configuración de normativa para una etapa específica desde la base.
    Copia y filtra la normativa base para crear una configuración específica de etapa.
    
    Args:
        project_name: Nombre del proyecto
        circuit_type: Tipo de circuito (dc_strings, level_1_dc, etc.)
        base_normative: Normativa base (IEC, NEC, PERSONALIZADA)
        
    Returns:
        True si la inicialización fue exitosa, False en caso contrario
    """
    try:
        import yaml
        from datetime import datetime
        
        # ✅ Cargar normativa base completa
        base_config = load_base_normative_full(base_normative)
        
        if not base_config:
            logger.error(f"Failed to load base normative {base_normative}")
            return False
        
        # ✅ Filtrar configuración para la etapa específica
        stage_config = base_config.copy()  # ✅ COPIA COMPLETA
        stage_config["_metadata"] = {
            "circuit_type": circuit_type,
            "base_normative": base_normative,
            "created_at": datetime.now().isoformat(),
            "stage_specific": True,
            "config_source": f"full_copy_of_{base_normative}"
        }
        
        # ✅ Guardar como configuración inicial de la etapa
        stage_file = f"projects/{project_name}/normativas/{circuit_type}.yaml"
        
        with open(stage_file, 'w', encoding='utf-8') as f:
            yaml.dump(stage_config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"✅ Initialized {circuit_type} normative for {project_name} from {base_normative}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error initializing stage normative: {e}")
        return False


# ✅ NUEVA FUNCIÓN: Cargar normativa base completa
def load_base_normative_full(normative: str) -> dict:
    """
    Carga la normativa base completa desde el archivo de configuración.
    """
    try:
        import yaml
        
        config_file = "configs/normativas.yaml"
        
        if not os.path.exists(config_file):
            logger.error(f"Normative config file not found: {config_file}")
            return {}
        
        with open(config_file, 'r', encoding='utf-8') as f:
            full_config = yaml.safe_load(f)
        
        # ✅ CORRECCIÓN: Extraer solo la sección específica
        if normative in full_config:
            base_config = full_config[normative]  # Solo IEC, no todo el archivo
        else:
            # Fallback: usar primera normativa disponible
            first_key = list(full_config.keys())[0]
            base_config = full_config[first_key]
            logger.warning(f"Normative {normative} not found, using {first_key}")
        
        logger.info(f"✅ Base normative {normative} loaded successfully")
        return base_config
        
    except Exception as e:
        logger.error(f"❌ Error loading base normative {normative}: {e}")
        return {}


# ✅ NUEVA FUNCIÓN: Filtrar configuración por etapa
def filter_config_for_stage(base_config: dict, circuit_type: str, base_normative: str) -> dict:
    """
    Filtra la configuración base para incluir solo parámetros relevantes a la etapa.
    Cada etapa tiene diferentes secciones de parámetros que son relevantes.
    
    Args:
        base_config: Configuración base completa
        circuit_type: Tipo de circuito/etapa
        base_normative: Normativa base utilizada
        
    Returns:
        Configuración filtrada para la etapa específica
    """
    try:
        from datetime import datetime
        
        # ✅ Mapeo de etapas a secciones relevantes
        stage_sections = {
            "dc_strings": [
                "correction_factors", 
                "cable", 
                "installation", 
                "temperature_correction", 
                "voltage_drop", 
                "safety_factors"
            ],
            "level_1_dc": [
                "correction_factors",
                "cable", 
                "installation", 
                "temperature_correction", 
                "voltage_drop", 
                "safety_factors",
                "combiner_factors"  # Específico para level 1
            ],
            "ac_circuits": [
                "cable", 
                "installation", 
                "temperature_correction", 
                "voltage_drop", 
                "safety_factors",
                "ac_specific",  # Específico para AC
                "inverter_factors"
            ],
            "mv_circuits": [
                "cable", 
                "installation", 
                "voltage_drop", 
                "safety_factors",
                "mv_specific",  # Específico para MV
                "transformer_factors"
            ]
        }
        
        # ✅ Obtener secciones relevantes para la etapa
        relevant_sections = stage_sections.get(circuit_type, stage_sections["dc_strings"])
        
        # ✅ Filtrar configuración base
        stage_config = {}
        sections_found = []
        
        for section in relevant_sections:
            if section in base_config:
                stage_config[section] = base_config[section]
                sections_found.append(section)
            else:
                logger.warning(f"Section {section} not found in base config for {circuit_type}")
        
        # ✅ Agregar metadatos específicos de la etapa
        stage_config["_metadata"] = {
            "circuit_type": circuit_type,
            "base_normative": base_normative,
            "created_at": datetime.now().isoformat(),
            "stage_specific": True,
            "sections_included": sections_found,
            "config_source": f"base_{base_normative}_filtered_for_{circuit_type}"
        }
        
        logger.info(f"✅ Config filtered for {circuit_type}: {len(sections_found)} sections included")
        return stage_config
        
    except Exception as e:
        logger.error(f"❌ Error filtering config for stage {circuit_type}: {e}")
        return {}


# ✅ NUEVA FUNCIÓN: Cargar configuración de etapa para UI
def load_stage_normative_for_ui(project_name: str, circuit_type: str, base_normative: str) -> dict:
    """
    Carga la configuración específica de etapa y la formatea para la UI.
    
    Args:
        project_name: Nombre del proyecto
        circuit_type: Tipo de circuito/etapa
        base_normative: Normativa base
        
    Returns:
        Configuración formateada para mostrar en la UI
    """
    try:
        import yaml
        
        stage_file = f"projects/{project_name}/normativas/{circuit_type}.yaml"
        
        # ✅ Cargar configuración específica de etapa
        with open(stage_file, 'r', encoding='utf-8') as f:
            stage_config = yaml.safe_load(f)
        
        # ✅ Formatear para UI usando función existente como base
        # Aquí reutilizamos la lógica de format_norm_parameters_for_ui pero con config de etapa
        ui_params = format_stage_config_for_ui(stage_config, circuit_type, base_normative)
        
        # ✅ Agregar información específica del proyecto y etapa
        ui_params.update({
            "project_name": project_name,
            "circuit_type": circuit_type,
            "has_project_overrides": True,  # Siempre true porque es configuración específica
            "stage_specific": True
        })
        
        logger.info(f"✅ Stage config for UI loaded: {circuit_type} - {project_name}")
        return ui_params
        
    except Exception as e:
        logger.error(f"❌ Error loading stage config for UI: {e}")
        
        # ✅ Fallback: usar configuración base
        fallback_params = format_norm_parameters_for_ui(base_normative)
        fallback_params.update({
            "project_name": project_name,
            "circuit_type": circuit_type,
            "has_project_overrides": False,
            "stage_specific": False,
            "error": f"Could not load stage config: {str(e)}"
        })
        return fallback_params


# ✅ NUEVA FUNCIÓN: Formatear configuración de etapa para UI
def format_stage_config_for_ui(stage_config: dict, circuit_type: str, base_normative: str) -> dict:
    """
    Formatea la configuración específica de etapa para mostrar en la UI.
    Similar a format_norm_parameters_for_ui pero adaptado para etapas.
    """
    try:
        # ✅ Estructura base para UI
        ui_structure = {
            "norm_name": f"{base_normative}_{circuit_type}",
            "display_name": f"{base_normative} - {circuit_type.replace('_', ' ').title()}",
            "description": f"Configuración específica para {circuit_type.replace('_', ' ')}",
            "country": stage_config.get("_metadata", {}).get("country", "International"),
            "editable_sections": {}
        }
        
        # ✅ Mapeo de secciones a UI amigable
        section_mapping = {
            "correction_factors": {
                "title": "Factores de Corrección",
                "parameters": {
                    "isc_safety_factor": {
                        "label": "Factor de Seguridad Isc",
                        "description": "Factor de seguridad para corriente de cortocircuito",
                        "type": "number",
                        "range": [1.0, 2.0],
                        "unit": ""
                    },
                    "parallel_strings": {
                        "label": "Strings en Paralelo",
                        "description": "Número de strings conectados en paralelo",
                        "type": "integer",
                        "range": [1, 50],
                        "unit": ""
                    }
                }
            },
            "cable": {
                "title": "Configuración de Cable",
                "parameters": {
                    "material": {
                        "label": "Material del Cable",
                        "description": "Material conductor del cable",
                        "type": "select",
                        "options": ["copper", "aluminum"]
                    },
                    "max_temp": {
                        "label": "Temperatura Máxima",
                        "description": "Temperatura máxima de operación del cable",
                        "type": "number",
                        "range": [60, 120],
                        "unit": "°C"
                    }
                }
            },
            "voltage_drop": {
                "title": "Caída de Tensión",
                "parameters": {
                    "max_percentage": {
                        "label": "Máximo Porcentaje (%)",
                        "description": "Máxima caída de tensión permitida",
                        "type": "number",
                        "range": [1.0, 5.0],
                        "unit": "%"
                    }
                }
            }
        }
        
        # ✅ Construir secciones editables
        for section_key, section_data in stage_config.items():
            if section_key.startswith("_"):  # Skip metadata
                continue
                
            if section_key in section_mapping:
                section_ui = section_mapping[section_key].copy()
                
                # ✅ Actualizar valores reales desde configuración
                for param_key, param_ui in section_ui["parameters"].items():
                    if isinstance(section_data, dict) and param_key in section_data:
                        param_ui["value"] = section_data[param_key]
                    else:
                        param_ui["value"] = param_ui.get("default", "")
                
                ui_structure["editable_sections"][section_key] = section_ui
        
        logger.info(f"✅ Stage config formatted for UI: {len(ui_structure['editable_sections'])} sections")
        return ui_structure
        
    except Exception as e:
        logger.error(f"❌ Error formatting stage config for UI: {e}")
        return {
            "norm_name": f"{base_normative}_{circuit_type}",
            "display_name": f"{base_normative} - {circuit_type}",
            "description": "Error loading configuration",
            "editable_sections": {},
            "error": str(e)
        }
       
@router.put("/projects/{project_name}/normative-parameters")
def save_project_normative_parameters(
    project_name: str,
    request: dict  # Accept generic dict for now
):
    """
    Guarda parámetros de normativa personalizados para un proyecto
    
    Args:
        project_name: Nombre del proyecto
        request: Parámetros modificados y normativa base
        
    Returns:
        Confirmación de guardado exitoso
    """
    """
    Guarda parámetros de normativa personalizados para un proyecto
    """
    try:
        # ✅ NUEVO: Manejar tanto modified_parameters como yaml_overrides
        base_norm = request.get('base_norm', 'IEC')
        modified_parameters = request.get('modified_parameters', {})
        yaml_overrides = request.get('yaml_overrides', {})
        
        logger.info(f"Guardando parámetros para {project_name}:")
        logger.info(f"  - base_norm: {base_norm}")
        logger.info(f"  - modified_parameters: {len(modified_parameters)} items")
        logger.info(f"  - yaml_overrides: {len(yaml_overrides)} items")
        
        # ✅ NUEVO: Si viene yaml_overrides, crear normativa completa del proyecto
        if yaml_overrides:
            try:
                from app.services.calculation.string_calculator import update_project_normative
                
                success = update_project_normative(project_name, yaml_overrides, base_norm)
                
                if success:
                    return {
                        "success": True,
                        "message": f"Custom normative created for project {project_name}",
                        "project_name": project_name,
                        "base_norm": base_norm,
                        "has_custom_normative": True,
                        "sections_updated": list(yaml_overrides.keys())
                    }
                else:
                    raise HTTPException(status_code=500, detail="Error creating project normative")
                    
            except ImportError as e:
                logger.error(f"String calculator service not available: {e}")
                raise HTTPException(status_code=503, detail="Normative service not available")
        
        # ✅ FALLBACK: Sistema original con project_norm_service
        elif modified_parameters:
            try:
                from app.services.loader.project_norm_service import project_norm_service
                
                success = project_norm_service.save_project_overrides(
                    project_name=project_name,
                    base_norm=base_norm,
                    modified_parameters=modified_parameters
                )
                
                if success:
                    return {
                        "success": True,
                        "message": f"Parameters saved via legacy system for project {project_name}",
                        "project_name": project_name,
                        "base_norm": base_norm,
                        "has_custom_normative": False,
                        "modified_count": len(modified_parameters)
                    }
                else:
                    raise HTTPException(status_code=500, detail="Error saving via legacy system")
                    
            except ImportError:
                logger.error("Project norm service not available")
                raise HTTPException(status_code=503, detail="Legacy normative service not available")
        
        else:
            logger.warning("No data to save (no yaml_overrides or modified_parameters)")
            return {
                "success": False,
                "message": "No data provided to save",
                "project_name": project_name
            }
            
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error saving parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving parameters: {str(e)}")


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
        try:
            from app.services.loader.project_norm_service import project_norm_service
            
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
            
        except ImportError:
            return {
                "project_name": project_name,
                "has_custom_config": False,
                "config_file_exists": False,
                "service_available": False
            }
        
    except Exception as e:
        logger.error(f"Error getting normative status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting status: {str(e)}")

# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/available-standards")
def get_available_calculation_standards():
    """
    Gets the list of available calculation standards/normatives.
    
    Returns all supported calculation standards with their descriptions
    and default selection for the frontend.
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
        logger.info(f"Base normative parameters for {normative} obtained successfully")
        return params
        
    except ValueError as e:
        logger.error(f"Invalid normative: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting base parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting parameters: {str(e)}")

@router.get("/available-panels")
def get_available_panel_database():
    """
    Gets the list of available solar panels in the database.
    
    Returns all panels from the panel database with their specifications.
    Used by frontend for panel selection and automatic parameter loading.
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
    """
    try:
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        config = load_yaml_config("configs/string_config.yaml")
        from app.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config)
        
        logger.warning(f"Legacy calculation used for {project_name}. Consider migrating to new endpoint.")
        return results
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.delete("/projects/{project_name}/normative-parameters")
def reset_project_normative_parameters(project_name: str):
    """
    Resetea los parámetros de normativa del proyecto a valores base
    """
    try:
        # ✅ Intentar resetear normativa completa del proyecto
        try:
            from app.services.calculation.string_calculator import reset_project_normative
            
            success = reset_project_normative(project_name)
            
            if success:
                logger.info(f"Project normative reset for {project_name}")
                return {
                    "success": True,
                    "message": f"Project normative reset to base values for {project_name}",
                    "project_name": project_name,
                    "has_custom_normative": False
                }
            else:
                raise Exception("Failed to reset project normative")
                
        except ImportError:
            logger.warning("String calculator service not available, trying legacy system")
            
            # ✅ FALLBACK: Sistema original
            try:
                from app.services.loader.project_norm_service import project_norm_service
                
                # Usar método correcto
                success = project_norm_service.delete_project_overrides(project_name)
                
                if success:
                    return {
                        "success": True,
                        "message": f"Legacy parameters reset for project {project_name}",
                        "project_name": project_name,
                        "has_custom_normative": False
                    }
                else:
                    raise Exception("Failed to reset via legacy system")
                    
            except (ImportError, AttributeError):
                # Si no existe delete_project_overrides, eliminar archivo manualmente
                override_file = f"projects/{project_name}/norm_overrides.json"
                
                if os.path.exists(override_file):
                    os.remove(override_file)
                    logger.info(f"Manually removed override file: {override_file}")
                
                return {
                    "success": True,
                    "message": f"Override file removed for project {project_name}",
                    "project_name": project_name,
                    "has_custom_normative": False
                }
        
    except Exception as e:
        logger.error(f"Error resetting parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Error resetting parameters: {str(e)}")