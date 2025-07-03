from fastapi.testclient import TestClient
from backend.app.main import app
import os
import shutil

# === CLIENTE FASTAPI ===

client = TestClient(app)

# === SETUP Y TEARDOWN ===

def setup_project(project_name: str):
    """
    Crea una carpeta de proyecto con subcarpetas y un archivo ficticio.
    Se simula una estructura válida del proyecto.
    """
    path = os.path.join("backend", "projects", project_name)
    os.makedirs(os.path.join(path, "calculations"), exist_ok=True)
    os.makedirs(os.path.join(path, "reports"), exist_ok=True)
    with open(os.path.join(path, "input.xlsx"), "w") as f:
        f.write("dummy content")

def teardown_project(project_name: str):
    """
    Elimina la carpeta del proyecto si existe.
    Se utiliza para limpiar después de cada prueba.
    """
    path = os.path.join("backend", "projects", project_name)
    if os.path.exists(path):
        shutil.rmtree(path)

# === TEST 1: Eliminación correcta con confirmación ===

def test_delete_project_success():
    """
    ✅ Borra correctamente un proyecto existente si se proporciona confirmación.
    """
    project_name = "test_delete_project_success"
    setup_project(project_name)

    response = client.delete(f"/projects/delete-project/{project_name}?confirm=true")
    assert response.status_code == 200

    data = response.json()
    assert data["message"].startswith("Project")
    assert "deleted_files" in data
    assert not os.path.exists(os.path.join("backend", "projects", project_name))

# === TEST 2: Intento de eliminación sin confirmación ===

def test_delete_project_without_confirmation():
    """
    ❌ Rechaza la eliminación si no se proporciona confirmación explícita.
    """
    project_name = "test_delete_project_no_confirm"
    setup_project(project_name)

    response = client.delete(f"/projects/delete-project/{project_name}")
    assert response.status_code == 400
    assert "confirm=true" in response.json()["detail"]

    # Verificar que el proyecto no fue eliminado
    assert os.path.exists(os.path.join("backend", "projects", project_name))

    teardown_project(project_name)

# === TEST 3: Proyecto inexistente ===

def test_delete_project_not_found():
    """
    ❌ Devuelve 404 si el proyecto no existe en el sistema de archivos.
    """
    project_name = "non_existing_project_12345"
    response = client.delete(f"/projects/delete-project/{project_name}?confirm=true")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]
