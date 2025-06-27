import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [projectName, setProjectName] = useState("");
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [mode, setMode] = useState<"create" | "select">("create");
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:8000/list-projects").then((res) => {
      setExistingProjects(res.data);
    });
  }, []);

  const handleContinue = async () => {
    const name = mode === "create" ? projectName.trim() : selectedProject;
  
    if (!name) return;
  
    if (mode === "create") {
      try {
        await axios.post("http://localhost:8000/create-project", { name });
      } catch (error: any) {
        if (error.response?.status === 400) {
          alert("Ese proyecto ya existe.");
          return;
        }
        alert("Error al crear el proyecto.");
        return;
      }
    }
  
    navigate(`/upload/${name}`);
  };
  

  return (
    <div className="page-wrapper">
      <div className="card">
        <h1>Seleccionar o crear un proyecto</h1>

        <div className="label">Modo</div>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="create">Crear nuevo proyecto</option>
          <option value="select">Seleccionar existente</option>
        </select>

        {mode === "create" ? (
          <>
            <div className="label">Nombre del proyecto</div>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej: nuevo_proyecto"
            />
          </>
        ) : (
          <>
            <div className="label">Proyectos existentes</div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">Seleccione un proyecto</option>
              {existingProjects.map((proj) => (
                <option key={proj} value={proj}>
                  {proj}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          disabled={
            (mode === "create" && projectName.trim() === "") ||
            (mode === "select" && selectedProject === "")
          }
          onClick={handleContinue}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

export default HomePage;
