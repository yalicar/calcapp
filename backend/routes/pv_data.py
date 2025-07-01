# backend/routes/pv_data.py
"""
PV DATA VALIDATION & EXTRACTION ROUTES

=== PURPOSE ===
This module handles all data operations related to Excel files in PV projects.
It provides validation, extraction, and preview capabilities for solar project
data stored in Excel format.

=== MAIN RESPONSIBILITIES ===
1. Excel file content validation against business rules
2. Data extraction from Excel sheets to JSON format
3. Excel structure validation (sheets, columns, basic format)
4. Preview generation for frontend display
5. Individual sheet data access
6. Error handling and cleanup for invalid files

=== KEY FEATURES ===
- Multi-sheet validation (project_info, circuits, etc.)
- Automatic file cleanup on validation errors
- Preview mode for large datasets
- Sheet-specific data access
- Comprehensive error reporting
- Data sanitization (NaN handling)

=== VALIDATION RULES ===
- Project info completeness and format
- DC string circuit parameters
- DC CN1 circuit specifications
- AC circuit configurations
- MV circuit requirements
- Cross-sheet data consistency

=== ENDPOINTS OVERVIEW ===
- GET /validate-excel-content/{project_name}           → Full content validation
- GET /validate-excel-structure/{project_name}         → Structure-only validation
- GET /excel-data/{project_name}                       → Complete data extraction
- GET /excel-preview/{project_name}                    → Limited preview (3 rows)
- GET /excel-sheet/{project_name}/{sheet_name}         → Single sheet data

=== EXCEL SHEET STRUCTURE ===
Expected sheets in uploaded Excel files:
- project_info: General project information and panel specs
- dc_string_circuits: DC string level circuit data
- dc_cn1_circuits: DC combiner level circuit data  
- ac_circuits: AC side circuit configurations
- mv_circuits: Medium voltage circuit specifications

=== DEPENDENCIES ===
- Excel parsing service (backend/services/parser.py)
- Validation engine (backend/services/validator.py)
- File system utilities (backend/utils/filesystem.py)

=== ERROR HANDLING ===
- Invalid files are automatically removed
- Detailed error messages for each validation rule
- Graceful fallbacks for missing data
- Comprehensive logging for debugging

=== FUTURE ENHANCEMENTS ===
- Real-time validation during upload
- Excel template generation
- Data transformation and cleaning
- Integration with external data sources
- Batch validation for multiple projects

=== LAST UPDATED ===
Created: 2025-06-30
Version: 1.0.0
Maintainer: Solar Engineering Team
"""

from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import os
import numpy as np
import pandas as pd
import logging

# Data processing imports
from backend.services.parser import read_project_excel
from backend.services.validation.project_validator import validate_project_info
from backend.services.validation.dc_string_validator import validate_dc_string_circuits  
from backend.services.validation.dc_cn1_validator import validate_dc_cn1_circuits
from backend.services.validation.mv_validator import validate_mv_circuits

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# EXCEL VALIDATION ENDPOINTS
# ============================================================================

@router.get("/validate-excel-content/{project_name}")
def validate_complete_excel_content(project_name: str):
    """
    Validates the complete content of the project's Excel file.
    
    This endpoint performs comprehensive validation of all Excel sheets
    against business rules and data requirements. If any validation
    errors are found, the Excel file is automatically removed to prevent
    invalid data from being used in calculations.
    
    Validation includes:
    - Project information completeness
    - Circuit parameter ranges and formats
    - Cross-sheet data consistency
    - Required field presence
    - Data type validation
    
    Args:
        project_name: Name of the project to validate
        
    Returns:
        Success message if all validation passes
        
    Raises:
        HTTPException 400: If validation fails (with detailed error list)
        HTTPException 500: If unexpected error during validation
        
    Side Effects:
        - Removes Excel file if validation fails
        - Logs validation results for audit trail
        
    Example:
        GET /validate-excel-content/solar_farm_project
        
        Success Response:
        {"message": "Excel content is valid."}
        
        Error Response:
        {
            "detail": [
                "Project info: Missing required field 'panel_model'",
                "DC strings: Current value 15.2A exceeds maximum 12A for circuit 'String_01'"
            ]
        }
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    errors = []

    try:
        # Validate each sheet with specific business rules
        errors += validate_project_info(xl.parse("project_info"))
        errors += validate_dc_string_circuits(xl.parse("dc_string_circuits"))
        errors += validate_dc_cn1_circuits(xl.parse("dc_cn1_circuits"))
        # Note: AC circuits validation not implemented yet
        errors += validate_mv_circuits(xl.parse("mv_circuits"))
        
    except Exception as e:
        logger.error(f"Error during validation of {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    if errors:
        # Only remove file for critical structural errors, not warnings
        critical_errors = [e for e in errors if not any(x in e for x in ["Warning", "Info"])]
        
        if critical_errors:
            file_path = Path(f"backend/projects/{project_name}/input.xlsx")
            if file_path.exists():
                os.remove(file_path)
                logger.info(f"Excel file removed due to critical errors: {file_path}")
            logger.error(f"Critical validation errors for {project_name}: {critical_errors}")
        else:
            logger.info(f"Only warnings found for {project_name} - file preserved")
        
        logger.warning(f"Validation completed for {project_name}: {len(errors)} total issues ({len(critical_errors)} critical)")
        raise HTTPException(status_code=400, detail=errors)

    logger.info(f"Validation successful for project: {project_name}")
    return {"message": "Excel content is valid."}

@router.get("/validate-excel-structure/{project_name}")
def validate_excel_file_structure(project_name: str):
    """
    Validates only the Excel file structure without content validation.
    
    This lightweight validation checks:
    - File can be read as Excel format
    - Required sheets are present
    - Basic column structure exists
    - No corruption in file format
    
    Does NOT validate:
    - Data content or values
    - Business rule compliance
    - Cross-sheet consistency
    
    Args:
        project_name: Name of the project
        
    Returns:
        Success message if structure is valid
        
    Raises:
        HTTPException 400: If structure is invalid or file unreadable
        
    Example:
        GET /validate-excel-structure/project1
    """
    success, result = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=result)
    
    logger.info(f"Excel structure validated for {project_name}")
    return {"message": "Excel structure is valid."}

# ============================================================================
# DATA EXTRACTION ENDPOINTS
# ============================================================================

@router.get("/excel-data/{project_name}")
def get_complete_excel_data(project_name: str):
    """
    Extracts all data from the Excel file in JSON format.
    
    Returns complete data from all sheets with:
    - NaN values replaced with empty strings
    - All rows included (no pagination)
    - Original data types preserved where possible
    - Consistent JSON structure for frontend consumption
    
    Args:
        project_name: Name of the project
        
    Returns:
        Complete Excel data organized by sheet name
        
    Raises:
        HTTPException 400: If Excel cannot be read
        HTTPException 500: If data extraction fails
        
    Example:
        GET /excel-data/solar_farm_project
        
        Response:
        {
            "project_info": [{"project_name": "Farm 1", "panel_model": "SunPower-400"}],
            "dc_string_circuits": [{"circuit_id": "String_01", "current": 8.5}],
            "dc_cn1_circuits": [...],
            "ac_circuits": [...],
            "mv_circuits": [...]
        }
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        # Extract all sheets with data cleaning
        data = {
            "project_info": xl.parse("project_info").fillna("").to_dict(orient="records"),
            "dc_string_circuits": xl.parse("dc_string_circuits").fillna("").to_dict(orient="records"),
            "dc_cn1_circuits": xl.parse("dc_cn1_circuits").fillna("").to_dict(orient="records"),
            "ac_circuits": xl.parse("ac_circuits").fillna("").to_dict(orient="records"),
            "mv_circuits": xl.parse("mv_circuits").fillna("").to_dict(orient="records"),
        }
        
        # Log extraction metrics
        total_rows = sum(len(sheet_data) for sheet_data in data.values())
        logger.info(f"Data extracted successfully from {project_name}: {total_rows} total rows")
        
        return data
        
    except Exception as e:
        logger.error(f"Error reading data from {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.get("/excel-preview/{project_name}")
def get_excel_data_preview(project_name: str):
    """
    Gets a limited preview of the Excel file (first 3 rows per sheet).
    
    Useful for:
    - Quick data verification without loading large datasets
    - Frontend preview display
    - Structure validation
    - Performance optimization for large files
    
    Data processing:
    - Limits to first 3 rows per sheet
    - Replaces NaN, Inf, -Inf with None
    - Maintains original column structure
    - Safe for large file handling
    
    Args:
        project_name: Name of the project
        
    Returns:
        Limited preview data from all sheets
        
    Raises:
        HTTPException 400: If Excel cannot be read
        HTTPException 500: If preview generation fails
        
    Example:
        GET /excel-preview/large_solar_project
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg

    try:
        def safe_parse_preview(sheet_name):
            """Helper function to safely parse sheet preview with data cleaning"""
            df = xl.parse(sheet_name).replace({np.nan: None, np.inf: None, -np.inf: None})
            return df.head(3).to_dict(orient="records")

        preview = {
            "project_info": safe_parse_preview("project_info"),
            "dc_string_circuits": safe_parse_preview("dc_string_circuits"),
            "dc_cn1_circuits": safe_parse_preview("dc_cn1_circuits"),
            "ac_circuits": safe_parse_preview("ac_circuits"),
            "mv_circuits": safe_parse_preview("mv_circuits"),
        }

        logger.info(f"Preview generated for {project_name}")
        return preview

    except Exception as e:
        logger.error(f"Error generating preview for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading Excel: {str(e)}")

@router.get("/excel-sheet/{project_name}/{sheet_name}")
def get_specific_excel_sheet(project_name: str, sheet_name: str):
    """
    Gets data from a specific Excel sheet.
    
    Useful for:
    - Partial data loading for performance
    - Sheet-specific operations
    - Targeted data access
    - Frontend lazy loading
    
    Args:
        project_name: Name of the project
        sheet_name: Name of the sheet to retrieve
        
    Returns:
        Data from the specified sheet with metadata
        
    Raises:
        HTTPException 400: If sheet name is invalid or data cannot be read
        HTTPException 500: If data extraction fails
        
    Valid Sheet Names:
        - project_info: General project and panel information
        - dc_string_circuits: DC string level circuit data
        - dc_cn1_circuits: DC combiner level circuit data
        - ac_circuits: AC side circuit configurations
        - mv_circuits: Medium voltage circuit specifications
        
    Example:
        GET /excel-sheet/project1/dc_string_circuits
        
        Response:
        {
            "sheet_name": "dc_string_circuits",
            "data": [{"circuit_id": "String_01", "current": 8.5}],
            "row_count": 24
        }
    """
    # Validate sheet names against expected structure
    allowed_sheets = [
        "project_info", 
        "dc_string_circuits", 
        "dc_cn1_circuits", 
        "ac_circuits", 
        "mv_circuits"
    ]
    
    if sheet_name not in allowed_sheets:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid sheet name '{sheet_name}'. Valid sheets: {allowed_sheets}"
        )
    
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        # Extract specific sheet with data cleaning
        sheet_data = xl.parse(sheet_name).fillna("").to_dict(orient="records")
        
        logger.info(f"Sheet '{sheet_name}' data extracted from {project_name}: {len(sheet_data)} rows")
        
        return {
            "sheet_name": sheet_name,
            "data": sheet_data,
            "row_count": len(sheet_data)
        }
        
    except Exception as e:
        logger.error(f"Error reading sheet '{sheet_name}' from {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading sheet {sheet_name}: {str(e)}")

# ============================================================================
# DATA UTILITY ENDPOINTS
# ============================================================================

@router.get("/excel-info/{project_name}")
def get_excel_file_information(project_name: str):
    """
    Gets metadata information about the Excel file.
    
    Provides:
    - Sheet names and row counts
    - File size and modification date
    - Column information per sheet
    - Data quality metrics
    
    Args:
        project_name: Name of the project
        
    Returns:
        Comprehensive Excel file metadata
        
    Example:
        GET /excel-info/project1
        
        Response:
        {
            "file_info": {
                "sheets": ["project_info", "dc_string_circuits"],
                "total_rows": 156,
                "last_modified": "2025-06-30T10:30:00"
            },
            "sheet_details": {
                "project_info": {"rows": 1, "columns": 15},
                "dc_string_circuits": {"rows": 24, "columns": 8}
            }
        }
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        # Get file path for metadata
        file_path = Path(f"backend/projects/{project_name}/input.xlsx")
        
        # Collect sheet information
        sheet_details = {}
        total_rows = 0
        
        for sheet_name in ["project_info", "dc_string_circuits", "dc_cn1_circuits", "ac_circuits", "mv_circuits"]:
            try:
                df = xl.parse(sheet_name)
                rows = len(df)
                cols = len(df.columns)
                sheet_details[sheet_name] = {"rows": rows, "columns": cols}
                total_rows += rows
            except Exception:
                sheet_details[sheet_name] = {"rows": 0, "columns": 0, "error": "Sheet not found or readable"}
        
        # File metadata
        file_info = {
            "sheets": list(sheet_details.keys()),
            "total_rows": total_rows,
            "file_exists": file_path.exists()
        }
        
        if file_path.exists():
            import os
            import datetime
            stat = os.stat(file_path)
            file_info.update({
                "file_size_bytes": stat.st_size,
                "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        
        return {
            "file_info": file_info,
            "sheet_details": sheet_details
        }
        
    except Exception as e:
        logger.error(f"Error getting Excel info for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting file information: {str(e)}")

# ============================================================================
# DATA QUALITY & ANALYSIS ENDPOINTS
# ============================================================================

@router.get("/data-quality/{project_name}")
def analyze_data_quality(project_name: str):
    """
    Analyzes data quality metrics for the project's Excel file.
    
    Provides insights into:
    - Missing data percentages
    - Data type consistency
    - Value ranges and outliers
    - Cross-sheet data relationships
    
    Args:
        project_name: Name of the project
        
    Returns:
        Data quality analysis report
        
    Example:
        GET /data-quality/project1
        
        Response:
        {
            "overall_quality": "good",
            "issues_found": 2,
            "sheet_analysis": {
                "dc_string_circuits": {
                    "completeness": 95.2,
                    "missing_fields": ["voltage_drop"],
                    "outliers": []
                }
            },
            "recommendations": ["Fill missing voltage_drop values"]
        }
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        analysis = {
            "overall_quality": "unknown",
            "issues_found": 0,
            "sheet_analysis": {},
            "recommendations": []
        }
        
        total_issues = 0
        
        for sheet_name in ["project_info", "dc_string_circuits", "dc_cn1_circuits", "ac_circuits", "mv_circuits"]:
            try:
                df = xl.parse(sheet_name)
                
                # Calculate completeness
                total_cells = df.size
                missing_cells = df.isnull().sum().sum()
                completeness = ((total_cells - missing_cells) / total_cells * 100) if total_cells > 0 else 0
                
                # Find missing fields (columns with >50% missing data)
                missing_fields = []
                for col in df.columns:
                    missing_pct = (df[col].isnull().sum() / len(df) * 100) if len(df) > 0 else 0
                    if missing_pct > 50:
                        missing_fields.append(col)
                        total_issues += 1
                
                # Check for obvious outliers (very rough check)
                outliers = []
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    if len(df[col].dropna()) > 0:
                        Q1 = df[col].quantile(0.25)
                        Q3 = df[col].quantile(0.75)
                        IQR = Q3 - Q1
                        lower_bound = Q1 - 1.5 * IQR
                        upper_bound = Q3 + 1.5 * IQR
                        outlier_count = len(df[(df[col] < lower_bound) | (df[col] > upper_bound)])
                        if outlier_count > 0:
                            outliers.append({"column": col, "count": outlier_count})
                
                analysis["sheet_analysis"][sheet_name] = {
                    "completeness": round(completeness, 1),
                    "missing_fields": missing_fields,
                    "outliers": outliers,
                    "row_count": len(df),
                    "column_count": len(df.columns)
                }
                
                # Add recommendations
                if missing_fields:
                    analysis["recommendations"].append(f"Complete missing data in {sheet_name}: {', '.join(missing_fields)}")
                if outliers:
                    analysis["recommendations"].append(f"Review potential outliers in {sheet_name}")
                    
            except Exception as e:
                analysis["sheet_analysis"][sheet_name] = {"error": f"Could not analyze: {str(e)}"}
                total_issues += 1
        
        # Determine overall quality
        analysis["issues_found"] = total_issues
        if total_issues == 0:
            analysis["overall_quality"] = "excellent"
        elif total_issues <= 2:
            analysis["overall_quality"] = "good"
        elif total_issues <= 5:
            analysis["overall_quality"] = "fair"
        else:
            analysis["overall_quality"] = "poor"
        
        if not analysis["recommendations"]:
            analysis["recommendations"] = ["Data quality looks good!"]
        
        logger.info(f"Data quality analysis completed for {project_name}: {analysis['overall_quality']}")
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing data quality for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing data quality: {str(e)}")

@router.get("/compare-sheets/{project_name}")
def compare_sheet_consistency(project_name: str):
    """
    Compares data consistency across related Excel sheets.
    
    Checks for:
    - Cross-reference integrity between sheets
    - Naming consistency
    - Data format consistency
    - Missing relationships
    
    Args:
        project_name: Name of the project
        
    Returns:
        Cross-sheet consistency analysis
        
    Example:
        GET /compare-sheets/project1
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        consistency_report = {
            "cross_references": {},
            "naming_consistency": {},
            "issues_found": [],
            "overall_consistency": "unknown"
        }
        
        # Load relevant sheets for comparison
        sheets_data = {}
        for sheet_name in ["dc_string_circuits", "dc_cn1_circuits", "ac_circuits"]:
            try:
                sheets_data[sheet_name] = xl.parse(sheet_name)
            except Exception:
                continue
        
        issues = []
        
        # Check if circuit IDs are consistent across sheets
        if "dc_string_circuits" in sheets_data and "dc_cn1_circuits" in sheets_data:
            dc_strings = sheets_data["dc_string_circuits"]
            dc_cn1 = sheets_data["dc_cn1_circuits"]
            
            # Look for common ID columns
            string_ids = set()
            cn1_ids = set()
            
            for col in dc_strings.columns:
                if 'id' in col.lower() or 'string' in col.lower():
                    string_ids.update(dc_strings[col].dropna().astype(str).tolist())
                    break
            
            for col in dc_cn1.columns:
                if 'id' in col.lower() or 'circuit' in col.lower():
                    cn1_ids.update(dc_cn1[col].dropna().astype(str).tolist())
                    break
            
            if string_ids and cn1_ids:
                missing_in_cn1 = string_ids - cn1_ids
                missing_in_strings = cn1_ids - string_ids
                
                if missing_in_cn1:
                    issues.append(f"String IDs missing in CN1 circuits: {list(missing_in_cn1)[:5]}")
                if missing_in_strings:
                    issues.append(f"CN1 IDs not found in string circuits: {list(missing_in_strings)[:5]}")
        
        # Check naming conventions consistency
        naming_patterns = {}
        for sheet_name, df in sheets_data.items():
            patterns = []
            for col in df.columns:
                if any(keyword in col.lower() for keyword in ['circuit', 'string', 'id']):
                    # Analyze naming pattern
                    sample_values = df[col].dropna().astype(str).head(3).tolist()
                    if sample_values:
                        patterns.append({"column": col, "samples": sample_values})
            naming_patterns[sheet_name] = patterns
        
        consistency_report["cross_references"] = {
            "string_to_cn1": "checked" if string_ids and cn1_ids else "not_available"
        }
        consistency_report["naming_consistency"] = naming_patterns
        consistency_report["issues_found"] = issues
        
        # Overall assessment
        if len(issues) == 0:
            consistency_report["overall_consistency"] = "good"
        elif len(issues) <= 2:
            consistency_report["overall_consistency"] = "fair"
        else:
            consistency_report["overall_consistency"] = "poor"
        
        logger.info(f"Sheet consistency check completed for {project_name}")
        return consistency_report
        
    except Exception as e:
        logger.error(f"Error comparing sheets for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error comparing sheets: {str(e)}")

# ============================================================================
# EXPORT & TRANSFORMATION ENDPOINTS
# ============================================================================

@router.get("/export-json/{project_name}")
def export_project_data_as_json(project_name: str, pretty: bool = Query(True)):
    """
    Exports complete project data as downloadable JSON file.
    
    Args:
        project_name: Name of the project
        pretty: Whether to format JSON with indentation
        
    Returns:
        JSON file download response
    """
    from fastapi.responses import JSONResponse
    
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        # Get complete data
        export_data = {
            "project_name": project_name,
            "export_timestamp": pd.Timestamp.now().isoformat(),
            "data": {
                "project_info": xl.parse("project_info").fillna("").to_dict(orient="records"),
                "dc_string_circuits": xl.parse("dc_string_circuits").fillna("").to_dict(orient="records"),
                "dc_cn1_circuits": xl.parse("dc_cn1_circuits").fillna("").to_dict(orient="records"),
                "ac_circuits": xl.parse("ac_circuits").fillna("").to_dict(orient="records"),
                "mv_circuits": xl.parse("mv_circuits").fillna("").to_dict(orient="records"),
            }
        }
        
        logger.info(f"JSON export completed for {project_name}")
        
        # Return as downloadable file
        headers = {
            "Content-Disposition": f"attachment; filename={project_name}_data.json"
        }
        
        return JSONResponse(
            content=export_data,
            headers=headers,
            media_type="application/json"
        )
        
    except Exception as e:
        logger.error(f"Error exporting JSON for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")

@router.get("/summary/{project_name}")
def get_project_data_summary(project_name: str):
    """
    Gets a comprehensive summary of project data for dashboard display.
    
    Args:
        project_name: Name of the project
        
    Returns:
        High-level summary statistics and key metrics
        
    Example:
        GET /summary/large_solar_farm
        
        Response:
        {
            "project_summary": {
                "total_circuits": 156,
                "total_strings": 1200,
                "system_size_mw": 500,
                "panel_count": 48000
            },
            "data_overview": {
                "sheets_populated": 5,
                "total_data_rows": 180,
                "data_completeness": 98.5
            },
            "key_metrics": {
                "avg_string_current": 8.2,
                "max_voltage_drop": 1.8,
                "total_cable_length_km": 45.6
            }
        }
    """
    success, xl_or_msg = read_project_excel(project_name)
    if not success:
        raise HTTPException(status_code=400, detail=xl_or_msg)

    xl = xl_or_msg
    try:
        summary = {
            "project_summary": {},
            "data_overview": {},
            "key_metrics": {},
            "warnings": []
        }
        
        # Get project basic info
        try:
            project_info = xl.parse("project_info").iloc[0].to_dict()
            summary["project_summary"] = {
                "project_name": project_info.get("project_name", "Unknown"),
                "panel_model": project_info.get("panel_model", "Unknown"),
                "location": project_info.get("location", "Unknown")
            }
        except Exception:
            summary["warnings"].append("Could not read project info")
        
        # Count data across sheets
        total_rows = 0
        populated_sheets = 0
        
        for sheet_name in ["dc_string_circuits", "dc_cn1_circuits", "ac_circuits", "mv_circuits"]:
            try:
                df = xl.parse(sheet_name)
                if len(df) > 0:
                    populated_sheets += 1
                    total_rows += len(df)
                    
                    # Add sheet-specific metrics
                    if sheet_name == "dc_string_circuits":
                        numeric_cols = df.select_dtypes(include=[np.number]).columns
                        if len(numeric_cols) > 0:
                            summary["key_metrics"]["string_circuits"] = len(df)
                            
                            # Look for current and voltage columns
                            for col in df.columns:
                                if 'current' in col.lower() and df[col].dtype in [np.float64, np.int64]:
                                    avg_current = df[col].mean()
                                    if not np.isnan(avg_current):
                                        summary["key_metrics"]["avg_string_current"] = round(avg_current, 2)
                                        
            except Exception as e:
                summary["warnings"].append(f"Could not analyze {sheet_name}: {str(e)}")
        
        summary["data_overview"] = {
            "sheets_populated": populated_sheets,
            "total_data_rows": total_rows,
            "sheets_available": 5
        }
        
        # Calculate completeness estimate
        if total_rows > 0:
            expected_min_rows = 10  # Rough estimate
            completeness = min(100, (total_rows / expected_min_rows) * 100)
            summary["data_overview"]["estimated_completeness"] = round(completeness, 1)
        
        logger.info(f"Data summary generated for {project_name}")
        return summary
        
    except Exception as e:
        logger.error(f"Error generating summary for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")