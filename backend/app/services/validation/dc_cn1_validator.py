# backend/services/validation/dc_cn1_validator.py
"""
DC CN1 CIRCUITS VALIDATION MODULE

=== PURPOSE ===
Specialized validation for DC CN1 (combiner box) circuit data. Handles 
validation of combiner-level DC circuits including circuit IDs, cable 
lengths, and inverter connections.

=== DATA STRUCTURE ===
Expected columns:
- circuit_id: Unique CN1 circuit identifier (cn1-X format)
- length_pos_m: Positive conductor length in meters
- length_neg_m: Negative conductor length in meters
- inverter_id: Associated inverter identifier (INV-X format)

=== VALIDATION FEATURES ===
- CN1 circuit ID format validation
- Cable length validation with decimal precision
- Inverter reference validation
- Length symmetry analysis
- Duplicate circuit detection

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
# DC CN1 VALIDATION RULES
# ============================================================================

DC_CN1_VALIDATION_RULES = {
    "circuit_id": {
        "type": "text",
        "required": True,
        "pattern": r"^cn1-\d+$",
        "description": "Identificador único del circuito CN1",
        "example": "cn1-1",
        "unique": True
    },
    "length_pos_m": {
        "type": "number",
        "required": True,
        "min_value": 1.0,
        "max_value": 5000,
        "decimal_places": 3,
        "description": "Longitud del conductor positivo en metros",
        "example": 484.218,
        "unit": "metros"
    },
    "length_neg_m": {
        "type": "number",
        "required": True,
        "min_value": 1.0,
        "max_value": 5000,
        "decimal_places": 3,
        "description": "Longitud del conductor negativo en metros",
        "example": 484.218,
        "unit": "metros"
    },
    "inverter_id": {
        "type": "text",
        "required": True,
        "pattern": r"^INV-\d+$",
        "description": "Identificador del inversor asociado",
        "example": "INV-1"
    }
}

# Business rules for DC CN1 circuits
DC_CN1_BUSINESS_RULES = {
    "max_length_difference_pct": 5,   # CN1 circuits should be more symmetric than strings
    "min_cn1_length_m": 5.0,         # Minimum practical CN1 circuit length
    "max_cn1_length_m": 3000,        # Maximum practical CN1 circuit length
    "typical_length_range_m": (50, 1500),  # Typical range for CN1 circuits
    "max_cn1s_per_inverter": 20,     # Maximum CN1 circuits per inverter
    "length_precision_warning": 0.1   # Warn if lengths are too precise (might be calculated)
}

# ============================================================================
# FIELD VALIDATION FUNCTIONS
# ============================================================================

def validate_cn1_circuit_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates CN1 circuit ID format and structure.
    
    Args:
        value: Circuit ID value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: circuit_id es requerido"
    
    if not isinstance(value, str):
        return False, f"Fila {row_num}: circuit_id debe ser texto -> {value}"
    
    # Check format: cn1-X (lowercase, hyphen, number)
    pattern = r"^cn1-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: circuit_id formato inválido '{value}' (esperado: cn1-X)"
    
    return True, ""

def validate_cn1_cable_length(value: Any, field_name: str, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates CN1 cable length values with higher precision than strings.
    
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
    
    if length < 1.0:
        return False, f"Fila {row_num}: {field_name} debe ser ≥ 1.0m -> {length}m"
    
    if length > 5000:
        return False, f"Fila {row_num}: {field_name} debe ser ≤ 5000m -> {length}m"
    
    # Check decimal places (CN1 circuits can have more precision)
    decimal_str = str(length)
    if '.' in decimal_str:
        decimal_places = len(decimal_str.split('.')[1])
        if decimal_places > 3:
            logger.warning(f"Fila {row_num}: {field_name} tiene más de 3 decimales -> {length}m")
    
    # Warning for unusual lengths
    min_typical, max_typical = DC_CN1_BUSINESS_RULES["typical_length_range_m"]
    if length < min_typical or length > max_typical:
        logger.warning(f"Fila {row_num}: {field_name} fuera del rango típico para CN1 ({min_typical}-{max_typical}m) -> {length}m")
    
    return True, ""

def validate_cn1_inverter_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates inverter ID format for CN1 circuits.
    
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
    
    # Check format: INV-X
    pattern = r"^INV-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: inverter_id formato inválido '{value}' (esperado: INV-X)"
    
    return True, ""

# ============================================================================
# BUSINESS LOGIC VALIDATION
# ============================================================================

def validate_cn1_length_symmetry(df: pd.DataFrame) -> List[str]:
    """
    Validates that CN1 positive and negative cable lengths are symmetric.
    CN1 circuits should be more symmetric than string circuits.
    
    Args:
        df: DataFrame with DC CN1 data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    max_diff_pct = DC_CN1_BUSINESS_RULES["max_length_difference_pct"]
    
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
            if pos_length > 0 and neg_length > 0:
                avg_length = (pos_length + neg_length) / 2
                diff_pct = abs(pos_length - neg_length) / avg_length * 100
                
                if diff_pct > max_diff_pct:
                    warnings.append(
                        f"Fila {row_num}: Diferencia entre longitudes pos/neg en CN1 "
                        f"({pos_length}m vs {neg_length}m, {diff_pct:.1f}% diferencia, máximo: {max_diff_pct}%)"
                    )
                
                # Special case: exactly equal lengths might indicate calculated values
                if pos_length == neg_length and pos_length > 100:
                    logger.info(f"Fila {row_num}: Longitudes CN1 exactamente iguales ({pos_length}m) - posible valor calculado")
        
        except (ValueError, ZeroDivisionError):
            continue
    
    return warnings

def validate_cn1_inverter_distribution(df: pd.DataFrame) -> List[str]:
    """
    Validates CN1 distribution across inverters.
    
    Args:
        df: DataFrame with DC CN1 data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    
    if len(df) == 0 or "inverter_id" not in df.columns:
        return warnings
    
    # Check CN1s per inverter
    inv_counts = df["inverter_id"].value_counts()
    max_cn1s_per_inv = DC_CN1_BUSINESS_RULES["max_cn1s_per_inverter"]
    
    overloaded_invs = inv_counts[inv_counts > max_cn1s_per_inv]
    if len(overloaded_invs) > 0:
        for inv_id, count in overloaded_invs.items():
            warnings.append(f"Inversor '{inv_id}' tiene {count} CN1 circuits (máximo recomendado: {max_cn1s_per_inv})")
    
    # Check for uneven distribution
    if len(inv_counts) > 1:
        min_cn1s = inv_counts.min()
        max_cn1s = inv_counts.max()
        if max_cn1s > min_cn1s * 2:  # If one inverter has more than double
            warnings.append(f"Distribución desigual de CN1s: min={min_cn1s}, max={max_cn1s} por inversor")
    
    return warnings

def validate_duplicate_cn1_circuits(df: pd.DataFrame) -> List[str]:
    """
    Validates that CN1 circuit IDs are unique.
    
    Args:
        df: DataFrame with DC CN1 data
        
    Returns:
        List of validation warnings (changed from errors)
    """
    warnings = []  # Changed from errors to warnings
    
    if "circuit_id" in df.columns:
        # Find duplicate circuit IDs
        duplicates = df[df.duplicated(subset=["circuit_id"], keep=False)]
        if len(duplicates) > 0:
            duplicate_ids = duplicates["circuit_id"].unique()
            for circuit_id in duplicate_ids:
                duplicate_rows = df[df["circuit_id"] == circuit_id].index + 2
                warnings.append(f"circuit_id duplicado '{circuit_id}' en filas: {list(duplicate_rows)}")
    
    return warnings  # Changed from errors to warnings

def validate_cn1_length_precision(df: pd.DataFrame) -> List[str]:
    """
    Validates length precision - warns if values seem overly precise.
    
    Args:
        df: DataFrame with DC CN1 data
        
    Returns:
        List of validation info messages
    """
    info_messages = []
    
    if "length_pos_m" not in df.columns or "length_neg_m" not in df.columns:
        return info_messages
    
    # Check if all lengths have high precision (might indicate calculated values)
    high_precision_count = 0
    total_valid_rows = 0
    
    for index, row in df.iterrows():
        pos_length = row["length_pos_m"]
        neg_length = row["length_neg_m"]
        
        if pd.isna(pos_length) or pd.isna(neg_length):
            continue
        
        total_valid_rows += 1
        
        # Check if both values have more than 2 decimal places
        try:
            pos_str = str(float(pos_length))
            neg_str = str(float(neg_length))
            
            pos_decimals = len(pos_str.split('.')[1]) if '.' in pos_str else 0
            neg_decimals = len(neg_str.split('.')[1]) if '.' in neg_str else 0
            
            if pos_decimals >= 3 or neg_decimals >= 3:
                high_precision_count += 1
        
        except (ValueError, IndexError):
            continue
    
    if total_valid_rows > 0 and high_precision_count / total_valid_rows > 0.8:
        info_messages.append("Más del 80% de las longitudes CN1 tienen alta precisión decimal - posibles valores calculados")
    
    return info_messages

# ============================================================================
# MAIN VALIDATION FUNCTION
# ============================================================================

def validate_dc_cn1_circuits(df: pd.DataFrame) -> List[str]:
    """
    Main validation function for DC CN1 circuits.
    
    Args:
        df: DataFrame containing DC CN1 circuit data
        
    Returns:
        List of validation errors and warnings
    """
    errors = []
    
    # Check if DataFrame is empty
    if len(df) == 0:
        return ["DC CN1 Circuits: No hay datos para validar"]
    
    # Check required columns
    required_columns = ["circuit_id", "length_pos_m", "length_neg_m", "inverter_id"]
    missing_columns = set(required_columns) - set(df.columns)
    if missing_columns:
        return [f"DC CN1 Circuits: Columnas faltantes: {', '.join(missing_columns)}"]
    
    # Validate each row
    for index, row in df.iterrows():
        row_num = index + 2  # Excel row number (accounting for header)
        
        # Validate circuit_id
        is_valid, error_msg = validate_cn1_circuit_id(row["circuit_id"], row_num)
        if not is_valid:
            errors.append(f"DC CN1 Circuits: {error_msg}")
        
        # Validate length_pos_m
        is_valid, error_msg = validate_cn1_cable_length(row["length_pos_m"], "length_pos_m", row_num)
        if not is_valid:
            errors.append(f"DC CN1 Circuits: {error_msg}")
        
        # Validate length_neg_m
        is_valid, error_msg = validate_cn1_cable_length(row["length_neg_m"], "length_neg_m", row_num)
        if not is_valid:
            errors.append(f"DC CN1 Circuits: {error_msg}")
        
        # Validate inverter_id
        is_valid, error_msg = validate_cn1_inverter_id(row["inverter_id"], row_num)
        if not is_valid:
            errors.append(f"DC CN1 Circuits: {error_msg}")
    
    # Business logic validations
    duplicate_warnings = validate_duplicate_cn1_circuits(df)
    errors.extend([f"DC CN1 Circuits (Warning): {warning}" for warning in duplicate_warnings])  # Changed to Warning

    
    length_warnings = validate_cn1_length_symmetry(df)
    errors.extend([f"DC CN1 Circuits (Warning): {warning}" for warning in length_warnings])
    
    distribution_warnings = validate_cn1_inverter_distribution(df)
    errors.extend([f"DC CN1 Circuits (Warning): {warning}" for warning in distribution_warnings])
    
    precision_info = validate_cn1_length_precision(df)
    errors.extend([f"DC CN1 Circuits (Info): {info}" for info in precision_info])
    
    logger.info(f"DC CN1 circuits validation completed: {len(errors)} issues found")
    return errors

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_dc_cn1_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Gets summary statistics for DC CN1 circuits.
    
    Args:
        df: DataFrame with DC CN1 data
        
    Returns:
        Summary statistics dictionary
    """
    if len(df) == 0:
        return {"total_cn1_circuits": 0, "has_data": False}
    
    summary = {
        "total_cn1_circuits": len(df),
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
        
        # Inverter distribution
        if "inverter_id" in df.columns:
            inv_counts = df["inverter_id"].value_counts()
            summary["inverter_stats"] = {
                "unique_inverters": len(inv_counts),
                "cn1s_per_inverter": {
                    "min": int(inv_counts.min()),
                    "max": int(inv_counts.max()),
                    "avg": float(inv_counts.mean())
                },
                "distribution": inv_counts.to_dict()
            }
        
        # Length precision analysis
        if "length_pos_m" in df.columns:
            lengths = pd.to_numeric(df["length_pos_m"], errors='coerce').dropna()
            decimal_places = []
            for length in lengths:
                length_str = str(float(length))
                if '.' in length_str:
                    decimal_places.append(len(length_str.split('.')[1]))
                else:
                    decimal_places.append(0)
            
            if decimal_places:
                summary["precision_stats"] = {
                    "avg_decimal_places": float(np.mean(decimal_places)),
                    "max_decimal_places": int(max(decimal_places)),
                    "high_precision_count": sum(1 for dp in decimal_places if dp >= 3)
                }
    
    except Exception as e:
        logger.warning(f"Error generating DC CN1 summary: {e}")
        summary["summary_error"] = str(e)
    
    return summary

def validate_single_dc_cn1_field(field_name: str, value: Any, row_num: int = 1) -> Dict[str, Any]:
    """
    Validates a single DC CN1 field - useful for real-time validation.
    
    Args:
        field_name: Name of the field to validate
        value: Value to validate
        row_num: Row number for error reporting
        
    Returns:
        Validation result dictionary
    """
    validation_functions = {
        "circuit_id": validate_cn1_circuit_id,
        "length_pos_m": lambda v, r: validate_cn1_cable_length(v, "length_pos_m", r),
        "length_neg_m": lambda v, r: validate_cn1_cable_length(v, "length_neg_m", r),
        "inverter_id": validate_cn1_inverter_id
    }
    
    if field_name not in validation_functions:
        return {
            "status": "unknown_field",
            "message": f"Campo '{field_name}' no reconocido para DC CN1",
            "is_valid": False
        }
    
    try:
        is_valid, error_msg = validation_functions[field_name](value, row_num)
        
        return {
            "status": "valid" if is_valid else "invalid",
            "message": error_msg if error_msg else "Campo válido",
            "is_valid": is_valid,
            "field_config": DC_CN1_VALIDATION_RULES.get(field_name, {})
        }
    
    except Exception as e:
        return {
            "status": "validation_error",
            "message": f"Error validando {field_name}: {str(e)}",
            "is_valid": False
        }

def get_dc_cn1_validation_rules() -> Dict[str, Any]:
    """
    Returns validation rules for DC CN1 circuits.
    
    Returns:
        Dictionary with validation rules and business rules
    """
    return {
        "field_rules": DC_CN1_VALIDATION_RULES,
        "business_rules": DC_CN1_BUSINESS_RULES,
        "required_columns": ["circuit_id", "length_pos_m", "length_neg_m", "inverter_id"]
    }