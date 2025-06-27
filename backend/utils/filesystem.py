import os
import json
import shutil
from datetime import datetime
from fastapi import UploadFile
import pandas as pd

PROJECTS_DIR = "backend/projects"

def create_project_folder(project_name: str):
    path = os.path.join(PROJECTS_DIR, project_name)

    if os.path.exists(path):
        return False, "Project already exists."

    try:
        os.makedirs(path)
        config = {
            "name": project_name,
            "created_at": datetime.now().isoformat()
        }
        with open(os.path.join(path, "config.json"), "w") as f:
            json.dump(config, f, indent=2)
        return True, f"Project '{project_name}' created successfully."
    except Exception as e:
        return False, f"Error creating project: {str(e)}"

def save_excel_file(project_name: str, file: UploadFile):
    path = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(path):
        return False, "Project does not exist."

    try:
        dest_file = os.path.join(path, "input.xlsx")
        with open(dest_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Log the upload
        log_path = os.path.join(path, "log.csv")
        with open(log_path, "a") as log:
            log.write(f"{datetime.now().isoformat()},uploaded,{file.filename}\n")

        return True, "Excel file uploaded and logged successfully."
    except Exception as e:
        return False, f"Error saving Excel: {str(e)}"


def load_excel_sheet(project_name: str, sheet_name: str) -> pd.DataFrame:
    path = os.path.join(PROJECTS_DIR, project_name, "input.xlsx")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No se encontró el archivo: {path}")
    return pd.read_excel(path, sheet_name=sheet_name)