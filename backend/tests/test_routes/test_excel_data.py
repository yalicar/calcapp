import pandas as pd
import os
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# =============================================================================
# TEST 1: Extracción de datos con archivo válido
# =============================================================================
def test_get_complete_excel_data_success():
    """
    Verifica que el endpoint /excel-data/{project_name} retorne correctamente
    todos los datos estructurados si el archivo Excel es válido.
    """
    project_name = "demo_project"
    create_test_excel_file(project_name)

    response = client.get(f"/data/excel-data/{project_name}")

    assert response.status_code == 200

    data = response.json()
    expected_sheets = [
        "project_info",
        "dc_string_circuits",
        "dc_cn1_circuits",
        "ac_circuits",
        "mv_circuits"
    ]
    for sheet in expected_sheets:
        assert sheet in data
        assert isinstance(data[sheet], list)

    delete_test_excel_file(project_name)

# =============================================================================
# TEST 2: Error al extraer datos cuando el archivo no existe
# =============================================================================
def test_get_complete_excel_data_file_missing():
    """
    Verifica que el endpoint /excel-data/{project_name} retorne un error 400
    cuando el archivo Excel no existe.
    """
    project_name = "non_existing_project"
    response = client.get(f"/data/excel-data/{project_name}")
    assert response.status_code == 400
    assert "detail" in response.json()

# =============================================================================
# Helpers para creación y limpieza de archivo Excel de prueba
# =============================================================================

def create_test_excel_file(project_name: str):
    """
    Crea un archivo Excel válido para pruebas con todas las hojas requeridas.
    """
    base_path = Path(f"backend/projects/{project_name}")
    base_path.mkdir(parents=True, exist_ok=True)
    file_path = base_path / "input.xlsx"

    sheets = {
        "project_info": pd.DataFrame([{"project_name": "Test Farm", "panel_model": "TestPanel-400"}]),
        "dc_string_circuits": pd.DataFrame([{"circuit_id": "String_01", "current": 8.5}]),
        "dc_cn1_circuits": pd.DataFrame([{"circuit_id": "CN1_01", "voltage": 1000}]),
        "ac_circuits": pd.DataFrame([{"circuit_id": "AC_01", "voltage": 480}]),
        "mv_circuits": pd.DataFrame([{"circuit_id": "MV_01", "voltage": 34000}]),
    }

    with pd.ExcelWriter(file_path) as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, index=False, sheet_name=sheet_name)

    return file_path

def delete_test_excel_file(project_name: str):
    """
    Elimina el archivo Excel y su carpeta de proyecto después del test.
    """
    project_dir = Path(f"backend/projects/{project_name}")
    if project_dir.exists():
        for f in project_dir.glob("*"):
            f.unlink()
        project_dir.rmdir()
