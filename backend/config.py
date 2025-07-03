import os

# Directorio base del proyecto (donde está este config.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Carpeta donde se guardan los proyectos
PROJECTS_DIR = os.path.join(BASE_DIR, "projects")

# Si no existe, crearla automáticamente
os.makedirs(PROJECTS_DIR, exist_ok=True)
