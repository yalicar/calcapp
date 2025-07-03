# backend/app/services/loader/project_norm_service.py
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from ...models.norm_params import ProjectNormOverrides
from ..config_loader import format_norm_parameters_for_ui

logger = logging.getLogger(__name__)

class ProjectNormService:
    def __init__(self):
        self.projects_base_path = Path(__file__).parent.parent.parent.parent / "projects"
    
    def get_project_overrides_path(self, project_name: str) -> Path:
        """Obtiene la ruta del archivo de overrides del proyecto"""
        return self.projects_base_path / project_name / "norm_overrides.json"
    
    def has_project_overrides(self, project_name: str) -> bool:
        """Verifica si el proyecto tiene parámetros personalizados"""
        overrides_path = self.get_project_overrides_path(project_name)
        return overrides_path.exists()
    
    def load_project_overrides(self, project_name: str) -> Optional[ProjectNormOverrides]:
        """Carga los overrides del proyecto si existen"""
        try:
            overrides_path = self.get_project_overrides_path(project_name)
            
            if not overrides_path.exists():
                return None
            
            with open(overrides_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            
            return ProjectNormOverrides(**data)
            
        except Exception as e:
            logger.error(f"Error cargando overrides del proyecto {project_name}: {e}")
            return None
    
    def save_project_overrides(self, project_name: str, base_norm: str, modified_parameters: Dict[str, Any]) -> bool:
        """Guarda los parámetros modificados del proyecto"""
        try:
            # Crear directorio del proyecto si no existe
            project_dir = self.projects_base_path / project_name
            project_dir.mkdir(parents=True, exist_ok=True)
            
            # Crear objeto de overrides
            overrides = ProjectNormOverrides(
                project_name=project_name,
                base_norm=base_norm,
                modified_parameters=modified_parameters,
                last_modified=datetime.now().isoformat(),
                version="1.0"
            )
            
            # Guardar archivo
            overrides_path = self.get_project_overrides_path(project_name)
            with open(overrides_path, 'w', encoding='utf-8') as file:
                json.dump(overrides.dict(), file, indent=2, ensure_ascii=False)
            
            logger.info(f"Overrides guardados para proyecto {project_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error guardando overrides del proyecto {project_name}: {e}")
            return False
    
    def delete_project_overrides(self, project_name: str) -> bool:
        """Elimina los overrides del proyecto (volver a valores por defecto)"""
        try:
            overrides_path = self.get_project_overrides_path(project_name)
            
            if overrides_path.exists():
                overrides_path.unlink()
                logger.info(f"Overrides eliminados para proyecto {project_name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error eliminando overrides del proyecto {project_name}: {e}")
            return False
    
    def get_effective_parameters(self, project_name: str, norm_name: str) -> Dict[str, Any]:
        """
        Obtiene los parámetros efectivos (base + overrides del proyecto)
        
        Args:
            project_name: Nombre del proyecto
            norm_name: Normativa base (IEC, NEC, etc.)
            
        Returns:
            Parámetros combinados (base + overrides)
        """
        try:
            # 1. Cargar parámetros base de la normativa
            base_parameters = format_norm_parameters_for_ui(norm_name)
            
            # 2. Cargar overrides del proyecto si existen
            project_overrides = self.load_project_overrides(project_name)
            
            if not project_overrides:
                # No hay overrides, devolver parámetros base
                base_parameters['has_project_overrides'] = False
                base_parameters['project_name'] = project_name
                return base_parameters
            
            # 3. Aplicar overrides del proyecto
            modified_parameters = self._apply_project_overrides(
                base_parameters, 
                project_overrides.modified_parameters
            )
            
            # 4. Agregar metadatos
            modified_parameters['has_project_overrides'] = True
            modified_parameters['project_name'] = project_name
            modified_parameters['metadata']['project_overrides'] = {
                'last_modified': project_overrides.last_modified,
                'base_norm': project_overrides.base_norm,
                'modified_count': len(project_overrides.modified_parameters)
            }
            
            return modified_parameters
            
        except Exception as e:
            logger.error(f"Error obteniendo parámetros efectivos para {project_name}: {e}")
            raise
    
    def _apply_project_overrides(self, base_parameters: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
        """Aplica los overrides del proyecto a los parámetros base"""
        import copy
        
        # Hacer copia profunda para no modificar el original
        result = copy.deepcopy(base_parameters)
        
        # Aplicar cada override
        for param_path, new_value in overrides.items():
            self._set_nested_parameter(result, param_path, new_value)
        
        return result
    
    def _set_nested_parameter(self, params_dict: Dict[str, Any], param_path: str, value: Any):
        """
        Establece un parámetro anidado usando notación de puntos
        
        Ejemplo: 'editable_sections.cable.parameters.material.value' = 'aluminum'
        """
        try:
            keys = param_path.split('.')
            current = params_dict
            
            # Navegar hasta el penúltimo nivel
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
            
            # Establecer el valor final
            current[keys[-1]] = value
            logger.debug(f"Override aplicado: {param_path} = {value}")
            
        except Exception as e:
            logger.warning(f"No se pudo aplicar override {param_path} = {value}: {e}")

# Instancia global del servicio
project_norm_service = ProjectNormService()