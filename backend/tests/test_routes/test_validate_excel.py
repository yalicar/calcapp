import os
import shutil
import pandas as pd
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# =============================================================================
# FUNCIÓN AUXILIAR PARA CREAR ARCHIVOS EXCEL DE PRUEBA (válido o inválido)
# =============================================================================
def create_excel_file(project_name: str, valid: bool = True):
    """
    Crea un archivo Excel de prueba con datos válidos o inválidos,
    en la ruta esperada por el validador: projects/{project_name}/input.xlsx

    Args:
        project_name: Nombre del proyecto (carpeta de destino).
        valid: Si True, genera un archivo completo y válido. Si False, incompleto.

    Este archivo será consumido por el endpoint GET /data/validate-excel-content/{project_name}
    """
    # Ruta del archivo Excel
    path = Path(f"projects/{project_name}")
    path.mkdir(parents=True, exist_ok=True)
    file_path = path / "input.xlsx"

    if valid:
        # ------------------------ HOJA 1: project_info ------------------------
        project_info = pd.DataFrame([
            {"Campo": "project_name", "Valor": "Test Project", "Prioridad": "Prioritario"},
            {"Campo": "installed_capacity_dc_kw", "Valor": 50000, "Prioridad": "Prioritario"},
            {"Campo": "installed_capacity_ac_kw", "Valor": 45000, "Prioridad": "Prioritario"},
            {"Campo": "design_voltage_dc", "Valor": 1500, "Prioridad": "Prioritario"},
            {"Campo": "design_voltage_ac_volt", "Valor": 480, "Prioridad": "Prioritario"},
            {"Campo": "design_voltage_mv_volt", "Valor": 34500, "Prioridad": "Prioritario"},
            {"Campo": "inverter_brand", "Valor": "Sungrow", "Prioridad": "Prioritario"},
            {"Campo": "inverter_model", "Valor": "SG8800UD-MV", "Prioridad": "Prioritario"},
            {"Campo": "number_of_inverters", "Valor": 2, "Prioridad": "Prioritario"},
            {"Campo": "inverter_station_model", "Valor": "Central MV", "Prioridad": "Prioritario"},
            {"Campo": "panel_brand", "Valor": "LONGi Solar", "Prioridad": "Prioritario"},
            {"Campo": "panel_model", "Valor": "LR5-72H", "Prioridad": "Prioritario"},
            {"Campo": "number_of_panels", "Valor": 10000, "Prioridad": "Prioritario"},
            {"Campo": "number_of_panels_per_string", "Valor": 28, "Prioridad": "Prioritario"},
            {"Campo": "latitude", "Valor": 14.1, "Prioridad": "No prioritario"},
            {"Campo": "longitude", "Valor": -87.2, "Prioridad": "No prioritario"}
        ])

        # ------------------------ HOJA 2: dc_string_circuits ------------------------
        dc_string = pd.DataFrame([
            {
                "string_id": "str-01-01-CN1-01-01",
                "inverter_id": "INV-1",
                "length_pos_m": 30,
                "length_neg_m": 30,
                "cn1_id": "CN1-01"
            }
        ])

        # ------------------------ HOJA 3: dc_cn1_circuits ------------------------
        dc_cn1 = pd.DataFrame([
            {
                "circuit_id": "cn1-01",
                "inverter_id": "INV-1",
                "length_pos_m": 60,
                "length_neg_m": 60
            }
        ])

        # ------------------------ HOJA 4: mv_circuits ------------------------
        mv_circuits = pd.DataFrame([
            {
                "circuit_id": "MV-1",
                "phases": 3,
                "length_m": 100,
                "section_mm2": 240
            }
        ])

    else:
        # Archivo inválido — faltan campos requeridos y hojas con columnas inválidas
        project_info = pd.DataFrame([
            {"Campo": "project_name", "Valor": "Bad Project", "Prioridad": "Prioritario"},
            {"Campo": "installed_capacity_dc_kw", "Valor": 0, "Prioridad": "Prioritario"}
        ])
        dc_string = pd.DataFrame([{"foo": 1}])
        dc_cn1 = pd.DataFrame([{"bar": 2}])
        mv_circuits = pd.DataFrame([{"baz": 3}])

    # Guardar archivo Excel con las hojas
    with pd.ExcelWriter(file_path) as writer:
        project_info.to_excel(writer, sheet_name="project_info", index=False)
        dc_string.to_excel(writer, sheet_name="dc_string_circuits", index=False)
        dc_cn1.to_excel(writer, sheet_name="dc_cn1_circuits", index=False)
        mv_circuits.to_excel(writer, sheet_name="mv_circuits", index=False)


# =============================================================================
# TEST 1: Validación exitosa de archivo correcto
# =============================================================================
def test_validate_excel_success():
    """
    ✅ Debe validar correctamente un archivo Excel válido.
    Espera status 200 y mensaje de éxito.
    """
    project_name = "test_valid_project"
    create_excel_file(project_name, valid=True)

    response = client.get(f"/data/validate-excel-content/{project_name}")
    assert response.status_code == 200
    assert response.json()["message"] == "Excel content is valid."

    # Limpieza
    shutil.rmtree(Path(f"projects/{project_name}"))


# =============================================================================
# TEST 2: Validación con errores en archivo inválido
# =============================================================================
def test_validate_excel_with_errors():
    """
    ❌ Archivo Excel inválido (faltan campos o estructuras).
    Espera status 400 y lista de errores. El archivo debe ser eliminado.
    """
    project_name = "test_invalid_project"
    create_excel_file(project_name, valid=False)

    response = client.get(f"/data/validate-excel-content/{project_name}")
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], list)
    assert len(response.json()["detail"]) > 0

    # Verifica que el archivo haya sido eliminado
    assert not Path(f"projects/{project_name}/input.xlsx").exists()
