# backend/services/validation/dc_string_validator.py
"""
DC STRING CIRCUITS VALIDATION MODULE

=== PURPOSE ===
Specialized validation for DC string circuit data. Handles validation of
string-level DC circuits including string IDs, cable lengths, and 
connections to combiner boxes and inverters.

=== DATA STRUCTURE ===
Expected columns:
- string_id: Unique string identifier (str-XX-XX-CN1-XX-XX format)
- length_pos_m: Positive conductor length in meters
- length_neg_m: Negative conductor length in meters  
- cn1_id: Combiner box (CN1) identifier
- inverter_id: Associated inverter identifier

=== VALIDATION FEATURES ===
- String ID format validation
- Cable length range validation
- Duplicate string detection
- CN1 and inverter reference validation
- Length symmetry analysis

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

import pandas as pd # type: ignore
import re
import numpy as np # type: ignore
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# DC STRING VALIDATION RULES
# ============================================================================

DC_STRING_VALIDATION_RULES = {
    "string_id": {
        "type": "text",
        "required": True,
        "pattern": r"^str-\d+-\d+-CN1-\d+-\d+$",
        "description": "Formato: str-XX-XX-CN1-XX-XX",
        "example": "str-01-01-CN1-01-01",
        "unique": True
    },
    "length_pos_m": {
        "type": "number",
        "required": True,
        "min_value": 0.5,
        "max_value": 2000,
        "decimal_places": 2,
        "description": "Longitud del conductor positivo en metros",
        "example": 21.0,
        "unit": "metros"
    },
    "length_neg_m": {
        "type": "number",
        "required": True,
        "min_value": 0.5,
        "max_value": 2000,
        "decimal_places": 2,
        "description": "Longitud del conductor negativo en metros",
        "example": 19.0,
        "unit": "metros"
    },
    "cn1_id": {
        "type": "text",
        "required": True,
        "pattern": r"^CN1-\d+$",
        "description": "Identificador del combiner box",
        "example": "CN1-01"
    },
    "inverter_id": {
        "type": "text",
        "required": True,
        "pattern": r"^INV-\d+$",
        "description": "Identificador del inversor asociado",
        "example": "INV-1"
    }
}

# Business rules for DC strings
DC_STRING_BUSINESS_RULES = {
    "max_length_difference_pct": 15,  # Maximum % difference between pos/neg lengths
    "min_string_length_m": 1.0,      # Minimum practical string length
    "max_string_length_m": 1500,     # Maximum practical string length
    "typical_length_range_m": (5, 500),  # Typical range for flagging outliers
    "max_strings_per_cn1": 50,       # Maximum strings per combiner box
    "max_strings_per_inverter": 200  # Maximum strings per inverter
}

# ============================================================================
# FIELD VALIDATION FUNCTIONS
# ============================================================================

def validate_string_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates string ID format and structure.
    
    Args:
        value: String ID value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: string_id es requerido"
    
    if not isinstance(value, str):
        return False, f"Fila {row_num}: string_id debe ser texto -> {value}"
    
    # Check format: str-XX-XX-CN1-XX-XX
    pattern = r"^str-\d+-\d+-CN1-\d+-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: string_id formato inválido '{value}' (esperado: str-XX-XX-CN1-XX-XX)"
    
    # Extract components for additional validation
    parts = value.split("-")
    if len(parts) != 6:  # ['str', 'XX', 'XX', 'CN1', 'XX', 'XX']
        return False, f"Fila {row_num}: string_id estructura incorrecta -> {value}"
    
    return True, ""

def validate_cable_length(value: Any, field_name: str, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates cable length values.
    
    Args:
        value: Length value to validate
        field_name: Name of the field (length_pos_m or length_neg_m)
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: {field_name} es requerido"
    
    try:
        length = float(value)
    except (ValueError, TypeError):
        return False, f"Fila {row_num}: {field_name} debe ser un número -> {value}"
    
    if length < 0.5:
        return False, f"Fila {row_num}: {field_name} debe ser ≥ 0.5m -> {length}m"
    
    if length > 2000:
        return False, f"Fila {row_num}: {field_name} debe ser ≤ 2000m -> {length}m"
    
    # Warning for unusual lengths
    min_typical, max_typical = DC_STRING_BUSINESS_RULES["typical_length_range_m"]
    if length < min_typical or length > max_typical:
        logger.warning(f"Fila {row_num}: {field_name} fuera del rango típico ({min_typical}-{max_typical}m) -> {length}m")
    
    return True, ""

def validate_cn1_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates CN1 (combiner box) ID format.
    
    Args:
        value: CN1 ID value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: cn1_id es requerido"
    
    if not isinstance(value, str):
        return False, f"Fila {row_num}: cn1_id debe ser texto -> {value}"
    
    # Check format: CN1-XX
    pattern = r"^CN1-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: cn1_id formato inválido '{value}' (esperado: CN1-XX)"
    
    return True, ""

def validate_inverter_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates inverter ID format.
    
    Args:
        value: Inverter ID value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: inverter_id es requerido"
    
    if not isinstance(value, str):
        return False, f"Fila {row_num}: inverter_id debe ser texto -> {value}"
    
    # Check format: INV-X or INV-XX
    pattern = r"^INV-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: inverter_id formato inválido '{value}' (esperado: INV-X)"
    
    return True, ""

# ============================================================================
# BUSINESS LOGIC VALIDATION
# ============================================================================

def validate_length_symmetry(df: pd.DataFrame) -> List[str]:
    """
    Validates that positive and negative cable lengths are reasonably similar.
    
    Args:
        df: DataFrame with DC string data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    max_diff_pct = DC_STRING_BUSINESS_RULES["max_length_difference_pct"]
    
    if "length_pos_m" not in df.columns or "length_neg_m" not in df.columns:
        return warnings
    
    for index, row in df.iterrows():
        row_num = index + 2
        pos_length = row["length_pos_m"]
        neg_length = row["length_neg_m"]
        
        if pd.isna(pos_length) or pd.isna(neg_length):
            continue
        
        try:
            pos_length = float(pos_length)
            neg_length = float(neg_length)
            
            # Calculate percentage difference
            avg_length = (pos_length + neg_length) / 2
            diff_pct = abs(pos_length - neg_length) / avg_length * 100
            
            if diff_pct > max_diff_pct:
                warnings.append(
                    f"Fila {row_num}: Gran diferencia entre longitudes pos/neg "
                    f"({pos_length}m vs {neg_length}m, {diff_pct:.1f}% diferencia)"
                )
        
        except (ValueError, ZeroDivisionError):
            continue
    
    return warnings

def validate_string_distribution(df: pd.DataFrame) -> List[str]:
    """
    Validates string distribution across CN1s and inverters.
    
    Args:
        df: DataFrame with DC string data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    
    if len(df) == 0:
        return warnings
    
    # Check strings per CN1
    if "cn1_id" in df.columns:
        cn1_counts = df["cn1_id"].value_counts()
        max_strings_per_cn1 = DC_STRING_BUSINESS_RULES["max_strings_per_cn1"]
        
        overloaded_cn1s = cn1_counts[cn1_counts > max_strings_per_cn1]
        if len(overloaded_cn1s) > 0:
            for cn1_id, count in overloaded_cn1s.items():
                warnings.append(f"CN1 '{cn1_id}' tiene {count} strings (máximo recomendado: {max_strings_per_cn1})")
    
    # Check strings per inverter
    if "inverter_id" in df.columns:
        inv_counts = df["inverter_id"].value_counts()
        max_strings_per_inv = DC_STRING_BUSINESS_RULES["max_strings_per_inverter"]
        
        overloaded_invs = inv_counts[inv_counts > max_strings_per_inv]
        if len(overloaded_invs) > 0:
            for inv_id, count in overloaded_invs.items():
                warnings.append(f"Inversor '{inv_id}' tiene {count} strings (máximo recomendado: {max_strings_per_inv})")
    
    return warnings

def validate_duplicate_strings(df: pd.DataFrame) -> List[str]:
    """
    Validates that string IDs are unique.
    
    Args:
        df: DataFrame with DC string data
        
    Returns:
        List of validation errors
    """
    errors = []
    
    if "string_id" in df.columns:
        # Find duplicate string IDs
        duplicates = df[df.duplicated(subset=["string_id"], keep=False)]
        if len(duplicates) > 0:
            duplicate_ids = duplicates["string_id"].unique()
            for string_id in duplicate_ids:
                duplicate_rows = df[df["string_id"] == string_id].index + 2
                errors.append(f"string_id duplicado '{string_id}' en filas: {list(duplicate_rows)}")
    
    return errors

# ============================================================================
# MAIN VALIDATION FUNCTION
# ============================================================================

def validate_dc_string_circuits(df: pd.DataFrame) -> List[str]:
    """
    Main validation function for DC string circuits.
    
    Args:
        df: DataFrame containing DC string circuit data
        
    Returns:
        List of validation errors and warnings
    """
    errors = []
    
    # Check if DataFrame is empty
    if len(df) == 0:
        return ["DC String Circuits: No hay datos para validar"]
    
    # Check required columns
    required_columns = ["string_id", "length_pos_m", "length_neg_m", "cn1_id", "inverter_id"]
    missing_columns = set(required_columns) - set(df.columns)
    if missing_columns:
        return [f"DC String Circuits: Columnas faltantes: {', '.join(missing_columns)}"]
    
    # Validate each row
    for index, row in df.iterrows():
        row_num = index + 2  # Excel row number (accounting for header)
        
        # Validate string_id
        is_valid, error_msg = validate_string_id(row["string_id"], row_num)
        if not is_valid:
            errors.append(f"DC String Circuits: {error_msg}")
        
        # Validate length_pos_m
        is_valid, error_msg = validate_cable_length(row["length_pos_m"], "length_pos_m", row_num)
        if not is_valid:
            errors.append(f"DC String Circuits: {error_msg}")
        
        # Validate length_neg_m
        is_valid, error_msg = validate_cable_length(row["length_neg_m"], "length_neg_m", row_num)
        if not is_valid:
            errors.append(f"DC String Circuits: {error_msg}")
        
        # Validate cn1_id
        is_valid, error_msg = validate_cn1_id(row["cn1_id"], row_num)
        if not is_valid:
            errors.append(f"DC String Circuits: {error_msg}")
        
        # Validate inverter_id
        is_valid, error_msg = validate_inverter_id(row["inverter_id"], row_num)
        if not is_valid:
            errors.append(f"DC String Circuits: {error_msg}")
    
    # Business logic validations (add as warnings)
    duplicate_errors = validate_duplicate_strings(df)
    errors.extend([f"DC String Circuits: {error}" for error in duplicate_errors])
    
    length_warnings = validate_length_symmetry(df)
    errors.extend([f"DC String Circuits (Warning): {warning}" for warning in length_warnings])
    
    distribution_warnings = validate_string_distribution(df)
    errors.extend([f"DC String Circuits (Warning): {warning}" for warning in distribution_warnings])
    
    logger.info(f"DC string circuits validation completed: {len(errors)} issues found")
    return errors

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_dc_string_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Gets summary statistics for DC string circuits.
    
    Args:
        df: DataFrame with DC string data
        
    Returns:
        Summary statistics dictionary
    """
    if len(df) == 0:
        return {"total_strings": 0, "has_data": False}
    
    summary = {
        "total_strings": len(df),
        "has_data": True
    }
    
    try:
        # Length statistics
        if "length_pos_m" in df.columns and "length_neg_m" in df.columns:
            pos_lengths = pd.to_numeric(df["length_pos_m"], errors='coerce').dropna()
            neg_lengths = pd.to_numeric(df["length_neg_m"], errors='coerce').dropna()
            
            if len(pos_lengths) > 0:
                summary["length_stats"] = {
                    "min_pos_length_m": float(pos_lengths.min()),
                    "max_pos_length_m": float(pos_lengths.max()),
                    "avg_pos_length_m": float(pos_lengths.mean()),
                    "min_neg_length_m": float(neg_lengths.min()),
                    "max_neg_length_m": float(neg_lengths.max()),
                    "avg_neg_length_m": float(neg_lengths.mean()),
                    "total_cable_length_km": float((pos_lengths.sum() + neg_lengths.sum()) / 1000)
                }
        
        # CN1 distribution
        if "cn1_id" in df.columns:
            cn1_counts = df["cn1_id"].value_counts()
            summary["cn1_stats"] = {
                "unique_cn1s": len(cn1_counts),
                "strings_per_cn1": {
                    "min": int(cn1_counts.min()),
                    "max": int(cn1_counts.max()),
                    "avg": float(cn1_counts.mean())
                }
            }
        
        # Inverter distribution
        if "inverter_id" in df.columns:
            inv_counts = df["inverter_id"].value_counts()
            summary["inverter_stats"] = {
                "unique_inverters": len(inv_counts),
                "strings_per_inverter": {
                    "min": int(inv_counts.min()),
                    "max": int(inv_counts.max()),
                    "avg": float(inv_counts.mean())
                }
            }
    
    except Exception as e:
        logger.warning(f"Error generating DC string summary: {e}")
        summary["summary_error"] = str(e)
    
    return summary

def validate_single_dc_string_field(field_name: str, value: Any, row_num: int = 1) -> Dict[str, Any]:
    """
    Validates a single DC string field - useful for real-time validation.
    
    Args:
        field_name: Name of the field to validate
        value: Value to validate
        row_num: Row number for error reporting
        
    Returns:
        Validation result dictionary
    """
    validation_functions = {
        "string_id": validate_string_id,
        "length_pos_m": lambda v, r: validate_cable_length(v, "length_pos_m", r),
        "length_neg_m": lambda v, r: validate_cable_length(v, "length_neg_m", r),
        "cn1_id": validate_cn1_id,
        "inverter_id": validate_inverter_id
    }
    
    if field_name not in validation_functions:
        return {
            "status": "unknown_field",
            "message": f"Campo '{field_name}' no reconocido para DC strings",
            "is_valid": False
        }
    
    try:
        is_valid, error_msg = validation_functions[field_name](value, row_num)
        
        return {
            "status": "valid" if is_valid else "invalid",
            "message": error_msg if error_msg else "Campo válido",
            "is_valid": is_valid,
            "field_config": DC_STRING_VALIDATION_RULES.get(field_name, {})
        }
    
    except Exception as e:
        return {
            "status": "validation_error",
            "message": f"Error validando {field_name}: {str(e)}",
            "is_valid": False
        }

def get_dc_string_validation_rules() -> Dict[str, Any]:
    """
    Returns validation rules for DC string circuits.
    
    Returns:
        Dictionary with validation rules and business rules
    """
    return {
        "field_rules": DC_STRING_VALIDATION_RULES,
        "business_rules": DC_STRING_BUSINESS_RULES,
        "required_columns": ["string_id", "length_pos_m", "length_neg_m", "cn1_id", "inverter_id"]
    }