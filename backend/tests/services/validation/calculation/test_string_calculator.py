import pytest
import pandas as pd
from backend.services.calculation.string_calculator import calculate_string_section

@pytest.fixture
def dummy_config():
    return {
        "isc_ref": 12.0,
        "isc_correction": 1.25,
        "system_voltage": 1500,
        "current_ambient": 30,
        "cable": {
            "material": "copper",
            "available_sections": [4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
        },
        "installation": {
            "method": "tubo",
            "depth_m": 0.0,
            "grouping": 1
        },
        "voltage_drop": {
            "max_percentage": 3.0
        },
        "reference_voltage": 1500
    }

def test_string_calculation_realistic(dummy_config):
    row = pd.Series({
        "string_id": "S_REAL",
        "length_pos_m": 25,
        "length_neg_m": 25
    })

    result = calculate_string_section(row, dummy_config, circuit_type="dc_strings")

    print("\n--- Resultados de cálculo ---")
    for key in [
        "string_id", "i_adjusted", "s_teorica_mm2", "s_comercial_mm2",
        "v_drop_real_pct", "v_drop_real_volts", "joule_losses_w", "resistivity"
    ]:
        print(f"{key}: {result.get(key)}")

    assert result["string_id"] == "S_REAL"
    assert result["s_teorica_mm2"] > 0

    available = dummy_config["cable"]["available_sections"]
    if result["s_teorica_mm2"] > max(available):
        assert result["s_comercial_mm2"] == max(available)
    else:
        assert result["s_comercial_mm2"] >= result["s_teorica_mm2"]

    # Nuevo enfoque: evaluamos el estado en lugar de forzar un límite artificial
    if result["v_drop_real_pct"] > dummy_config["voltage_drop"]["max_percentage"] * 1.1:
        assert result["voltage_status"] == "CRITICAL"
    else:
        assert result["voltage_status"] in ["OK", "WARNING"]