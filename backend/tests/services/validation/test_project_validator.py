import pytest
import pandas as pd
from backend.services.validation import project_validator as pv

# =============================================================================
# HELPER FUNCTION: Construye un DataFrame en estructura vertical para pruebas
# =============================================================================
def make_vertical_df(data: dict) -> pd.DataFrame:
    return pd.DataFrame([
        {"Campo": k, "Valor": v, "Prioridad": "Prioritario"} for k, v in data.items()
    ])

# =============================================================================
# TESTS GENERALES PARA VALIDACIÓN VERTICAL DE project_info
# =============================================================================

def test_validate_project_info_vertical_valid():
    """✅ Todos los campos obligatorios válidos — debe pasar sin errores ni warnings"""
    data = {
        "project_name": "Solar Project A",
        "installed_capacity_dc_kw": 50000,
        "installed_capacity_ac_kw": 45000,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34500,
        "inverter_brand": "Sungrow",
        "inverter_model": "SG8800UD-MV",
        "number_of_inverters": 2,
        "inverter_station_model": "Central MV Type A",
        "panel_brand": "Canadian Solar",
        "panel_model": "CS6X-300M",
        "number_of_panels": 183334,
        "number_of_panels_per_string": 28,
        "latitude": 14.1,
        "longitude": -87.2
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] == "valid"



def test_validate_project_info_missing_required_fields():
    """❌ Faltan campos obligatorios — debe marcar error e incluir formulario de completado"""
    data = {
        "project_name": "Test Project",
        "installed_capacity_dc_kw": 100000
        # faltan otros
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] == "incomplete"
    assert "Campo prioritario faltante: installed_capacity_ac_kw" in result["errors"]
    assert result["completion_form"] is not None

def test_validate_project_info_invalid_field_value():
    """❌ Valor inválido en campo numérico — debe fallar"""
    data = {
        "project_name": "Bad Project",
        "installed_capacity_dc_kw": 0,  # inválido: < 1
        "installed_capacity_ac_kw": 45000,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34000,
        "inverter_brand": "Sungrow",
        "inverter_model": "SG8800UD-MV",
        "number_of_inverters": 2,
        "inverter_station_model": "Central MV Type A",
        "panel_brand": "Canadian Solar",
        "panel_model": "CS6X-300M",
        "number_of_panels": 183334,
        "number_of_panels_per_string": 28
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] == "invalid"
    assert any("debe ser mayor o igual a" in e for e in result["errors"])

def test_validate_project_info_with_warnings():
    """⚠️ Campos opcionales con errores — debe pasar con advertencias"""
    data = {
        "project_name": "Warn Project",
        "installed_capacity_dc_kw": 50000,
        "installed_capacity_ac_kw": 45000,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34000,
        "inverter_brand": "Sungrow",
        "inverter_model": "SG8800UD-MV",
        "number_of_inverters": 2,
        "inverter_station_model": "Central MV Type A",
        "panel_brand": "Canadian Solar",
        "panel_model": "CS6X-300M",
        "number_of_panels": 183334,
        "number_of_panels_per_string": 28,
        "latitude": 99.0,
        "longitude": -200.0
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] in ("valid_with_warnings", "invalid")
    assert any("Latitud" in e or "Longitud" in e for e in result["errors"] + result["warnings"])

def test_validate_project_info_cross_reference_errors():
    """❌ Ratio DC/AC fuera de rango — debe mostrar advertencia"""
    data = {
        "project_name": "Bad Ratio",
        "installed_capacity_dc_kw": 200,
        "installed_capacity_ac_kw": 100,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34000,
        "inverter_brand": "Huawei",
        "inverter_model": "HUA-1000TL",
        "number_of_inverters": 1,
        "inverter_station_model": "X Model",
        "panel_brand": "LONGi Solar",
        "panel_model": "LR6-72H",
        "number_of_panels": 100,
        "number_of_panels_per_string": 100
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert any("Ratio DC/AC muy alto" in e for e in result["errors"])

# =============================================================================
# TESTS DE VALIDACIÓN DE CAMPO ÚNICO (AJAX)
# =============================================================================

def test_validate_single_field_valid():
    """✅ Campo único válido"""
    result = pv.validate_single_field("design_voltage_dc", 1500)
    assert result["status"] == "valid"
    assert result["is_valid"]

def test_validate_single_field_invalid():
    """❌ Campo único con valor inválido"""
    result = pv.validate_single_field("number_of_panels_per_string", 100)
    assert result["status"] == "invalid"
    assert "debe ser" in result["message"].lower()

# =============================================================================
# TESTS DE DETECCIÓN DE ESTRUCTURA
# =============================================================================

def test_validate_project_info_unknown_structure():
    """❌ DataFrame sin estructura reconocida"""
    df = pd.DataFrame({"foo": [1], "bar": [2]})
    errors = pv.validate_project_info(df)
    assert "estructura" in errors[0].lower()
# =============================================================================
# TESTS ADICIONALES PARA VALIDACIONES ESPECIALES (FORMATOS Y RATIOS)
# =============================================================================

def test_project_name_with_invalid_characters():
    """❌ project_name con caracteres inválidos — debe fallar por formato"""
    data = {
        "project_name": "Solar@2025!!",
        "installed_capacity_dc_kw": 50000,
        "installed_capacity_ac_kw": 45000,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34500,
        "inverter_brand": "Sungrow",
        "inverter_model": "SG8800UD-MV",
        "number_of_inverters": 2,
        "inverter_station_model": "Central MV Type A",
        "panel_brand": "Canadian Solar",
        "panel_model": "CS6X-300M",
        "number_of_panels": 183334,
        "number_of_panels_per_string": 28,
        "latitude": 14.1,
        "longitude": -87.2
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] == "invalid"
    assert any("formato inválido" in e for e in result["errors"])

def test_low_dc_ac_ratio_warning():
    """⚠️ Ratio DC/AC muy bajo — debe generar advertencia o error"""
    data = {
        "project_name": "Low Ratio",
        "installed_capacity_dc_kw": 40000,
        "installed_capacity_ac_kw": 50000,
        "design_voltage_dc": 1500,
        "design_voltage_ac_volt": 480,
        "design_voltage_mv_volt": 34500,
        "inverter_brand": "Sungrow",
        "inverter_model": "SG8800UD-MV",
        "number_of_inverters": 2,
        "inverter_station_model": "Central MV Type A",
        "panel_brand": "Canadian Solar",
        "panel_model": "CS6X-300M",
        "number_of_panels": 183334,
        "number_of_panels_per_string": 28,
        "latitude": 14.1,
        "longitude": -87.2
    }
    df = make_vertical_df(data)
    result = pv.validate_project_info_vertical(df)
    assert result["status"] in ["invalid", "valid_with_warnings"]
    assert any("AC no puede ser mayor" in e or "Ratio DC/AC muy bajo" in e for e in result["errors"])

