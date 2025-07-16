import yaml
import math
import json
from pathlib import Path
import pandas as pd
from typing import Dict, List, Optional
import logging
import os
from datetime import datetime
from copy import deepcopy

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar configuración global
from app.services.config_loader import load_yaml_config

def load_custom_normativa_fixed(override_file: str, base_normativa: str = "IEC"):
    """
    ✅ FUNCIÓN CRÍTICA FALTANTE: Carga normativa personalizada manteniendo estructura completa
    """
    try:
        # 1. Cargar normativa base completa
        with open("configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        
        if base_normativa not in yaml_data["normativas"]:
            logger.error(f"Normativa base '{base_normativa}' no encontrada")
            return None
        
        # 2. Clonar normativa base (estructura completa)
        custom_config = deepcopy(yaml_data["normativas"][base_normativa])
        custom_config["name"] = f"{custom_config['name']} (Personalizada)"
        custom_config["description"] = f"Basada en {base_normativa} con modificaciones personalizadas"
        
        # 3. Cargar overrides del JSON
        try:
            with open(override_file) as f:
                overrides = json.load(f)
        except FileNotFoundError:
            logger.warning(f"Archivo de overrides '{override_file}' no encontrado, usando base")
            return custom_config
        
        # 4. Aplicar modificaciones manteniendo estructura
        if "modified_parameters" in overrides:
            modifications = overrides["modified_parameters"]
            
            # Mapear parámetros del JSON a estructura YAML
            parameter_mapping = {
                "editable_sections.basic.parameters.isc_safety_factor.value": 
                    ["correction_factors", "isc_safety_factor"],
                "editable_sections.basic.parameters.parallel_strings.value": 
                    ["correction_factors", "parallel_strings"],
                "editable_sections.cable.parameters.material.value": 
                    ["cable", "material"],
                "editable_sections.cable.parameters.insulation.value": 
                    ["cable", "insulation"],
                "editable_sections.cable.parameters.max_temp.value": 
                    ["cable", "max_temp"],
                "editable_sections.installation.parameters.method.value": 
                    ["installation", "method"],
                "editable_sections.installation.parameters.depth_cm.value": 
                    ["installation", "depth_cm"],
                "editable_sections.installation.parameters.layout.value": 
                    ["installation", "layout"],
                "editable_sections.temperature.parameters.ambient_design.value": 
                    ["temperature_correction", "ambient_design"],
                "editable_sections.voltage.parameters.max_percentage.value": 
                    ["voltage_drop", "max_percentage"],
                "editable_sections.voltage.parameters.reference_voltage.value": 
                    ["voltage_drop", "reference_voltage"],
                "editable_sections.safety.parameters.current_safety.value": 
                    ["safety_factors", "current_safety"],
                "editable_sections.safety.parameters.voltage_safety.value": 
                    ["safety_factors", "voltage_safety"]
            }
            
            # Aplicar cada modificación
            for json_path, value in modifications.items():
                if json_path in parameter_mapping:
                    yaml_path = parameter_mapping[json_path]
                    
                    # Navegar y actualizar la estructura anidada
                    current_dict = custom_config
                    for key in yaml_path[:-1]:
                        if key not in current_dict:
                            current_dict[key] = {}
                        current_dict = current_dict[key]
                    
                    # Actualizar valor final
                    current_dict[yaml_path[-1]] = value
                    logger.info(f"Aplicado override: {json_path} -> {yaml_path} = {value}")
                else:
                    logger.warning(f"Parámetro no mapeado: {json_path}")
        
        logger.info(f"Normativa personalizada cargada exitosamente basada en {base_normativa}")
        return custom_config
        
    except Exception as e:
        logger.error(f"Error cargando normativa personalizada: {e}")
        return None

def validate_custom_normativa_structure(config: dict) -> bool:
    """
    ✅ FUNCIÓN CRÍTICA FALTANTE: Valida que la normativa personalizada tenga estructura completa
    """
    required_sections = [
        "temperature_correction",
        "grouping_factors", 
        "standard_sections",
        "voltage_drop"
    ]
    
    missing_sections = []
    for section in required_sections:
        if section not in config:
            missing_sections.append(section)
    
    if missing_sections:
        logger.error(f"Normativa personalizada incompleta. Faltan secciones: {missing_sections}")
        return False
    
    # Validar que grouping_factors tenga estructura correcta
    grouping = config.get("grouping_factors", {})
    if not grouping:
        logger.error("grouping_factors vacío en normativa personalizada")
        return False
    
    # Verificar que al menos un método tenga valores
    has_valid_method = False
    for method, method_data in grouping.items():
        if isinstance(method_data, dict):
            if "values" in method_data and method_data["values"]:
                has_valid_method = True
                break
            # Verificar estructura anidada (layout)
            for layout, layout_data in method_data.items():
                if isinstance(layout_data, dict) and "values" in layout_data and layout_data["values"]:
                    has_valid_method = True
                    break
    
    if not has_valid_method:
        logger.error("No se encontraron factores de agrupamiento válidos en normativa personalizada")
        return False
    
    logger.info("Estructura de normativa personalizada validada correctamente")
    return True

def diagnose_normativa_structure(normativa_name: str = None) -> dict:
    """
    ✅ FUNCIÓN CRÍTICA FALTANTE: Diagnostica la estructura de la normativa activa
    """
    if not normativa_name:
        normativa_name = SECTIONS_CONFIG.get("normativa_used", "IEC")
    
    diagnosis = {
        "normativa": normativa_name,
        "status": "OK",
        "errors": [],
        "warnings": [],
        "structure_check": {}
    }
    
    try:
        config = get_normativa_config_fixed(normativa_name)
        
        # Verificar secciones críticas
        critical_sections = ["temperature_correction", "grouping_factors", "standard_sections", "voltage_drop"]
        
        for section in critical_sections:
            if section not in config:
                diagnosis["errors"].append(f"Falta sección crítica: {section}")
                diagnosis["structure_check"][section] = "MISSING"
            else:
                diagnosis["structure_check"][section] = "OK"
        
        # Verificar grouping_factors específicamente
        if "grouping_factors" in config:
            grouping = config["grouping_factors"]
            methods_found = list(grouping.keys())
            diagnosis["structure_check"]["grouping_methods"] = methods_found
            
            valid_methods = 0
            for method, method_data in grouping.items():
                if isinstance(method_data, dict):
                    if "values" in method_data:
                        valid_methods += 1
                    else:
                        # Verificar estructura anidada
                        for layout, layout_data in method_data.items():
                            if isinstance(layout_data, dict) and "values" in layout_data:
                                valid_methods += 1
                                break
            
            if valid_methods == 0:
                diagnosis["errors"].append("No se encontraron factores de agrupamiento válidos")
        
        # Verificar temperature_correction
        if "temperature_correction" in config:
            temp_corr = config["temperature_correction"]
            if "values" not in temp_corr or not temp_corr["values"]:
                diagnosis["warnings"].append("Factores de temperatura vacíos")
        
        # Determinar estado general
        if diagnosis["errors"]:
            diagnosis["status"] = "ERROR"
        elif diagnosis["warnings"]:
            diagnosis["status"] = "WARNING"
        
        logger.info(f"Diagnóstico de normativa '{normativa_name}': {diagnosis['status']}")
        
    except Exception as e:
        diagnosis["status"] = "CRITICAL"
        diagnosis["errors"].append(f"Error crítico: {str(e)}")
    
    return diagnosis

def validate_config_parameters(config: dict) -> dict:
    """✅ NUEVA FUNCIÓN: Valida y sanitiza parámetros de configuración"""
    validated_config = config.copy()
    
    # Validar caída de tensión
    voltage_drop = validated_config.get("voltage_drop", {})
    max_percentage = voltage_drop.get("max_percentage", 1.5)
    
    if not (0.1 <= max_percentage <= 10.0):
        logger.warning(f"Caída de tensión {max_percentage}% fuera de rango válido (0.1-10%), usando 1.5%")
        validated_config.setdefault("voltage_drop", {})["max_percentage"] = 1.5
    
    # Validar tensión de referencia
    v_ref = voltage_drop.get("reference_voltage", 1500)
    if v_ref <= 0:
        logger.warning(f"Tensión de referencia inválida {v_ref}V, usando 1500V")
        validated_config["voltage_drop"]["reference_voltage"] = 1500
    
    # Validar número de strings en paralelo
    num_strings = validated_config.get("number_of_parallel_strings", 1)
    if num_strings < 1:
        logger.warning(f"Número de strings inválido {num_strings}, usando 1")
        validated_config["number_of_parallel_strings"] = 1
    elif num_strings > 100:
        logger.warning(f"Número de strings muy alto {num_strings}, limitando a 100")
        validated_config["number_of_parallel_strings"] = 100
    
    # Validar corriente ISC
    isc_ref = validated_config.get("isc_ref", 0)
    if isc_ref <= 0:
        logger.error(f"Corriente ISC inválida: {isc_ref}A")
        raise ValueError(f"La corriente ISC debe ser mayor a 0A, recibido: {isc_ref}A")
    
    return validated_config

def get_grouping_factor_safe(normativa_config: dict, number_of_circuits: int, 
                           method: str, layout: str) -> float:
    """✅ FUNCIÓN CORREGIDA: Obtiene factor de agrupamiento de forma segura"""
    try:
        grouping_corr = normativa_config.get("grouping_factors", {})
        default_factor = 1.0
        
        # ✅ CORRECCIÓN: Verificar que method sea string y esté en grouping_corr
        if not isinstance(method, str) or method not in grouping_corr:
            logger.warning(f"Método de instalación '{method}' no encontrado o inválido, usando factor {default_factor}")
            return default_factor
        
        method_data = grouping_corr[method]
        group_table = {}
        
        # Extraer tabla de valores
        if isinstance(method_data, dict):
            # ✅ CORRECCIÓN: Verificar que layout sea string antes de usar 'in'
            if layout and isinstance(layout, str) and layout in method_data and "values" in method_data[layout]:
                group_table = method_data[layout]["values"]
                logger.debug(f"Usando tabla de agrupamiento '{layout}' para método '{method}'")
            elif "values" in method_data:
                group_table = method_data["values"]
                logger.debug(f"Usando tabla de agrupamiento directa para método '{method}'")
            else:
                # Buscar primera tabla disponible
                for key, value in method_data.items():
                    if isinstance(value, dict) and "values" in value:
                        group_table = value["values"]
                        logger.info(f"Usando tabla de agrupamiento '{key}' para método '{method}'")
                        break
        
        if not group_table:
            logger.warning(f"No se encontró tabla de agrupamiento para método '{method}', usando factor {default_factor}")
            return default_factor
        
        # ✅ CORRECCIÓN: Asegurar que number_of_circuits sea entero
        try:
            number_of_circuits = int(number_of_circuits)
        except (ValueError, TypeError):
            logger.error(f"Número de circuitos inválido: {number_of_circuits}, usando factor {default_factor}")
            return default_factor
        
        # Búsqueda del factor
        str_circuits = str(number_of_circuits)
        
        # 1. Búsqueda exacta
        if str_circuits in group_table:
            factor = float(group_table[str_circuits])
            logger.debug(f"Factor de agrupamiento exacto: {factor} para {number_of_circuits} strings")
            return factor
        
        # 2. Búsqueda por rangos (ej: "10+", "6+")
        applicable_ranges = []
        for key in group_table.keys():
            if isinstance(key, str) and "+" in key:
                try:
                    threshold = int(key.replace("+", ""))
                    if number_of_circuits >= threshold:
                        applicable_ranges.append((threshold, float(group_table[key])))
                except ValueError:
                    continue
        
        if applicable_ranges:
            applicable_ranges.sort(reverse=True)
            factor = applicable_ranges[0][1]
            logger.info(f"Usando factor de agrupamiento {factor} para {number_of_circuits} strings (rango aplicable)")
            return factor
        
        # 3. Búsqueda por aproximación
        numeric_keys = []
        for key in group_table.keys():
            try:
                if isinstance(key, (str, int)) and "+" not in str(key):
                    numeric_keys.append((int(key), float(group_table[key])))
            except ValueError:
                continue
        
        if numeric_keys:
            closest = min(numeric_keys, key=lambda x: abs(x[0] - number_of_circuits))
            factor = closest[1]
            logger.warning(f"Número de strings {number_of_circuits} no encontrado exactamente, "
                         f"usando factor {factor} del valor más cercano ({closest[0]} strings)")
            return factor
        
        logger.warning(f"No se pudo determinar factor de agrupamiento para {number_of_circuits} strings, "
                      f"usando factor por defecto {default_factor}")
        return default_factor
        
    except Exception as e:
        logger.error(f"Error obteniendo factor de agrupamiento: {e}")
        logger.error(f"  - method: {method} (tipo: {type(method)})")
        logger.error(f"  - layout: {layout} (tipo: {type(layout)})")
        logger.error(f"  - number_of_circuits: {number_of_circuits} (tipo: {type(number_of_circuits)})")
        return 1.0

def diagnose_config(config: dict) -> dict:
    """✅ NUEVA: Función para diagnosticar problemas en la configuración"""
    diagnosis = {
        "status": "OK",
        "warnings": [],
        "errors": [],
        "config_summary": {}
    }
    
    try:
        # Verificar parámetros críticos
        if "isc_ref" not in config or config["isc_ref"] <= 0:
            diagnosis["errors"].append(f"ISC de referencia inválida: {config.get('isc_ref', 'NO_DEFINIDA')}")
        
        voltage_drop = config.get("voltage_drop", {})
        max_pct = voltage_drop.get("max_percentage")
        v_ref = voltage_drop.get("reference_voltage")
        
        if not max_pct or not (0.1 <= max_pct <= 10):
            diagnosis["warnings"].append(f"Caída de tensión fuera de rango: {max_pct}%")
        
        if not v_ref or v_ref <= 0:
            diagnosis["errors"].append(f"Tensión de referencia inválida: {v_ref}V")
        
        num_strings = config.get("number_of_parallel_strings", 1)
        if num_strings < 1 or num_strings > 100:
            diagnosis["warnings"].append(f"Número de strings inusual: {num_strings}")
        
        diagnosis["config_summary"] = {
            "isc_ref": config.get("isc_ref"),
            "voltage_drop_pct": max_pct,
            "reference_voltage": v_ref,
            "parallel_strings": num_strings,
            "normativa": SECTIONS_CONFIG.get("normativa_used")
        }
        
        if diagnosis["errors"]:
            diagnosis["status"] = "ERROR"
        elif diagnosis["warnings"]:
            diagnosis["status"] = "WARNING"
            
    except Exception as e:
        diagnosis["status"] = "CRITICAL"
        diagnosis["errors"].append(f"Error durante diagnóstico: {str(e)}")
    
    return diagnosis

def validate_normativas_yaml():
    """Valida que el YAML de normativas tenga la estructura correcta"""
    try:
        with open("configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        
        # Verificar estructura básica
        if "normativas" not in yaml_data:
            raise ValueError("El YAML debe tener una clave 'normativas'")
        
        normativas = yaml_data["normativas"]
        
        # Verificar que al menos una normativa tenga secciones
        found_sections = False
        for normativa_name, normativa_data in normativas.items():
            if "standard_sections" in normativa_data:
                sections = normativa_data["standard_sections"]
                
                # Verificar si tiene la nueva estructura separada
                if "dc_strings" in sections:
                    # Nueva estructura
                    required_types = ["dc_strings", "level_1_dc", "ac_circuits"]
                    for circuit_type in required_types:
                        if circuit_type not in sections:
                            raise ValueError(f"Falta el tipo de circuito '{circuit_type}' en {normativa_name}")
                        if "mm2" not in sections[circuit_type]:
                            raise ValueError(f"Falta 'mm2' en {circuit_type} de {normativa_name}")
                        if not isinstance(sections[circuit_type]["mm2"], list):
                            raise ValueError(f"'mm2' en {circuit_type} debe ser una lista en {normativa_name}")
                        if len(sections[circuit_type]["mm2"]) == 0:
                            raise ValueError(f"La lista 'mm2' en {circuit_type} no puede estar vacía en {normativa_name}")
                    
                    logger.info(f"YAML validado: normativa '{normativa_name}' con estructura nueva")
                    found_sections = True
                    break
                    
                elif "mm2" in sections:
                    # Estructura antigua
                    if not isinstance(sections["mm2"], list):
                        raise ValueError(f"'mm2' debe ser una lista en {normativa_name}")
                    if len(sections["mm2"]) == 0:
                        raise ValueError(f"La lista 'mm2' no puede estar vacía en {normativa_name}")
                    
                    logger.info(f"YAML validado: normativa '{normativa_name}' con estructura legacy")
                    found_sections = True
                    break
        
        if not found_sections:
            raise ValueError("No se encontraron secciones válidas en ninguna normativa")
            
        return "normativas_structure"
            
    except FileNotFoundError:
        raise FileNotFoundError("No se encontró el archivo configs/normativas.yaml")
    except Exception as e:
        raise ValueError(f"Error validando YAML de normativas: {str(e)}")

def load_sections_config(normativa: str = "IEC"):
    """
    Carga las secciones comerciales desde normativas.yaml
    
    Args:
        normativa: Nombre de la normativa a usar ("IEC", "NEC", "PERSONALIZADA")
    """
    structure_type = validate_normativas_yaml()
    
    with open("configs/normativas.yaml") as f:
        yaml_data = yaml.safe_load(f)
    
    normativas = yaml_data["normativas"]
    
    # Verificar que la normativa solicitada existe
    if normativa not in normativas:
        available_normativas = list(normativas.keys())
        logger.warning(f"Normativa '{normativa}' no encontrada. Usando 'IEC'. Disponibles: {available_normativas}")
        normativa = "IEC"
    
    normativa_data = normativas[normativa]
    
    if "standard_sections" not in normativa_data:
        raise ValueError(f"La normativa '{normativa}' no tiene secciones estándar definidas")
    
    sections = normativa_data["standard_sections"]
    
    # Verificar estructura de secciones
    if "dc_strings" in sections:
        # Estructura nueva separada por tipos
        result = {
            "dc_strings": sorted(sections["dc_strings"]["mm2"]),
            "level_1_dc": sorted(sections["level_1_dc"]["mm2"]),
            "ac_circuits": sorted(sections["ac_circuits"]["mm2"]),
            "mv_circuits": sorted(sections.get("mv_circuits", {}).get("mm2", [])),
            # ✅ AGREGAR CN1_INVERTER AQUÍ:
            "cn1_inverter": sorted(sections.get("cn1_inverter", {}).get("mm2", sections["level_1_dc"]["mm2"])),
            "structure_type": "new",
            "normativa_used": normativa,
            "normativa_info": {
                "name": normativa_data.get("name", normativa),
                "description": normativa_data.get("description", ""),
                "country": normativa_data.get("country", "")
            },
            "metadata": yaml_data.get("metadata", {})
        }
        
        # ✅ LOG PARA VERIFICAR QUE SE CARGÓ
        logger.info(f"Secciones CN1 cargadas: {len(result['cn1_inverter'])} secciones disponibles")
        return result
        
    elif "mm2" in sections:
        # Estructura legacy - usar las mismas secciones para todos los tipos
        standard_sections = sorted(sections["mm2"])
        return {
            "dc_strings": standard_sections,
            "level_1_dc": standard_sections,
            "ac_circuits": standard_sections,
            "mv_circuits": standard_sections,
            # ✅ AGREGAR CN1_INVERTER AQUÍ TAMBIÉN:
            "cn1_inverter": standard_sections,
            "structure_type": "legacy",
            "normativa_used": normativa,
            "normativa_info": {
                "name": normativa_data.get("name", normativa),
                "description": normativa_data.get("description", ""),
                "country": normativa_data.get("country", "")
            },
            "metadata": {"version": "legacy"}
        }
    else:
        raise ValueError(f"La normativa '{normativa}' no tiene estructura de secciones válida")

def get_normativa_config_fixed(normativa: str = "IEC", project_name: str = None):
    """
    ✅ FUNCIÓN ACTUALIZADA: Prioriza normativa del proyecto
    """
    try:
        # 1. Si hay proyecto, buscar su normativa específica
        if project_name:
            project_normative_file = f"projects/{project_name}/normativa.yaml"
            if os.path.exists(project_normative_file):
                try:
                    with open(project_normative_file) as f:
                        project_data = yaml.safe_load(f)
                    logger.info(f"Usando normativa específica del proyecto: {project_name}")
                    return project_data["normativa"]
                except Exception as e:
                    logger.warning(f"Error cargando normativa del proyecto, usando base: {e}")
        
        # 2. Usar normativa base
        with open("configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        
        if normativa not in yaml_data["normativas"]:
            available = list(yaml_data["normativas"].keys())
            logger.warning(f"Normativa '{normativa}' no encontrada. Usando 'IEC'. Disponibles: {available}")
            normativa = "IEC"
        
        logger.info(f"Usando normativa base: {normativa}")
        return yaml_data["normativas"][normativa]
    
    except Exception as e:
        logger.error(f"Error cargando configuración de normativa '{normativa}': {e}")
        raise

def create_project_normative_copy(project_name: str, base_norm: str = "IEC"):
    """
    ✅ NUEVA: Crea copia completa de normativa en el proyecto
    """
    try:
        # 1. Cargar normativa base
        with open("configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        
        if base_norm not in yaml_data["normativas"]:
            raise ValueError(f"Normativa base '{base_norm}' no encontrada")
        
        # 2. Crear copia completa
        project_normative = {
            "project_info": {
                "project_name": project_name,
                "based_on": base_norm,
                "created_at": datetime.now().isoformat(),
                "version": "1.0"
            },
            "normativa": deepcopy(yaml_data["normativas"][base_norm])
        }
        
        # 3. Guardar en el proyecto
        project_dir = f"projects/{project_name}"
        os.makedirs(project_dir, exist_ok=True)
        
        normative_file = f"{project_dir}/normativa.yaml"
        with open(normative_file, 'w') as f:
            yaml.dump(project_normative, f, default_flow_style=False, indent=2)
        
        logger.info(f"Copia de normativa creada: {normative_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error creando copia de normativa: {e}")
        return False

def update_project_normative(project_name: str, yaml_overrides: dict, base_norm: str = "IEC"):
    """
    ✅ NUEVA: Actualiza normativa específica del proyecto
    """
    try:
        project_normative_file = f"projects/{project_name}/normativa.yaml"
        
        # 1. Si no existe copia, crearla
        if not os.path.exists(project_normative_file):
            logger.info(f"Creando primera copia de normativa para: {project_name}")
            if not create_project_normative_copy(project_name, base_norm):
                return False
        
        # 2. Cargar normativa actual del proyecto
        with open(project_normative_file) as f:
            project_data = yaml.safe_load(f)
        
        # 3. Aplicar cambios directamente a la normativa
        normativa = project_data["normativa"]
        
        for section_name, section_data in yaml_overrides.items():
            if section_name in normativa:
                if isinstance(section_data, dict) and isinstance(normativa[section_name], dict):
                    # Merge profundo
                    normativa[section_name].update(section_data)
                else:
                    # Reemplazo directo
                    normativa[section_name] = section_data
                logger.info(f"Actualizada sección: {section_name}")
            else:
                logger.warning(f"Sección no encontrada: {section_name}")
        
        # 4. Actualizar metadatos
        project_data["project_info"]["last_modified"] = datetime.now().isoformat()
        project_data["project_info"]["version"] = str(float(project_data["project_info"]["version"]) + 0.1)
        
        # 5. Guardar normativa actualizada
        with open(project_normative_file, 'w') as f:
            yaml.dump(project_data, f, default_flow_style=False, indent=2)
        
        logger.info(f"Normativa del proyecto actualizada: {project_normative_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error actualizando normativa del proyecto: {e}")
        return False

def reset_project_normative(project_name: str):
    """
    ✅ NUEVA: Elimina normativa del proyecto (vuelve a usar base)
    """
    try:
        project_normative_file = f"projects/{project_name}/normativa.yaml"
        
        if os.path.exists(project_normative_file):
            os.remove(project_normative_file)
            logger.info(f"Normativa del proyecto eliminada: {project_normative_file}")
            return True
        else:
            logger.info(f"No había normativa personalizada para: {project_name}")
            return True
            
    except Exception as e:
        logger.error(f"Error eliminando normativa del proyecto: {e}")
        return False
def get_normativa_config(normativa: str = "IEC"):
    """
    Obtiene la configuración completa de una normativa
    """
    return get_normativa_config_fixed(normativa)

# ===== INICIALIZAR VARIABLES GLOBALES =====
# Agregar antes de las funciones que usan SECTIONS_CONFIG y MATERIALS

# Cargar secciones al inicializar el módulo (usando IEC por defecto)
try:
    SECTIONS_CONFIG = load_sections_config("IEC")
    logger.info(f"Secciones cargadas exitosamente: {SECTIONS_CONFIG['structure_type']} "
                f"(normativa: {SECTIONS_CONFIG['normativa_used']})")
except Exception as e:
    logger.error(f"ERROR CRÍTICO: No se pudieron cargar las secciones comerciales: {e}")
    # NO usar fallback - fallar explícitamente
    raise RuntimeError(f"Error cargando secciones comerciales: {e}")

# Cargar materiales
try:
    with open("configs/material_properties.yaml") as f:
        MATERIALS = yaml.safe_load(f)["materials"]
    logger.info("Propiedades de materiales cargadas exitosamente")
except Exception as e:
    logger.error(f"ERROR CRÍTICO: No se pudieron cargar las propiedades de materiales: {e}")
    raise RuntimeError(f"Error cargando propiedades de materiales: {e}")

# ===== CORRECCIÓN EN apply_correction_factors =====
# BUSCAR esta línea en tu función apply_correction_factors:
# normativa_config = get_normativa_config(SECTIONS_CONFIG.get("normativa_used", "IEC"))

# REEMPLAZAR por:
# normativa_config = get_normativa_config_fixed(SECTIONS_CONFIG.get("normativa_used", "IEC"))

# Y AGREGAR inmediatamente después:
# # Validar estructura si es personalizada
# if SECTIONS_CONFIG.get("normativa_used") == "PERSONALIZADA":
#     if not validate_custom_normativa_structure(normativa_config):
#         logger.warning("Estructura de normativa personalizada inválida, usando factores por defecto")
#         return i_nominal * 1.25


def get_available_sections(circuit_type: str = "dc_strings") -> List[float]:
    """Obtiene las secciones disponibles para un tipo de circuito específico"""
    if circuit_type not in SECTIONS_CONFIG:
        available_types = [k for k in SECTIONS_CONFIG.keys() if isinstance(SECTIONS_CONFIG[k], list)]
        raise ValueError(f"Tipo de circuito '{circuit_type}' no válido. Disponibles: {available_types}")
    
    return SECTIONS_CONFIG[circuit_type]

def get_available_normativas() -> List[str]:
    """Obtiene la lista de normativas disponibles"""
    try:
        with open("configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        return list(yaml_data["normativas"].keys())
    except Exception as e:
        logger.error(f"Error obteniendo normativas disponibles: {e}")
        return ["IEC"]  # Fallback

def get_material_resistivity(material_name: str, temp_operating: float) -> float:
    """
    Calcula la resistividad del material a la temperatura de operación
    
    Args:
        material_name: Nombre del material (copper, aluminum, etc.)
        temp_operating: Temperatura de operación en °C
    
    Returns:
        Resistividad en Ω·mm²/m
    """
    print(f"DEBUG: Buscando material '{material_name}' a temperatura {temp_operating}°C")
    print(f"DEBUG: MATERIALS disponibles: {list(MATERIALS.keys())}")
    
    if material_name not in MATERIALS:
        available_materials = list(MATERIALS.keys())
        raise ValueError(f"Material '{material_name}' no encontrado. Disponibles: {available_materials}")
    
    props = MATERIALS[material_name]
    print(f"DEBUG: Propiedades de {material_name}: {props}")
    
    # ✅ CORRECCIÓN: Usar directamente la resistividad del YAML (ahora corregida en Ω·mm²/m)
    rho_20 = props["resistivity_20C"]  # Ω·mm²/m (valores ya corregidos en el YAML)
    alpha = props["temp_coefficient"]  # 1/°C
    
    # Corrección por temperatura
    resistivity_temp = rho_20 * (1 + alpha * (temp_operating - 20))
    
    print(f"DEBUG: Resistividad a {temp_operating}°C: {resistivity_temp:.6f} Ω·mm²/m")
    logger.debug(f"Resistividad {material_name} a {temp_operating}°C: {resistivity_temp:.6f} Ω·mm²/m")
    
    return resistivity_temp

def apply_correction_factors(i_nominal: float, config: dict) -> float:
    """✅ FUNCIÓN MEJORADA: Aplica factores de corrección de forma segura"""
    try:
        # Validar entrada
        if i_nominal <= 0:
            raise ValueError(f"Corriente nominal inválida: {i_nominal}A")
        
        # Cargar configuración de normativa
        project_name = config.get("project_name") or config.get("_metadata", {}).get("project_name")
        normativa_name = SECTIONS_CONFIG.get("normativa_used", "IEC")

        # Usar normativa del proyecto para cálculos de strings
        if normativa_name == "PERSONALIZADA" and project_name:
            normativa_config = get_normativa_config_fixed(normativa_name, project_name)
        else:
            normativa_config = get_normativa_config_fixed(normativa_name)

        # Validar estructura si es personalizada
        if SECTIONS_CONFIG.get("normativa_used") == "PERSONALIZADA":
            if not validate_custom_normativa_structure(normativa_config):
                logger.warning("Estructura de normativa personalizada inválida, usando factores por defecto")
                return i_nominal * 1.25
        
        temp_corr = normativa_config.get("temperature_correction", {})
        
        # ✅ FACTOR DE TEMPERATURA MEJORADO
        current_ambient = config.get("current_ambient", 
                                   config.get("correction_factors", {}).get("ambient_temperature", {}).get("current_ambient", 
                                   temp_corr.get("ambient_design", 30)))
        temp_factor = 1.0
        
        if "values" in temp_corr and temp_corr["values"]:
            temp_values = temp_corr["values"]
            
            # Búsqueda exacta
            if str(current_ambient) in temp_values:
                temp_factor = float(temp_values[str(current_ambient)])
                logger.debug(f"Factor de temperatura exacto: {temp_factor} para {current_ambient}°C")
            else:
                # Interpolación o valor más cercano
                available_temps = []
                for temp_str in temp_values.keys():
                    try:
                        available_temps.append((int(temp_str), float(temp_values[temp_str])))
                    except ValueError:
                        continue
                
                if available_temps:
                    available_temps.sort()
                    
                    # Interpolación lineal si está entre dos valores
                    for i in range(len(available_temps) - 1):
                        temp1, factor1 = available_temps[i]
                        temp2, factor2 = available_temps[i + 1]
                        
                        if temp1 <= current_ambient <= temp2:
                            temp_factor = factor1 + (factor2 - factor1) * (current_ambient - temp1) / (temp2 - temp1)
                            logger.info(f"Factor de temperatura interpolado: {temp_factor:.3f} para {current_ambient}°C")
                            break
                    else:
                        # Usar el más cercano si no está en rango
                        closest = min(available_temps, key=lambda x: abs(x[0] - current_ambient))
                        temp_factor = closest[1]
                        logger.warning(f"Temperatura {current_ambient}°C fuera de rango, usando factor {temp_factor} ({closest[0]}°C)")
        else:
            logger.warning(f"No hay tabla de temperatura, usando factor {temp_factor}")
        
        # ✅ FACTOR DE AGRUPAMIENTO MEJORADO
        method = config.get("method", 
                          config.get("installation", {}).get("method", 
                          normativa_config.get("installation", {}).get("method", "conduit")))
        layout = config.get("layout", 
                          config.get("installation", {}).get("layout", 
                          normativa_config.get("installation", {}).get("layout", "single_layer")))
        number_of_circuits = config.get("number_of_parallel_strings", 1)
        
        # ✅ CORRECCIÓN: Asegurar tipos correctos
        method = str(method) if method is not None else "conduit"
        layout = str(layout) if layout is not None else "single_layer"
        
        try:
            number_of_circuits = int(number_of_circuits)
        except (ValueError, TypeError):
            logger.warning(f"Número de strings inválido {number_of_circuits}, usando 1")
            number_of_circuits = 1
        
        logger.debug(f"Parámetros de agrupamiento: method='{method}', layout='{layout}', circuits={number_of_circuits}")
        
        group_factor = get_grouping_factor_safe(normativa_config, number_of_circuits, method, layout)
        
        # Validación final
        if temp_factor <= 0 or temp_factor > 2:
            logger.error(f"Factor de temperatura inválido: {temp_factor}, usando 0.8")
            temp_factor = 0.8
        
        if group_factor <= 0 or group_factor > 1.2:
            logger.error(f"Factor de agrupamiento inválido: {group_factor}, usando 0.8")
            group_factor = 0.8
        
        # ✅ APLICAR CORRECCIÓN CORRECTAMENTE
        combined_factor = temp_factor * group_factor
        i_adjusted = i_nominal / combined_factor
        
        logger.info(f"Corrección de corriente: {i_nominal:.2f}A → {i_adjusted:.2f}A "
                   f"(temp_factor: {temp_factor:.3f}, group_factor: {group_factor:.3f}, combined: {combined_factor:.3f})")
        
        return i_adjusted
        
    except Exception as e:
        logger.error(f"Error aplicando factores de corrección: {e}")
        safety_factor = 1.25
        result = i_nominal / safety_factor  # ✅ CORRECCIÓN: Dividir, no multiplicar
        logger.warning(f"Usando corrección de seguridad: {i_nominal:.2f}A → {result:.2f}A (dividido por factor {safety_factor})")
        return result
    
def get_commercial_section(theoretical_section_mm2: float, circuit_type: str = "dc_strings") -> Optional[float]:
    """
    Encuentra la sección comercial inmediatamente superior a la teórica.
    Si no hay ninguna mayor, retorna la más grande disponible.
    """
    available_sections = get_available_sections(circuit_type)
    available_sections = sorted(available_sections)  # Asegura orden ascendente

    for section in available_sections:
        if section >= theoretical_section_mm2:
            logger.debug(f"Sección seleccionada: {section}mm² para teórica {theoretical_section_mm2:.3f}mm² "
                         f"(tipo: {circuit_type}, normativa: {SECTIONS_CONFIG['normativa_used']})")
            return float(section)

    # Si ninguna sección disponible cumple, retornar la mayor disponible
    if available_sections:
        logger.warning(f"Sección teórica {theoretical_section_mm2:.3f}mm² excede máxima disponible "
                       f"{available_sections[-1]}mm² para tipo {circuit_type} (normativa: {SECTIONS_CONFIG['normativa_used']}). "
                       f"Usando sección máxima disponible.")
        return float(available_sections[-1])

    logger.error(f"No hay secciones comerciales definidas para tipo {circuit_type}")
    return None


def calculate_string_section(row: pd.Series, config: dict, circuit_type: str = "dc_strings") -> dict:
    """✅ FUNCIÓN MEJORADA: Calcula sección con validaciones robustas"""
    try:
        # Validar configuración
        config = validate_config_parameters(config)
        # ✅ DEBUG: Verificar qué normativa se está usando
        project_name = config.get("project_name")
        if project_name:
            project_normative_file = f"projects/{project_name}/normativa.yaml"
            if os.path.exists(project_normative_file):
                logger.info(f"🔥 USANDO NORMATIVA DEL PROYECTO: {project_normative_file}")
                # Verificar algunos parámetros clave
                with open(project_normative_file) as f:
                    project_data = yaml.safe_load(f)
                normativa = project_data["normativa"]
                logger.info(f"🔥 Parámetros del proyecto - ISC factor: {normativa.get('correction_factors', {}).get('isc_safety_factor', 'NO_FOUND')}")
                logger.info(f"🔥 Parámetros del proyecto - Max voltage drop: {normativa.get('voltage_drop', {}).get('max_percentage', 'NO_FOUND')}%")
            else:
                logger.info(f"🔥 USANDO NORMATIVA BASE - No existe: {project_normative_file}")
        
        string_id = str(row.get("string_id", "UNKNOWN"))
        length_pos = float(row.get("length_pos_m", 0))
        length_neg = float(row.get("length_neg_m", 0))

        # Validar longitudes
        if length_pos <= 0 or length_neg <= 0:
            raise ValueError(f"Longitudes inválidas: pos={length_pos}m, neg={length_neg}m")
        
        if length_pos > 10000 or length_neg > 10000:
            raise ValueError(f"Longitudes excesivas: pos={length_pos}m, neg={length_neg}m (máximo 10km)")

        # Cálculos con validación
        isc_safety_factor = config.get("isc_correction", 1.25)
        i_nominal = config["isc_ref"] * isc_safety_factor
        
        # Aplicar factores de corrección de forma segura
        i_adj = apply_correction_factors(i_nominal, config)
        
        # Longitud total
        length_total = length_pos + length_neg

        # Obtener resistividad
        material = config.get("cable", {}).get("material", "copper")
        temp_operating = config.get("correction_factors", {}).get("ambient_temperature", {}).get("current_ambient", 30)
        resistivity_ohm_mm2_per_m = get_material_resistivity(material, temp_operating)

        # Parámetros de caída de tensión validados
        max_percentage = config["voltage_drop"]["max_percentage"]
        v_ref = config["voltage_drop"]["reference_voltage"]
        
        max_voltage_drop_v = v_ref * (max_percentage / 100)
        
        # Validar antes de dividir
        if max_voltage_drop_v <= 0:
            raise ValueError(f"Caída de tensión máxima inválida: {max_voltage_drop_v}V")
        
        # Cálculo de sección teórica
        numerator = 2 * resistivity_ohm_mm2_per_m * length_total * i_adj
        s_teorica_mm2 = numerator / max_voltage_drop_v
        
        # Validar resultado
        if s_teorica_mm2 <= 0:
            raise ValueError(f"Sección teórica inválida: {s_teorica_mm2}mm²")
        
        if s_teorica_mm2 > 1000:
            logger.warning(f"Sección teórica muy alta: {s_teorica_mm2:.1f}mm² para string {string_id}")
        
        # Obtener sección comercial
        s_comercial_mm2 = get_commercial_section(s_teorica_mm2, circuit_type)

        if s_comercial_mm2 and s_comercial_mm2 > 0:
            # Cálculos finales
            v_drop_real = (2 * resistivity_ohm_mm2_per_m * length_total * i_adj) / s_comercial_mm2
            v_drop_pct = (v_drop_real / v_ref) * 100
            resistance_total = (2 * resistivity_ohm_mm2_per_m * length_total) / s_comercial_mm2
            joule_losses = (i_adj ** 2) * resistance_total

            # Estado de la caída de tensión
            if v_drop_pct <= max_percentage:
                voltage_status = "OK"
            elif v_drop_pct <= max_percentage * 1.1:
                voltage_status = "WARNING"
            else:
                voltage_status = "CRITICAL"
        else:
            v_drop_real = None
            v_drop_pct = None
            joule_losses = None
            voltage_status = "NO_SECTION"
            resistance_total = None

        # Resultado completo
        result = {
            "string_id": string_id,
            "length_total_m": round(length_total, 2),
            "i_nominal": round(i_nominal, 2),
            "i_adjusted": round(i_adj, 2),
            "resistivity_ohm_mm2_per_m": round(resistivity_ohm_mm2_per_m, 6),
            "s_teorica_mm2": round(s_teorica_mm2, 3),
            "s_comercial_mm2": s_comercial_mm2,
            "v_drop_real_volts": round(v_drop_real, 3) if v_drop_real is not None else None,
            "v_drop_real_pct": round(v_drop_pct, 3) if v_drop_pct is not None else None,
            "v_drop_max_volts": round(max_voltage_drop_v, 3),
            "joule_losses_w": round(joule_losses, 2) if joule_losses is not None else None,
            "resistance_total_ohm": round(resistance_total, 6) if resistance_total is not None else None,
            "reference_voltage": v_ref,
            "max_vdrop_pct": max_percentage,
            "voltage_status": voltage_status,
            "circuit_type": circuit_type,
            "normativa": SECTIONS_CONFIG["normativa_used"],
            "cable_material": material,
            "calculation_status": "SUCCESS"
        }

        logger.debug(f"String {string_id} calculado exitosamente")
        return result

    except Exception as e:
        logger.error(f"Error calculando string {row.get('string_id', 'UNKNOWN')}: {e}")
        return {
            "string_id": str(row.get("string_id", "UNKNOWN")),
            "error": str(e),
            "calculation_status": "ERROR",
            "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
        }

def calculate_all_strings(df: pd.DataFrame, config: dict, circuit_type: str = "dc_strings") -> List[dict]:
    """Calcula todas las strings del DataFrame usando configuración de normativa"""
    
    logger.info(f"Iniciando cálculo de {len(df)} strings con tipo de circuito: {circuit_type}, "
                f"normativa: {SECTIONS_CONFIG['normativa_used']}")
    
    results = []
    success_count = 0
    error_count = 0
    
    for index, row in df.iterrows():
        try:
            result = calculate_string_section(row, config, circuit_type)
            results.append(result)
            
            if "error" not in result:
                success_count += 1
            else:
                error_count += 1
                
        except Exception as e:
            logger.error(f"Error fatal en fila {index}: {e}")
            error_result = {
                "string_id": str(row.get("string_id", f"ROW_{index}")),
                "error": f"Error fatal: {str(e)}",
                "status": "FATAL_ERROR",
                "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
            }
            results.append(error_result)
            error_count += 1
    
    logger.info(f"Cálculo completado: {success_count} exitosos, {error_count} errores "
                f"(normativa: {SECTIONS_CONFIG['normativa_used']})")
    
    return results

# Función de utilidad para verificar configuración
def get_sections_info():
    """Devuelve información sobre las secciones configuradas"""
    return {
        "structure_type": SECTIONS_CONFIG.get("structure_type", "unknown"),
        "normativa_used": SECTIONS_CONFIG.get("normativa_used", "unknown"),
        "normativa_info": SECTIONS_CONFIG.get("normativa_info", {}),
        "available_circuit_types": [k for k in SECTIONS_CONFIG.keys() 
                                  if k not in ["structure_type", "metadata", "normativa_used", "normativa_info"]],
        "sections_count": {
            circuit_type: len(sections) 
            for circuit_type, sections in SECTIONS_CONFIG.items() 
            if isinstance(sections, list)
        },
        "available_normativas": get_available_normativas(),
        "metadata": SECTIONS_CONFIG.get("metadata", {})
    }

def switch_normativa(normativa: str):
    """
    Cambia la normativa activa y recarga las secciones
    
    Args:
        normativa: Nombre de la nueva normativa ("IEC", "NEC", "PERSONALIZADA")
    """
    global SECTIONS_CONFIG
    try:
        SECTIONS_CONFIG = load_sections_config(normativa)
        logger.info(f"Normativa cambiada exitosamente a: {normativa}")
        return True
    except Exception as e:
        logger.error(f"Error cambiando a normativa '{normativa}': {e}")
        return False
    

def calcular_seccion_minima_simple(corriente_a, longitud_m, caida_pct, tension_v=1500, resistividad_ohm_mm2_per_m=0.01724):
    """
    ✅ FUNCIÓN CORREGIDA: Calcula la sección mínima teórica del conductor (en mm²) por caída de tensión
    
    Parámetros:
    - corriente_a: Corriente en amperios (A)
    - longitud_m: Longitud total (ida y vuelta) del conductor en metros (m)
    - caida_pct: Porcentaje de caída de tensión permitida (ej.: 3.0)
    - tension_v: Tensión del sistema (V). Default = 1500 V
    - resistividad_ohm_mm2_per_m: Resistividad del conductor en Ω·mm²/m (✅ CORREGIDO: default cobre = 0.01724)

    Retorna:
    - Sección mínima requerida en mm² (float)
    
    Fórmula corregida: S = (2 × ρ × L × I) / (V × caida_pct/100)
    """
    
    # Convertir caída permitida a voltios
    caida_v = tension_v * (caida_pct / 100)
    
    # ✅ CORRECCIÓN: Fórmula corregida con resistividad real
    # S = (2 × ρ × L × I) / ΔV
    # Donde ρ está ahora en valores correctos (0.01724 Ω·mm²/m para cobre)
    seccion_mm2 = (2 * resistividad_ohm_mm2_per_m * longitud_m * corriente_a) / caida_v
    
    return round(seccion_mm2, 3)

def test_custom_normativa():
    """
    Prueba la carga de normativa personalizada
    """
    print("🧪 Probando carga de normativa personalizada...")
    
    # Diagnóstico inicial
    diagnosis = diagnose_normativa_structure("PERSONALIZADA")
    print(f"Diagnóstico: {diagnosis}")
    
    if diagnosis["status"] == "OK":
        print("✅ Normativa personalizada cargada correctamente")
        
        # Probar configuración problemática
        test_config = {
            "isc_ref": 15.5,
            "number_of_parallel_strings": 2,  # Valor del JSON
            "voltage_drop": {"max_percentage": 1.5, "reference_voltage": 1500},
            "current_ambient": 35,
            "method": "buried",
            "layout": "single_layer"
        }
        
        try:
            result = apply_correction_factors(15.5, test_config)
            print(f"✅ Cálculo exitoso: corriente ajustada = {result:.2f}A")
        except Exception as e:
            print(f"❌ Error en cálculo: {e}")
    else:
        print(f"❌ Problemas en normativa: {diagnosis['errors']}")

# ===== AGREGAR AL FINAL DE string_calculator.py =====

# REEMPLAZAR la función calculate_cn1_section existente en string_calculator.py con esta versión corregida:

def calculate_cn1_section(row: pd.Series, config: dict, circuit_type: str = "cn1_inverter") -> dict:
    """
    Calcula sección CN1 con corriente combinada de múltiples strings
    CORREGIDO: Usa normalización correcta para mapeo de strings en paralelo
    """
    try:
        # Validar configuración
        config = validate_config_parameters(config)
        
        # Información del circuito
        circuit_id = str(row.get("circuit_id", "UNKNOWN"))
        length_pos = float(row.get("length_pos_m", 0))
        length_neg = float(row.get("length_neg_m", 0))

        # Validar longitudes
        if length_pos <= 0 or length_neg <= 0:
            raise ValueError(f"Longitudes inválidas: pos={length_pos}m, neg={length_neg}m")

        # CORREGIDO: Normalizar circuit_id para mapeo consistente
        # cn1-1 + INV-1 → cn1-01-inv1
        inverter_id = str(row.get("inverter_id", ""))
        normalized_circuit_id = normalize_circuit_id_from_cn1_table(circuit_id, inverter_id)

        # Obtener número de strings en paralelo desde config
        parallel_mapping = config.get('cn1_parallel_mapping', {})
        parallel_strings = parallel_mapping.get(normalized_circuit_id, 1)
        
        # Debug logging mejorado
        if normalized_circuit_id not in parallel_mapping:
            logger.warning(f"[CN1] circuit_id '{normalized_circuit_id}' no encontrado en mapping")
            logger.warning(f"[CN1] Raw inputs: circuit_id='{circuit_id}', inverter_id='{inverter_id}'")
            logger.warning(f"[CN1] Available mappings: {list(parallel_mapping.keys())[:5]}...")
        else:
            logger.info(f"[CN1] {normalized_circuit_id}: encontrado {parallel_strings} strings en paralelo")

        # CORRIENTE COMBINADA: Isc_base × número_de_strings
        isc_base = config["isc_ref"]  # Corriente de un solo string
        isc_combined = isc_base * parallel_strings  # Corriente combinada
        
        # Factor de seguridad se aplica a la corriente combinada
        isc_safety_factor = config.get("isc_correction", 1.25)
        i_nominal = isc_combined * isc_safety_factor
        
        logger.info(f"CN1 {normalized_circuit_id}: {parallel_strings} strings → "
                   f"{isc_base:.2f}A × {parallel_strings} = {isc_combined:.2f}A → "
                   f"nominal: {i_nominal:.2f}A")

        # Aplicar factores de corrección (temperatura, agrupamiento)
        i_adj = apply_correction_factors(i_nominal, config)
        
        # LONGITUDES: NO MULTIPLICAR - ya están dadas correctamente en el Excel
        length_total = length_pos + length_neg  # Distancia real del cable CN1

        # Obtener resistividad
        material = config.get("cable", {}).get("material", "copper")
        temp_operating = config.get("correction_factors", {}).get("ambient_temperature", {}).get("current_ambient", 30)
        resistivity_ohm_mm2_per_m = get_material_resistivity(material, temp_operating)

        # Parámetros de caída de tensión
        max_percentage = config["voltage_drop"]["max_percentage"]
        v_ref = config["voltage_drop"]["reference_voltage"]
        max_voltage_drop_v = v_ref * (max_percentage / 100)
        
        # Validar antes de dividir
        if max_voltage_drop_v <= 0:
            raise ValueError(f"Caída de tensión máxima inválida: {max_voltage_drop_v}V")
        
        # Cálculo de sección teórica (con corriente combinada, longitud real)
        numerator = 2 * resistivity_ohm_mm2_per_m * length_total * i_adj
        s_teorica_mm2 = numerator / max_voltage_drop_v
        
        # Validar resultado
        if s_teorica_mm2 <= 0:
            raise ValueError(f"Sección teórica inválida: {s_teorica_mm2}mm²")
        
        # Obtener sección comercial CN1 (usa secciones más gruesas)
        s_comercial_mm2 = get_commercial_section(s_teorica_mm2, circuit_type)

        if s_comercial_mm2 and s_comercial_mm2 > 0:
            # Cálculos finales
            v_drop_real = (2 * resistivity_ohm_mm2_per_m * length_total * i_adj) / s_comercial_mm2
            v_drop_pct = (v_drop_real / v_ref) * 100
            resistance_total = (2 * resistivity_ohm_mm2_per_m * length_total) / s_comercial_mm2
            joule_losses = (i_adj ** 2) * resistance_total

            # Estado de la caída de tensión
            if v_drop_pct <= max_percentage:
                voltage_status = "OK"
            elif v_drop_pct <= max_percentage * 1.1:
                voltage_status = "WARNING"
            else:
                voltage_status = "CRITICAL"
        else:
            v_drop_real = None
            v_drop_pct = None
            joule_losses = None
            voltage_status = "NO_SECTION"
            resistance_total = None

        # Resultado con información CN1 específica
        result = {
            "circuit_id": circuit_id,  # Mantener ID original para mostrar
            "normalized_circuit_id": normalized_circuit_id,  # Para debugging
            "parallel_strings": parallel_strings,
            "isc_base": round(isc_base, 2),
            "isc_combined": round(isc_combined, 2),
            "length_total_m": round(length_total, 2),
            "i_nominal": round(i_nominal, 2),
            "i_adjusted": round(i_adj, 2),
            "resistivity_ohm_mm2_per_m": round(resistivity_ohm_mm2_per_m, 6),
            "s_teorica_mm2": round(s_teorica_mm2, 3),
            "s_comercial_mm2": s_comercial_mm2,
            "v_drop_real_volts": round(v_drop_real, 3) if v_drop_real is not None else None,
            "v_drop_real_pct": round(v_drop_pct, 3) if v_drop_pct is not None else None,
            "v_drop_max_volts": round(max_voltage_drop_v, 3),
            "joule_losses_w": round(joule_losses, 2) if joule_losses is not None else None,
            "resistance_total_ohm": round(resistance_total, 6) if resistance_total is not None else None,
            "reference_voltage": v_ref,
            "max_vdrop_pct": max_percentage,
            "voltage_status": voltage_status,
            "circuit_type": circuit_type,
            "normativa": SECTIONS_CONFIG["normativa_used"],
            "cable_material": material,
            "calculation_status": "SUCCESS",
            "calculation_type": "CN1_COMBINED"
        }

        logger.debug(f"CN1 {circuit_id} calculado exitosamente: {parallel_strings} strings, {isc_combined:.2f}A combinada")
        return result

    except Exception as e:
        logger.error(f"Error calculando CN1 {row.get('circuit_id', 'UNKNOWN')}: {e}")
        return {
            "circuit_id": str(row.get("circuit_id", "UNKNOWN")),
            "error": str(e),
            "calculation_status": "ERROR",
            "calculation_type": "CN1_COMBINED",
            "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
        }

def calculate_all_cn1_circuits(df: pd.DataFrame, config: dict, circuit_type: str = "cn1_inverter") -> List[dict]:
    """
    ✅ NUEVA FUNCIÓN: Calcula todos los circuits CN1 con corriente combinada
    """
    parallel_mapping = config.get('cn1_parallel_mapping', {})
    
    logger.info(f"Iniciando cálculo CN1 de {len(df)} circuits con corriente combinada")
    logger.info(f"Mappings disponibles: {len(parallel_mapping)} circuits con strings en paralelo")
    
    results = []
    success_count = 0
    error_count = 0
    
    for index, row in df.iterrows():
        try:
            # Usar función específica para CN1
            result = calculate_cn1_section(row, config, circuit_type)
            results.append(result)
            
            if "error" not in result:
                success_count += 1
                # Log información útil para verificación
                circuit_id = result.get("circuit_id", "UNKNOWN")
                parallel_strings = result.get("parallel_strings", 1)
                isc_combined = result.get("isc_combined", 0)
                logger.debug(f"✅ CN1 {circuit_id}: {parallel_strings} strings, {isc_combined:.1f}A combinada")
            else:
                error_count += 1
                
        except Exception as e:
            logger.error(f"Error fatal en CN1 fila {index}: {e}")
            error_result = {
                "circuit_id": str(row.get("circuit_id", f"CN1_ROW_{index}")),
                "error": f"Error fatal: {str(e)}",
                "calculation_status": "FATAL_ERROR",
                "calculation_type": "CN1_COMBINED",
                "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
            }
            results.append(error_result)
            error_count += 1
    
    # Estadísticas mejoradas
    if success_count > 0:
        successful_results = [r for r in results if "error" not in r]
        current_range = {
            "min": min(r.get("isc_combined", 0) for r in successful_results),
            "max": max(r.get("isc_combined", 0) for r in successful_results),
        }
        strings_range = {
            "min": min(r.get("parallel_strings", 1) for r in successful_results),
            "max": max(r.get("parallel_strings", 1) for r in successful_results),
        }
        
        logger.info(f"Cálculo CN1 completado: {success_count} exitosos, {error_count} errores")
        logger.info(f"Rango corriente combinada: {current_range['min']:.1f}A - {current_range['max']:.1f}A")
        logger.info(f"Rango strings en paralelo: {strings_range['min']} - {strings_range['max']}")
    else:
        logger.warning(f"Cálculo CN1 completado: 0 exitosos, {error_count} errores")
    
    return results

# AGREGAR estas funciones al final de backend/app/services/calculation/string_calculator.py

def calculate_cn1_parallel_strings(project_name: str) -> dict:
    """
    ✅ NUEVA FUNCIÓN FALTANTE: Calcula strings en paralelo por CN1
    Mapea correctamente CN1-XX → cn1-XX-invY
    """
    from app.utils.filesystem import load_excel_sheet
    
    try:
        logger.info(f"[DEBUG] calculate_cn1_parallel_strings INICIANDO para {project_name}")
        
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")
        logger.info(f"[DEBUG] Cargados {len(df)} rows de dc_string_circuits")

        if df.empty:
            logger.warning("[DEBUG] La hoja 'dc_string_circuits' está vacía.")
            return {}

        if "cn1_id" not in df.columns or "inverter_id" not in df.columns:
            logger.warning(f"[DEBUG] Columnas disponibles: {list(df.columns)}")
            logger.warning("[DEBUG] Faltan columnas 'cn1_id' o 'inverter_id' en hoja dc_string_circuits.")
            return {}

        # Log de algunos ejemplos de datos originales
        sample_data = df[["cn1_id", "inverter_id"]].head(3)
        logger.info(f"[DEBUG] Ejemplos de datos originales:\n{sample_data.to_string()}")

        def build_mapping_circuit_id(row):
            """
            Convierte CN1-01 + INV-1 → cn1-01-inv1
            para que coincida con el formato usado en dc_cn1_circuits
            """
            try:
                cn1_raw = str(row["cn1_id"]).upper().strip()
                inv_raw = str(row["inverter_id"]).upper().strip()
                
                logger.debug(f"[DEBUG] Procesando: cn1_raw='{cn1_raw}', inv_raw='{inv_raw}'")
                
                if cn1_raw.startswith("CN1-"):
                    # CN1-01 → 01
                    cn1_num = cn1_raw.replace("CN1-", "").zfill(2)
                else:
                    cn1_num = str(row["cn1_id"]).zfill(2)
                
                if inv_raw.startswith("INV-"):
                    # INV-1 → 1
                    inv_num = inv_raw.replace("INV-", "").lstrip("0") or "0"
                else:
                    inv_num = str(row["inverter_id"]).lstrip("0") or "0"
                
                result = f"cn1-{cn1_num}-inv{inv_num}"
                logger.debug(f"[DEBUG] Resultado: '{result}'")
                return result
                
            except Exception as e:
                logger.error(f"[DEBUG] Error building mapping circuit_id: {e}")
                return "UNKNOWN"

        df["mapping_circuit_id"] = df.apply(build_mapping_circuit_id, axis=1)

        # Log de algunos ejemplos después del mapeo
        sample_mapped = df[["cn1_id", "inverter_id", "mapping_circuit_id"]].head(5)
        logger.info(f"[DEBUG] Ejemplos después del mapeo:\n{sample_mapped.to_string()}")

        # Contar cuántos strings hay por cada combinación CN1 + Inversor
        mapping = df["mapping_circuit_id"].value_counts().to_dict()
        
        # Log detallado para debugging
        logger.info(f"[DEBUG] Calculados strings en paralelo para {len(mapping)} circuitos CN1:")
        for circuit_id, count in sorted(mapping.items()):
            logger.info(f"[DEBUG]   {circuit_id}: {count} strings")
        
        # Mostrar algunos ejemplos del mapeo para verificar
        sample_mappings = df[["cn1_id", "inverter_id", "mapping_circuit_id"]].drop_duplicates().head(5)
        logger.info(f"[DEBUG] Ejemplos de mapeo únicos:\n{sample_mappings.to_string()}")
        
        # Verificar casos problemáticos
        unknown_count = mapping.get("UNKNOWN", 0)
        if unknown_count > 0:
            logger.warning(f"[DEBUG] ¡ATENCIÓN! {unknown_count} strings con circuit_id 'UNKNOWN'")
            unknown_samples = df[df["mapping_circuit_id"] == "UNKNOWN"][["cn1_id", "inverter_id"]].head(3)
            logger.warning(f"[DEBUG] Ejemplos de IDs problemáticos:\n{unknown_samples.to_string()}")

        logger.info(f"[DEBUG] calculate_cn1_parallel_strings TERMINANDO - retornando {len(mapping)} mappings")
        return mapping

    except Exception as e:
        logger.error(f"[DEBUG] Error al calcular strings en paralelo por CN1: {e}")
        import traceback
        logger.error(f"[DEBUG] Traceback: {traceback.format_exc()}")
        return {}

def normalize_circuit_id_from_cn1_table(cn1_circuit_id: str, inverter_id: str) -> str:
    """
    ✅ NUEVA FUNCIÓN FALTANTE: Normaliza circuit_id para tabla dc_cn1_circuits
    """
    try:
        # Normalizar CN1 desde circuit_id
        cn1_str = str(cn1_circuit_id).lower().strip()
        if cn1_str.startswith("cn1-"):
            cn1_num = cn1_str.replace("cn1-", "").zfill(2)  # ej: "1" → "01"
        else:
            cn1_num = str(cn1_circuit_id).zfill(2)
        
        # Normalizar Inversor
        inv_str = str(inverter_id).upper().strip()
        if inv_str.startswith("INV-"):
            inv_num = inv_str.replace("INV-", "").lstrip("0") or "0"
        else:
            inv_num = str(inverter_id).lstrip("0") or "0"
        
        circuit_id = f"cn1-{cn1_num}-inv{inv_num}"
        return circuit_id
        
    except Exception as e:
        logger.error(f"Error normalizando desde CN1 table: circuit_id={cn1_circuit_id}, inv={inverter_id} -> {e}")
        return "UNKNOWN"