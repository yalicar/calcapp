# backend/services/parser.py
"""
EXCEL PARSER MODULE

=== PURPOSE ===
Handles reading and basic structure validation of Excel files for
solar PV projects. Focuses ONLY on file accessibility and sheet existence,
leaving detailed content validation to specialized validators.

=== RESPONSIBILITIES ===
- Check if Excel file exists and is readable
- Verify required sheets are present
- Return ExcelFile object for further processing
- Basic logging and error reporting

=== NOT RESPONSIBLE FOR ===
- Content validation (handled by validation modules)
- Business rule validation (handled by validators)
- Data format validation (handled by validators)

=== LAST UPDATED ===
Updated: 2025-06-30
Version: 2.1.0
Maintainer: Solar Engineering Team
"""

import pandas as pd
import os
import logging

logger = logging.getLogger(__name__)

# Required sheets - only checking existence, not content
REQUIRED_SHEETS = [
    "project_info",
    "dc_string_circuits", 
    "dc_cn1_circuits",
    "mv_circuits"
]

# Optional sheets for future expansion
OPTIONAL_SHEETS = [
    "ac_circuits"
]

def read_project_excel(project_name: str):
    """
    Reads Excel file and performs basic structure validation.
    
    ONLY validates:
    - File exists and is readable
    - Required sheets are present
    - Sheets can be parsed
    
    Content validation is handled by specialized validators.
    
    Args:
        project_name: Name of the project
        
    Returns:
        Tuple[bool, Union[pd.ExcelFile, str]]: (success, excel_file_or_error_message)
    """
    excel_path = f"backend/projects/{project_name}/input.xlsx"

    # Check if file exists
    if not os.path.exists(excel_path):
        logger.error(f"Excel file not found: {excel_path}")
        return False, "Excel file not found."

    try:
        # Try to open the Excel file
        xl = pd.ExcelFile(excel_path)
        found_sheets = xl.sheet_names
        
        logger.info(f"Found sheets in {project_name}: {found_sheets}")

        # Check for required sheets
        missing_sheets = set(REQUIRED_SHEETS) - set(found_sheets)
        if missing_sheets:
            error_msg = f"Missing required sheets: {', '.join(missing_sheets)}"
            logger.error(error_msg)
            return False, error_msg

        # Quick readability test for each required sheet
        for sheet_name in REQUIRED_SHEETS:
            try:
                df = xl.parse(sheet_name)
                logger.debug(f"Sheet '{sheet_name}' is readable ({len(df)} rows, {len(df.columns)} columns)")
            except Exception as e:
                error_msg = f"Cannot read sheet '{sheet_name}': {str(e)}"
                logger.error(error_msg)
                return False, error_msg

        # Log optional sheets found
        for sheet_name in OPTIONAL_SHEETS:
            if sheet_name in found_sheets:
                logger.info(f"Found optional sheet: {sheet_name}")

        logger.info(f"Excel file structure check successful for project: {project_name}")
        return True, xl

    except Exception as e:
        error_msg = f"Error reading Excel file: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def get_sheet_info(project_name: str) -> dict:
    """
    Gets basic information about sheets in the Excel file.
    
    Args:
        project_name: Name of the project
        
    Returns:
        Dictionary with sheet information
    """
    excel_path = f"backend/projects/{project_name}/input.xlsx"
    
    if not os.path.exists(excel_path):
        return {"error": "Excel file not found", "sheets": []}
    
    try:
        xl = pd.ExcelFile(excel_path)
        sheet_info = {}
        
        for sheet_name in xl.sheet_names:
            try:
                df = xl.parse(sheet_name)
                sheet_info[sheet_name] = {
                    "rows": len(df),
                    "columns": len(df.columns),
                    "column_names": df.columns.tolist(),
                    "is_required": sheet_name in REQUIRED_SHEETS,
                    "is_optional": sheet_name in OPTIONAL_SHEETS
                }
            except Exception as e:
                sheet_info[sheet_name] = {
                    "error": f"Could not read sheet: {str(e)}"
                }
        
        return {
            "total_sheets": len(xl.sheet_names),
            "required_sheets_found": len(set(REQUIRED_SHEETS) & set(xl.sheet_names)),
            "required_sheets_total": len(REQUIRED_SHEETS),
            "sheets": list(xl.sheet_names),
            "sheet_details": sheet_info
        }
        
    except Exception as e:
        return {"error": f"Error reading Excel: {str(e)}", "sheets": []}

def validate_excel_accessibility(project_name: str) -> dict:
    """
    Quick validation that Excel file is accessible and has basic structure.
    
    Args:
        project_name: Name of the project
        
    Returns:
        Dictionary with validation results
    """
    success, result = read_project_excel(project_name)
    
    if not success:
        return {
            "is_accessible": False,
            "error": result,
            "file_path": f"backend/projects/{project_name}/input.xlsx"
        }
    
    # If we get here, file is accessible
    xl = result
    
    return {
        "is_accessible": True,
        "file_path": f"backend/projects/{project_name}/input.xlsx",
        "sheets_found": xl.sheet_names,
        "required_sheets_present": all(sheet in xl.sheet_names for sheet in REQUIRED_SHEETS),
        "optional_sheets_present": [sheet for sheet in OPTIONAL_SHEETS if sheet in xl.sheet_names]
    }

# Legacy function for backward compatibility
def read_project_excel_legacy(project_name: str):
    """
    Legacy function for backward compatibility.
    Use read_project_excel() for new implementations.
    """
    logger.warning("Using legacy read_project_excel_legacy function. Consider migrating to read_project_excel().")
    return read_project_excel(project_name)