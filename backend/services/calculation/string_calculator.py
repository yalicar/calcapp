import yaml
import math
from pathlib import Path
import pandas as pd
from typing import Dict, List, Optional
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar configuración global
from backend.services.config_loader import load_yaml_config

def validate_normativas_yaml():
    """Valida que el YAML de normativas tenga la estructura correcta"""
    try:
        with open("backend/configs/normativas.yaml") as f:
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
        raise FileNotFoundError("No se encontró el archivo backend/configs/normativas.yaml")
    except Exception as e:
        raise ValueError(f"Error validando YAML de normativas: {str(e)}")

def load_sections_config(normativa: str = "IEC"):
    """
    Carga las secciones comerciales desde normativas.yaml
    
    Args:
        normativa: Nombre de la normativa a usar ("IEC", "NEC", "PERSONALIZADA")
    """
    structure_type = validate_normativas_yaml()
    
    with open("backend/configs/normativas.yaml") as f:
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
        return {
            "dc_strings": sorted(sections["dc_strings"]["mm2"]),
            "level_1_dc": sorted(sections["level_1_dc"]["mm2"]),
            "ac_circuits": sorted(sections["ac_circuits"]["mm2"]),
            "mv_circuits": sorted(sections.get("mv_circuits", {}).get("mm2", [])),
            "structure_type": "new",
            "normativa_used": normativa,
            "normativa_info": {
                "name": normativa_data.get("name", normativa),
                "description": normativa_data.get("description", ""),
                "country": normativa_data.get("country", "")
            },
            "metadata": yaml_data.get("metadata", {})
        }
    elif "mm2" in sections:
        # Estructura legacy - usar las mismas secciones para todos los tipos
        standard_sections = sorted(sections["mm2"])
        return {
            "dc_strings": standard_sections,
            "level_1_dc": standard_sections,
            "ac_circuits": standard_sections,
            "mv_circuits": standard_sections,
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

def get_normativa_config(normativa: str = "IEC"):
    """
    Obtiene la configuración completa de una normativa
    
    Args:
        normativa: Nombre de la normativa ("IEC", "NEC", "PERSONALIZADA")
    
    Returns:
        Dict con toda la configuración de la normativa
    """
    try:
        with open("backend/configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        
        if normativa not in yaml_data["normativas"]:
            available = list(yaml_data["normativas"].keys())
            logger.warning(f"Normativa '{normativa}' no encontrada. Usando 'IEC'. Disponibles: {available}")
            normativa = "IEC"
        
        return yaml_data["normativas"][normativa]
    
    except Exception as e:
        logger.error(f"Error cargando configuración de normativa '{normativa}': {e}")
        raise

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
    with open("backend/configs/material_properties.yaml") as f:
        MATERIALS = yaml.safe_load(f)["materials"]
    logger.info("Propiedades de materiales cargadas exitosamente")
except Exception as e:
    logger.error(f"ERROR CRÍTICO: No se pudieron cargar las propiedades de materiales: {e}")
    raise RuntimeError(f"Error cargando propiedades de materiales: {e}")

def get_available_sections(circuit_type: str = "dc_strings") -> List[float]:
    """Obtiene las secciones disponibles para un tipo de circuito específico"""
    if circuit_type not in SECTIONS_CONFIG:
        available_types = [k for k in SECTIONS_CONFIG.keys() if isinstance(SECTIONS_CONFIG[k], list)]
        raise ValueError(f"Tipo de circuito '{circuit_type}' no válido. Disponibles: {available_types}")
    
    return SECTIONS_CONFIG[circuit_type]

def get_available_normativas() -> List[str]:
    """Obtiene la lista de normativas disponibles"""
    try:
        with open("backend/configs/normativas.yaml") as f:
            yaml_data = yaml.safe_load(f)
        return list(yaml_data["normativas"].keys())
    except Exception as e:
        logger.error(f"Error obteniendo normativas disponibles: {e}")
        return ["IEC"]  # Fallback

def get_material_resistivity(material_name: str, temp_operating: float) -> float:
    """Calcula la resistividad del material a la temperatura de operación"""
    print(f"DEBUG: Buscando material '{material_name}' a temperatura {temp_operating}°C")
    print(f"DEBUG: MATERIALS disponibles: {list(MATERIALS.keys())}")
    
    if material_name not in MATERIALS:
        available_materials = list(MATERIALS.keys())
        raise ValueError(f"Material '{material_name}' no encontrado. Disponibles: {available_materials}")
    
    props = MATERIALS[material_name]
    print(f"DEBUG: Propiedades de {material_name}: {props}")
    
    rho_20 = props["resistivity_20C"]
    alpha = props["temp_coefficient"]
    resistivity = rho_20 * (1 + alpha * (temp_operating - 20))
    
    print(f"DEBUG: Resistividad calculada: {resistivity}")
    logger.debug(f"Resistividad {material_name} a {temp_operating}°C: {resistivity:.6f} Ω·m")
    return resistivity

def apply_correction_factors(i_nominal: float, config: dict) -> float:
    """Aplica factores de corrección por temperatura y agrupamiento usando configuración de normativa"""
    try:
        # Usar factores de corrección de la normativa cargada
        normativa_config = get_normativa_config(SECTIONS_CONFIG.get("normativa_used", "IEC"))
        
        temp_corr = normativa_config["temperature_correction"]
        grouping_corr = normativa_config["grouping_factors"]

        current_ambient = config.get("current_ambient", temp_corr["ambient_design"])
        temp_factor = temp_corr["values"].get(str(current_ambient), 1.0)

        method = config.get("method", normativa_config["installation"]["method"])
        layout = config.get("layout", normativa_config["installation"]["layout"])
        number_of_circuits = config.get("number_of_parallel_strings", 1)

        if method == "buried" and layout in grouping_corr[method]:
            group_table = grouping_corr[method][layout]["values"]
        elif method in grouping_corr:
            group_table = grouping_corr[method]["values"]
        else:
            logger.warning(f"Método '{method}' no encontrado en factores de agrupamiento, usando factor 1.0")
            group_table = {"1": 1.0}

        group_factor = 1.0
        if str(number_of_circuits) in group_table:
            group_factor = group_table[str(number_of_circuits)]
        elif "10+" in group_table and number_of_circuits >= 10:
            group_factor = group_table["10+"]
        elif "6+" in group_table and number_of_circuits >= 6:
            group_factor = group_table["6+"]
        elif "4+" in group_table and number_of_circuits >= 4:
            group_factor = group_table["4+"]

        i_adjusted = i_nominal / (temp_factor * group_factor)
        
        logger.debug(f"Corrección de corriente: {i_nominal:.2f}A → {i_adjusted:.2f}A "
                    f"(temp_factor: {temp_factor}, group_factor: {group_factor})")
        
        return i_adjusted
    
    except KeyError as e:
        logger.warning(f"Configuración incompleta en factores de corrección: {e}. Usando factor 1.0")
        return i_nominal
    except Exception as e:
        logger.error(f"Error aplicando factores de corrección: {e}")
        return i_nominal

def get_commercial_section(theoretical_section_mm2: float, circuit_type: str = "dc_strings") -> Optional[float]:
    """
    Encuentra la sección comercial inmediatamente superior a la teórica
    
    Args:
        theoretical_section_mm2: Sección teórica calculada en mm²
        circuit_type: Tipo de circuito ("dc_strings", "level_1_dc", "ac_circuits", "mv_circuits")
    
    Returns:
        Sección comercial en mm² o None si no se encuentra
    """
    available_sections = get_available_sections(circuit_type)
    
    # Buscar la primera sección mayor o igual a la teórica
    for section in available_sections:
        if section >= theoretical_section_mm2:
            logger.debug(f"Sección seleccionada: {section}mm² para teórica {theoretical_section_mm2:.3f}mm² "
                        f"(tipo: {circuit_type}, normativa: {SECTIONS_CONFIG['normativa_used']})")
            return float(section)
    
    # Si ninguna es suficiente, devolver None y registrar warning
    max_section = float(max(available_sections)) if available_sections else None
    logger.warning(f"Sección teórica {theoretical_section_mm2:.3f}mm² excede máxima disponible "
                  f"{max_section}mm² para tipo {circuit_type} (normativa: {SECTIONS_CONFIG['normativa_used']})")
    return None

def calculate_string_section(row: pd.Series, config: dict, circuit_type: str = "dc_strings") -> dict:
    """Calcula la sección de conductor para un string individual usando configuración de normativa"""
    
    try:
        # Obtener configuración de normativa
        normativa_config = get_normativa_config(SECTIONS_CONFIG.get("normativa_used", "IEC"))
        
        # Extraer datos del row de forma segura
        string_id = str(row.get("string_id", "UNKNOWN"))
        length_pos = float(row.get("length_pos_m", 0))
        length_neg = float(row.get("length_neg_m", 0))
        
        # Validar datos de entrada
        if length_pos <= 0 or length_neg <= 0:
            raise ValueError(f"Longitudes inválidas: pos={length_pos}m, neg={length_neg}m")
        
        # Cálculo corriente ajustada usando config de normativa
        isc_safety_factor = normativa_config["correction_factors"]["isc_safety_factor"]
        i_nominal = config["isc_ref"] * isc_safety_factor
        i_adj = apply_correction_factors(i_nominal, config)

        # Longitud ida y vuelta
        length_total = length_pos + length_neg

        # Resistividad del conductor ajustada a temperatura de operación
        cable_material = config.get("cable_material", normativa_config["cable"]["material"])
        cable_max_temp = config.get("cable_max_temp", normativa_config["cable"]["max_temp"])
        resistivity = get_material_resistivity(cable_material, cable_max_temp)

        # Parámetros de caída de tensión de la normativa
        max_percentage = normativa_config["voltage_drop"]["max_percentage"]
        voltage_drop_pct = max_percentage / 100
        v_ref = config.get("reference_voltage", normativa_config["voltage_drop"]["reference_voltage"])

        # Cálculo sección teórica (resultado en m²)
        s_teorica_m2 = (2 * resistivity * length_total * i_adj) / (v_ref * voltage_drop_pct)
        s_teorica_mm2 = s_teorica_m2 * 1e6  # Convertir a mm²

        # Selección de sección comercial
        s_comercial_mm2 = get_commercial_section(s_teorica_mm2, circuit_type)

        # Calcular parámetros finales con sección comercial
        if s_comercial_mm2:
            s_comercial_m2 = s_comercial_mm2 / 1e6  # Convertir a m²
            v_drop_real = (2 * resistivity * length_total * i_adj) / s_comercial_m2
            v_drop_pct = (v_drop_real / v_ref) * 100
            resistance_total = (2 * resistivity * length_total) / s_comercial_m2
            joule_losses = i_adj ** 2 * resistance_total
            
            # Estado de validación
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

        # Construir resultado
        result = {
            "string_id": string_id,
            "length_total_m": round(length_total, 2),
            "i_nominal": round(i_nominal, 2),
            "i_adjusted": round(i_adj, 2),
            "resistivity": round(resistivity, 6),
            "s_teorica_mm2": round(s_teorica_mm2, 3),
            "s_comercial_mm2": s_comercial_mm2,
            "v_drop_real_volts": round(v_drop_real, 3) if v_drop_real else None,
            "v_drop_real_pct": round(v_drop_pct, 3) if v_drop_pct else None,
            "joule_losses_w": round(joule_losses, 2) if joule_losses else None,
            "reference_voltage": v_ref,
            "max_vdrop_pct": max_percentage,
            "voltage_status": voltage_status,
            "circuit_type": circuit_type,
            "normativa": SECTIONS_CONFIG["normativa_used"],
            "cable_material": cable_material
        }

        logger.debug(f"String {string_id} calculado exitosamente con normativa {SECTIONS_CONFIG['normativa_used']}")
        return result

    except Exception as e:
        logger.error(f"Error calculando string {row.get('string_id', 'UNKNOWN')}: {e}")
        return {
            "string_id": str(row.get("string_id", "UNKNOWN")),
            "error": str(e),
            "status": "ERROR",
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