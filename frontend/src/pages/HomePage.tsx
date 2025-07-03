import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useProject } from "../context/ProjectContext";
import "./HomePage.css";

// ✅ MEJORA: Configuración centralizada
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface Project {
  name: string;
  has_excel?: boolean;
  last_modified?: string;
  status?: string;
  file_size_mb?: number;
}

function HomePage() {
  const [projectName, setProjectName] = useState("");
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [mode, setMode] = useState<"create" | "select">("create");
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { setProjectName: setContextProjectName } = useProject();
  const navigate = useNavigate();

  // ✅ MEJORA: Cargar proyectos con manejo de errores
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setError(null);
    
    try {
      // ✅ CORREGIDO: añadir prefijo /projects
      const response = await axios.get(`${API_BASE_URL}/projects/list-projects`);
      
      // ✅ CORREGIDO: extraer projects del response
      const projectsData = response.data.projects || [];
      setExistingProjects(projectsData);
      
    } catch (error: any) {
      console.error("Error loading projects:", error);
      setError("Error al cargar los proyectos existentes");
      setExistingProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // ✅ MEJORA: Validación de nombre de proyecto
  const validateProjectName = (name: string): string | null => {
    if (!name.trim()) {
      return "El nombre del proyecto es requerido";
    }
    
    if (name.length < 3) {
      return "El nombre debe tener al menos 3 caracteres";
    }
    
    if (name.length > 50) {
      return "El nombre no puede exceder 50 caracteres";
    }
    
    // Solo permitir letras, números, guiones y guiones bajos
    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validNameRegex.test(name)) {
      return "Solo se permiten letras, números, guiones (-) y guiones bajos (_)";
    }
    
    return null;
  };

  const handleContinue = async () => {
    const name = mode === "create" ? projectName.trim() : selectedProject;
    
    if (!name) {
      setError("Por favor seleccione o ingrese un nombre de proyecto");
      return;
    }

    // Validar nombre solo para proyectos nuevos
    if (mode === "create") {
      const validationError = validateProjectName(name);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "create") {
        // ✅ CORREGIDO: añadir prefijo /projects
        await axios.post(`${API_BASE_URL}/projects/create-project`, { 
          name: name,
          description: `Proyecto ${name} creado desde la interfaz web`
        });
      }

      // Establecer el proyecto en el contexto
      setContextProjectName(name);
      
      // ✅ MEJORA: Usar rutas consistentes
      navigate(`/projects/${name}/upload`);
      
    } catch (error: any) {
      console.error("Error with project:", error);
      
      if (error.response?.status === 400) {
        setError("Este proyecto ya existe. Seleccione 'Seleccionar existente' o use otro nombre.");
      } else if (error.response?.status === 422) {
        setError("Datos inválidos. Verifique el nombre del proyecto.");
      } else {
        setError(`Error ${mode === "create" ? "creando" : "seleccionando"} el proyecto. Intente nuevamente.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ MEJORA: Manejar cambio de nombre con validación en tiempo real
  const handleNameChange = (value: string) => {
    setProjectName(value);
    if (error && mode === "create") {
      // Limpiar error si el usuario está corrigiendo
      const validationError = validateProjectName(value);
      if (!validationError) {
        setError(null);
      }
    }
  };

  const canContinue = () => {
    if (loading) return false;
    
    if (mode === "create") {
      return projectName.trim() !== "" && !validateProjectName(projectName.trim());
    } else {
      return selectedProject !== "";
    }
  };

  return (
    <div className="page-wrapper">
      <div className="card">
        <div className="header">
          <h1>Calculador de Cables DC</h1>
          <p>Seleccione o cree un proyecto para comenzar</p>
        </div>

        {/* Modo de operación */}
        <div className="form-group">
          <label className="label">Modo de operación</label>
          <select 
            value={mode} 
            onChange={(e) => {
              setMode(e.target.value as any);
              setError(null); // Limpiar errores al cambiar modo
            }}
            disabled={loading}
            className="select-input"
          >
            <option value="create">Crear nuevo proyecto</option>
            <option value="select">Seleccionar proyecto existente</option>
          </select>
        </div>

        {/* Crear nuevo proyecto */}
        {mode === "create" && (
          <div className="form-group">
            <label className="label">Nombre del nuevo proyecto</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="ej: proyecto_solar_2024"
              disabled={loading}
              className={`text-input ${error && mode === "create" ? "error" : ""}`}
              maxLength={50}
            />
            <small className="hint">
              Solo letras, números, guiones (-) y guiones bajos (_). Entre 3 y 50 caracteres.
            </small>
          </div>
        )}

        {/* Seleccionar proyecto existente */}
        {mode === "select" && (
          <div className="form-group">
            <label className="label">Proyectos disponibles</label>
            {loadingProjects ? (
              <div className="loading-projects">Cargando proyectos...</div>
            ) : existingProjects.length > 0 ? (
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                className="select-input"
              >
                <option value="">Seleccione un proyecto</option>
                {existingProjects.map((project) => (
                  <option key={project.name} value={project.name}>
                    {project.name}
                    {project.has_excel ? " (Excel)" : " (Sin datos)"}
                    {project.last_modified && ` - ${new Date(project.last_modified).toLocaleDateString()}`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="no-projects">
                <p>No hay proyectos disponibles</p>
                <button 
                  onClick={() => setMode("create")}
                  className="link-button"
                >
                  Crear el primer proyecto
                </button>
              </div>
            )}
            
            {!loadingProjects && (
              <button 
                onClick={loadProjects}
                className="refresh-button"
                disabled={loading}
              >
                🔄 Actualizar lista
              </button>
            )}
          </div>
        )}

        {/* Mensajes de error */}
        {error && (
          <div className="error-message">
            <span className="error-icon">!</span>
            {error}
          </div>
        )}

        {/* Botón continuar */}
        <button
          onClick={handleContinue}
          disabled={!canContinue()}
          className={`continue-button ${!canContinue() ? "disabled" : ""}`}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              {mode === "create" ? "Creando..." : "Cargando..."}
            </>
          ) : (
            <>
              {mode === "create" ? "Crear Proyecto" : "Seleccionar Proyecto"}
              <span className="arrow">→</span>
            </>
          )}
        </button>

        {/* Información adicional */}
        <div className="info-section">
          <h3>Sistema de Cálculo de Cables DC</h3>
          <ul>
            <li>Cálculo de secciones según normativas internacionales</li>
            <li>Validación automática de caídas de tensión</li>
            <li>Soporte para múltiples materiales conductores</li>
            <li>Generación de reportes técnicos detallados</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default HomePage;