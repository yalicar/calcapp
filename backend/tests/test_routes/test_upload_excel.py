from fastapi.testclient import TestClient
from backend.app.main import app
import os
import shutil
import pandas as pd
import io

client = TestClient(app)

# ============================================================================
# SETUP Y TEARDOWN
# ============================================================================

def setup_project(project_name: str):
    """Crea una carpeta de proyecto vacía para simular un proyecto existente."""
    path = os.path.join("backend", "projects", project_name)
    os.makedirs(path, exist_ok=True)

def teardown_project(project_name: str):
    """Elimina la carpeta del proyecto después del test."""
    path = os.path.join("backend", "projects", project_name)
    if os.path.exists(path):
        shutil.rmtree(path)

# ============================================================================
# TEST 1: Subida exitosa de Excel válido
# ============================================================================

def test_upload_excel_success():
    """
    ✅ Sube un archivo Excel válido a un proyecto existente.
    Verifica:
    - Respuesta 200
    - Se guarda como 'input.xlsx'
    - El nombre original del archivo está en la respuesta
    """
    project_name = "test_upload_excel"
    setup_project(project_name)

    # Crear archivo Excel válido en memoria
    df = pd.DataFrame({"Campo": ["project_name"], "Valor": ["Test"], "Prioridad": ["✅"]})
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="project_info", index=False)
    excel_buffer.seek(0)

    files = {"file": ("project_data.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = client.post(f"/projects/upload-excel/{project_name}", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["message"].startswith("Excel file uploaded")
    assert data["filename"] == "project_data.xlsx"
    assert os.path.exists(f"projects/{project_name}/input.xlsx")

    teardown_project(project_name)

# ============================================================================
# TEST 2: Error si el proyecto no existe
# ============================================================================

def test_upload_excel_project_not_found():
    """
    ❌ Falla si se intenta subir un archivo a un proyecto que no existe.
    Verifica:
    - Respuesta 404
    - Mensaje de error adecuado
    """
    project_name = "nonexistent_project"
    df = pd.DataFrame({"Campo": ["project_name"], "Valor": ["Test"], "Prioridad": ["✅"]})
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="project_info", index=False)
    excel_buffer.seek(0)

    files = {"file": ("data.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = client.post(f"/projects/upload-excel/{project_name}", files=files)

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]

# ============================================================================
# TEST 3: Error por formato inválido (no .xlsx)
# ============================================================================

def test_upload_invalid_file_format():
    """
    ❌ Falla si se intenta subir un archivo que no tiene formato .xlsx.
    Verifica:
    - Respuesta 400
    - Mensaje indicando que solo se aceptan archivos .xlsx
    """
    project_name = "test_invalid_format"
    setup_project(project_name)

    fake_file = io.BytesIO(b"fake content")
    files = {"file": ("document.txt", fake_file, "text/plain")}
    response = client.post(f"/projects/upload-excel/{project_name}", files=files)

    assert response.status_code == 400
    assert "Only .xlsx files" in response.json()["detail"]

    teardown_project(project_name)

# ============================================================================
# TEST 4: Sobrescritura de archivo Excel existente
# ============================================================================

def test_upload_excel_overwrite_existing_file():
    """
    ✅ Verifica que un archivo Excel nuevo sobrescribe correctamente uno existente.
    Verifica:
    - Segunda subida no genera error
    - El contenido de 'input.xlsx' se reemplaza por el nuevo archivo
    """
    project_name = "test_upload_excel_overwrite"
    setup_project(project_name)

    # --- Primera subida con valor 1 ---
    df1 = pd.DataFrame({"A": [1]})
    excel_buffer1 = io.BytesIO()
    with pd.ExcelWriter(excel_buffer1, engine="xlsxwriter") as writer:
        df1.to_excel(writer, sheet_name="project_info", index=False)
    excel_buffer1.seek(0)

    files = {"file": ("original.xlsx", excel_buffer1, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response1 = client.post(f"/projects/upload-excel/{project_name}", files=files)
    assert response1.status_code == 200

    # --- Segunda subida con valor 999 ---
    df2 = pd.DataFrame({"A": [999]})
    excel_buffer2 = io.BytesIO()
    with pd.ExcelWriter(excel_buffer2, engine="xlsxwriter") as writer:
        df2.to_excel(writer, sheet_name="project_info", index=False)
    excel_buffer2.seek(0)

    files = {"file": ("updated.xlsx", excel_buffer2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response2 = client.post(f"/projects/upload-excel/{project_name}", files=files)
    assert response2.status_code == 200
    assert response2.json()["filename"] == "updated.xlsx"

    # --- Validar que el contenido fue sobrescrito correctamente ---
    path = os.path.join("backend", "projects", project_name, "input.xlsx")
    df_read = pd.read_excel(path, sheet_name="project_info")
    assert df_read.iloc[0, 0] == 999  # Confirmamos sobrescritura

    teardown_project(project_name)
