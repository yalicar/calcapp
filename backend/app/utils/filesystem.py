import json
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import UploadFile
import pandas as pd

# Define base project directory dynamically
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECTS_DIR = BASE_DIR / "projects"


def create_project_folder(project_name: str):
    """
    Crea una estructura de carpetas para un nuevo proyecto fotovoltaico.

    Este procedimiento genera una carpeta con el nombre del proyecto dentro del directorio de proyectos,
    crea subcarpetas 'calculations' y 'reports', y escribe un archivo 'config.json' con información básica
    como el nombre y la fecha de creación.

    Args:
        project_name (str): Nombre único del proyecto (usado como nombre de carpeta).

    Returns:
        tuple[bool, str]: 
            - bool: True si se creó correctamente, False si hubo un error o el proyecto ya existe.
            - str: Mensaje de éxito o error.
    """
    path = PROJECTS_DIR / project_name

    if path.exists():
        return False, "Project already exists."

    try:
        (path / "calculations").mkdir(parents=True)
        (path / "reports").mkdir()

        # Crear archivo de configuración
        config = {
            "name": project_name,
            "created_at": datetime.now().isoformat()
        }
        with open(path / "config.json", "w") as f:
            json.dump(config, f, indent=2)

        return True, f"Project '{project_name}' created successfully."
    
    except Exception as e:
        return False, f"Error creating project: {str(e)}"


def save_excel_file(project_name: str, file: UploadFile):
    path = PROJECTS_DIR / project_name
    if not path.exists():
        return False, "Project does not exist."

    try:
        dest_file = path / "input.xlsx"
        with open(dest_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Log the upload
        log_path = path / "log.csv"
        with open(log_path, "a") as log:
            log.write(f"{datetime.now().isoformat()},uploaded,{file.filename}\n")

        return True, "Excel file uploaded and logged successfully."
    except Exception as e:
        return False, f"Error saving Excel: {str(e)}"


def load_excel_sheet(project_name: str, sheet_name: str) -> pd.DataFrame:
    file_path = PROJECTS_DIR / project_name / "input.xlsx"
    print(f"[DEBUG] Buscando archivo: {file_path}")  # Reemplazar por logger.debug si prefieres

    if not file_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {file_path}")
    
    try:
        return pd.read_excel(file_path, sheet_name=sheet_name)
    except Exception as e:
        raise RuntimeError(f"Error al cargar hoja '{sheet_name}' del archivo: {e}")

