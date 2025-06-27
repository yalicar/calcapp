import yaml
import math
from pathlib import Path
import pandas as pd

# Cargar configuración global
from backend.services.config_loader import load_yaml_config

CONFIG = load_yaml_config("backend/configs/string_config.yaml")

# Cargar propiedades del material
with open("backend/configs/material_properties.yaml") as f:
    MATERIALS = yaml.safe_load(f)["materials"]

# Cargar secciones comerciales
with open("backend/configs/standard_sections.yaml") as f:
    STANDARD_SECTIONS = yaml.safe_load(f)["standard_sections"]["mm2"]

def get_material_resistivity(material_name: str, temp_operating: float) -> float:
    props = MATERIALS[material_name]
    rho_20 = props["resistivity_20C"]
    alpha = props["temp_coefficient"]
    return rho_20 * (1 + alpha * (temp_operating - 20))

def apply_correction_factors(i_nominal: float, config: dict) -> float:
    temp_corr = config["correction_factors"]["ambient_temperature"]
    grouping_corr = config["correction_factors"]["grouping"]

    current_ambient = temp_corr["current_ambient"]
    temp_factor = temp_corr["values"].get(str(current_ambient), 1.0)

    method = config["installation"]["method"]
    layout = config["installation"]["layout"]
    number_of_circuits = config["number_of_parallel_strings"]

    if method == "buried":
        group_table = grouping_corr[method][layout]["values"]
    else:
        group_table = grouping_corr[method]["values"]

    group_factor = 1.0
    if str(number_of_circuits) in group_table:
        group_factor = group_table[str(number_of_circuits)]
    elif "10+" in group_table and number_of_circuits >= 10:
        group_factor = group_table["10+"]
    elif "6+" in group_table and number_of_circuits >= 6:
        group_factor = group_table["6+"]

    return i_nominal / (temp_factor * group_factor)

def calculate_string_section(row: pd.Series, config: dict) -> dict:
    # Cálculo corriente ajustada
    i_nominal = config["isc_ref"] * config["isc_correction"]
    i_adj = apply_correction_factors(i_nominal, config)

    # Longitud ida y vuelta
    length_total = row["length_pos_m"] + row["length_neg_m"]

    # Resistividad del conductor ajustada a temperatura de operación
    resistivity = get_material_resistivity(config["cable"]["material"], config["cable"]["max_temp"])

    # Parámetros de caída de tensión
    max_percentage = config["voltage_drop"]["max_percentage"]
    voltage_drop_pct = max_percentage / 100
    v_ref = config["voltage_drop"]["reference_voltage"]

    # Cálculo sección teórica
    s_teorica = (2 * resistivity * length_total * i_adj) / (v_ref * voltage_drop_pct)
    s_comercial = next((s for s in STANDARD_SECTIONS if s >= s_teorica * 1e6), None)

    # Calcular caída de tensión y pérdidas Joule con sección comercial
    if s_comercial:
        s_comercial_m2 = s_comercial / 1e6
        v_drop_real = (2 * resistivity * length_total * i_adj) / s_comercial_m2
        v_drop_pct = (v_drop_real / v_ref) * 100
        resistance_total = (2 * resistivity * length_total) / s_comercial_m2
        joule_losses = i_adj ** 2 * resistance_total
    else:
        v_drop_real = None
        v_drop_pct = None
        joule_losses = None

    return {
        "string_id": row["string_id"],
        "length_total_m": length_total,
        "i_nominal": round(i_nominal, 2),
        "i_adjusted": round(i_adj, 2),
        "resistivity": resistivity,
        "s_teorica_mm2": round(s_teorica * 1e6, 2),
        "s_comercial_mm2": s_comercial,
        "v_drop_real_volts": round(v_drop_real, 2) if v_drop_real else None,
        "v_drop_real_pct": round(v_drop_pct, 2) if v_drop_pct else None,
        "joule_losses_w": round(joule_losses, 2) if joule_losses else None,
        "reference_voltage": v_ref,
        "max_vdrop_pct": max_percentage
    }


def calculate_all_strings(df: pd.DataFrame, config: dict) -> list:
    results = []
    for _, row in df.iterrows():
        result = calculate_string_section(row, config)
        results.append(result)
    return results
