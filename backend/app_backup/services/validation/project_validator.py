# backend/services/validation/project_validator.py
"""
PROJECT INFO VALIDATION MODULE

=== PURPOSE ===
Specialized validation for project_info data with support for both horizontal 
and vertical Excel structures. Handles priority-based validation and dynamic 
form generation for missing required fields.

=== KEY FEATURES ===
- Automatic structure detection (vertical vs horizontal)
- Priority-based validation (Prioritario vs No prioritario)
- Cross-field validation (DC/AC ratios, coordinates)
- Dynamic form generation for missing fields
- Regional coordinate validation (Central America)
- Real-time field validation support

=== VALIDATION STRUCTURE ===
Vertical: Campo | Valor | Prioridad
Horizontal: Traditional column-based structure

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

import pandas as pd
import re
import math
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# FIELD DEFINITIONS & VALIDATION RULES
# ============================================================================

# Priority field definitions with comprehensive validation rules
PRIORITY_FIELDS = {
    # Project identification
    "project_name": {
        "type": "text",
        "required": True,
        "min_length": 3,
        "max_length": 100,
        "pattern": r"^[a-zA-Z0-9\s\-_\.]+$",
        "description": "Nombre del proyecto (alfanumérico, espacios, guiones permitidos)",
        "example": "Solar Farm Honduras 2025"
    },
    
    # Electrical capacities
    "installed_capacity_dc_kw": {
        "type": "number",
        "required": True,
        "min_value": 1,
        "max_value": 1000000,
        "data_type": "integer",
        "description": "Capacidad DC instalada en kW",
        "example": 55000
    },
    "installed_capacity_ac_kw": {
        "type": "number", 
        "required": True,
        "min_value": 1,
        "max_value": 1000000,
        "data_type": "integer",
        "description": "Capacidad AC instalada en kW",
        "example": 50000
    },
    
    # Design voltages with standard values
    "design_voltage_dc": {
        "type": "number",
        "required": True,
        "allowed_values": [600, 1000, 1500, 3000],
        "description": "Voltaje del sistema DC (valores estándar únicamente)",
        "example": 1500
    },
    "design_voltage_ac_volt": {
        "type": "number",
        "required": True,
        "allowed_values": [120, 208, 240, 277, 480, 600],
        "description": "Voltaje del sistema AC (valores estándar únicamente)",
        "example": 480
    },
    "design_voltage_mv_volt": {
        "type": "number",
        "required": True,
        "allowed_values": [4160, 12470, 13800, 34500, 69000],
        "description": "Nivel de voltaje medio (valores estándar únicamente)",
        "example": 34000
    },
    
    # Equipment specifications
    "inverter_brand": {
        "type": "select",
        "required": True,
        "allowed_values": [
            "ABB", "SMA", "Sungrow", "Huawei", "Fronius", 
            "Schneider Electric", "Delta", "KACO", "Ingeteam",
            "Power Electronics", "Solaredge", "Enphase", "Otro"
        ],
        "description": "Marca del inversor",
        "example": "Sungrow"
    },
    "inverter_model": {
        "type": "text",
        "required": True,
        "min_length": 5,
        "max_length": 50,
        "pattern": r"^[a-zA-Z0-9\-_\.]+$",
        "description": "Modelo del inversor (alfanumérico, sin espacios)",
        "example": "SG8800UD-MV"
    },
    "number_of_inverters": {
        "type": "number",
        "required": True,
        "min_value": 1,
        "max_value": 1000,
        "data_type": "integer",
        "description": "Número total de inversores",
        "example": 2
    },
    "inverter_station_model": {
        "type": "text",
        "required": True,
        "min_length": 5,
        "max_length": 100,
        "description": "Modelo de estación inversora o transformador",
        "example": "Central MV Type A"
    },
    "panel_brand": {
        "type": "select",
        "required": True,
        "allowed_values": [
            "Canadian Solar", "JinkoSolar", "Trina Solar", "LONGi Solar",
            "JA Solar", "Hanwha Q CELLS", "First Solar", "SunPower",
            "Risen Energy", "GCL System", "Yingli Solar", "Otro"
        ],
        "description": "Marca del panel solar",
        "example": "Canadian Solar"
    },
    "panel_model": {
        "type": "text",
        "required": True,
        "min_length": 5,
        "max_length": 50,
        "pattern": r"^[a-zA-Z0-9\-_\.]+$",
        "description": "Modelo del panel solar",
        "example": "CS6X-300M"
    },
    "number_of_panels": {
        "type": "number",
        "required": True,
        "min_value": 1,
        "max_value": 10000000,
        "data_type": "integer",
        "description": "Número total de paneles solares",
        "example": 183334
    },
    "number_of_panels_per_string": {
        "type": "number",
        "required": True,
        "min_value": 1,
        "max_value": 50,
        "data_type": "integer",
        "description": "Número de paneles por string",
        "example": 28
    }
}

# Non-priority fields with validation rules
NON_PRIORITY_FIELDS = {
    "location": {
        "type": "text",
        "required": False,
        "max_length": 200,
        "description": "Ubicación del proyecto (ciudad, país)",
        "example": "San José, Costa Rica"
    },
    "latitude": {
        "type": "number",
        "required": False,
        "min_value": -90,
        "max_value": 90,
        "decimal_places": 6,
        "description": "Latitud en grados decimales (precisión 6 decimales)",
        "example": 9.930000
    },
    "longitude": {
        "type": "number",
        "required": False,
        "min_value": -180,
        "max_value": 180,
        "decimal_places": 6,
        "description": "Longitud en grados decimales (precisión 6 decimales)",
        "example": -84.080000
    },
    "execution_year": {
        "type": "number",
        "required": False,
        "min_value": 2020,
        "max_value": 2030,
        "data_type": "integer",
        "description": "Año de ejecución del proyecto",
        "example": 2025
    },
    "notes": {
        "type": "text",
        "required": False,
        "max_length": 1000,
        "description": "Notas adicionales del proyecto",
        "example": "Proyecto demo para validación"
    }
}

# Regional coordinate validation for Central America
COORDINATE_REGIONS = {
    "CENTROAMERICA": {
        "latitude_range": (7.0, 17.0),
        "longitude_range": (-95.0, -82.0),
        "description": "Región de Centroamérica",
        "countries": ["Honduras", "Guatemala", "El Salvador", "Nicaragua", "Costa Rica", "Panamá"]
    },
    "HONDURAS": {
        "latitude_range": (13.0, 16.5),
        "longitude_range": (-89.5, -83.0),
        "description": "República de Honduras"
    },
    "COSTA_RICA": {
        "latitude_range": (8.0, 11.5),
        "longitude_range": (-87.0, -82.5),
        "description": "República de Costa Rica"
    }
}

# ============================================================================
# STRUCTURE DETECTION
# ============================================================================

def detect_project_info_structure(df: pd.DataFrame) -> str:
    """
    Detects whether project_info uses vertical or horizontal structure.
    
    Args:
        df: DataFrame containing project_info data
        
    Returns:
        "vertical" - Campo | Valor | Prioridad structure
        "horizontal" - Traditional column structure
        "unknown" - Cannot determine structure
    """
    # Check for vertical structure indicators
    if all(col in df.columns for col in ["Campo", "Valor", "Prioridad"]):
        logger.info("Detected vertical project_info structure")
        return "vertical"
    
    # Check for horizontal structure indicators
    if "project_name" in df.columns and len(df.columns) > 10:
        logger.info("Detected horizontal project_info structure")
        return "horizontal"
    
    logger.warning("Unknown project_info structure")
    return "unknown"

# ============================================================================
# FIELD VALIDATION FUNCTIONS
# ============================================================================

def validate_field_value(field_name: str, value: Any, field_config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validates a single field value against its configuration.
    
    Args:
        field_name: Name of the field
        value: Value to validate
        field_config: Validation configuration for the field
        
    Returns:
        (is_valid, error_message)
    """
    # Check if field is required and value is missing
    if field_config.get("required", False) and (pd.isna(value) or value == "" or value is None):
        return False, f"Campo prioritario requerido '{field_name}' está vacío"
    
    # If value is empty/None and field is not required, it's valid
    if pd.isna(value) or value == "" or value is None:
        return True, ""
    
    field_type = field_config.get("type", "text")
    
    # Text validation
    if field_type == "text":
        if not isinstance(value, str):
            return False, f"'{field_name}' debe ser texto"
        
        min_len = field_config.get("min_length", 0)
        max_len = field_config.get("max_length", float('inf'))
        
        if len(value) < min_len:
            return False, f"'{field_name}' debe tener al menos {min_len} caracteres"
        if len(value) > max_len:
            return False, f"'{field_name}' no puede exceder {max_len} caracteres"
        
        pattern = field_config.get("pattern")
        if pattern and not re.match(pattern, value):
            return False, f"'{field_name}' tiene formato inválido"
    
    # Number validation
    elif field_type == "number":
        try:
            numeric_value = float(value)
        except (ValueError, TypeError):
            return False, f"'{field_name}' debe ser un número válido"
        
        min_val = field_config.get("min_value", float('-inf'))
        max_val = field_config.get("max_value", float('inf'))
        
        if numeric_value < min_val:
            return False, f"'{field_name}' debe ser mayor o igual a {min_val}"
        if numeric_value > max_val:
            return False, f"'{field_name}' debe ser menor o igual a {max_val}"
        
        # Check if integer is required
        if field_config.get("data_type") == "integer" and not float(numeric_value).is_integer():
            return False, f"'{field_name}' debe ser un número entero"
        
        # Check allowed values
        allowed_values = field_config.get("allowed_values")
        if allowed_values and numeric_value not in allowed_values:
            return False, f"'{field_name}' debe ser uno de: {allowed_values}"
        
        # Check decimal places
        decimal_places = field_config.get("decimal_places")
        if decimal_places is not None:
            decimal_part = str(numeric_value).split('.')
            if len(decimal_part) > 1 and len(decimal_part[1]) > decimal_places:
                return False, f"'{field_name}' no puede tener más de {decimal_places} decimales"
    
    # Select validation
    elif field_type == "select":
        allowed_values = field_config.get("allowed_values", [])
        if value not in allowed_values:
            return False, f"'{field_name}' debe ser uno de: {allowed_values}"
    
    return True, ""

def validate_coordinates(latitude: float, longitude: float, region: str = "CENTROAMERICA") -> Tuple[bool, str]:
    """
    Validates geographic coordinates for a specific region.
    
    Args:
        latitude: Latitude in decimal degrees
        longitude: Longitude in decimal degrees  
        region: Region name for validation
        
    Returns:
        (is_valid, error_message)
    """
    if region not in COORDINATE_REGIONS:
        return True, "No hay validación regional disponible"
    
    region_config = COORDINATE_REGIONS[region]
    lat_min, lat_max = region_config["latitude_range"]
    lon_min, lon_max = region_config["longitude_range"]
    
    if not (lat_min <= latitude <= lat_max):
        return False, f"Latitud {latitude} fuera del rango para {region} ({lat_min} a {lat_max})"
    
    if not (lon_min <= longitude <= lon_max):
        return False, f"Longitud {longitude} fuera del rango para {region} ({lon_min} a {lon_max})"
    
    return True, ""

def validate_cross_references(project_data: Dict[str, Any]) -> List[str]:
    """
    Validates cross-field relationships and business logic.
    
    Args:
        project_data: Dictionary with project field values
        
    Returns:
        List of validation errors
    """
    errors = []
    
    try:
        # DC/AC capacity relationship
        dc_capacity = project_data.get("installed_capacity_dc_kw")
        ac_capacity = project_data.get("installed_capacity_ac_kw")
        
        if dc_capacity and ac_capacity:
            if ac_capacity > dc_capacity:
                errors.append("Capacidad AC no puede ser mayor que capacidad DC")
            
            ratio = dc_capacity / ac_capacity
            if ratio > 1.5:
                errors.append(f"Ratio DC/AC muy alto ({ratio:.2f}), típico: 1.0-1.4")
            elif ratio < 0.9:
                errors.append(f"Ratio DC/AC muy bajo ({ratio:.2f}), típico: 1.0-1.4")
        
        # Panel and inverter relationship validation
        num_panels = project_data.get("number_of_panels")
        num_inverters = project_data.get("number_of_inverters")
        panels_per_string = project_data.get("number_of_panels_per_string")
        
        if all([num_panels, num_inverters, panels_per_string]):
            panels_per_inverter = num_panels / num_inverters
            strings_per_inverter = panels_per_inverter / panels_per_string
            
            if strings_per_inverter < 1:
                errors.append(f"Muy pocos strings por inversor ({strings_per_inverter:.1f})")
        
        # Coordinate validation
        latitude = project_data.get("latitude")
        longitude = project_data.get("longitude")
        
        if latitude is not None and longitude is not None:
            coord_valid, coord_error = validate_coordinates(latitude, longitude)
            if not coord_valid:
                errors.append(coord_error)
    
    except Exception as e:
        logger.error(f"Error in cross-reference validation: {e}")
        errors.append("Error validando relaciones entre campos")
    
    return errors

# ============================================================================
# VERTICAL STRUCTURE VALIDATION
# ============================================================================

def validate_project_info_vertical(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validates project_info with vertical structure (Campo | Valor | Prioridad).
    
    Args:
        df: DataFrame with vertical structure
        
    Returns:
        Comprehensive validation result with errors, warnings, and completion form
    """
    # Verify column structure
    required_columns = ['Campo', 'Valor', 'Prioridad']
    if not all(col in df.columns for col in required_columns):
        return {
            "status": "structure_error",
            "errors": [f"Estructura de columnas incorrecta. Requeridas: {required_columns}"],
            "warnings": [],
            "completion_form": None
        }
    
    # Convert to dictionaries for easy access
    project_data = dict(zip(df['Campo'], df['Valor']))
    priorities = dict(zip(df['Campo'], df['Prioridad']))
    
    errors = []
    warnings = []
    missing_priority_fields = []
    
    # Validate priority fields
    for field_name, field_config in PRIORITY_FIELDS.items():
        if field_name not in project_data or pd.isna(project_data[field_name]):
            missing_priority_fields.append(field_name)
            errors.append(f"Campo prioritario faltante: {field_name}")
        else:
            is_valid, error_msg = validate_field_value(field_name, project_data[field_name], field_config)
            if not is_valid:
                errors.append(error_msg)
    
    # Validate non-priority fields (warnings only)
    for field_name, field_config in NON_PRIORITY_FIELDS.items():
        if field_name in project_data and not pd.isna(project_data[field_name]):
            is_valid, error_msg = validate_field_value(field_name, project_data[field_name], field_config)
            if not is_valid:
                warnings.append(f"Campo opcional '{field_name}': {error_msg}")
        elif field_name in ["latitude", "longitude"]:
            warnings.append(f"Campo '{field_name}' no proporcionado - afectará cálculos de irradiación solar")
    
    # Cross-reference validation
    cross_errors = validate_cross_references(project_data)
    errors.extend(cross_errors)
    
    # Generate completion form if there are missing priority fields
    completion_form = None
    if missing_priority_fields:
        completion_form = generate_completion_form(missing_priority_fields, project_data)
    
    # Determine overall status
    if errors:
        status = "incomplete" if missing_priority_fields else "invalid"
    elif warnings:
        status = "valid_with_warnings"
    else:
        status = "valid"
    
    result = {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "completion_form": completion_form,
        "missing_priority_fields": missing_priority_fields,
        "project_data": project_data,
        "field_count": {
            "total": len(project_data),
            "priority_filled": len([f for f in PRIORITY_FIELDS.keys() if f in project_data and not pd.isna(project_data[f])]),
            "priority_total": len(PRIORITY_FIELDS),
            "non_priority_filled": len([f for f in NON_PRIORITY_FIELDS.keys() if f in project_data and not pd.isna(project_data[f])]),
            "non_priority_total": len(NON_PRIORITY_FIELDS)
        }
    }
    
    logger.info(f"Vertical validation completed: {status}, {len(errors)} errors, {len(warnings)} warnings")
    return result

def generate_completion_form(missing_fields: List[str], current_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a dynamic form structure for completing missing priority fields.
    
    Args:
        missing_fields: List of missing field names
        current_data: Current project data
        
    Returns:
        Form structure for frontend consumption
    """
    form_structure = {
        "missing_required": [],
        "current_values": {},
        "field_definitions": {},
        "form_metadata": {
            "total_missing": len(missing_fields),
            "completion_percentage": ((len(PRIORITY_FIELDS) - len(missing_fields)) / len(PRIORITY_FIELDS)) * 100
        }
    }
    
    # Add missing required fields
    for field in missing_fields:
        if field in PRIORITY_FIELDS:
            field_config = PRIORITY_FIELDS[field]
            form_field = {
                "field": field,
                "type": field_config["type"],
                "required": True,
                "description": field_config["description"],
                "example": field_config.get("example", "")
            }
            
            # Add field-specific properties
            if "allowed_values" in field_config:
                form_field["options"] = field_config["allowed_values"]
            if "min_value" in field_config:
                form_field["min_value"] = field_config["min_value"]
            if "max_value" in field_config:
                form_field["max_value"] = field_config["max_value"]
            if "pattern" in field_config:
                form_field["pattern"] = field_config["pattern"]
            
            form_structure["missing_required"].append(form_field)
    
    # Add current values (all editable)
    for field, value in current_data.items():
        if not pd.isna(value) and field in {**PRIORITY_FIELDS, **NON_PRIORITY_FIELDS}:
            field_config = PRIORITY_FIELDS.get(field, NON_PRIORITY_FIELDS.get(field, {}))
            form_structure["current_values"][field] = {
                "value": value,
                "editable": True,
                "type": field_config.get("type", "text"),
                "priority": "Prioritario" if field in PRIORITY_FIELDS else "No prioritario",
                "description": field_config.get("description", "")
            }
    
    # Add field definitions for reference
    form_structure["field_definitions"] = {**PRIORITY_FIELDS, **NON_PRIORITY_FIELDS}
    
    return form_structure

# ============================================================================
# LEGACY HORIZONTAL VALIDATION
# ============================================================================

def validate_project_info_horizontal(df: pd.DataFrame) -> List[str]:
    """
    Legacy validation for horizontal structure - backward compatibility.
    
    Args:
        df: DataFrame with horizontal structure
        
    Returns:
        List of validation errors
    """
    errors = []
    required_fields = [
        "project_name", "location", "latitude", "longitude",
        "installed_capacity_dc", "installed_capacity_ac",
        "design_voltage_dc", "design_voltage_ac", "design_voltage_mv",
        "execution_year", "inverter_model", "number_of_inverters",
        "inverter_station_model", "panel_model", "number_of_panels", "notes"
    ]
    
    for field in required_fields:
        if field not in df.columns:
            errors.append(f"Missing column: {field}")
    
    logger.info("Legacy horizontal project_info validation completed")
    return errors

# ============================================================================
# MAIN VALIDATION ENTRY POINT
# ============================================================================

def validate_project_info(df: pd.DataFrame) -> List[str]:
    """
    Main entry point for project_info validation.
    Automatically detects structure and applies appropriate validation.
    
    Args:
        df: DataFrame containing project_info data
        
    Returns:
        List of validation errors (for backward compatibility with existing system)
    """
    structure = detect_project_info_structure(df)
    
    if structure == "vertical":
        result = validate_project_info_vertical(df)
        # Return errors list for backward compatibility
        return result["errors"]
    
    elif structure == "horizontal":
        return validate_project_info_horizontal(df)
    
    else:
        return ["Error: No se pudo determinar la estructura del archivo project_info"]

def validate_project_info_enhanced(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Enhanced validation entry point that returns full validation result.
    Use this for new frontend implementations that can handle rich validation data.
    
    Args:
        df: DataFrame containing project_info data
        
    Returns:
        Complete validation result with errors, warnings, and form data
    """
    structure = detect_project_info_structure(df)
    
    if structure == "vertical":
        return validate_project_info_vertical(df)
    
    elif structure == "horizontal":
        errors = validate_project_info_horizontal(df)
        return {
            "status": "valid" if not errors else "invalid",
            "errors": errors,
            "warnings": [],
            "completion_form": None,
            "structure": "horizontal"
        }
    
    else:
        return {
            "status": "structure_error",
            "errors": ["No se pudo determinar la estructura del archivo project_info"],
            "warnings": [],
            "completion_form": None,
            "structure": "unknown"
        }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_field_definitions() -> Dict[str, Dict[str, Any]]:
    """Returns all field definitions for documentation/frontend use"""
    return {
        "priority_fields": PRIORITY_FIELDS,
        "non_priority_fields": NON_PRIORITY_FIELDS,
        "coordinate_regions": COORDINATE_REGIONS
    }

def validate_single_field(field_name: str, value: Any, priority: str = "Prioritario") -> Dict[str, Any]:
    """
    Validates a single field value - useful for real-time validation.
    
    Args:
        field_name: Name of the field
        value: Value to validate
        priority: Field priority level
        
    Returns:
        Validation result with status and message
    """
    field_config = PRIORITY_FIELDS.get(field_name, NON_PRIORITY_FIELDS.get(field_name))
    
    if not field_config:
        return {
            "status": "unknown_field",
            "message": f"Campo '{field_name}' no reconocido",
            "is_valid": False
        }
    
    is_valid, error_msg = validate_field_value(field_name, value, field_config)
    
    return {
        "status": "valid" if is_valid else "invalid",
        "message": error_msg if error_msg else "Campo válido",
        "is_valid": is_valid,
        "field_config": field_config
    }

def get_completion_status(project_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Gets completion status for a project without full validation.
    
    Args:
        project_data: Project data dictionary
        
    Returns:
        Completion status information
    """
    priority_completed = sum(1 for field in PRIORITY_FIELDS.keys() 
                           if field in project_data and not pd.isna(project_data[field]))
    
    non_priority_completed = sum(1 for field in NON_PRIORITY_FIELDS.keys() 
                               if field in project_data and not pd.isna(project_data[field]))
    
    total_priority = len(PRIORITY_FIELDS)
    total_non_priority = len(NON_PRIORITY_FIELDS)
    
    return {
        "priority_completion": {
            "completed": priority_completed,
            "total": total_priority,
            "percentage": (priority_completed / total_priority) * 100
        },
        "non_priority_completion": {
            "completed": non_priority_completed,
            "total": total_non_priority,
            "percentage": (non_priority_completed / total_non_priority) * 100
        },
        "overall_completion": {
            "completed": priority_completed + non_priority_completed,
            "total": total_priority + total_non_priority,
            "percentage": ((priority_completed + non_priority_completed) / (total_priority + total_non_priority)) * 100
        },
        "is_ready_for_calculation": priority_completed == total_priority
    }