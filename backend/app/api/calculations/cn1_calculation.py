# backend/app/api/calculations/cn1_calculation.py

from fastapi import APIRouter, HTTPException
import logging
import json
from app.services.loader.project_loader import extract_project_info
from app.services.config_loader import build_calculation_config
from app.services.calculation.string_calculator import calculate_all_strings, calculate_all_cn1_circuits
from app.utils.filesystem import load_excel_sheet
import pandas as pd


router = APIRouter()
logger = logging.getLogger(__name__)

def normalize_circuit_id_from_cn1_table(cn1_circuit_id: str, inverter_id: str) -> str:
    """
    Normaliza circuit_id cuando viene de la tabla dc_cn1_circuits
    
    Args:
        cn1_circuit_id: circuit_id de la tabla CN1 (ej: "cn1-1", "cn1-2")
        inverter_id: ID del inversor (ej: "INV-1")
    
    Returns:
        str: circuit_id normalizado para mapeo (ej: "cn1-01-inv1")
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

def normalize_circuit_id(cn1_id: str, inverter_id: str) -> str:
    """
    Normaliza circuit_id de forma consistente para mapeo correcto
    
    Args:
        cn1_id: ID del CN1 (ej: "CN1-01", "CN1-1", "cn1-01")
        inverter_id: ID del inversor (ej: "INV-01", "INV-1", "inv-01")
    
    Returns:
        str: circuit_id normalizado (ej: "cn1-01-inv1")
    """
    try:
        # Normalizar CN1
        cn1_str = str(cn1_id).upper().strip()
        if cn1_str.startswith("CN1-"):
            cn1_num = cn1_str.replace("CN1-", "").zfill(2)  # Asegurar 2 dígitos
        else:
            cn1_num = str(cn1_id).zfill(2)
        
        # Normalizar Inversor
        inv_str = str(inverter_id).upper().strip()
        if inv_str.startswith("INV-"):
            inv_num = inv_str.replace("INV-", "").lstrip("0") or "0"
        else:
            inv_num = str(inverter_id).lstrip("0") or "0"
        
        circuit_id = f"cn1-{cn1_num}-inv{inv_num}"
        return circuit_id
        
    except Exception as e:
        logger.error(f"Error normalizando circuit_id: cn1={cn1_id}, inv={inverter_id} -> {e}")
        return "UNKNOWN"

def calculate_cn1_section(row: pd.Series, config: dict, circuit_type: str = "cn1_inverter") -> dict:
    """
    Calcula sección CN1 con corriente combinada de múltiples strings.
    CORREGIDO: Maneja tanto cn1_id como circuit_id según la estructura de datos
    """
    try:
        # Validar y normalizar configuración
        config = validate_config_parameters(config)

        # Obtener longitudes
        length_pos = float(row.get("length_pos_m", 0))
        length_neg = float(row.get("length_neg_m", 0))
        if length_pos <= 0 or length_neg <= 0:
            raise ValueError(f"Longitudes inválidas: pos={length_pos}m, neg={length_neg}m")

        # CORREGIDO: Para tabla dc_cn1_circuits, convertir cn1-X → cn1-0X-inv1
        if 'circuit_id' in row and pd.notna(row['circuit_id']):
            cn1_raw = str(row['circuit_id'])  # ej: "cn1-1"
            inverter_id = str(row.get("inverter_id", ""))
            circuit_id = normalize_circuit_id_from_cn1_table(cn1_raw, inverter_id)
        else:
            # Si no, usar cn1_id + inverter_id (tabla dc_string_circuits)
            cn1_id = row.get("cn1_id", "")
            inverter_id = row.get("inverter_id", "")
            circuit_id = normalize_circuit_id(cn1_id, inverter_id)

        # Obtener número de strings en paralelo desde config
        parallel_mapping = config.get('cn1_parallel_mapping', {})
        parallel_strings = parallel_mapping.get(circuit_id, 1)
        
        # Debug logging mejorado
        if circuit_id not in parallel_mapping:
            logger.warning(f"[CN1] circuit_id '{circuit_id}' no encontrado en mapping")
            logger.warning(f"[CN1] Available mappings: {list(parallel_mapping.keys())[:5]}...")
            logger.warning(f"[CN1] Raw inputs: cn1_id='{cn1_id}', inverter_id='{inverter_id}'")
        else:
            logger.info(f"[CN1] {circuit_id}: encontrado {parallel_strings} strings en paralelo")

        # Corriente base (Isc) y combinada
        isc_base = config["isc_ref"]
        isc_combined = isc_base * parallel_strings
        isc_safety_factor = config.get("isc_correction", 1.25)
        i_nominal = isc_combined * isc_safety_factor

        logger.info(
            f"[CN1] {circuit_id}: {parallel_strings} strings × {isc_base:.2f} A = {isc_combined:.2f} A → nominal: {i_nominal:.2f} A"
        )

        # Aplicar factores de corrección de corriente (temperatura, agrupamiento)
        i_adj = apply_correction_factors(i_nominal, config)

        # Longitud total del tramo CN1
        length_total = length_pos + length_neg

        # Resistividad corregida por temperatura
        material = config.get("cable", {}).get("material", "copper")
        temp_operating = config.get("correction_factors", {}).get("ambient_temperature", {}).get("current_ambient", 30)
        resistivity_ohm_mm2_per_m = get_material_resistivity(material, temp_operating)

        # Parámetros de caída de tensión
        max_percentage = config["voltage_drop"]["max_percentage"]
        v_ref = config["voltage_drop"]["reference_voltage"]
        max_voltage_drop_v = v_ref * (max_percentage / 100)

        if max_voltage_drop_v <= 0:
            raise ValueError(f"Caída de tensión máxima inválida: {max_voltage_drop_v} V")

        # Cálculo sección teórica
        numerator = 2 * resistivity_ohm_mm2_per_m * length_total * i_adj
        s_teorica_mm2 = numerator / max_voltage_drop_v
        if s_teorica_mm2 <= 0:
            raise ValueError(f"Sección teórica inválida: {s_teorica_mm2} mm²")

        # Obtener sección comercial
        s_comercial_mm2 = get_commercial_section(s_teorica_mm2, circuit_type)

        if s_comercial_mm2 and s_comercial_mm2 > 0:
            v_drop_real = (2 * resistivity_ohm_mm2_per_m * length_total * i_adj) / s_comercial_mm2
            v_drop_pct = (v_drop_real / v_ref) * 100
            resistance_total = (2 * resistivity_ohm_mm2_per_m * length_total) / s_comercial_mm2
            joule_losses = (i_adj ** 2) * resistance_total

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
            resistance_total = None
            voltage_status = "NO_SECTION"

        return {
            "circuit_id": circuit_id,
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
            "calculation_type": "CN1_COMBINED",
            # Debug info
            "debug_info": {
                "raw_cn1_id": str(cn1_id),
                "raw_inverter_id": str(inverter_id),
                "normalized_circuit_id": circuit_id,
                "mapping_found": circuit_id in parallel_mapping,
                "available_mappings_count": len(parallel_mapping)
            }
        }

    except Exception as e:
        logger.error(f"Error calculando CN1 '{row.get('cn1_id', 'UNKNOWN')}' + '{row.get('inverter_id', 'UNKNOWN')}': {e}")
        return {
            "circuit_id": normalize_circuit_id(row.get("cn1_id", ""), row.get("inverter_id", "")),
            "error": str(e),
            "calculation_status": "ERROR",
            "calculation_type": "CN1_COMBINED",
            "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
        }

def calculate_cn1_parallel_strings(project_name: str) -> dict:
    """
    Calcula el número de strings en paralelo por cada CN1 + Inversor
    CORREGIDO: Mapea correctamente CN1-XX → cn1-XX-invY
    """
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

        # CORREGIDO: Mapear CN1-XX a cn1-XX-invY para que coincida con tabla dc_cn1_circuits
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
        sample_mapped = df[["cn1_id", "inverter_id", "mapping_circuit_id"]].head(3)
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

def enhance_cn1_config_with_parallel_strings(config: dict, project_name: str) -> dict:
    """
    Mejora la configuración CN1 con información de strings en paralelo
    CORREGIDO: Usa función de string_calculator.py
    """
    try:
        logger.info(f"[DEBUG] enhance_cn1_config_with_parallel_strings INICIANDO para {project_name}")
        
        # CORREGIDO: Usar función de string_calculator.py
        parallel_mapping = calculate_cn1_parallel_strings(project_name)
        
        logger.info(f"[DEBUG] parallel_mapping obtenido: {parallel_mapping}")
        
        # Agregar información al config
        enhanced_config = config.copy()
        enhanced_config['cn1_parallel_mapping'] = parallel_mapping
        enhanced_config['cn1_enhanced'] = True
        
        # Logging mejorado
        if parallel_mapping:
            total_mappings = len(parallel_mapping)
            min_strings = min(parallel_mapping.values()) if parallel_mapping else 1
            max_strings = max(parallel_mapping.values()) if parallel_mapping else 1
            
            logger.info(f"[DEBUG] Configuración CN1 mejorada: {total_mappings} mappings, "
                       f"strings: {min_strings}-{max_strings}")
            
            # Log de los primeros mappings para verificar
            for i, (circuit_id, count) in enumerate(sorted(parallel_mapping.items())[:3]):
                logger.info(f"[DEBUG] Mapping {i+1}: {circuit_id} → {count} strings")
        else:
            logger.warning("[DEBUG] ¡ATENCIÓN! No se encontraron mappings de strings en paralelo")
        
        return enhanced_config
        
    except Exception as e:
        logger.error(f"[DEBUG] Error mejorando configuración CN1: {e}")
        return config

def get_parallel_strings_range(parallel_mapping: dict) -> dict:
    """Helper para estadísticas de strings en paralelo"""
    if not parallel_mapping:
        return {"min": 1, "max": 1, "total_mappings": 0}
    
    values = list(parallel_mapping.values())
    return {
        "min": min(values),
        "max": max(values),
        "total_mappings": len(values)
    }

# Rest of the functions remain the same...
def get_current_range_from_results(results: list) -> dict:
    """Extrae rango de corrientes de los resultados CN1"""
    successful_results = [r for r in results if "error" not in r and "isc_combined" in r]
    
    if not successful_results:
        return {"min": 0, "max": 0, "average": 0}
    
    currents = [r["isc_combined"] for r in successful_results]
    return {
        "min": round(min(currents), 1),
        "max": round(max(currents), 1), 
        "average": round(sum(currents) / len(currents), 1)
    }

def get_section_range_from_results(results: list) -> dict:
    """Extrae rango de secciones de los resultados CN1"""
    successful_results = [r for r in results if "error" not in r and "s_comercial_mm2" in r]
    
    if not successful_results:
        return {"min": 0, "max": 0, "most_common": 0}
    
    sections = [r["s_comercial_mm2"] for r in successful_results if r["s_comercial_mm2"]]
    if not sections:
        return {"min": 0, "max": 0, "most_common": 0}
    
    from collections import Counter
    most_common = Counter(sections).most_common(1)[0][0]
    
    return {
        "min": min(sections),
        "max": max(sections),
        "most_common": most_common
    }

# Los endpoints permanecen igual...
@router.get("/calculate-iec-cn1/{project_name}")
def calculate_iec_cn1(project_name: str):
    """
    Calcula cables principales CN1 usando corriente combinada de múltiples strings.
    CORREGIDO: Usa normalización consistente de circuit_id
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[CN1-IEC] Proyecto: {project_name}")

        # Cargar datos CN1
        df = load_excel_sheet(project_name, sheet_name="dc_cn1_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="No hay datos en 'dc_cn1_circuits'.")

        # Calcular configuración mejorada con strings en paralelo
        base_config = build_calculation_config(
            project_info=project_info,
            normativa="IEC",
            project_name=project_name
        )
        
        # Mejorar config con información de strings en paralelo
        config = enhance_cn1_config_with_parallel_strings(base_config, project_name)
        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        # Usar función de cálculo específica para CN1
        results = calculate_all_cn1_circuits(df, config, circuit_type="cn1_inverter")

        # Respuesta con información mejorada
        response_data = {
            "project_name": project_name,
            "circuit_type": "cn1_inverter",
            "normative": "IEC",
            "has_project_overrides": config['_metadata']['normativa_config'].get('has_project_overrides', False),
            "panel_info": {
                "model": project_info.get('panel_model', 'N/A'),
                "isc": config.get('isc_ref', 0),
                "power": config.get('power_stc', 0)
            },
            "calculation_params": {
                "isc_correction": config.get('isc_correction', 1.25),
                "cable_material": config['cable']['material'],
                "installation_method": config['installation']['method'],
                "max_voltage_drop": config['voltage_drop']['max_percentage'],
                "cn1_enhanced": config.get('cn1_enhanced', False),
                "total_cn1_mappings": len(config.get('cn1_parallel_mapping', {})),
                "factor_reduccion_cn1": 1.0,
                "factor_seguridad_cn1": config.get('isc_correction', 1.25),
                "caida_max_cn1": config['voltage_drop']['max_percentage'],
                "temp_ambiente_cn1": config.get('ambient_design_temp', 35),
                "parallel_strings_stats": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_range_cn1": get_current_range_from_results(results)
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r]),
                "parallel_strings_range": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_statistics": get_current_range_from_results(results),
                "section_statistics": get_section_range_from_results(results)
            },
            "metadata": config['_metadata']
        }

        return response_data

    except Exception as e:
        logger.error(f"[CN1-IEC] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error CN1-IEC: {str(e)}")

@router.get("/calculate-nec-cn1/{project_name}")
def calculate_nec_cn1(project_name: str):
    """
    Calcula cables principales CN1 usando corriente combinada de múltiples strings.
    CORREGIDO: Usa normalización consistente de circuit_id
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[CN1-NEC] Proyecto: {project_name}")

        # Cargar datos CN1
        df = load_excel_sheet(project_name, sheet_name="dc_cn1_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="No hay datos en 'dc_cn1_circuits'.")

        # Calcular configuración mejorada con strings en paralelo
        base_config = build_calculation_config(
            project_info=project_info,
            normativa="NEC",
            project_name=project_name
        )
        
        # Mejorar config con información de strings en paralelo
        config = enhance_cn1_config_with_parallel_strings(base_config, project_name)
        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        # Usar función de cálculo específica para CN1
        results = calculate_all_cn1_circuits(df, config, circuit_type="cn1_inverter")

        # Respuesta con información mejorada
        response_data = {
            "project_name": project_name,
            "normative": "NEC", 
            "circuit_type": "cn1_inverter",
            "has_project_overrides": config['_metadata']['normativa_config'].get('has_project_overrides', False),
            "panel_info": {
                "model": project_info.get('panel_model', 'N/A'),
                "isc": config.get('isc_ref', 0),
                "power": config.get('power_stc', 0)
            },
            "calculation_params": {
                "isc_correction": config.get('isc_correction', 1.25),
                "cable_material": config['cable']['material'],
                "installation_method": config['installation']['method'],
                "max_voltage_drop": config['voltage_drop']['max_percentage'],
                "cn1_enhanced": config.get('cn1_enhanced', False),
                "total_cn1_mappings": len(config.get('cn1_parallel_mapping', {})),
                "factor_reduccion_cn1": 1.0,
                "factor_seguridad_cn1": config.get('isc_correction', 1.25),
                "caida_max_cn1": config['voltage_drop']['max_percentage'],
                "temp_ambiente_cn1": config.get('ambient_design_temp', 35),
                "parallel_strings_stats": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_range_cn1": get_current_range_from_results(results)
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r]),
                "parallel_strings_range": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_statistics": get_current_range_from_results(results),
                "section_statistics": get_section_range_from_results(results)
            },
            "metadata": config['_metadata']
        }

        return response_data

    except Exception as e:
        logger.error(f"[CN1-NEC] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error CN1-NEC: {str(e)}")