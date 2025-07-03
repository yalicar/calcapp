from fastapi.testclient import TestClient
from backend.app.main import app
import os
import shutil
import pandas as pd

# Instancia del cliente de pruebas FastAPI
client = TestClient(app)

# === SETUP y TEARDOWN ===

def setup_project(project_name: str, with_excel: bool = True):
    """
    Crea un proyecto de prueba. Si with_excel=True, se incluye un archivo Excel válido con todas las hojas requeridas.
    """
    path = os.path.join("backend", "projects", project_name)
    os.makedirs(path, exist_ok=True)
    if with_excel:
        df = pd.DataFrame({"col1": [1], "col2": [2]})
        with pd.ExcelWriter(os.path.join(path, "input.xlsx")) as writer:
            for sheet in ["project_info", "dc_string_circuits", "dc_cn1_circuits", "mv_circuits"]:
                df.to_excel(writer, sheet_name=sheet, index=False)

def teardown_project(project_name: str):
    """
    Elimina el proyecto de prueba del sistema de archivos después del test.
    """
    path = os.path.join("backend", "projects", project_name)
    if os.path.exists(path):
        shutil.rmtree(path)

# === TEST 1: Proyecto con Excel válido ===

def test_list_projects_with_valid_excel():
    """
    Verifica que un proyecto con archivo Excel válido sea listado con status 'ready_for_calculation'.
    """
    project_name = "test_project_list_valid"
    setup_project(project_name)

    response = client.get("/projects/list-projects")
    assert response.status_code == 200
    data = response.json()

    found = any(p["name"] == project_name and p["status"] == "ready_for_calculation" for p in data["projects"])
    assert found is True

    teardown_project(project_name)

# === TEST 2: Proyecto sin Excel ===

def test_list_projects_without_excel():
    """
    Verifica que un proyecto sin archivo Excel sea listado con status 'awaiting_excel'.
    """
    project_name = "test_project_list_no_excel"
    setup_project(project_name, with_excel=False)

    response = client.get("/projects/list-projects")
    assert response.status_code == 200
    data = response.json()

    found = any(p["name"] == project_name and p["status"] == "awaiting_excel" for p in data["projects"])
    assert found is True

    teardown_project(project_name)

# === TEST 3: Proyecto con Excel inválido (falta de hojas requeridas) ===

def test_list_projects_with_invalid_excel():
    """
    Verifica que un proyecto con Excel mal estructurado (faltan hojas requeridas) sea listado como 'excel_error'.
    """
    project_name = "test_project_invalid_excel"
    project_path = os.path.join("backend", "projects", project_name)
    os.makedirs(project_path, exist_ok=True)

    # Crear Excel inválido con solo una hoja irrelevante
    invalid_data = pd.DataFrame({"dummy": [1, 2, 3]})
    invalid_excel_path = os.path.join(project_path, "input.xlsx")
    with pd.ExcelWriter(invalid_excel_path) as writer:
        invalid_data.to_excel(writer, sheet_name="only_one_sheet", index=False)

    response = client.get("/projects/list-projects")
    assert response.status_code == 200
    projects = response.json()["projects"]

    found = next((p for p in projects if p["name"] == project_name), None)
    assert found is not None
    assert found["status"] == "excel_error"

    # Limpieza
    shutil.rmtree(project_path)
