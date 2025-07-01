import { useState, useEffect } from "react";
import { useProject } from "../context/ProjectContext"; // Ajusta la ruta según tu estructura
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Box, Typography, Button, Paper, Accordion, AccordionSummary, AccordionDetails, Alert, CircularProgress, Divider, Chip } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalculateIcon from '@mui/icons-material/Calculate';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RefreshIcon from '@mui/icons-material/Refresh';

interface SheetData {
  [key: string]: any[];
}

interface TableData {
  sheetName: string;
  columns: any[];
  rows: any[];
}

function UploadExcelPage() {
  const { projectName, setProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [tablesData, setTablesData] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [hasExistingFile, setHasExistingFile] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Establecer el proyecto desde la URL si no está en el contexto
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  // Usar el proyecto del contexto o de la URL
  const currentProjectName = projectName || urlProjectName;

  // Verificar si hay archivo existente al cargar el componente
  useEffect(() => {
    if (currentProjectName) {
      checkForExistingFile();
    }
  }, [currentProjectName]);

  const checkForExistingFile = async () => {
    if (!currentProjectName) return;

    setIsInitialLoading(true);
    try {
      // Intentar obtener datos del Excel existente
      const response = await axios.get(`http://localhost:8000/get-excel-data/${currentProjectName}`);
      
      if (response.data && Object.keys(response.data).length > 0) {
        // Hay datos existentes
        setHasExistingFile(true);
        const sheetData: SheetData = response.data;
        const formattedTables = formatTableData(sheetData);
        
        if (formattedTables.length > 0) {
          setTablesData(formattedTables);
          setIsDataLoaded(true);
          const totalRows = formattedTables.reduce((sum, table) => sum + table.rows.length, 0);
          setMessage(`Archivo Excel cargado desde proyecto. ${totalRows} registros encontrados en ${formattedTables.length} hoja(s)`);
        }
      } else {
        // No hay datos existentes
        setHasExistingFile(false);
        setShowUploadForm(true);
      }
    } catch (error: any) {
      // Si no hay archivo o hay error, mostrar formulario de subida
      setHasExistingFile(false);
      setShowUploadForm(true);
      
      if (error.response?.status !== 400) {
        console.warn("No se pudo cargar archivo existente:", error.message);
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  const formatTableData = (sheetData: SheetData): TableData[] => {
    const tables: TableData[] = [];
    
    Object.entries(sheetData).forEach(([sheetName, data]) => {
      if (Array.isArray(data) && data.length > 0) {
        // Crear columnas basadas en las claves del primer objeto
        const formattedColumns = Object.keys(data[0]).map((key) => ({
          field: key,
          headerName: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizar primera letra
          width: 150,
          sortable: true,
          filterable: true,
          resizable: true,
        }));

        // Crear filas con ID único
        const formattedRows = data.map((row, index) => ({ 
          id: `${sheetName}_${index}`, 
          ...row 
        }));

        tables.push({
          sheetName,
          columns: formattedColumns,
          rows: formattedRows,
        });
      }
    });

    return tables;
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Por favor selecciona un archivo");
      return;
    }

    if (!currentProjectName) {
      setMessage("No hay un proyecto seleccionado");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setErrors([]);
    setTablesData([]);
    setIsDataLoaded(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Subir archivo
      const uploadResponse = await axios.post(`http://localhost:8000/upload-excel/${currentProjectName}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log("Upload response:", uploadResponse.data);
      
      // Esperar un momento para el procesamiento
      await new Promise((res) => setTimeout(res, 1000));

      // Validar contenido
      const validationResponse = await axios.get(`http://localhost:8000/validate-content/${currentProjectName}`);
      setMessage(validationResponse.data.message);
      setErrors([]);

      // Obtener datos para preview
      const previewResponse = await axios.get(`http://localhost:8000/get-excel-data/${currentProjectName}`);
      console.log("Preview response:", previewResponse.data);
      
      const sheetData: SheetData = previewResponse.data;

      // Formatear datos para múltiples tablas
      const formattedTables = formatTableData(sheetData);
      setTablesData(formattedTables);

      // Verificar si hay datos
      if (formattedTables.length === 0) {
        setMessage("No se encontraron datos válidos en el archivo Excel");
        setIsDataLoaded(false);
      } else {
        const totalRows = formattedTables.reduce((sum, table) => sum + table.rows.length, 0);
        setMessage(`Archivo procesado exitosamente. ${totalRows} registros encontrados en ${formattedTables.length} hoja(s)`);
        setIsDataLoaded(true);
        setHasExistingFile(true);
        setShowUploadForm(false); // Ocultar formulario después de subir exitosamente
      }

    } catch (error: any) {
      console.error("Error durante la carga:", error);
      setIsDataLoaded(false);
      
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        
        if (error.response.status === 400) {
          const detail = error.response.data.detail;
          setErrors(Array.isArray(detail) ? detail : [detail]);
          setMessage("Se encontraron errores en el archivo");
        } else if (error.response.status === 404) {
          setMessage("Endpoint no encontrado. Verifica la configuración del servidor.");
        } else if (error.response.status === 500) {
          setMessage("Error interno del servidor. Revisa los logs del backend.");
        } else {
          setMessage(`Error del servidor: ${error.response.status} - ${error.response.data.detail || 'Error desconocido'}`);
        }
      } else if (error.request) {
        setMessage("No se pudo conectar con el servidor. Verifica que esté ejecutándose en http://localhost:8000");
      } else {
        setMessage(`Error inesperado: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    
    // Limpiar estados previos cuando se selecciona un nuevo archivo
    if (selectedFile) {
      setMessage("");
      setErrors([]);
    }
  };

  // Función para refrescar los datos
  const handleRefreshData = async () => {
    if (!currentProjectName) {
      setMessage("No hay un proyecto seleccionado");
      return;
    }
    
    setIsLoading(true);
    try {
      const previewResponse = await axios.get(`http://localhost:8000/get-excel-data/${currentProjectName}`);
      console.log("Refresh response:", previewResponse.data);
      
      const sheetData: SheetData = previewResponse.data;
      const formattedTables = formatTableData(sheetData);
      setTablesData(formattedTables);
      
      if (formattedTables.length === 0) {
        setIsDataLoaded(false);
        setMessage("No se encontraron datos válidos");
      } else {
        const totalRows = formattedTables.reduce((sum, table) => sum + table.rows.length, 0);
        setMessage(`Datos actualizados. ${totalRows} registros encontrados en ${formattedTables.length} hoja(s)`);
        setIsDataLoaded(true);
      }
    } catch (error: any) {
      console.error("Error al refrescar datos:", error);
      setMessage("Error al cargar los datos. Verifica que el archivo haya sido procesado correctamente.");
      setIsDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para mostrar el formulario de subida
  const handleShowUploadForm = () => {
    setShowUploadForm(true);
    setFile(null);
    setMessage("");
    setErrors([]);
  };

  // Función para cancelar la subida
  const handleCancelUpload = () => {
    setShowUploadForm(false);
    setFile(null);
    setMessage("");
    setErrors([]);
    
    // Si había datos cargados, restaurar el mensaje
    if (isDataLoaded) {
      const totalRows = tablesData.reduce((sum, table) => sum + table.rows.length, 0);
      setMessage(`Archivo Excel cargado desde proyecto. ${totalRows} registros encontrados en ${tablesData.length} hoja(s)`);
    }
  };

  // Función para navegar a la página de cálculos
  const handleNavigateToCalculations = () => {
    if (currentProjectName) {
      navigate(`/projects/${currentProjectName}/calculations`);
    }
  };

  // Mostrar loading inicial
  if (isInitialLoading) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Paper elevation={6} sx={{ 
          padding: 4, 
          textAlign: 'center',
          backgroundColor: '#1a1a2e',
          borderRadius: '16px',
          border: '1px solid #16213e',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <CircularProgress sx={{ color: '#e53e3e', marginBottom: 2 }} />
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
            Verificando archivo Excel...
          </Typography>
          <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
            Proyecto: {currentProjectName}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Mostrar mensaje si no hay proyecto seleccionado
  if (!currentProjectName) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Paper elevation={6} sx={{ 
          padding: 4, 
          textAlign: 'center',
          backgroundColor: '#1a1a2e',
          borderRadius: '16px',
          border: '1px solid #16213e',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <Typography variant="h5" sx={{ color: '#e53e3e', marginBottom: 2, fontSize: '48px' }}>
            ⚠️
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            No hay proyecto seleccionado
          </Typography>
          <Typography variant="body1" sx={{ color: '#a0a0a0' }}>
            Por favor selecciona un proyecto antes de subir archivos Excel
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      padding: 3, 
      maxWidth: '100%', 
      margin: '0 auto' 
    }}>
      <Typography variant="h4" gutterBottom sx={{ 
        color: '#fff', 
        textAlign: 'center',
        fontWeight: 'bold',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        marginBottom: 3
      }}>
        📊 Gestión de Excel - Proyecto: {currentProjectName}
      </Typography>

      {/* Estado del archivo */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        border: '1px solid #16213e',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
              📁 Estado del Archivo Excel
            </Typography>
            
            {hasExistingFile ? (
              <Chip 
                label="Archivo cargado"
                icon={<CheckCircleIcon />}
                sx={{ 
                  backgroundColor: '#1b2d1b',
                  color: '#81c784',
                  border: '1px solid #4caf50',
                  fontWeight: 'bold'
                }}
              />
            ) : (
              <Chip 
                label="Sin archivo"
                icon={<UploadFileIcon />}
                sx={{ 
                  backgroundColor: '#2d1b1b',
                  color: '#ff9800',
                  border: '1px solid #ff9800',
                  fontWeight: 'bold'
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {hasExistingFile && !showUploadForm && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRefreshData}
                  disabled={isLoading}
                  sx={{ 
                    borderColor: '#4caf50',
                    color: '#4caf50',
                    '&:hover': {
                      borderColor: '#388e3c',
                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    },
                  }}
                >
                  Actualizar
                </Button>
                
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={handleShowUploadForm}
                  sx={{ 
                    background: 'linear-gradient(45deg, #ff9800 30%, #ffb74d 90%)',
                    color: 'white',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
                    },
                  }}
                >
                  Reemplazar Archivo
                </Button>
              </>
            )}

            {showUploadForm && hasExistingFile && (
              <Button
                variant="outlined"
                onClick={handleCancelUpload}
                sx={{ 
                  borderColor: '#666',
                  color: '#666',
                  '&:hover': {
                    borderColor: '#888',
                    backgroundColor: 'rgba(102, 102, 102, 0.1)',
                  },
                }}
              >
                Cancelar
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Formulario de subida (solo se muestra cuando es necesario) */}
      {showUploadForm && (
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#1a1a2e',
          borderRadius: '16px',
          border: '1px solid #16213e',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
            📁 {hasExistingFile ? 'Reemplazar Archivo Excel' : 'Subir Archivo Excel'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2, flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ 
                padding: '12px',
                border: '2px solid #16213e',
                borderRadius: '12px',
                flexGrow: 1,
                minWidth: '300px',
                backgroundColor: '#0f0f23',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
            
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || isLoading}
              sx={{ 
                minWidth: '140px',
                background: 'linear-gradient(45deg, #e53e3e 30%, #ff6b6b 90%)',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '25px',
                boxShadow: '0 4px 15px rgba(229, 62, 62, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #c53030 30%, #e53e3e 90%)',
                  boxShadow: '0 6px 20px rgba(229, 62, 62, 0.4)',
                  transform: 'translateY(-2px)',
                },
                '&:disabled': {
                  background: '#666',
                  color: '#ccc',
                },
                transition: 'all 0.3s ease'
              }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={20} sx={{ color: '#fff', marginRight: 1 }} />
                  Procesando...
                </>
              ) : (
                `🚀 ${hasExistingFile ? 'Reemplazar' : 'Subir'} Excel`
              )}
            </Button>
          </Box>

          {file && (
            <Typography variant="body2" sx={{ color: '#a0a0a0', display: 'flex', alignItems: 'center', gap: 1 }}>
              ✅ Archivo seleccionado: <strong style={{ color: '#e53e3e' }}>{file.name}</strong>
              <span style={{ color: '#81c784' }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </Typography>
          )}
        </Paper>
      )}

      {/* Mensajes de estado */}
      {message && (
        <Alert 
          severity={errors.length > 0 ? "error" : "success"} 
          sx={{ 
            marginBottom: 2,
            backgroundColor: errors.length > 0 ? '#2d1b1b' : '#1b2d1b',
            border: errors.length > 0 ? '1px solid #e53e3e' : '1px solid #4caf50',
            borderRadius: '12px',
            color: errors.length > 0 ? '#ff6b6b' : '#81c784',
            '& .MuiAlert-icon': {
              color: errors.length > 0 ? '#ff6b6b' : '#81c784',
            },
          }}
        >
          {message}
        </Alert>
      )}

      {/* Errores */}
      {errors.length > 0 && (
        <Paper elevation={3} sx={{ 
          padding: 2, 
          marginBottom: 2, 
          backgroundColor: '#2d1b1b',
          border: '1px solid #e53e3e',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(229, 62, 62, 0.2)'
        }}>
          <Typography variant="h6" sx={{ color: '#ff6b6b', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            🚨 Errores encontrados:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errors.map((err, i) => (
              <li key={i}>
                <Typography sx={{ color: '#ffcccb', fontSize: '14px' }}>
                  {err}
                </Typography>
              </li>
            ))}
          </ul>
        </Paper>
      )}

      {/* Botón para continuar a cálculos */}
      {isDataLoaded && errors.length === 0 && (
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#1b2d1b',
          borderRadius: '16px',
          border: '2px solid #4caf50',
          boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)',
          textAlign: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
            <CheckCircleIcon sx={{ color: '#4caf50', fontSize: '32px' }} />
            <Typography variant="h6" sx={{ color: '#81c784', fontWeight: 'bold' }}>
              ¡Datos listos para cálculo!
            </Typography>
          </Box>
          
          <Typography variant="body1" sx={{ color: '#a5d6a7', marginBottom: 3 }}>
            Los datos del Excel han sido validados y están listos para los cálculos.
            Puedes revisar los datos abajo o continuar directamente a la página de cálculos.
          </Typography>

          <Divider sx={{ backgroundColor: '#4caf50', marginY: 2 }} />

          <Button
            variant="contained"
            size="large"
            onClick={handleNavigateToCalculations}
            startIcon={<CalculateIcon />}
            endIcon={<NavigateNextIcon />}
            sx={{ 
              minWidth: '250px',
              background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              borderRadius: '30px',
              padding: '12px 30px',
              boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)',
              '&:hover': {
                background: 'linear-gradient(45deg, #388e3c 30%, #4caf50 90%)',
                boxShadow: '0 8px 25px rgba(76, 175, 80, 0.5)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease'
            }}
          >
            Continuar a Cálculos
          </Button>

          <Typography variant="body2" sx={{ color: '#81c784', marginTop: 2, fontSize: '14px' }}>
            💡 Tip: Puedes volver a esta página en cualquier momento para revisar o actualizar los datos
          </Typography>
        </Paper>
      )}

      {/* Tablas de datos */}
      {tablesData.length > 0 && (
        <Box>
          <Typography variant="h5" gutterBottom sx={{ 
            marginTop: 3, 
            marginBottom: 2,
            color: '#fff',
            textAlign: 'center',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}>
            📋 Datos del Excel ({tablesData.length} hoja{tablesData.length > 1 ? 's' : ''})
            <span style={{ 
              color: '#81c784', 
              fontSize: '14px',
              backgroundColor: '#1b2d1b',
              padding: '4px 12px',
              borderRadius: '12px',
              border: '1px solid #4caf50'
            }}>
              {tablesData.reduce((sum, table) => sum + table.rows.length, 0)} registros totales
            </span>
          </Typography>

          {tablesData.map((tableData, index) => (
            <Accordion 
              key={tableData.sheetName} 
              defaultExpanded={index === 0}
              sx={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #16213e',
                borderRadius: '12px !important',
                marginBottom: 2,
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                '&:before': {
                  display: 'none',
                },
              }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: '#e53e3e' }} />}
                sx={{
                  backgroundColor: '#16213e',
                  borderRadius: '12px 12px 0 0',
                  '& .MuiAccordionSummary-content': {
                    margin: '12px 0',
                  },
                }}
              >
                <Typography variant="h6" sx={{ 
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontWeight: 'bold',
                  flexWrap: 'wrap'
                }}>
                  📊 {tableData.sheetName} 
                  <span style={{ 
                    color: '#e53e3e', 
                    fontSize: '14px',
                    backgroundColor: '#2d1b1b',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    border: '1px solid #e53e3e'
                  }}>
                    {tableData.rows.length} filas
                  </span>
                  <span style={{ 
                    color: '#81c784', 
                    fontSize: '12px',
                    backgroundColor: '#1b2d1b',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    border: '1px solid #4caf50'
                  }}>
                    {tableData.columns.length} columnas
                  </span>
                </Typography>
              </AccordionSummary>
              
              <AccordionDetails sx={{ padding: 2 }}>
                <Box sx={{ height: 'auto', minHeight: 400, width: '100%' }}>
                  <DataGrid
                    rows={tableData.rows}
                    columns={tableData.columns}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 25, page: 0 },
                      },
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    checkboxSelection
                    disableSelectionOnClick
                    autoHeight
                    sx={{
                      backgroundColor: '#1a1a2e',
                      color: '#eee',
                      border: '1px solid #16213e',
                      borderRadius: '12px',
                      '& .MuiDataGrid-root': {
                        border: 'none',
                      },
                      '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid #16213e',
                        color: '#e0e0e0',
                        '&:hover': {
                          backgroundColor: '#0f3460',
                        },
                      },
                      '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: '#16213e',
                        color: '#fff',
                        borderBottom: '2px solid #0f3460',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      },
                      '& .MuiDataGrid-columnSeparator': {
                        color: '#fff !important',
                      },
                      '& .MuiDataGrid-filterIcon': {
                        color: '#fff !important',
                      },
                      '& .MuiDataGrid-sortIcon': {
                        color: '#fff !important',
                      },
                      '& .MuiDataGrid-menuIcon': {
                        color: '#fff !important',
                      },
                      '& .MuiDataGrid-row': {
                        '&:hover': {
                          backgroundColor: '#0f3460',
                        },
                        '&.Mui-selected': {
                          backgroundColor: '#e53e3e',
                          '&:hover': {
                            backgroundColor: '#c53030',
                          },
                        },
                      },
                      '& .MuiDataGrid-footerContainer': {
                        backgroundColor: '#16213e',
                        color: '#fff',
                        borderTop: '1px solid #0f3460',
                      },
                      '& .MuiTablePagination-root': {
                        color: '#fff',
                      },
                      '& .MuiTablePagination-selectIcon': {
                        color: '#fff',
                      },
                      '& .MuiDataGrid-toolbarContainer': {
                        backgroundColor: '#16213e',
                        color: '#fff',
                        borderBottom: '1px solid #0f3460',
                      },
                      '& .MuiCheckbox-root': {
                        color: '#e53e3e',
                        '&.Mui-checked': {
                          color: '#e53e3e',
                        },
                      },
                    }}
                  />
                </Box>
                
                <Typography variant="body2" sx={{ 
                  marginTop: 2,
                  color: '#a0a0a0',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  flexWrap: 'wrap'
                }}>
                  📈 Total de registros en <strong style={{ color: '#e53e3e' }}>{tableData.sheetName}</strong>: 
                  <strong style={{ color: '#81c784' }}>{tableData.rows.length}</strong>
                  {tableData.rows.length > 0 && (
                    <span style={{ color: '#81c784' }}>
                      (Mostrando todos los registros disponibles)
                    </span>
                  )}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Estado vacío */}
      {!isLoading && !isInitialLoading && tablesData.length === 0 && !message && !showUploadForm && (
        <Paper elevation={3} sx={{ 
          padding: 4, 
          textAlign: 'center', 
          marginTop: 3,
          backgroundColor: '#1a1a2e',
          border: '1px solid #16213e',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <Typography variant="h6" sx={{ color: '#a0a0a0', marginBottom: 2, fontSize: '48px' }}>
            📤
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
            No hay archivos Excel en este proyecto
          </Typography>
          <Typography variant="body2" sx={{ color: '#a0a0a0', marginBottom: 3 }}>
            Haz clic en "Reemplazar Archivo" para subir un Excel
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={handleShowUploadForm}
            sx={{ 
              background: 'linear-gradient(45deg, #e53e3e 30%, #ff6b6b 90%)',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '25px',
            }}
          >
            Subir Excel
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default UploadExcelPage;