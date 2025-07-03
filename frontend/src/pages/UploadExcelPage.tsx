import { useState, useEffect } from "react";
import { useProject } from "../context/ProjectContext";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./UploadExcelPage.css";

// Configuración API
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ValidationResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  errors: string[];
  warnings: string[];
}

interface ProjectInfo {
  project_info: {
    project_name: string;
    panel_model?: string;
    location?: string;
    [key: string]: any;
  };
  project_status: {
    has_excel: boolean;
    ready_for_calculation: boolean;
  };
  file_info?: {
    last_modified: string;
    size_mb: number;
  };
}

interface ExcelData {
  [sheetName: string]: any[];
}

interface TableData {
  sheetName: string;
  data: any[];
  columns: string[];
  isExpanded?: boolean;
}

function UploadExcelPage() {
  const { projectName, setProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  
  // Estados principales
  const [file, setFile] = useState<File | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [isValidationExpanded, setIsValidationExpanded] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Nombre del proyecto actual
  const currentProjectName = projectName || urlProjectName;

  // Establecer proyecto en contexto si viene de URL
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  // Cargar información del proyecto al montar
  useEffect(() => {
    if (currentProjectName) {
      loadProjectInfo();
    }
  }, [currentProjectName]);

  const loadProjectInfo = async () => {
    if (!currentProjectName) return;

    setInitialLoading(true);
    setError(null);

    try {
      // Primero verificar si el proyecto existe en la lista
      const projectsResponse = await axios.get(`${API_BASE_URL}/projects/list-projects`);
      const projects = projectsResponse.data.projects || [];
      const projectExists = projects.find((p: any) => p.name === currentProjectName);
      
      if (!projectExists) {
        setError("Proyecto no encontrado");
        return;
      }

      // Si el proyecto existe, intentar obtener info detallada
      if (projectExists.has_excel) {
        try {
          const infoResponse = await axios.get(`${API_BASE_URL}/projects/project-info/${currentProjectName}`);
          setProjectInfo(infoResponse.data);
          await loadExcelData();
          
          // 🔧 NUEVA FUNCIONALIDAD: Validar automáticamente al cargar
          await performInitialValidation();
        } catch (infoError) {
          // Si no se puede obtener info detallada, crear info básica
          setProjectInfo({
            project_info: {
              project_name: currentProjectName
            },
            project_status: {
              has_excel: projectExists.has_excel,
              ready_for_calculation: projectExists.status === 'ready_for_calculation'
            },
            file_info: projectExists.last_modified ? {
              last_modified: projectExists.last_modified,
              size_mb: projectExists.file_size_mb || 0
            } : undefined
          });
          
          if (projectExists.has_excel) {
            await loadExcelData();
            // 🔧 NUEVA FUNCIONALIDAD: Validar también en el caso de error de info
            await performInitialValidation();
          }
        }
      } else {
        // Proyecto sin Excel - crear info básica
        setProjectInfo({
          project_info: {
            project_name: currentProjectName
          },
          project_status: {
            has_excel: false,
            ready_for_calculation: false
          }
        });
        setShowUploadForm(true);
      }
      
    } catch (error: any) {
      console.error("Error loading project info:", error);
      setError("Error al verificar el proyecto");
      
      // Permitir subir Excel incluso si hay error
      setProjectInfo({
        project_info: {
          project_name: currentProjectName || 'Unknown'
        },
        project_status: {
          has_excel: false,
          ready_for_calculation: false
        }
      });
      setShowUploadForm(true);
    } finally {
      setInitialLoading(false);
    }
  };

  // 🔧 NUEVA FUNCIÓN: Manejar expansión/contracción de tablas
  const toggleTableExpansion = (sheetName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sheetName)) {
        newSet.delete(sheetName);
      } else {
        newSet.add(sheetName);
      }
      return newSet;
    });
  };

  // 🔧 NUEVA FUNCIÓN: Expandir/contraer todas las tablas
  const toggleAllTables = () => {
    if (expandedTables.size === tableData.length) {
      // Si todas están expandidas, contraer todas
      setExpandedTables(new Set());
    } else {
      // Si no todas están expandidas, expandir todas
      setExpandedTables(new Set(tableData.map(table => table.sheetName)));
    }
  };

  // 🔧 NUEVA FUNCIÓN: Obtener información resumida de una tabla
  const getTableSummary = (table: TableData) => {
    const numericColumns = table.columns.filter(col => {
      return table.data.slice(0, 10).some(row => 
        typeof row[col] === 'number' && !isNaN(row[col])
      );
    });

    const textColumns = table.columns.filter(col => {
      return table.data.slice(0, 10).some(row => 
        typeof row[col] === 'string' && isNaN(Number(row[col]))
      );
    });

    return {
      numericColumns: numericColumns.length,
      textColumns: textColumns.length,
      totalRows: table.data.length,
      totalColumns: table.columns.length
    };
  };

  const validateExcelContent = async (): Promise<ValidationResult> => {
    if (!currentProjectName) {
      throw new Error("No hay proyecto seleccionado");
    }

    setValidating(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/data/validate-excel-content/${currentProjectName}`);
      
      return {
        status: 'success',
        message: response.data.message || 'Validación exitosa',
        errors: [],
        warnings: []
      };
      
    } catch (error: any) {
      console.error("Validation error:", error);
      
      if (error.response?.status === 400) {
        const details = error.response.data.detail;
        
        if (Array.isArray(details)) {
          const errors = details.filter((msg: string) => 
            !msg.toLowerCase().includes('warning') && 
            !msg.toLowerCase().includes('info')
          );
          const warnings = details.filter((msg: string) => 
            msg.toLowerCase().includes('warning') || 
            msg.toLowerCase().includes('info')
          );
          
          return {
            status: errors.length > 0 ? 'error' : 'warning',
            message: errors.length > 0 
              ? `Se encontraron ${errors.length} errores críticos` 
              : `Se encontraron ${warnings.length} advertencias`,
            errors,
            warnings
          };
        } else {
          return {
            status: 'error',
            message: 'Error de validación',
            errors: [typeof details === 'string' ? details : 'Error desconocido'],
            warnings: []
          };
        }
      } else {
        return {
          status: 'error',
          message: 'Error al validar el archivo',
          errors: ['No se pudo conectar con el servidor de validación'],
          warnings: []
        };
      }
    } finally {
      setValidating(false);
    }
  };

  // 🔧 NUEVA FUNCIÓN: Validación inicial al cargar la página
  const performInitialValidation = async () => {
    if (!currentProjectName) return;
    
    try {
      console.log("Realizando validación inicial del archivo existente...");
      const validation = await validateExcelContent();
      setValidationResult(validation);
      
      // Mostrar mensaje según el resultado
      if (validation.status === 'success') {
        setSuccess("Archivo Excel validado correctamente");
      } else if (validation.status === 'warning') {
        // No establecer como error, solo mostrar las advertencias
        console.log("Archivo con advertencias detectadas");
      } else if (validation.status === 'error') {
        setError("El archivo Excel actual tiene errores críticos");
      }
      
    } catch (error: any) {
      console.error("Error en validación inicial:", error);
      // No mostrar error crítico si la validación inicial falla
      // ya que el archivo puede estar bien pero el servicio no responder
    }
  };

  const formatExcelDataForTables = (rawData: ExcelData): TableData[] => {
    const tables: TableData[] = [];
    
    Object.entries(rawData).forEach(([sheetName, sheetData]) => {
      if (Array.isArray(sheetData) && sheetData.length > 0) {
        const columns = Object.keys(sheetData[0]);
        
        tables.push({
          sheetName,
          data: sheetData,
          columns
        });
      }
    });
    
    return tables;
  };

  const loadExcelData = async () => {
    if (!currentProjectName) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/data/excel-data/${currentProjectName}`);
      const rawData: ExcelData = response.data;
      
      setExcelData(rawData);
      
      const formattedTables = formatExcelDataForTables(rawData);
      setTableData(formattedTables);
      
      if (formattedTables.length > 0) {
        const totalRows = formattedTables.reduce((sum, table) => sum + table.data.length, 0);
        setSuccess(`Datos cargados: ${totalRows} registros en ${formattedTables.length} hoja(s)`);
      }
      
    } catch (error: any) {
      console.error("Error loading Excel data:", error);
      setTableData([]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (!file || !currentProjectName) {
      setError("Seleccione un archivo Excel");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setValidationResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(
        `${API_BASE_URL}/projects/upload-excel/${currentProjectName}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setSuccess("Archivo subido exitosamente. Validando contenido...");
      
      const validation = await validateExcelContent();
      setValidationResult(validation);
      
      if (validation.status === 'error') {
        // 🔧 SOLUCIÓN: Limpiar datos cuando la validación falla
        setTableData([]);
        setExcelData(null);
        setExpandedTables(new Set());
        setError("Validación falló - hay errores críticos en el archivo");
        return;
      }
      
      setFile(null);
      setShowUploadForm(false);
      
      setTimeout(async () => {
        await loadProjectInfo();
        await loadExcelData();
      }, 1000);
      
    } catch (error: any) {
      console.error("Error uploading file:", error);
      
      // 🔧 SOLUCIÓN ADICIONAL: También limpiar en caso de error de subida
      setTableData([]);
      setExcelData(null);
      setExpandedTables(new Set());
      
      if (error.response?.status === 400) {
        setError(error.response.data.detail || "Error en el archivo");
      } else if (error.response?.status === 404) {
        setError("Proyecto no encontrado");
      } else {
        setError("Error al subir el archivo");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowUploadForm = () => {
    setShowUploadForm(true);
    setFile(null);
    setError(null);
    setSuccess(null);
    setValidationResult(null);
  };

  const handleCancelUpload = () => {
    setShowUploadForm(false);
    setFile(null);
    setError(null);
    setSuccess(null);
    setValidationResult(null);
  };

  const handleRefreshData = async () => {
    if (!currentProjectName) {
      setError("No hay proyecto seleccionado");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Mantener el estado de expansión durante la actualización
      const currentExpandedState = new Set(expandedTables);
      await loadExcelData();
      // Restaurar el estado de expansión
      setExpandedTables(currentExpandedState);
    } catch (error: any) {
      console.error("Error refreshing data:", error);
      setError("Error al actualizar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleRevalidate = async () => {
    if (!currentProjectName) return;
    
    try {
      const validation = await validateExcelContent();
      setValidationResult(validation);
      
      if (validation.status === 'success') {
        setSuccess("Revalidación exitosa");
      }
    } catch (error: any) {
      console.error("Error revalidating:", error);
      setError("Error al revalidar el archivo");
    }
  };

  const handleNavigateToCalculations = () => {
    if (currentProjectName) {
      navigate(`/projects/${currentProjectName}/calculations`);
    }
  };

  // Loading inicial
  if (initialLoading) {
    return (
      <div className="upload-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <h2>Cargando información del proyecto...</h2>
          <p>Proyecto: {currentProjectName}</p>
        </div>
      </div>
    );
  }

  // Sin proyecto seleccionado
  if (!currentProjectName) {
    return (
      <div className="upload-page">
        <div className="error-container">
          <div className="error-icon">!</div>
          <h2>No hay proyecto seleccionado</h2>
          <p>Seleccione un proyecto antes de continuar</p>
          <button onClick={() => navigate("/")} className="btn-primary">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-page">
      {/* Header */}
      <div className="page-header">
        <h1>Gestión de Datos Excel</h1>
        <div className="project-info">
          <span className="project-name">Proyecto: {currentProjectName}</span>
          <button onClick={handleRefreshData} className="btn-refresh" disabled={loading}>
            ↻ Actualizar Datos
          </button>
        </div>
      </div>

      {/* Estado del proyecto */}
      {projectInfo && (
        <div className="project-status-card">
          <div className="status-header">
            <h2>Estado del Proyecto</h2>
            <div className="status-badges">
              <span className={`status-badge ${projectInfo.project_status.has_excel ? 'success' : 'warning'}`}>
                {projectInfo.project_status.has_excel ? 'Excel Cargado' : 'Sin Excel'}
              </span>
              <span className={`status-badge ${projectInfo.project_status.ready_for_calculation ? 'success' : 'neutral'}`}>
                {projectInfo.project_status.ready_for_calculation ? 'Listo para Cálculo' : 'Pendiente'}
              </span>
            </div>
          </div>

          <div className="project-details">
            <div className="detail-item">
              <label>Proyecto:</label>
              <span>{currentProjectName}</span>
            </div>
            
            {projectInfo.project_info.project_name && 
             projectInfo.project_info.project_name !== currentProjectName && (
              <div className="detail-item">
                <label>Nombre en Excel:</label>
                <span>{projectInfo.project_info.project_name}</span>
              </div>
            )}
            
            {projectInfo.project_info.panel_model && (
              <div className="detail-item">
                <label>Modelo de panel:</label>
                <span>{projectInfo.project_info.panel_model}</span>
              </div>
            )}
            
            {projectInfo.project_info.location && (
              <div className="detail-item">
                <label>Ubicación:</label>
                <span>{projectInfo.project_info.location}</span>
              </div>
            )}

            {projectInfo.file_info && (
              <div className="detail-item">
                <label>Último archivo:</label>
                <span>
                  {new Date(projectInfo.file_info.last_modified).toLocaleDateString()} 
                  ({projectInfo.file_info.size_mb} MB)
                </span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="project-actions">
            {projectInfo.project_status.has_excel && !showUploadForm && (
              <>
                <button 
                  onClick={handleShowUploadForm}
                  className="btn-secondary"
                >
                  Reemplazar Excel
                </button>
                
                {projectInfo.project_status.ready_for_calculation && 
                 (!validationResult || validationResult.status !== 'error') && (
                  <button 
                    onClick={handleNavigateToCalculations}
                    className="btn-primary"
                  >
                    Continuar a Cálculos →
                  </button>
                )}
              </>
            )}

            {!projectInfo.project_status.has_excel && !showUploadForm && (
              <button 
                onClick={handleShowUploadForm}
                className="btn-primary"
              >
                Subir Excel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Formulario de subida */}
      {showUploadForm && (
        <div className="upload-form-card">
          <div className="form-header">
            <h2>{projectInfo?.project_status.has_excel ? 'Reemplazar' : 'Subir'} Archivo Excel</h2>
            <p>Seleccione un archivo .xlsx con los datos del proyecto</p>
          </div>

          <div className="upload-form">
            <div className="file-input-container">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="file-input"
                id="excel-file"
              />
              <label htmlFor="excel-file" className="file-input-label">
                {file ? file.name : 'Seleccionar archivo Excel...'}
              </label>
            </div>

            {file && (
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}

            <div className="form-actions">
              <button 
                onClick={handleCancelUpload}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              
              <button 
                onClick={handleUpload}
                className="btn-primary"
                disabled={!file || loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-small"></span>
                    Subiendo...
                  </>
                ) : (
                  `${projectInfo?.project_status.has_excel ? 'Reemplazar' : 'Subir'} Excel`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes */}
      {error && (
        <div className="message-card error">
          <div className="message-icon">!</div>
          <div className="message-content">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="message-card success">
          <div className="message-icon">✓</div>
          <div className="message-content">
            <strong>Éxito</strong>
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Sección de validación */}
      {validationResult && (
        <div className={`validation-card ${validationResult.status}`}>
          <div 
            className="validation-header clickable"
            onClick={() => setIsValidationExpanded(!isValidationExpanded)}
            title="Click para expandir/contraer detalles"
          >
            <div className="validation-title">
              <div className={`validation-icon ${validationResult.status}`}>
                {validationResult.status === 'success' ? '✓' : 
                 validationResult.status === 'warning' ? '⚠' : '✗'}
              </div>
              <h3>Resultado de Validación</h3>
              {validating && <span className="spinner-small"></span>}
              <span className="expand-icon">
                {isValidationExpanded ? "▼" : "▶"}
              </span>
            </div>
            
            <div className="validation-actions">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevalidate();
                }}
                className="btn-revalidate"
                disabled={validating}
              >
                {validating ? 'Validando...' : 'Revalidar'}
              </button>
            </div>
          </div>

          <div className="validation-summary">
            <p className="validation-message">{validationResult.message}</p>
          </div>

          {isValidationExpanded && (
            <div className="validation-content">
              {validationResult.errors.length > 0 && (
                <div className="validation-section">
                  <h4>Errores Críticos ({validationResult.errors.length})</h4>
                  <ul className="validation-list error-list">
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.warnings.length > 0 && (
                <div className="validation-section">
                  <h4>Advertencias ({validationResult.warnings.length})</h4>
                  <ul className="validation-list warning-list">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.status === 'success' && (
                <div className="validation-success-note">
                  <p>✓ El archivo Excel ha pasado todas las validaciones y está listo para los cálculos.</p>
                </div>
              )}
              
              {validationResult.status === 'warning' && (
                <div className="validation-warning-note">
                  <p>⚠ El archivo tiene advertencias pero puede usarse para cálculos. Revise las advertencias arriba.</p>
                </div>
              )}
              
              {validationResult.status === 'error' && (
                <div className="validation-error-note">
                  <p>✗ El archivo tiene errores críticos y debe corregirse antes de continuar a los cálculos.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sección de ayuda */}
      <div className="help-section">
        <h3>Información sobre archivos Excel</h3>
        <ul>
          <li>Formatos soportados: .xlsx, .xls</li>
          <li>El archivo debe contener datos de strings con longitudes</li>
          <li>Se validará automáticamente la estructura del archivo</li>
          <li>Una vez subido, podrá proceder a los cálculos</li>
        </ul>
      </div>

      {/* Datos del Excel */}
      {tableData.length > 0 && (
        <div className="excel-data-section">
          <div className="data-header">
            <h2>Datos del Excel</h2>
            <div className="data-summary">
              <span className="summary-item">
                {tableData.length} hoja{tableData.length !== 1 ? 's' : ''}
              </span>
              <span className="summary-item">
                {tableData.reduce((sum, table) => sum + table.data.length, 0)} registros totales
              </span>
              <button 
                onClick={toggleAllTables}
                className="btn-toggle-all"
                title={expandedTables.size === tableData.length ? "Contraer todas" : "Expandir todas"}
              >
                {expandedTables.size === tableData.length ? "Contraer todas" : "Expandir todas"}
              </button>
            </div>
          </div>

          {tableData.map((table, index) => {
            const isExpanded = expandedTables.has(table.sheetName);
            const summary = getTableSummary(table);
            
            return (
              <div key={table.sheetName} className="excel-table-container">
                <div 
                  className="table-header clickable"
                  onClick={() => toggleTableExpansion(table.sheetName)}
                  title="Click para expandir/contraer"
                >
                  <div className="table-header-main">
                    <div className="table-title">
                      <span className="expand-icon">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <h3>{table.sheetName}</h3>
                    </div>
                    <span className="table-info">
                      {table.data.length} filas × {table.columns.length} columnas
                    </span>
                  </div>
                  

                </div>

                {isExpanded && (
                  <div className="table-content">
                    <div className="table-actions">
                      <span className="table-stats">
                        Mostrando {Math.min(100, table.data.length)} de {table.data.length} filas
                      </span>
                    </div>

                    <div className="table-wrapper">
                      <table className="excel-table">
                        <thead>
                          <tr>
                            <th className="row-number">#</th>
                            {table.columns.map((column) => {
                              const isNumeric = table.data.slice(0, 10).some(row => 
                                typeof row[column] === 'number' && !isNaN(row[column])
                              );
                              return (
                                <th key={column} className={isNumeric ? "numeric-column" : "text-column"}>
                                  {column}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {table.data.slice(0, 100).map((row, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? "even-row" : "odd-row"}>
                              <td className="row-number">{rowIndex + 1}</td>
                              {table.columns.map((column) => {
                                const value = row[column];
                                const isNumeric = typeof value === 'number' && !isNaN(value);
                                const isEmpty = value === null || value === undefined || value === '';
                                
                                return (
                                  <td key={column} className={`
                                    ${isNumeric ? "numeric-cell" : "text-cell"}
                                    ${isEmpty ? "empty-cell" : ""}
                                  `}>
                                    {isEmpty ? (
                                      <span className="empty-indicator">-</span>
                                    ) : isNumeric ? (
                                      <span className="numeric-value">
                                        {typeof value === 'number' ? value.toLocaleString() : value}
                                      </span>
                                    ) : (
                                      <span className="text-value" title={String(value)}>
                                        {String(value)}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {table.data.length > 100 && (
                      <div className="table-footer">
                        <div className="pagination-info">
                          <span>📄 Mostrando las primeras 100 filas de {table.data.length.toLocaleString()} total</span>
                          <span className="load-time">({(table.data.length / 1000).toFixed(1)}K registros)</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UploadExcelPage;