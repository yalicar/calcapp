from fastapi.testclient import TestClient
from fastapi import status
from backend.app.main import app
import os
import shutil

# ================================
# TEST 1: Creación exitosa de proyecto
# ================================
def test_create_project_success():
    project_name = "test_project_unit"
    path = os.path.join("backend", "projects", project_name)
    
    # Eliminar el proyecto si ya existe (limpieza previa)
    if os.path.exists(path):
        shutil.rmtree(path)

    # Crear cliente de prueba
    client = TestClient(app)

    # Enviar solicitud POST para crear el proyecto
    response = client.post("/projects/create-project", json={
        "name": project_name,
        "description": "Proyecto de prueba unitaria",
        "location": "Testing City"
    })

    # Verificar que la creación fue exitosa (HTTP 200)
    assert response.status_code == status.HTTP_200_OK

    # Verificar el contenido de la respuesta
    data = response.json()
    assert data["project_name"] == project_name
    assert "calculations" in data["folder_structure"]
    assert "reports" in data["folder_structure"]

    # Eliminar el proyecto después de la prueba (limpieza)
    if os.path.exists(path):
        shutil.rmtree(path)

# ================================
# TEST 2: Proyecto ya existe (debe fallar)
# ================================
def test_create_project_already_exists():
    project_name = "test_project_exists"
    path = os.path.join("backend", "projects", project_name)

    # Crear manualmente el proyecto para simular existencia previa
    os.makedirs(path, exist_ok=True)

    # Crear cliente de prueba
    client = TestClient(app)

    # Enviar solicitud POST con el mismo nombre de proyecto
    response = client.post("/projects/create-project", json={
        "name": project_name,
        "description": "Intento duplicado",
        "location": "Ciudad duplicada"
    })

    # Verificar que falla con error 400
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    # Verificar que el mensaje de error sea el esperado
    assert "Project already exists" in response.json()["detail"]

    # Eliminar el proyecto después de la prueba (limpieza)
    if os.path.exists(path):
        shutil.rmtree(path)
