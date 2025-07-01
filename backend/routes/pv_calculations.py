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

# Project management imports
from backend.models.string_params import StringCalculationParams
from backend.utils.filesystem import load_excel_sheet
from backend.services.parser import read_project_excel

# Configuration and calculation imports
from backend.services.config_loader import (
    build_calculation_config,
    get_available_normativas,
    get_available_panels,
    load_yaml_config
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_project_info(project_name: str) -> Dict[str, Any]:
    """
    Extracts project information from Excel using the new vertical structure.
    
    This helper function handles the vertical structure (Campo | Valor | Prioridad)
    and converts it to a dictionary for use in calculations.
    
    Args:
        project_name: Name of the project
        
    Returns:
        Dict containing cleaned project information
        
    Raises:
        ValueError: If Excel cannot be read or project_info sheet is invalid
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise ValueError(f"Error reading Excel: {xl_or_msg}")
    
    xl = xl_or_msg
    try:
        df = xl.parse("project_info")
        if len(df) == 0:
            raise ValueError("The project_info sheet is empty")
        
        # Check if it's the new vertical structure
        if all(col in df.columns for col in ["Campo", "Valor", "Prioridad"]):
            # NEW VERTICAL STRUCTURE: Campo | Valor | Prioridad
            project_info = dict(zip(df['Campo'], df['Valor']))
            logger.info(f"Detected vertical project_info structure for '{project_name}'")
        else:
            # LEGACY HORIZONTAL STRUCTURE (backward compatibility)
            project_info = df.iloc[0].to_dict()
            logger.warning(f"Using legacy horizontal project_info structure for '{project_name}'")
        
        # Clean NaN values
        cleaned_info = {}
        for key, value in project_info.items():
            if pd.isna(value):
                cleaned_info[key] = None
            else:
                cleaned_info[key] = value
        
        logger.info(f"Project info extracted successfully for '{project_name}': {len(cleaned_info)} fields")
        return cleaned_info
    
    except Exception as e:
        logger.error(f"Error extracting project_info: {e}")
        raise ValueError(f"Error processing project_info: {str(e)}")

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
        from backend.services.calculation.string_calculator import calculate_all_strings
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
        from backend.services.calculation.string_calculator import calculate_all_strings
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
        from backend.services.calculation.string_calculator import calculate_all_strings
        results = calculate_all_strings(df, config)
        
        logger.warning(f"Legacy calculation used for {project_name}. Consider migrating to new endpoint.")
        return results
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project or Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))