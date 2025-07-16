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

def calculate_cn1_section(row: pd.Series, config: dict, circuit_type: str = "cn1_inverter") -> dict:
    """
    Calcula sección CN1 con corriente combinada de múltiples strings.
    Construye el circuito_id como cn1-XX-invY directamente desde el row.

    Parameters:
        row: fila del DataFrame con los datos del circuito CN1
        config: configuración con parámetros de cálculo
        circuit_type: tipo de circuito para seleccionar sección comercial

    Returns:
        dict con resultados del cálculo
    """
    try:
        # Validar y normalizar configuración
        config = validate_config_parameters(config)

        # Obtener longitudes
        length_pos = float(row.get("length_pos_m", 0))
        length_neg = float(row.get("length_neg_m", 0))
        if length_pos <= 0 or length_neg <= 0:
            raise ValueError(f"Longitudes inválidas: pos={length_pos}m, neg={length_neg}m")

        # Construir circuit_id desde cn1_id e inverter_id
        cn1_raw = str(row.get("cn1_id", "")).upper()
        inv_raw = str(row.get("inverter_id", "")).upper()
        if cn1_raw.startswith("CN1-") and inv_raw.startswith("INV-"):
            cn1_num = cn1_raw.replace("CN1-", "")  # conserva ceros
            inv_num = inv_raw.replace("INV-", "").lstrip("0") or "0"
            circuit_id = f"cn1-{cn1_num}-inv{inv_num}"
        else:
            circuit_id = "UNKNOWN"

        # Obtener número de strings en paralelo desde config
        parallel_mapping = config.get('cn1_parallel_mapping', {})
        parallel_strings = parallel_mapping.get(circuit_id, 1)
        if circuit_id not in parallel_mapping:
            logger.warning(f"[CN1] circuit_id '{circuit_id}' no encontrado en mapping → se usará 1 string")

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
            "calculation_type": "CN1_COMBINED"
        }

    except Exception as e:
        logger.error(f"Error calculando CN1 '{row.get('cn1_id', 'UNKNOWN')}' + '{row.get('inverter_id', 'UNKNOWN')}': {e}")
        return {
            "circuit_id": str(row.get("cn1_id", "UNKNOWN")),
            "error": str(e),
            "calculation_status": "ERROR",
            "calculation_type": "CN1_COMBINED",
            "normativa": SECTIONS_CONFIG.get("normativa_used", "UNKNOWN")
        }


def enhance_cn1_config_with_parallel_strings(config: dict, project_name: str) -> dict:
    """
    Mejora la configuración CN1 con información de strings en paralelo
    """
    try:
        # Calcular strings en paralelo
        parallel_mapping = calculate_cn1_parallel_strings(project_name)
        
        # Agregar información al config
        enhanced_config = config.copy()
        enhanced_config['cn1_parallel_mapping'] = parallel_mapping
        enhanced_config['cn1_enhanced'] = True
        
        logger.info(f"Configuración CN1 mejorada con {len(parallel_mapping)} mappings de strings")
        return enhanced_config
        
    except Exception as e:
        logger.error(f"Error mejorando configuración CN1: {e}")
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

# ==============================================================================
# 📘 Endpoint IEC CN1 - Con corriente combinada de múltiples strings
# ==============================================================================
@router.get("/calculate-iec-cn1/{project_name}")
def calculate_iec_cn1(project_name: str):
    """
    Calcula cables principales CN1 usando corriente combinada de múltiples strings.
    MEJORADO: Incluye corriente combinada (Isc × número_de_strings_en_paralelo)
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[CN1-IEC] Proyecto: {project_name}")

        # Cargar datos CN1
        df = load_excel_sheet(project_name, sheet_name="dc_cn1_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="No hay datos en 'dc_cn1_circuits'.")

        # NUEVO: Calcular configuración mejorada con strings en paralelo
        base_config = build_calculation_config(
            project_info=project_info,
            normativa="IEC",
            project_name=project_name
        )
        
        # NUEVO: Mejorar config con información de strings en paralelo
        config = enhance_cn1_config_with_parallel_strings(base_config, project_name)
        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        # NUEVO: Usar función de cálculo específica para CN1
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
                # NUEVO: Información CN1 específica
                "cn1_enhanced": config.get('cn1_enhanced', False),
                "total_cn1_mappings": len(config.get('cn1_parallel_mapping', {})),
                # PARÁMETROS PARA EL FRONTEND:
                "factor_reduccion_cn1": 1.0,  # Factor temperatura/agrupamiento combinado
                "factor_seguridad_cn1": config.get('isc_correction', 1.25),
                "caida_max_cn1": config['voltage_drop']['max_percentage'],
                "temp_ambiente_cn1": config.get('ambient_design_temp', 35),
                # ESTADÍSTICAS CN1:
                "parallel_strings_stats": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_range_cn1": get_current_range_from_results(results)
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r]),
                # NUEVO: Estadísticas de corriente combinada
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


# ==============================================================================
# 📙 Endpoint NEC CN1 - Con corriente combinada de múltiples strings
# ==============================================================================
@router.get("/calculate-nec-cn1/{project_name}")
def calculate_nec_cn1(project_name: str):
    """
    Calcula cables principales CN1 usando corriente combinada de múltiples strings.
    MEJORADO: Incluye corriente combinada (Isc × número_de_strings_en_paralelo)
    """
    try:
        project_info = extract_project_info(project_name)
        logger.info(f"[CN1-NEC] Proyecto: {project_name}")

        # Cargar datos CN1
        df = load_excel_sheet(project_name, sheet_name="dc_cn1_circuits")
        if df.empty:
            raise HTTPException(status_code=400, detail="No hay datos en 'dc_cn1_circuits'.")

        # NUEVO: Calcular configuración mejorada con strings en paralelo
        base_config = build_calculation_config(
            project_info=project_info,
            normativa="NEC",
            project_name=project_name
        )
        
        # NUEVO: Mejorar config con información de strings en paralelo
        config = enhance_cn1_config_with_parallel_strings(base_config, project_name)
        config["project_name"] = project_name
        config["_metadata"]["project_name"] = project_name

        # NUEVO: Usar función de cálculo específica para CN1
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
                # NUEVO: Información CN1 específica
                "cn1_enhanced": config.get('cn1_enhanced', False),
                "total_cn1_mappings": len(config.get('cn1_parallel_mapping', {})),
                # PARÁMETROS PARA EL FRONTEND:
                "factor_reduccion_cn1": 1.0,  # Factor temperatura/agrupamiento combinado
                "factor_seguridad_cn1": config.get('isc_correction', 1.25),
                "caida_max_cn1": config['voltage_drop']['max_percentage'],
                "temp_ambiente_cn1": config.get('ambient_design_temp', 35),
                # ESTADÍSTICAS CN1:
                "parallel_strings_stats": get_parallel_strings_range(config.get('cn1_parallel_mapping', {})),
                "current_range_cn1": get_current_range_from_results(results)
            },
            "results": results,
            "summary": {
                "total_circuits": len(results),
                "successful_calculations": len([r for r in results if "error" not in r]),
                "errors": len([r for r in results if "error" in r]),
                # NUEVO: Estadísticas de corriente combinada
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
    
def calculate_cn1_parallel_strings(project_name: str) -> dict:
    """
    Calcula el número de strings en paralelo por cada CN1 + Inversor (circuit_id = cn1-XX-invY)

    Returns:
        dict: {circuit_id: cantidad de strings en paralelo}
    """
    try:
        df = load_excel_sheet(project_name, sheet_name="dc_string_circuits")

        if df.empty:
            logger.warning("La hoja 'dc_string_circuits' está vacía.")
            return {}

        if "cn1_id" not in df.columns or "inverter_id" not in df.columns:
            logger.warning("Faltan columnas 'cn1_id' o 'inverter_id' en hoja dc_string_circuits.")
            return {}

        # Construir los circuit_id combinados tipo cn1-01-inv1
        df["cn1_id_str"] = df["cn1_id"].astype(str).str.upper()
        df["inverter_id_str"] = df["inverter_id"].astype(str).str.upper()

        def build_circuit_id(row):
            cn1_raw = row["cn1_id_str"]
            inv_raw = row["inverter_id_str"]
            if cn1_raw.startswith("CN1-") and inv_raw.startswith("INV-"):
                cn1_num = cn1_raw.replace("CN1-", "")  # SE CONSERVAN LOS CEROS
                inv_num = inv_raw.replace("INV-", "").lstrip("0") or "0"
                return f"cn1-{cn1_num}-inv{inv_num}"
            return "UNKNOWN"

        df["circuit_id"] = df.apply(build_circuit_id, axis=1)

        # Contar cuántos strings hay por cada combinación CN1 + Inversor
        mapping = df["circuit_id"].value_counts().to_dict()

        logger.info(f"Calculados strings en paralelo para {len(mapping)} circuitos CN1")
        return mapping

    except Exception as e:
        logger.error(f"Error al calcular strings en paralelo por CN1: {e}")
        return {}
