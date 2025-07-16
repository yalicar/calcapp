# backend/services/project_loader.py

import pandas as pd
from typing import Dict, Any
import logging

from app.services.parsing.parser import read_project_excel


logger = logging.getLogger(__name__)

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