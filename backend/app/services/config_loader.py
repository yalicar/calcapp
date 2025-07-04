import os
import yaml
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Paths de configuración
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIGS_DIR = BASE_DIR / "configs"

NORMATIVAS_PATH = CONFIGS_DIR / "normativas.yaml"
PANELS_PATH = CONFIGS_DIR / "panel_database.yaml"

def load_yaml_config(file_path: str) -> dict:
    """Función legacy para compatibilidad"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Config file not found: {file_path}")
    
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)

def load_panel_database() -> Dict[str, Any]:
    """Carga la base de datos de paneles"""
    try:
        with open(PANELS_PATH, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        
        logger.info(f"Base de datos de paneles cargada exitosamente desde {PANELS_PATH}")
        return config
    
    except FileNotFoundError:
        logger.error(f"Base de datos de paneles no encontrada: {PANELS_PATH}")
        raise FileNotFoundError(f"Panel database not found at {PANELS_PATH}")
    except yaml.YAMLError as e:
        logger.error(f"Error parseando YAML de paneles: {e}")
        raise ValueError(f"Error parsing panels YAML: {e}")

def get_panel_data(panel_model: str) -> Dict[str, Any]:
    """
    Obtiene los datos de un panel específico
    
    Args:
        panel_model: Modelo del panel según aparece en project_info
        
    Returns:
        Diccionario con los parámetros del panel
    """
    try:
        panel_db = load_panel_database()
        panels = panel_db.get('panels', {})
        
        if panel_model not in panels:
            available_panels = list(panels.keys())
            logger.warning(f"Panel '{panel_model}' no encontrado. Disponibles: {available_panels}")
            
            # Retornar panel personalizado como fallback
            if "Panel Personalizado" in panels:
                logger.info("Usando panel personalizado como fallback")
                return panels["Panel Personalizado"]
            else:
                raise ValueError(f"Panel '{panel_model}' no encontrado y no hay fallback disponible")
        
        panel_data = panels[panel_model].copy()
        logger.info(f"Datos del panel '{panel_model}' cargados exitosamente")
        return panel_data
    
    except Exception as e:
        logger.error(f"Error obteniendo datos del panel '{panel_model}': {e}")
        raise

def load_normativas_config() -> Dict[str, Any]:
    """Carga las configuraciones de normativas"""
    try:
        with open(NORMATIVAS_PATH, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        
        logger.info(f"Normativas cargadas exitosamente desde {NORMATIVAS_PATH}")
        return config
    
    except FileNotFoundError:
        logger.error(f"Archivo de normativas no encontrado: {NORMATIVAS_PATH}")
        raise FileNotFoundError(f"Normativas config file not found at {NORMATIVAS_PATH}")
    except yaml.YAMLError as e:
        logger.error(f"Error parseando YAML de normativas: {e}")
        raise ValueError(f"Error parsing normativas YAML: {e}")

def get_available_normativas() -> Dict[str, str]:
    """Obtiene la lista de normativas disponibles"""
    try:
        config = load_normativas_config()
        normativas = {}
        
        for key, value in config.get('normativas', {}).items():
            normativas[key] = {
                'name': value.get('name', key),
                'description': value.get('description', ''),
                'country': value.get('country', '')
            }
        
        return normativas
    
    except Exception as e:
        logger.error(f"Error obteniendo normativas: {e}")
        return {
            'IEC': {'name': 'IEC (Fallback)', 'description': 'Configuración por defecto', 'country': 'Internacional'},
            'PERSONALIZADA': {'name': 'Personalizada (Fallback)', 'description': 'Configuración personalizada', 'country': 'Personalizado'}
        }

# En tu archivo app/services/config_loader.py
# Buscar la función get_normativa_config y cambiar el final:

def get_normativa_config(normativa: str, project_name: str = None) -> Dict[str, Any]:
    """
    Obtiene la configuración de una normativa específica, 
    con soporte para overrides por proyecto
    """
    try:
        config = load_normativas_config()
        normativas = config.get('normativas', {})
        
        if normativa not in normativas:
            available = list(normativas.keys())
            raise ValueError(f"Normativa '{normativa}' no encontrada. Disponibles: {available}")
        
        normativa_config = normativas[normativa].copy()
        
        # Agregar metadatos útiles
        normativa_config['_metadata'] = {
            'normativa_key': normativa,
            'loaded_at': 'runtime',
            'editable_parameters': config.get('metadata', {}).get('editable_parameters', {}),
            'valid_values': config.get('metadata', {}).get('valid_values', {}),
            'parameter_ranges': config.get('metadata', {}).get('parameter_ranges', {}),
            'has_project_overrides': False,
            'project_name': project_name
        }
        
        # Si hay proyecto, intentar cargar overrides
        if project_name:
            try:
                from app.services.loader.project_norm_service import project_norm_service
                
                if project_norm_service.has_project_overrides(project_name):
                    overrides = project_norm_service.load_project_overrides(project_name)
                    if overrides:
                        # Aplicar overrides a la configuración base
                        normativa_config = apply_overrides_to_config(normativa_config, overrides.modified_parameters)
                        normativa_config['_metadata']['has_project_overrides'] = True
                        normativa_config['_metadata']['overrides_info'] = {
                            'last_modified': overrides.last_modified,
                            'base_norm': overrides.base_norm,
                            'modified_count': len(overrides.modified_parameters)
                        }
                        logger.info(f"Overrides aplicados para proyecto {project_name}: {len(overrides.modified_parameters)} parámetros")
                        
            except Exception as e:
                logger.warning(f"No se pudieron cargar overrides para proyecto {project_name}: {e}")
        
        logger.info(f"Configuración de normativa '{normativa}' cargada exitosamente")
        return normativa_config
    
    except Exception as e:
        logger.error(f"Error cargando configuración de normativa '{normativa}': {e}")
        raise  # ← AGREGAR ESTA LÍNEA

def build_calculation_config(
    project_info: Dict[str, Any], 
    normativa: str = "IEC", 
    project_name: str = None,  # ← NUEVO parámetro
    custom_params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Construye la configuración completa para cálculos combinando:
    1. Datos del panel (desde project_info + panel_database)
    2. Configuración de normativa (base + overrides del proyecto)
    3. Parámetros personalizados (opcional, legacy)
    
    Args:
        project_info: Datos del proyecto (incluye panel_model)
        normativa: Normativa a usar (IEC, NEC, PERSONALIZADA)
        project_name: Nombre del proyecto (para cargar overrides)
        custom_params: Parámetros personalizados opcionales (legacy)
        
    Returns:
        Configuración completa para cálculos
    """
    try:
        # 1. Obtener datos del panel
        panel_model = project_info.get('panel_model', 'Panel Personalizado')
        panel_data = get_panel_data(panel_model)
        
        # 2. Obtener configuración de normativa (base + overrides del proyecto)
        normativa_config = get_normativa_config(normativa, project_name)
        
        # 3. Construir configuración combinada
        combined_config = {
            # Parámetros del panel (desde base de datos)
            "isc_ref": panel_data['electrical_stc']['isc'],
            "voc_ref": panel_data['electrical_stc']['voc'],
            "power_stc": panel_data['power_stc'],
            
            # Factores normativos (pueden venir de overrides del proyecto)
            "isc_correction": normativa_config['correction_factors']['isc_safety_factor'],
            "number_of_parallel_strings": normativa_config['correction_factors']['parallel_strings'],
            
            # Configuración de cable (puede venir de overrides del proyecto)
            "cable": normativa_config['cable'].copy(),
            
            # Configuración de instalación (puede venir de overrides del proyecto)
            "installation": normativa_config['installation'].copy(),
            
            # Factores de corrección (pueden venir de overrides del proyecto)
            "correction_factors": {
                "ambient_temperature": {
                    "current_ambient": normativa_config['temperature_correction']['ambient_design'],
                    "values": normativa_config['temperature_correction']['values']
                },
                "grouping": normativa_config['grouping_factors']
            },
            
            # Caída de tensión (puede venir de overrides del proyecto)
            "voltage_drop": normativa_config['voltage_drop'].copy(),
            
            # Metadatos
            "_metadata": {
                "panel_model": panel_model,
                "panel_data": panel_data,
                "normativa": normativa,
                "normativa_config": normativa_config['_metadata'],
                "has_custom_params": custom_params is not None,
                "project_info": project_info,
                "project_name": project_name
            }
        }
        
        # 4. Aplicar parámetros personalizados si existen (legacy)
        if custom_params:
            combined_config = merge_custom_params(combined_config, custom_params)
        
        # ✅ AGREGAR ESTE BLOQUE AQUÍ
        if project_name:
            combined_config["project_name"] = project_name
            if "_metadata" not in combined_config:
                combined_config["_metadata"] = {}
            combined_config["_metadata"]["project_name"] = project_name
            logger.info(f"🔧 Project name agregado al config: {project_name}")
        
        has_overrides = normativa_config['_metadata'].get('has_project_overrides', False)
        logger.info(f"Configuración de cálculo construida exitosamente para panel {panel_model} con normativa {normativa}" + 
                   (f" (con {len(normativa_config['_metadata'].get('overrides_info', {}).get('modified_count', 0))} overrides del proyecto)" if has_overrides else ""))
        
        return combined_config
        
    except Exception as e:
        logger.error(f"Error construyendo configuración de cálculo: {e}")
        raise

def merge_custom_params(base_config: Dict[str, Any], custom_params: Dict[str, Any]) -> Dict[str, Any]:
    """Combina configuración base con parámetros personalizados"""
    try:
        import copy
        merged_config = copy.deepcopy(base_config)
        
        # Mapeo de parámetros editables
        param_mapping = {
            # Cable (editables)
            'cable_material': ['cable', 'material'],
            'cable_max_temp': ['cable', 'max_temp'],
            'cable_type': ['cable', 'type'],
            
            # Instalación (editables)
            'method': ['installation', 'method'],
            'layout': ['installation', 'layout'],
            'depth_cm': ['installation', 'depth_cm'],
            'separation': ['installation', 'separation'],
            
            # Temperatura (editable)
            'current_ambient': ['correction_factors', 'ambient_temperature', 'current_ambient'],
            
            # Tensión (editable)
            'reference_voltage': ['voltage_drop', 'reference_voltage'],
            'max_voltage_drop_pct': ['voltage_drop', 'max_percentage'],
            
            # Factores de seguridad (editables)
            'isc_correction': ['isc_correction'],
            'number_of_parallel_strings': ['number_of_parallel_strings'],
        }
        
        # Aplicar parámetros personalizados
        for param_key, param_value in custom_params.items():
            if param_key in param_mapping:
                path = param_mapping[param_key]
                current_level = merged_config
                
                # Navegar hasta el penúltimo nivel
                for key in path[:-1]:
                    if key not in current_level:
                        current_level[key] = {}
                    current_level = current_level[key]
                
                # Asignar el valor final
                current_level[path[-1]] = param_value
                logger.debug(f"Parámetro personalizado aplicado: {param_key} = {param_value}")
            else:
                logger.warning(f"Parámetro personalizado no reconocido: {param_key}")
        
        # Marcar como personalizado
        merged_config['_metadata']['custom_params'] = custom_params
        merged_config['_metadata']['is_custom'] = True
        
        return merged_config
    
    except Exception as e:
        logger.error(f"Error aplicando parámetros personalizados: {e}")
        raise

def get_available_panels() -> Dict[str, str]:
    """Obtiene la lista de paneles disponibles en la base de datos"""
    try:
        panel_db = load_panel_database()
        panels = {}
        
        for key, value in panel_db.get('panels', {}).items():
            panels[key] = {
                'manufacturer': value.get('manufacturer', ''),
                'model': value.get('model', key),
                'power': value.get('power_stc', 0),
                'technology': value.get('technology', '')
            }
        
        return panels
    
    except Exception as e:
        logger.error(f"Error obteniendo paneles disponibles: {e}")
        return {"Panel Personalizado": {"manufacturer": "Personalizado", "model": "Definido por usuario", "power": 400}}

# Agregar al final de backend/app/services/config_loader.py

def format_norm_parameters_for_ui(normativa: str) -> Dict[str, Any]:
    """
    Formatea los parámetros de una normativa para la UI de configuración
    
    Args:
        normativa: Nombre de la normativa (IEC, NEC, PERSONALIZADA)
        
    Returns:
        Diccionario estructurado para la UI de parámetros
    """
    try:
        # Usar las funciones existentes
        normativa_config = get_normativa_config(normativa)
        norm_data = load_normativas_config()
        metadata = norm_data.get('metadata', {})
        
        # Formatear secciones editables
        editable_sections = _build_editable_sections(normativa_config, metadata)
        
        # Formatear factores de agrupamiento
        grouping_factors = _build_grouping_factors_info(normativa_config)
        
        # Formatear secciones estándar
        standard_sections = _build_standard_sections_info(normativa_config)
        
        return {
            "norm_name": normativa,
            "display_name": normativa_config['name'],
            "description": normativa_config['description'],
            "country": normativa_config['country'],
            "editable_sections": editable_sections,
            "grouping_factors": grouping_factors,
            "standard_sections": standard_sections,
            "metadata": {
                'version': metadata.get('version'),
                'last_updated': metadata.get('last_updated'),
                'standards_reference': normativa_config.get('standards_reference', {})
            }
        }
        
    except Exception as e:
        logger.error(f"Error formateando parámetros de UI para {normativa}: {e}")
        raise

def _build_editable_sections(normativa_config: Dict, metadata: Dict) -> Dict[str, Dict]:
    """Construye las secciones editables para la UI"""
    sections = {}
    
    # Parámetros básicos
    sections['basic'] = {
        "title": "Parámetros Básicos",
        "parameters": {
            'isc_safety_factor': {
                "value": normativa_config['correction_factors']['isc_safety_factor'],
                "label": "Factor de seguridad Isc",
                "description": "Factor de seguridad normativo para corriente de cortocircuito",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('isc_safety_factor', [1.0, 2.0]),
                "unit": ""
            },
            'parallel_strings': {
                "value": normativa_config['correction_factors']['parallel_strings'],
                "label": "Strings en paralelo",
                "description": "Número de strings por cálculo",
                "type": "integer",
                "range": metadata.get('parameter_ranges', {}).get('parallel_strings', [1, 20]),
                "unit": ""
            }
        }
    }
    
    # Configuración de cable
    sections['cable'] = {
        "title": "Configuración de Cable",
        "parameters": {
            'material': {
                "value": normativa_config['cable']['material'],
                "label": "Material del conductor",
                "description": "Material del cable conductor",
                "type": "select",
                "options": metadata.get('valid_values', {}).get('cable_material', ['copper', 'aluminum']),
                "unit": ""
            },
            'insulation': {
                "value": normativa_config['cable']['insulation'],
                "label": "Tipo de aislamiento",
                "description": "Material de aislamiento del cable",
                "type": "select",
                "options": metadata.get('valid_values', {}).get('cable_insulation', ['PVC', 'XLPE', 'EPR']),
                "unit": ""
            },
            'max_temp': {
                "value": normativa_config['cable']['max_temp'],
                "label": "Temperatura máxima",
                "description": "Temperatura máxima del conductor",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('max_temp', [60, 120]),
                "unit": "°C"
            }
        }
    }
    
    # Método de instalación
    sections['installation'] = {
        "title": "Método de Instalación",
        "parameters": {
            'method': {
                "value": normativa_config['installation']['method'],
                "label": "Método de instalación",
                "description": "Forma de instalación del cable",
                "type": "select",
                "options": metadata.get('valid_values', {}).get('installation_method', 
                        ['buried', 'tray_perforated', 'tray_non_perforated', 'conduit']),
                "unit": ""
            },
            'depth_cm': {
                "value": normativa_config['installation']['depth_cm'],
                "label": "Profundidad de enterrado",
                "description": f"Profundidad mínima de enterrado",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('depth_cm', [30, 150]),
                "unit": "cm",
                "depends_on": "method",
                "visible_when": "buried"
            },
            'layout': {
                "value": normativa_config['installation']['layout'],
                "label": "Disposición de cables",
                "description": "Configuración de capas de cables",
                "type": "select",
                "options": metadata.get('valid_values', {}).get('layout', ['single_layer', 'multilayer']),
                "unit": ""
            }
        }
    }
    
    # Temperatura
    sections['temperature'] = {
        "title": "Parámetros de Temperatura",
        "parameters": {
            'ambient_design': {
                "value": normativa_config['temperature_correction']['ambient_design'],
                "label": "Temperatura ambiente de diseño",
                "description": "Temperatura ambiente para diseño",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('ambient_design', [15, 70]),
                "unit": "°C"
            }
        }
    }
    
    # Caída de tensión
    sections['voltage'] = {
        "title": "Caída de Tensión",
        "parameters": {
            'max_percentage': {
                "value": normativa_config['voltage_drop']['max_percentage'],
                "label": "Caída máxima permitida",
                "description": "Máxima caída de tensión permitida",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('max_percentage', [0.5, 5.0]),
                "unit": "%"
            },
            'reference_voltage': {
                "value": normativa_config['voltage_drop']['reference_voltage'],
                "label": "Tensión de referencia",
                "description": "Tensión de referencia para cálculos",
                "type": "number",
                "range": metadata.get('parameter_ranges', {}).get('reference_voltage', [400, 2000]),
                "unit": "V"
            }
        }
    }
    
    # Factores de seguridad
    sections['safety'] = {
        "title": "Factores de Seguridad",
        "parameters": {
            'current_safety': {
                "value": normativa_config['safety_factors']['current_safety'],
                "label": "Factor de seguridad adicional - corriente",
                "description": "Factor de seguridad adicional para corriente",
                "type": "number",
                "range": [1.0, 2.0],
                "unit": ""
            },
            'voltage_safety': {
                "value": normativa_config['safety_factors']['voltage_safety'],
                "label": "Factor de seguridad adicional - tensión",
                "description": "Factor de seguridad adicional para tensión",
                "type": "number",
                "range": [1.0, 2.0],
                "unit": ""
            }
        }
    }
    
    return sections

def _build_grouping_factors_info(normativa_config: Dict) -> Dict[str, Any]:
    """Construye la información de factores de agrupamiento"""
    installation = normativa_config['installation']
    grouping = normativa_config['grouping_factors']
    
    method = installation['method']
    layout = installation.get('layout')
    
    # Obtener factores según método y layout
    if method in grouping:
        if layout and layout in grouping[method]:
            factors_data = grouping[method][layout]['values']
        else:
            factors_data = grouping[method].get('values', {})
    else:
        factors_data = {}
    
    return {
        "current_method": method,
        "current_layout": layout,
        "available_groupings": list(factors_data.keys()),
        "factors": factors_data
    }

def _build_standard_sections_info(normativa_config: Dict) -> Dict[str, Dict]:
    """Construye la información de secciones estándar"""
    sections = {}
    
    for circuit_type, section_data in normativa_config['standard_sections'].items():
        sections[circuit_type] = {
            "available": section_data['mm2'],
            "description": section_data['description'],
            "typical_range": section_data['typical_current_range'],
            "max_length": section_data['max_recommended_length']
        }
    
    return sections

def apply_overrides_to_config(base_config: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aplica overrides del proyecto a la configuración base de normativa
    
    Args:
        base_config: Configuración base de la normativa
        overrides: Overrides del proyecto en formato de paths con puntos
        
    Returns:
        Configuración con overrides aplicados
    """
    import copy
    result = copy.deepcopy(base_config)
    
    for param_path, new_value in overrides.items():
        try:
            # Convertir path de UI a path de configuración
            config_path = convert_ui_path_to_config_path(param_path)
            set_nested_parameter(result, config_path, new_value)
            logger.debug(f"Override aplicado: {param_path} -> {config_path} = {new_value}")
        except Exception as e:
            logger.warning(f"No se pudo aplicar override {param_path} = {new_value}: {e}")
    
    return result

def convert_ui_path_to_config_path(ui_path: str) -> str:
    """
    Convierte paths de UI a paths de configuración de normativa
    
    Ejemplos:
    - 'editable_sections.cable.parameters.material.value' -> 'cable.material'
    - 'editable_sections.voltage.parameters.max_percentage.value' -> 'voltage_drop.max_percentage'
    """
    # Mapeo de paths de UI a paths de configuración
    path_mapping = {
        # Parámetros básicos
        'editable_sections.basic.parameters.isc_safety_factor.value': 'correction_factors.isc_safety_factor',
        'editable_sections.basic.parameters.parallel_strings.value': 'correction_factors.parallel_strings',
        
        # Cable
        'editable_sections.cable.parameters.material.value': 'cable.material',
        'editable_sections.cable.parameters.insulation.value': 'cable.insulation',
        'editable_sections.cable.parameters.max_temp.value': 'cable.max_temp',
        
        # Instalación
        'editable_sections.installation.parameters.method.value': 'installation.method',
        'editable_sections.installation.parameters.depth_cm.value': 'installation.depth_cm',
        'editable_sections.installation.parameters.layout.value': 'installation.layout',
        
        # Temperatura
        'editable_sections.temperature.parameters.ambient_design.value': 'temperature_correction.ambient_design',
        
        # Tensión
        'editable_sections.voltage.parameters.max_percentage.value': 'voltage_drop.max_percentage',
        'editable_sections.voltage.parameters.reference_voltage.value': 'voltage_drop.reference_voltage',
        
        # Seguridad
        'editable_sections.safety.parameters.current_safety.value': 'safety_factors.current_safety',
        'editable_sections.safety.parameters.voltage_safety.value': 'safety_factors.voltage_safety',
    }
    
    return path_mapping.get(ui_path, ui_path)

def set_nested_parameter(config_dict: Dict[str, Any], param_path: str, value: Any):
    """
    Establece un parámetro anidado usando notación de puntos
    
    Ejemplo: 'cable.material' = 'aluminum'
    """
    keys = param_path.split('.')
    current = config_dict
    
    # Navegar hasta el penúltimo nivel
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    
    # Establecer el valor final
    current[keys[-1]] = value