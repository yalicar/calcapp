import { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Box, Typography, Button, Paper, Accordion, AccordionSummary, AccordionDetails, Alert, CircularProgress } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface SheetData {
  [key: string]: any[];
}

interface TableData {
  sheetName: string;
  columns: any[];
  rows: any[];
}

function UploadExcelPage() {
  const { projectName } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [tablesData, setTablesData] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);
    setMessage("");
    setErrors([]);
    setTablesData([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Subir archivo
      const uploadResponse = await axios.post(`http://localhost:8000/upload-excel/${projectName}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log("Upload response:", uploadResponse.data);
      
      // Esperar un momento para el procesamiento
      await new Promise((res) => setTimeout(res, 1000));

      // Validar contenido
      const validationResponse = await axios.get(`http://localhost:8000/validate-content/${projectName}`);
      setMessage(validationResponse.data.message);
      setErrors([]);

      // Obtener datos para preview - CORREGIDO: usar el endpoint correcto
      const previewResponse = await axios.get(`http://localhost:8000/get-excel-data/${projectName}`);
      console.log("Preview response:", previewResponse.data);
      
      const sheetData: SheetData = previewResponse.data;

      // Formatear datos para múltiples tablas
      const formattedTables = formatTableData(sheetData);
      setTablesData(formattedTables);

      // Verificar si hay datos
      if (formattedTables.length === 0) {
        setMessage("No se encontraron datos válidos en el archivo Excel");
      } else {
        const totalRows = formattedTables.reduce((sum, table) => sum + table.rows.length, 0);
        setMessage(`Archivo procesado exitosamente. ${totalRows} registros encontrados en ${formattedTables.length} hoja(s)`);
      }

    } catch (error: any) {
      console.error("Error durante la carga:", error);
      
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
      setTablesData([]);
    }
  };

  // Función para refrescar los datos
  const handleRefreshData = async () => {
    if (!projectName) return;
    
    setIsLoading(true);
    try {
      const previewResponse = await axios.get(`http://localhost:8000/get-excel-data/${projectName}`);
      console.log("Refresh response:", previewResponse.data);
      
      const sheetData: SheetData = previewResponse.data;
      const formattedTables = formatTableData(sheetData);
      setTablesData(formattedTables);
      
      const totalRows = formattedTables.reduce((sum, table) => sum + table.rows.length, 0);
      setMessage(`Datos actualizados. ${totalRows} registros encontrados en ${formattedTables.length} hoja(s)`);
    } catch (error: any) {
      console.error("Error al refrescar datos:", error);
      setMessage("Error al cargar los datos. Verifica que el archivo haya sido procesado correctamente.");
    } finally {
      setIsLoading(false);
    }
  };

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
        📊 Carga de Excel - Proyecto: {projectName}
      </Typography>

      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        border: '1px solid #16213e',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          📁 Seleccionar Archivo Excel
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
              '🚀 Subir Excel'
            )}
          </Button>

          {tablesData.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleRefreshData}
              disabled={isLoading}
              sx={{ 
                minWidth: '120px',
                borderColor: '#e53e3e',
                color: '#e53e3e',
                fontWeight: 'bold',
                borderRadius: '25px',
                '&:hover': {
                  borderColor: '#c53030',
                  backgroundColor: 'rgba(229, 62, 62, 0.1)',
                },
                '&:disabled': {
                  borderColor: '#666',
                  color: '#ccc',
                },
              }}
            >
              🔄 Refrescar
            </Button>
          )}
        </Box>

        {file && (
          <Typography variant="body2" sx={{ color: '#a0a0a0', display: 'flex', alignItems: 'center', gap: 1 }}>
            ✅ Archivo seleccionado: <strong style={{ color: '#e53e3e' }}>{file.name}</strong>
            <span style={{ color: '#81c784' }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </Typography>
        )}
      </Paper>

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
      {!isLoading && tablesData.length === 0 && !message && (
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
            Selecciona y sube un archivo Excel para comenzar
          </Typography>
          <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
            Los datos se mostrarán aquí después de la validación
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default UploadExcelPage;