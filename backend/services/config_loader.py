import os
import yaml
from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Paths de configuración
NORMATIVAS_PATH = os.path.join(os.path.dirname(__file__), '..', 'configs', 'normativas.yaml')
PANELS_PATH = os.path.join(os.path.dirname(__file__), '..', 'configs', 'panel_database.yaml')

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

def get_normativa_config(normativa: str) -> Dict[str, Any]:
    """Obtiene la configuración de una normativa específica"""
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
            'parameter_ranges': config.get('metadata', {}).get('parameter_ranges', {})
        }
        
        logger.info(f"Configuración de normativa '{normativa}' cargada exitosamente")
        return normativa_config
    
    except Exception as e:
        logger.error(f"Error cargando configuración de normativa '{normativa}': {e}")
        raise

def build_calculation_config(
    project_info: Dict[str, Any], 
    normativa: str = "IEC", 
    custom_params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Construye la configuración completa para cálculos combinando:
    1. Datos del panel (desde project_info + panel_database)
    2. Configuración de normativa
    3. Parámetros personalizados (opcional)
    
    Args:
        project_info: Datos del proyecto (incluye panel_model)
        normativa: Normativa a usar (IEC, NEC, PERSONALIZADA)
        custom_params: Parámetros personalizados opcionales
        
    Returns:
        Configuración completa para cálculos
    """
    try:
        # 1. Obtener datos del panel
        panel_model = project_info.get('panel_model', 'Panel Personalizado')
        panel_data = get_panel_data(panel_model)
        
        # 2. Obtener configuración de normativa
        normativa_config = get_normativa_config(normativa)
        
        # 3. Construir configuración combinada
        combined_config = {
            # Parámetros del panel (desde base de datos)
            "isc_ref": panel_data['electrical_stc']['isc'],
            "voc_ref": panel_data['electrical_stc']['voc'],
            "power_stc": panel_data['power_stc'],
            
            # Factores normativos
            "isc_correction": normativa_config['correction_factors']['isc_safety_factor'],
            "number_of_parallel_strings": normativa_config['correction_factors']['parallel_strings'],
            
            # Configuración de cable (desde normativa, editable)
            "cable": normativa_config['cable'].copy(),
            
            # Configuración de instalación (desde normativa, editable)
            "installation": normativa_config['installation'].copy(),
            
            # Factores de corrección (desde normativa) - FORMATO CORRECTO
            "correction_factors": {
                "ambient_temperature": {
                    "current_ambient": normativa_config['temperature_correction']['ambient_design'],
                    "values": normativa_config['temperature_correction']['values']
                },
                "grouping": normativa_config['grouping_factors']  # Este era el que faltaba
            },
            
            # Caída de tensión (desde normativa, editable)
            "voltage_drop": normativa_config['voltage_drop'].copy(),
            
            # Metadatos
            "_metadata": {
                "panel_model": panel_model,
                "panel_data": panel_data,
                "normativa": normativa,
                "normativa_config": normativa_config['_metadata'],
                "has_custom_params": custom_params is not None,
                "project_info": project_info
            }
        }
        
        # 4. Aplicar parámetros personalizados si existen
        if custom_params:
            combined_config = merge_custom_params(combined_config, custom_params)
        
        logger.info(f"Configuración de cálculo construida exitosamente para panel {panel_model} con normativa {normativa}")
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