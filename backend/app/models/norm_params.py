# backend/app/models/norm_params.py
from pydantic import BaseModel
from typing import Dict, List, Optional, Union, Any

class ParameterInfo(BaseModel):
    value: Union[str, int, float, bool]
    label: str
    description: str
    type: str  # "number", "integer", "select", "boolean"
    unit: Optional[str] = ""
    range: Optional[List[Union[int, float]]] = None
    options: Optional[List[str]] = None
    depends_on: Optional[str] = None
    visible_when: Optional[str] = None

class ParameterSection(BaseModel):
    title: str
    parameters: Dict[str, ParameterInfo]

class GroupingFactorInfo(BaseModel):
    current_method: str
    current_layout: Optional[str] = None
    available_groupings: List[Union[int, str]]
    factors: Dict[str, float]

class StandardSectionInfo(BaseModel):
    available: List[int]
    description: str
    typical_range: str
    max_length: str

class NormParametersResponse(BaseModel):
    norm_name: str
    display_name: str
    description: str
    country: str
    editable_sections: Dict[str, ParameterSection]
    grouping_factors: GroupingFactorInfo
    standard_sections: Dict[str, StandardSectionInfo]
    metadata: Dict[str, Any]
    has_project_overrides: bool = False
    project_name: Optional[str] = None

# Modelo para guardar/cargar overrides del proyecto
class ProjectNormOverrides(BaseModel):
    project_name: str
    base_norm: str  # IEC, NEC, PERSONALIZADA
    modified_parameters: Dict[str, Any]
    last_modified: str
    version: str = "1.0"

# Modelo para recibir parámetros editados del frontend
class SaveNormParametersRequest(BaseModel):
    base_norm: str
    modified_parameters: Dict[str, Any]