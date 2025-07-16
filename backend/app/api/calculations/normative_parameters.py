import os
import yaml
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException

# Importa tu función para formatear la normativa base
from app.services.config_loader import format_norm_parameters_for_ui
from app.services.loader.project_norm_service import project_norm_service

# Logger del módulo
logger = logging.getLogger(__name__)

# Router para los endpoints de normativa
router = APIRouter()

@router.get("/normatives/{normative}/parameters")
def get_base_normative_parameters(normative: str):
    """
    Obtiene los parámetros base de una normativa (sin overrides de proyecto)
    
    Args:
        normative: Nombre de la normativa (IEC, NEC, PERSONALIZADA)
        
    Returns:
        Parámetros base de la normativa estructurados para UI
    """
    try:
        params = format_norm_parameters_for_ui(normative)
        logger.info(f"Base normative parameters for {normative} obtained successfully")
        return params
        
    except ValueError as e:
        logger.error(f"Invalid normative: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting base parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting parameters: {str(e)}")

@router.get("/projects/{project_name}/normatives/{stage}/parameters")
def get_project_stage_normative(project_name: str, stage: str):
    """
    Devuelve la normativa personalizada por etapa si existe (dc_strings.yaml, etc.)

    Args:
        project_name (str): Nombre del proyecto
        stage (str): Etapa del circuito (dc_strings, level_1_dc, etc.)

    Returns:
        dict: Contenido del archivo YAML personalizado para esa etapa
    """
    try:
        import yaml
        import os
        
        # 🔧 USAR LA MISMA RUTA QUE PUT Y DELETE
        stage_file = os.path.join(
            "projects", project_name, "normativas", f"{stage}.yaml"
        )
        
        if not os.path.exists(stage_file):
            raise HTTPException(status_code=404, detail=f"No override found for stage '{stage}' in project '{project_name}'")
        
        # Cargar el archivo YAML directamente
        with open(stage_file, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        logger.info(f"✅ Config cargada desde: {stage_file}")
        
        return {
            "project_name": project_name,
            "stage": stage,
            "custom_parameters": config
        }

    except FileNotFoundError:
        logger.warning(f"⚠️ Archivo no encontrado: {stage_file}")
        raise HTTPException(status_code=404, detail=f"No override found for stage '{stage}' in project '{project_name}'")
    except Exception as e:
        logger.error(f"❌ Error loading stage override for {project_name}/{stage}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading override: {str(e)}")

@router.put("/projects/{project_name}/normatives/{stage}/parameters")
def save_stage_normative_parameters(
    project_name: str,
    stage: str,
    request: dict  # expected to contain "yaml_overrides"
):
    """
    Guarda parámetros de normativa personalizados para una etapa específica de un proyecto.
    
    Args:
        project_name: Nombre del proyecto
        stage: Etapa del sistema eléctrico (dc_strings, level_1_dc, etc.)
        request: Diccionario con claves:
            - base_norm: (opcional) normativa base usada
            - yaml_overrides: parámetros completos a guardar (dict)
    
    Returns:
        Confirmación de guardado exitoso o error
    """
    try:
        import yaml
        from datetime import datetime

        base_norm = request.get("base_norm", "IEC")
        yaml_overrides = request.get("yaml_overrides", {})

        logger.info(f"🔧 Guardando normativa etapa '{stage}' para proyecto '{project_name}'")
        logger.info(f"  - base_norm: {base_norm}")
        logger.info(f"  - parámetros recibidos: {len(yaml_overrides)} secciones")

        if not yaml_overrides:
            raise HTTPException(status_code=400, detail="No se proporcionaron parámetros a guardar")

        # Agregar metadatos si no existen
        if "_metadata" not in yaml_overrides:
            yaml_overrides["_metadata"] = {}
        yaml_overrides["_metadata"].update({
            "circuit_type": stage,
            "base_normative": base_norm,
            "updated_at": datetime.now().isoformat(),
            "stage_specific": True,
            "source": "user_override"
        })

        # Ruta destino del archivo YAML
        stage_dir = f"projects/{project_name}/normativas"
        os.makedirs(stage_dir, exist_ok=True)
        stage_path = os.path.join(stage_dir, f"{stage}.yaml")

        # Guardar archivo
        with open(stage_path, "w", encoding="utf-8") as f:
            yaml.dump(yaml_overrides, f, default_flow_style=False, allow_unicode=True)

        logger.info(f"✅ Parámetros guardados correctamente en: {stage_path}")
        return {
            "success": True,
            "message": f"Parámetros de etapa '{stage}' guardados correctamente para el proyecto '{project_name}'",
            "project_name": project_name,
            "stage": stage,
            "sections_updated": list(yaml_overrides.keys())
        }

    except Exception as e:
        logger.error(f"❌ Error guardando parámetros para etapa '{stage}': {e}")
        raise HTTPException(status_code=500, detail=f"Error al guardar parámetros: {str(e)}")

@router.delete("/projects/{project_name}/normatives/{stage}/parameters")
def delete_stage_normative_parameters(project_name: str, stage: str):
    """
    Elimina el archivo de normativa personalizada para una etapa específica de un proyecto.

    Args:
        project_name: Nombre del proyecto
        stage: Etapa del sistema eléctrico (dc_strings, level_1_dc, etc.)

    Returns:
        Confirmación de eliminación o mensaje si no existe
    """
    try:
        import os

        # Ruta del archivo a eliminar
        stage_file = os.path.join(
            "projects", project_name, "normativas", f"{stage}.yaml"
        )

        if os.path.exists(stage_file):
            os.remove(stage_file)
            logger.info(f"✅ Eliminada normativa personalizada: {stage_file}")
            return {
                "success": True,
                "message": f"Normativa de etapa '{stage}' eliminada para proyecto '{project_name}'",
                "project_name": project_name,
                "stage": stage
            }
        else:
            logger.warning(f"⚠️ Archivo no encontrado: {stage_file}")
            raise HTTPException(status_code=404, detail=f"No se encontró normativa para etapa '{stage}' en el proyecto '{project_name}'")

    except Exception as e:
        logger.error(f"❌ Error al eliminar normativa de etapa '{stage}': {e}")
        raise HTTPException(status_code=500, detail=f"Error eliminando normativa: {str(e)}")

@router.post("/projects/{project_name}/normatives/copy-base/{normative}")
def copy_base_normative_to_all_stages(project_name: str, normative: str):
    """
    Copia la normativa base seleccionada a todas las etapas conocidas (dc_strings, level_1_dc, etc.)
    y las guarda como archivos YAML editables dentro del proyecto.

    Args:
        project_name (str): Nombre del proyecto
        normative (str): Normativa base a copiar (IEC, NEC, etc.)

    Returns:
        dict: Lista de archivos generados y confirmación de éxito
    """
    try:
        from app.services.config_loader import format_norm_parameters_for_ui
        import yaml

        # Formatear toda la normativa base
        base_params = format_norm_parameters_for_ui(normative)

        # Etapas conocidas del sistema
        stages = ["dc_strings", "level_1_dc", "ac_circuits", "mv_circuits"]

        stage_dir = os.path.join("projects", project_name, "normativas")
        os.makedirs(stage_dir, exist_ok=True)

        generated = []
        for stage in stages:
            stage_data = base_params.get(stage)
            if stage_data:
                # Agregar metadatos
                stage_data["_metadata"] = {
                    "base_normative": normative,
                    "circuit_type": stage,
                    "stage_specific": True,
                    "source": "auto_base_copy",
                    "updated_at": datetime.now().isoformat()
                }

                file_path = os.path.join(stage_dir, f"{stage}.yaml")
                with open(file_path, "w", encoding="utf-8") as f:
                    yaml.dump(stage_data, f, allow_unicode=True, default_flow_style=False)

                generated.append(file_path)

        return {
            "success": True,
            "message": f"Normativa base '{normative}' copiada en {len(generated)} etapas.",
            "files_created": generated
        }

    except Exception as e:
        logger.error(f"Error copiando normativa base a etapas: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando normativas: {str(e)}")
