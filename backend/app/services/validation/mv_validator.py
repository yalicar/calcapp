# backend/services/validation/mv_validator.py
"""
MV CIRCUITS VALIDATION MODULE

=== PURPOSE ===
Specialized validation for Medium Voltage (MV) circuit data. Handles 
validation of medium voltage circuits including circuit IDs, cable 
lengths, phases, and cable sections for electrical distribution.

=== DATA STRUCTURE ===
Expected columns:
- circuit_id: Unique MV circuit identifier (MV-X format)
- length_m: Total circuit length in meters
- phases: Number of phases (typically 3 for MV)
- section_mm2: Cable section in mm² (commercial MV values)

=== VALIDATION FEATURES ===
- MV circuit ID format validation
- Cable length validation for MV applications
- Phase validation (1 or 3, with warnings for single phase)
- Commercial MV cable section verification
- Power system best practices validation

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

import pandas as pd
import re
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# MV VALIDATION RULES
# ============================================================================

MV_VALIDATION_RULES = {
    "circuit_id": {
        "type": "text",
        "required": True,
        "pattern": r"^MV-\d+$",
        "description": "Identificador único del circuito de media tensión",
        "example": "MV-1",
        "unique": True
    },
    "length_m": {
        "type": "number",
        "required": True,
        "min_value": 10,
        "max_value": 50000,
        "decimal_places": 1,
        "description": "Longitud total del circuito en metros",
        "example": 125,
        "unit": "metros"
    },
    "phases": {
        "type": "number",
        "required": True,
        "allowed_values": [1, 3],
        "data_type": "integer",
        "description": "Número de fases (1 o 3)",
        "example": 3
    },
    "section_mm2": {
        "type": "number",
        "required": True,
        "min_value": 25,
        "max_value": 2000,
        "allowed_values": [25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000, 1200, 1600, 2000],
        "description": "Sección del conductor MV en mm² (valores comerciales para MV)",
        "example": 70,
        "unit": "mm²"
    }
}

# Business rules for MV circuits
MV_BUSINESS_RULES = {
    "min_mv_length_m": 20,           # Minimum practical MV circuit length
    "max_mv_length_m": 25000,       # Maximum practical MV circuit length  
    "typical_length_range_m": (50, 5000),  # Typical range for MV circuits
    "preferred_phases": 3,           # MV circuits should typically be 3-phase
    "min_mv_section_mm2": 25,       # Minimum section for MV applications
    "max_circuits_total": 50,       # Maximum total MV circuits in a system
    "section_length_guidelines": {   # Section recommendations by length
        "short": {"max_length": 500, "min_section": 35},
        "medium": {"max_length": 2000, "min_section": 70},
        "long": {"max_length": 10000, "min_section": 150}
    }
}

# Standard MV cable sections
STANDARD_MV_SECTIONS = [25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000, 1200, 1600, 2000]

# ============================================================================
# FIELD VALIDATION FUNCTIONS
# ============================================================================

def validate_mv_circuit_id(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates MV circuit ID format and structure.
    
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
    
    # Check format: MV-X (uppercase MV, hyphen, number)
    pattern = r"^MV-\d+$"
    if not re.match(pattern, value):
        return False, f"Fila {row_num}: circuit_id formato inválido '{value}' (esperado: MV-X)"
    
    return True, ""

def validate_mv_length(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates MV circuit length values.
    
    Args:
        value: Length value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: length_m es requerido"
    
    try:
        length = float(value)
    except (ValueError, TypeError):
        return False, f"Fila {row_num}: length_m debe ser un número -> {value}"
    
    if length < 10:
        return False, f"Fila {row_num}: length_m debe ser ≥ 10m -> {length}m"
    
    if length > 50000:
        return False, f"Fila {row_num}: length_m debe ser ≤ 50000m -> {length}m"
    
    # Warning for unusual lengths
    min_typical, max_typical = MV_BUSINESS_RULES["typical_length_range_m"]
    if length < min_typical:
        logger.warning(f"Fila {row_num}: length_m muy corto para MV ({length}m, típico: ≥{min_typical}m)")
    elif length > max_typical:
        logger.warning(f"Fila {row_num}: length_m muy largo para MV ({length}m, típico: ≤{max_typical}m)")
    
    return True, ""

def validate_mv_phases(value: Any, row_num: int = 0) -> Tuple[bool, str]:
    """
    Validates number of phases for MV circuits.
    
    Args:
        value: Phases value to validate
        row_num: Row number for error reporting
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: phases es requerido"
    
    try:
        phases = int(value)
    except (ValueError, TypeError):
        return False, f"Fila {row_num}: phases debe ser un número entero -> {value}"
    
    if phases not in [1, 3]:
        return False, f"Fila {row_num}: phases debe ser 1 o 3 -> {phases}"
    
    # Warning for single phase MV (unusual in power systems)
    if phases == 1:
        logger.warning(f"Fila {row_num}: Circuito MV monofásico inusual (phases=1)")
    
    return True, ""

def validate_mv_section(value: Any, row_num: int = 0, length_m: Optional[float] = None) -> Tuple[bool, str]:
    """
    Validates MV cable section with length-based recommendations.
    
    Args:
        value: Section value to validate
        row_num: Row number for error reporting
        length_m: Optional circuit length for section adequacy check
        
    Returns:
        (is_valid, error_message)
    """
    if pd.isna(value) or value == "":
        return False, f"Fila {row_num}: section_mm2 es requerido"
    
    try:
        section = float(value)
    except (ValueError, TypeError):
        return False, f"Fila {row_num}: section_mm2 debe ser un número -> {value}"
    
    if section < 25:
        return False, f"Fila {row_num}: section_mm2 debe ser ≥ 25mm² para MV -> {section}mm²"
    
    if section > 2000:
        return False, f"Fila {row_num}: section_mm2 debe ser ≤ 2000mm² -> {section}mm²"
    
    # Check if section is commercial standard
    if section not in STANDARD_MV_SECTIONS:
        return False, f"Fila {row_num}: section_mm2 debe ser valor comercial estándar -> {section}mm² (disponibles: {STANDARD_MV_SECTIONS})"
    
    # Length-based section adequacy check
    if length_m is not None:
        guidelines = MV_BUSINESS_RULES["section_length_guidelines"]
        
        if length_m <= guidelines["short"]["max_length"] and section < guidelines["short"]["min_section"]:
            logger.warning(f"Fila {row_num}: Sección pequeña para longitud ({section}mm² para {length_m}m, recomendado: ≥{guidelines['short']['min_section']}mm²)")
        elif length_m <= guidelines["medium"]["max_length"] and section < guidelines["medium"]["min_section"]:
            logger.warning(f"Fila {row_num}: Sección pequeña para longitud ({section}mm² para {length_m}m, recomendado: ≥{guidelines['medium']['min_section']}mm²)")
        elif length_m <= guidelines["long"]["max_length"] and section < guidelines["long"]["min_section"]:
            logger.warning(f"Fila {row_num}: Sección pequeña para longitud ({section}mm² para {length_m}m, recomendado: ≥{guidelines['long']['min_section']}mm²)")
    
    return True, ""

# ============================================================================
# BUSINESS LOGIC VALIDATION
# ============================================================================

def validate_duplicate_mv_circuits(df: pd.DataFrame) -> List[str]:
    """
    Validates that MV circuit IDs are unique.
    
    Args:
        df: DataFrame with MV data
        
    Returns:
        List of validation errors
    """
    errors = []
    
    if "circuit_id" in df.columns:
        # Find duplicate circuit IDs
        duplicates = df[df.duplicated(subset=["circuit_id"], keep=False)]
        if len(duplicates) > 0:
            duplicate_ids = duplicates["circuit_id"].unique()
            for circuit_id in duplicate_ids:
                duplicate_rows = df[df["circuit_id"] == circuit_id].index + 2
                errors.append(f"circuit_id duplicado '{circuit_id}' en filas: {list(duplicate_rows)}")
    
    return errors

def validate_mv_system_design(df: pd.DataFrame) -> List[str]:
    """
    Validates overall MV system design considerations.
    
    Args:
        df: DataFrame with MV data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    
    if len(df) == 0:
        return warnings
    
    # Check total number of MV circuits
    total_circuits = len(df)
    max_circuits = MV_BUSINESS_RULES["max_circuits_total"]
    if total_circuits > max_circuits:
        warnings.append(f"Sistema tiene {total_circuits} circuitos MV (máximo recomendado: {max_circuits})")
    
    # Check phase distribution
    if "phases" in df.columns:
        phase_counts = df["phases"].value_counts()
        single_phase_count = phase_counts.get(1, 0)
        three_phase_count = phase_counts.get(3, 0)
        
        if single_phase_count > 0:
            warnings.append(f"Sistema tiene {single_phase_count} circuitos MV monofásicos (inusual en sistemas de potencia)")
        
        if three_phase_count == 0 and total_circuits > 0:
            warnings.append("Sistema no tiene circuitos MV trifásicos (inusual para sistemas solares)")
    
    # Check section distribution
    if "section_mm2" in df.columns:
        sections = df["section_mm2"].dropna()
        if len(sections) > 0:
            min_section = sections.min()
            max_section = sections.max()
            
            if min_section < 70:
                warnings.append(f"Sección mínima MV muy pequeña ({min_section}mm², recomendado: ≥70mm² para la mayoría de aplicaciones)")
            
            # Check for too many different sections (complexity)
            unique_sections = len(sections.unique())
            if unique_sections > 5:
                warnings.append(f"Sistema usa {unique_sections} secciones MV diferentes (considerar estandarizar)")
    
    return warnings

def validate_mv_length_section_relationships(df: pd.DataFrame) -> List[str]:
    """
    Validates relationships between circuit length and cable section.
    
    Args:
        df: DataFrame with MV data
        
    Returns:
        List of validation warnings
    """
    warnings = []
    
    if "length_m" not in df.columns or "section_mm2" not in df.columns:
        return warnings
    
    for index, row in df.iterrows():
        row_num = index + 2
        length = row["length_m"]
        section = row["section_mm2"]
        
        if pd.isna(length) or pd.isna(section):
            continue
        
        try:
            length = float(length)
            section = float(section)
            
            # Very long circuits with small sections
            if length > 2000 and section < 150:
                warnings.append(f"Fila {row_num}: Circuito largo ({length}m) con sección pequeña ({section}mm²) - revisar caída de tensión")
            
            # Very short circuits with large sections
            if length < 100 and section > 300:
                warnings.append(f"Fila {row_num}: Circuito corto ({length}m) con sección grande ({section}mm²) - posible sobredimensionamiento")
        
        except (ValueError):
            continue
    
    return warnings

# ============================================================================
# MAIN VALIDATION FUNCTION
# ============================================================================

def validate_mv_circuits(df: pd.DataFrame) -> List[str]:
    """
    Main validation function for MV circuits.
    
    Args:
        df: DataFrame containing MV circuit data
        
    Returns:
        List of validation errors and warnings
    """
    errors = []
    
    # Check if DataFrame is empty
    if len(df) == 0:
        return ["MV Circuits: No hay datos para validar"]
    
    # Check required columns
    required_columns = ["circuit_id", "length_m", "phases", "section_mm2"]
    missing_columns = set(required_columns) - set(df.columns)
    if missing_columns:
        return [f"MV Circuits: Columnas faltantes: {', '.join(missing_columns)}"]
    
    # Validate each row
    for index, row in df.iterrows():
        row_num = index + 2  # Excel row number (accounting for header)
        
        # Validate circuit_id
        is_valid, error_msg = validate_mv_circuit_id(row["circuit_id"], row_num)
        if not is_valid:
            errors.append(f"MV Circuits: {error_msg}")
        
        # Validate length_m
        is_valid, error_msg = validate_mv_length(row["length_m"], row_num)
        if not is_valid:
            errors.append(f"MV Circuits: {error_msg}")
        
        # Validate phases
        is_valid, error_msg = validate_mv_phases(row["phases"], row_num)
        if not is_valid:
            errors.append(f"MV Circuits: {error_msg}")
        
        # Validate section_mm2 (with length context)
        length_value = None
        try:
            length_value = float(row["length_m"]) if not pd.isna(row["length_m"]) else None
        except (ValueError, TypeError):
            pass
        
        is_valid, error_msg = validate_mv_section(row["section_mm2"], row_num, length_value)
        if not is_valid:
            errors.append(f"MV Circuits: {error_msg}")
    
    # Business logic validations
    duplicate_errors = validate_duplicate_mv_circuits(df)
    errors.extend([f"MV Circuits: {error}" for error in duplicate_errors])
    
    system_warnings = validate_mv_system_design(df)
    errors.extend([f"MV Circuits (Warning): {warning}" for warning in system_warnings])
    
    relationship_warnings = validate_mv_length_section_relationships(df)
    errors.extend([f"MV Circuits (Warning): {warning}" for warning in relationship_warnings])
    
    logger.info(f"MV circuits validation completed: {len(errors)} issues found")
    return errors

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_mv_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Gets summary statistics for MV circuits.
    
    Args:
        df: DataFrame with MV data
        
    Returns:
        Summary statistics dictionary
    """
    if len(df) == 0:
        return {"total_mv_circuits": 0, "has_data": False}
    
    summary = {
        "total_mv_circuits": len(df),
        "has_data": True
    }
    
    try:
        # Length statistics
        if "length_m" in df.columns:
            lengths = pd.to_numeric(df["length_m"], errors='coerce').dropna()
            if len(lengths) > 0:
                summary["length_stats"] = {
                    "min_length_m": float(lengths.min()),
                    "max_length_m": float(lengths.max()),
                    "avg_length_m": float(lengths.mean()),
                    "total_length_km": float(lengths.sum() / 1000)
                }
        
        # Phase distribution
        if "phases" in df.columns:
            phase_counts = df["phases"].value_counts()
            summary["phase_distribution"] = {
                "single_phase": int(phase_counts.get(1, 0)),
                "three_phase": int(phase_counts.get(3, 0))
            }
        
        # Section statistics
        if "section_mm2" in df.columns:
            sections = pd.to_numeric(df["section_mm2"], errors='coerce').dropna()
            if len(sections) > 0:
                summary["section_stats"] = {
                    "min_section_mm2": float(sections.min()),
                    "max_section_mm2": float(sections.max()),
                    "avg_section_mm2": float(sections.mean()),
                    "unique_sections": sorted(sections.unique().tolist()),
                    "section_distribution": sections.value_counts().to_dict()
                }
    
    except Exception as e:
        logger.warning(f"Error generating MV summary: {e}")
        summary["summary_error"] = str(e)
    
    return summary

def validate_single_mv_field(field_name: str, value: Any, row_num: int = 1, context: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Validates a single MV field - useful for real-time validation.
    
    Args:
        field_name: Name of the field to validate
        value: Value to validate
        row_num: Row number for error reporting
        context: Optional context (e.g., length for section validation)
        
    Returns:
        Validation result dictionary
    """
    validation_functions = {
        "circuit_id": validate_mv_circuit_id,
        "length_m": validate_mv_length,
        "phases": validate_mv_phases,
        "section_mm2": lambda v, r: validate_mv_section(v, r, context.get("length_m") if context else None)
    }
    
    if field_name not in validation_functions:
        return {
            "status": "unknown_field",
            "message": f"Campo '{field_name}' no reconocido para MV",
            "is_valid": False
        }
    
    try:
        is_valid, error_msg = validation_functions[field_name](value, row_num)
        
        return {
            "status": "valid" if is_valid else "invalid",
            "message": error_msg if error_msg else "Campo válido",
            "is_valid": is_valid,
            "field_config": MV_VALIDATION_RULES.get(field_name, {})
        }
    
    except Exception as e:
        return {
            "status": "validation_error",
            "message": f"Error validando {field_name}: {str(e)}",
            "is_valid": False
        }

def get_mv_validation_rules() -> Dict[str, Any]:
    """
    Returns validation rules for MV circuits.
    
    Returns:
        Dictionary with validation rules and business rules
    """
    return {
        "field_rules": MV_VALIDATION_RULES,
        "business_rules": MV_BUSINESS_RULES,
        "required_columns": ["circuit_id", "length_m", "phases", "section_mm2"],
        "standard_sections": STANDARD_MV_SECTIONS
    }