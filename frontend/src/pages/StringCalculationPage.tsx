import { useState, useEffect } from "react";
import { useProject } from "../context/ProjectContext";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Grid,
  Divider,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalculateIcon from '@mui/icons-material/Calculate';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import PowerIcon from '@mui/icons-material/Power';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SummarizeIcon from '@mui/icons-material/Summarize';

// Interfaces para tipos de datos
interface CalculationResult {
  results: any[];
  summary?: any;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

interface CalculationState {
  strings: CalculationResult | null;
  level1: CalculationResult | null;
  ac: CalculationResult | null;
  mv: CalculationResult | null;
}

interface ProjectProgress {
  completed: number;
  total: number;
  percentage: number;
}

// Componente de pestaña personalizada
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`calculation-tabpanel-${index}`}
      aria-labelledby={`calculation-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Componente principal
function CalculationPage() {
  const { projectName, setProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState(0);
  const [norm, setNorm] = useState<"IEC" | "NEC" | "Personalizada">("IEC");
  const [calculations, setCalculations] = useState<CalculationState>({
    strings: null,
    level1: null,
    ac: null,
    mv: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Establecer el proyecto desde la URL
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  const currentProjectName = projectName || urlProjectName;

  // Calcular progreso - CORREGIDO: solo cuenta el tab actual
  const getProgress = (): ProjectProgress => {
    const calcArray = Object.values(calculations);
    const completed = calcArray.filter(calc => calc?.status === 'success').length;
    const total = 4; // Solo 4 tipos de cálculo (sin resumen)
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
  };

  const progress = getProgress();

  // Configuración de pestañas
  const tabs = [
    {
      label: "Strings DC",
      icon: <ElectricalServicesIcon />,
      description: "Cálculo de strings fotovoltaicos",
      circuitType: "dc_strings",
      sheetName: "dc_string_circuits"
    },
    {
      label: "Nivel 1 DC",
      icon: <PowerIcon />,
      description: "Combinadores y concentradores DC",
      circuitType: "level_1_dc", 
      sheetName: "dc_cn1_circuits"
    },
    {
      label: "Circuitos AC",
      icon: <ElectricalServicesIcon />,
      description: "Circuitos de corriente alterna",
      circuitType: "ac_circuits",
      sheetName: "ac_circuits"
    },
    {
      label: "Media Tensión",
      icon: <FlashOnIcon />,
      description: "Circuitos de media tensión",
      circuitType: "mv_circuits",
      sheetName: "mv_circuits"
    },
    {
      label: "Resumen",
      icon: <SummarizeIcon />,
      description: "Resumen ejecutivo y reportes",
      circuitType: "summary",
      sheetName: null
    }
  ];

  // Función para ejecutar cálculo específico
  const executeCalculation = async (tabIndex: number) => {
    if (!currentProjectName) {
      setError("No hay proyecto seleccionado");
      return;
    }

    const tab = tabs[tabIndex];
    if (tab.circuitType === "summary") {
      setActiveTab(4); // Ir al resumen
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      let response;
      
      // Adaptar la llamada según el tipo de circuito
      if (norm === "IEC") {
        response = await axios.get(
          `http://localhost:8000/calculate-strings/${currentProjectName}?circuit_type=${tab.circuitType}`
        );
      } else {
        // Para parámetros personalizados (implementar más tarde)
        response = await axios.post(
          `http://localhost:8000/calculate-strings/${currentProjectName}/custom?circuit_type=${tab.circuitType}`,
          { /* parámetros personalizados */ }
        );
      }

      console.log(`Calculation response for ${tab.circuitType}:`, response.data);
      
      // Actualizar estado del cálculo específico
      const calculationResult: CalculationResult = {
        results: response.data.results || response.data,
        summary: response.data.summary,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      setCalculations(prev => ({
        ...prev,
        [getCalculationKey(tab.circuitType)]: calculationResult
      }));

      setSuccess(`Cálculo de ${tab.label} completado exitosamente`);

    } catch (error: any) {
      console.error(`Error calculando ${tab.circuitType}:`, error);
      
      const calculationResult: CalculationResult = {
        results: [],
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.response?.data?.detail || error.message
      };

      setCalculations(prev => ({
        ...prev,
        [getCalculationKey(tab.circuitType)]: calculationResult
      }));

      setError(`Error en cálculo de ${tab.label}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Mapear circuit_type a key del estado
  const getCalculationKey = (circuitType: string): keyof CalculationState => {
    switch (circuitType) {
      case "dc_strings": return "strings";
      case "level_1_dc": return "level1";
      case "ac_circuits": return "ac";
      case "mv_circuits": return "mv";
      default: return "strings";
    }
  };

  // Función para calcular todo
  const calculateAll = async () => {
    setError("");
    setSuccess("");
    
    for (let i = 0; i < tabs.length - 1; i++) { // Excluir resumen
      await executeCalculation(i);
      // Pequeña pausa entre cálculos
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setSuccess("Todos los cálculos completados");
  };

  // Obtener estado del cálculo actual
  const getCurrentCalculation = () => {
    if (activeTab >= tabs.length - 1) return null; // Resumen no tiene cálculo
    const tab = tabs[activeTab];
    return calculations[getCalculationKey(tab.circuitType)];
  };

  const currentCalculation = getCurrentCalculation();

  // Función para volver
  const handleGoBack = () => {
    if (currentProjectName) {
      navigate(`/projects/${currentProjectName}/upload`);
    } else {
      navigate('/projects');
    }
  };

  // Mostrar error si no hay proyecto
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
        }}>
          <Typography variant="h5" sx={{ color: '#e53e3e', marginBottom: 2, fontSize: '48px' }}>
            ⚠️
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            No hay proyecto seleccionado
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
    }}>
      {/* Header del proyecto */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        border: '1px solid #16213e',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ 
              color: '#fff', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              ⚡ Cálculos Eléctricos
            </Typography>
            <Chip 
              label={currentProjectName}
              sx={{ 
                backgroundColor: '#16213e',
                color: '#81c784',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: '#fff' }}>Normativa</InputLabel>
              <Select
                value={norm}
                onChange={(e) => setNorm(e.target.value as any)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#16213e' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e53e3e' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                <MenuItem value="IEC">IEC</MenuItem>
                <MenuItem value="NEC">NEC</MenuItem>
                <MenuItem value="Personalizada">Personalizada</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleGoBack}
              sx={{ 
                borderColor: '#e53e3e',
                color: '#e53e3e',
                '&:hover': { borderColor: '#c53030', backgroundColor: 'rgba(229, 62, 62, 0.1)' },
              }}
            >
              Volver
            </Button>
          </Box>
        </Box>

        {/* Barra de progreso */}
        <Box sx={{ marginTop: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              Progreso general del proyecto
            </Typography>
            <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 'bold' }}>
              {progress.completed}/{progress.total} secciones calculadas ({Math.round(progress.percentage)}%)
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress.percentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#16213e',
              '& .MuiLinearProgress-bar': {
                backgroundColor: progress.percentage === 100 ? '#4caf50' : '#e53e3e',
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {/* Botón calcular todo */}
        <Box sx={{ marginTop: 2, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<CalculateIcon />}
            onClick={calculateAll}
            disabled={isLoading}
            sx={{ 
              background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '25px',
              padding: '12px 30px',
              '&:hover': {
                background: 'linear-gradient(45deg, #388e3c 30%, #4caf50 90%)',
              },
              '&:disabled': { background: '#666' },
            }}
          >
            {isLoading ? 'Calculando...' : 'Calcular Todo'}
          </Button>
        </Box>
      </Paper>

      {/* Mensajes de estado */}
      {error && (
        <Alert severity="error" sx={{ marginBottom: 2, backgroundColor: '#2d1b1b', color: '#ff6b6b' }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ marginBottom: 2, backgroundColor: '#1b2d1b', color: '#81c784' }}>
          {success}
        </Alert>
      )}

      {/* Pestañas principales */}
      <Paper elevation={6} sx={{ 
        backgroundColor: '#1a1a2e',
        borderRadius: '16px',
        border: '1px solid #16213e',
        overflow: 'hidden'
      }}>
        {/* Navegación de pestañas */}
        <Box sx={{ borderBottom: 1, borderColor: '#16213e' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#a0a0a0',
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '14px',
                minHeight: '72px',
                '&.Mui-selected': {
                  color: '#e53e3e',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#e53e3e',
                height: 3,
              },
            }}
          >
            {tabs.map((tab, index) => {
              const calculation = index < tabs.length - 1 ? calculations[getCalculationKey(tab.circuitType)] : null;
              const status = calculation?.status;
              
              return (
                <Tab
                  key={index}
                  icon={tab.icon}
                  label={
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {tab.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                        {tab.description}
                      </Typography>
                      {status && (
                        <Chip
                          size="small"
                          label={status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳'}
                          sx={{ 
                            marginTop: 0.5,
                            height: 16,
                            fontSize: '10px',
                            backgroundColor: status === 'success' ? '#1b2d1b' : status === 'error' ? '#2d1b1b' : '#2d2416',
                          }}
                        />
                      )}
                    </Box>
                  }
                  iconPosition="top"
                />
              );
            })}
          </Tabs>
        </Box>

        {/* Contenido de las pestañas */}
        {tabs.map((tab, index) => (
          <TabPanel key={index} value={activeTab} index={index}>
            {index < tabs.length - 1 ? (
              // Pestañas de cálculo
              <CalculationTabContent
                tab={tab}
                calculation={calculations[getCalculationKey(tab.circuitType)]}
                onCalculate={() => executeCalculation(index)}
                isLoading={isLoading}
                norm={norm}
              />
            ) : (
              // Pestaña de resumen
              <SummaryTabContent
                calculations={calculations}
                projectName={currentProjectName}
                progress={progress}
              />
            )}
          </TabPanel>
        ))}
      </Paper>
    </Box>
  );
}

// Componente para tabla de resultados de strings DC
function StringsResultsTable({ results }: { results: any[] }) {
  const columns = [
    { 
      field: "string_id", 
      headerName: "String ID", 
      width: 150,
      pinned: 'left' as const,
      cellStyle: { fontWeight: 'bold', color: '#e53e3e' }
    },
    { 
      field: "length_total_m", 
      headerName: "Longitud (m)", 
      width: 120,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} m` : 'N/A'
    },
    { 
      field: "i_nominal", 
      headerName: "I Nominal (A)", 
      width: 120,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} A` : 'N/A'
    },
    { 
      field: "i_adjusted", 
      headerName: "I Ajustada (A)", 
      width: 130,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} A` : 'N/A'
    },
    { 
      field: "s_teorica_mm2", 
      headerName: "S Teórica (mm²)", 
      width: 140,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} mm²` : 'N/A'
    },
    { 
      field: "s_comercial_mm2", 
      headerName: "S Comercial (mm²)", 
      width: 150,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(0)} mm²` : 'N/A',
      cellStyle: { fontWeight: 'bold', color: '#4caf50' }
    },
    { 
      field: "v_drop_real_pct", 
      headerName: "Caída V (%)", 
      width: 120,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(3)}%` : 'N/A',
      cellStyle: (params: any) => {
        const value = params.row?.v_drop_real_pct;
        if (value != null && value > 1.5) return { backgroundColor: '#2d1b1b', color: '#ff6b6b', fontWeight: 'bold' };
        return { color: '#4caf50', fontWeight: 'bold' };
      }
    },
    { 
      field: "v_drop_real_volts", 
      headerName: "Caída V (V)", 
      width: 120,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} V` : 'N/A'
    },
    { 
      field: "joule_losses_w", 
      headerName: "Pérdidas (W)", 
      width: 130,
      valueFormatter: (value: any) => value != null ? `${Number(value).toFixed(2)} W` : 'N/A'
    },
    { 
      field: "voltage_status", 
      headerName: "Estado", 
      width: 100,
      cellStyle: (params: any) => {
        const value = params.row?.voltage_status;
        switch(value) {
          case 'OK': return { color: '#4caf50', fontWeight: 'bold' };
          case 'WARNING': return { color: '#ff9800', fontWeight: 'bold' };
          case 'CRITICAL': return { color: '#f44336', fontWeight: 'bold' };
          default: return { color: '#666' };
        }
      },
      valueFormatter: (value: any) => {
        switch(value) {
          case 'OK': return '✅ OK';
          case 'WARNING': return '⚠️ Warning';
          case 'CRITICAL': return '❌ Critical';
          default: return '❓ Unknown';
        }
      }
    }
  ];

  const validResults = results.filter(result => !result.error);
  const errorResults = results.filter(result => result.error);

  // Debug: ver qué datos están llegando
  console.log("StringsResultsTable - Datos recibidos:", results);
  console.log("StringsResultsTable - Primer resultado válido:", validResults[0]);

  return (
    <Box>
      {/* Tabla principal */}
      <Box sx={{ height: 400, width: '100%', marginBottom: 2 }}>
        <DataGrid
          rows={validResults.map((row, index) => ({ ...row, id: index }))}
          columns={columns}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
          }}
          pageSizeOptions={[5, 10, 25, 50]}
          checkboxSelection
          disableSelectionOnClick
          sx={{
            backgroundColor: '#1a1a2e',
            color: '#eee',
            border: '1px solid #16213e',
            borderRadius: '12px',
            
            // Headers de columnas - MEJORADO
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#0f3460',
              color: '#ffffff !important',
              fontWeight: 'bold',
              fontSize: '14px',
              borderBottom: '2px solid #e53e3e',
              '& .MuiDataGrid-columnHeader': {
                backgroundColor: '#0f3460',
                color: '#ffffff !important',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                color: '#ffffff !important',
                fontWeight: 'bold',
                fontSize: '14px',
              },
            },
            
            // Separadores y iconos
            '& .MuiDataGrid-columnSeparator': {
              color: '#fff !important',
              visibility: 'visible',
            },
            '& .MuiDataGrid-iconButtonContainer': {
              '& .MuiIconButton-root': {
                color: '#fff !important',
              },
            },
            '& .MuiDataGrid-sortIcon': {
              color: '#fff !important',
            },
            '& .MuiDataGrid-filterIcon': {
              color: '#fff !important',
            },
            '& .MuiDataGrid-menuIcon': {
              color: '#fff !important',
            },
            
            // Celdas de datos
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #16213e',
              color: '#e0e0e0',
              borderRight: '1px solid #16213e',
            },
            
            // Filas
            '& .MuiDataGrid-row': {
              backgroundColor: '#1a1a2e',
              '&:hover': {
                backgroundColor: '#0f3460 !important',
              },
              '&.Mui-selected': {
                backgroundColor: '#e53e3e !important',
                '&:hover': {
                  backgroundColor: '#c53030 !important',
                },
              },
            },
            
            // Footer
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: '#16213e',
              color: '#fff',
              borderTop: '2px solid #0f3460',
              '& .MuiTablePagination-root': {
                color: '#fff',
              },
              '& .MuiTablePagination-selectIcon': {
                color: '#fff',
              },
              '& .MuiIconButton-root': {
                color: '#fff',
              },
            },
            
            // Checkboxes
            '& .MuiCheckbox-root': {
              color: '#e53e3e',
              '&.Mui-checked': { 
                color: '#e53e3e',
              },
            },
            
            // Scrollbars
            '& .MuiDataGrid-virtualScroller': {
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#16213e',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#e53e3e',
                borderRadius: '4px',
              },
            },
          }}
        />
      </Box>

      {/* Mostrar errores si los hay */}
      {errorResults.length > 0 && (
        <Alert severity="warning" sx={{ backgroundColor: '#2d2416', color: '#ffb74d', marginTop: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            ⚠️ {errorResults.length} strings con errores:
          </Typography>
          {errorResults.slice(0, 3).map((err, i) => (
            <Typography key={i} variant="body2" sx={{ fontSize: '12px', marginLeft: 2 }}>
              • {err.string_id}: {err.error}
            </Typography>
          ))}
          {errorResults.length > 3 && (
            <Typography variant="body2" sx={{ fontSize: '12px', marginLeft: 2, fontStyle: 'italic' }}>
              ... y {errorResults.length - 3} más
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}

// Componente para análisis crítico de strings
function StringsCriticalAnalysis({ results }: { results: any[] }) {
  const validResults = results.filter(r => !r.error && r.v_drop_real_pct !== null);
  
  if (validResults.length === 0) return null;

  // Encontrar string más crítico por longitud
  const longestString = validResults.reduce((max, curr) => 
    curr.length_total_m > max.length_total_m ? curr : max
  );

  // Encontrar string con mayor caída de tensión
  const highestVoltageDropString = validResults.reduce((max, curr) => 
    curr.v_drop_real_pct > max.v_drop_real_pct ? curr : max
  );

  // Contar strings fuera de límite
  const stringsOverLimit = validResults.filter(r => r.v_drop_real_pct > 1.5).length;

  return (
    <Box sx={{ marginTop: 2 }}>
      <Typography variant="h6" sx={{ color: '#ff9800', marginBottom: 2 }}>
        🔍 Análisis Crítico
      </Typography>
      
      <Grid container spacing={2}>
        <Grid xs={12} md={4}>
          <Paper sx={{ padding: 2, backgroundColor: '#2d2416', border: '1px solid #ff9800' }}>
            <Typography variant="body2" sx={{ color: '#ffb74d', fontWeight: 'bold' }}>
              String más largo:
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff' }}>
              {longestString.string_id}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              {longestString.length_total_m.toFixed(2)} m | {longestString.v_drop_real_pct.toFixed(2)}%
            </Typography>
          </Paper>
        </Grid>
        
        <Grid xs={12} md={4}>
          <Paper sx={{ padding: 2, backgroundColor: '#2d1b1b', border: '1px solid #f44336' }}>
            <Typography variant="body2" sx={{ color: '#ff6b6b', fontWeight: 'bold' }}>
              Mayor caída de tensión:
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff' }}>
              {highestVoltageDropString.string_id}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              {highestVoltageDropString.v_drop_real_pct.toFixed(3)}% | {highestVoltageDropString.s_comercial_mm2}mm²
            </Typography>
          </Paper>
        </Grid>
        
        <Grid xs={12} md={4}>
          <Paper sx={{ 
            padding: 2, 
            backgroundColor: stringsOverLimit > 0 ? '#2d1b1b' : '#1b2d1b', 
            border: `1px solid ${stringsOverLimit > 0 ? '#f44336' : '#4caf50'}` 
          }}>
            <Typography variant="body2" sx={{ 
              color: stringsOverLimit > 0 ? '#ff6b6b' : '#81c784', 
              fontWeight: 'bold' 
            }}>
              Cumplimiento normativo:
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff' }}>
              {validResults.length - stringsOverLimit}/{validResults.length}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              {stringsOverLimit > 0 ? `${stringsOverLimit} fuera de límite` : 'Todos dentro de límite'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// Componentes placeholder para otros tipos de circuito
function Level1ResultsTable({ results }: { results: any[] }) {
  return (
    <Box sx={{ textAlign: 'center', padding: 4 }}>
      <Typography variant="h6" sx={{ color: '#a0a0a0' }}>
        🚧 Tabla de Nivel 1 DC
      </Typography>
      <Typography variant="body2" sx={{ color: '#666' }}>
        {results.length} elementos calculados (tabla por implementar)
      </Typography>
    </Box>
  );
}

function ACResultsTable({ results }: { results: any[] }) {
  return (
    <Box sx={{ textAlign: 'center', padding: 4 }}>
      <Typography variant="h6" sx={{ color: '#a0a0a0' }}>
        🚧 Tabla de Circuitos AC
      </Typography>
      <Typography variant="body2" sx={{ color: '#666' }}>
        {results.length} elementos calculados (tabla por implementar)
      </Typography>
    </Box>
  );
}

function MVResultsTable({ results }: { results: any[] }) {
  return (
    <Box sx={{ textAlign: 'center', padding: 4 }}>
      <Typography variant="h6" sx={{ color: '#a0a0a0' }}>
        🚧 Tabla de Media Tensión
      </Typography>
      <Typography variant="body2" sx={{ color: '#666' }}>
        {results.length} elementos calculados (tabla por implementar)
      </Typography>
    </Box>
  );
}
interface CalculationTabContentProps {
  tab: any;
  calculation: CalculationResult | null;
  onCalculate: () => void;
  isLoading: boolean;
  norm: string;
}

function CalculationTabContent({ tab, calculation, onCalculate, isLoading, norm }: CalculationTabContentProps) {
  return (
    <Box>
      {/* Header de la pestaña */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
          {tab.icon} {tab.label}
        </Typography>
        <Typography variant="body1" sx={{ color: '#a0a0a0' }}>
          {tab.description}
        </Typography>
      </Box>

      {/* Configuración y botón de cálculo */}
      <Paper sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#16213e',
        border: '1px solid #0f3460'
      }}>
        <Grid container spacing={3} alignItems="center">
          <Grid xs={12} md={3}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: '#fff' }}>Normativa</InputLabel>
              <Select
                value={norm}
                onChange={(e) => setNorm(e.target.value as any)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#16213e' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e53e3e' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                <MenuItem value="IEC">IEC</MenuItem>
                <MenuItem value="NEC">NEC</MenuItem>
                <MenuItem value="Personalizada">Personalizada</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid xs={12} md={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={onCalculate}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <CalculateIcon />}
              sx={{ 
                background: 'linear-gradient(45deg, #e53e3e 30%, #ff6b6b 90%)',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '25px',
                '&:hover': {
                  background: 'linear-gradient(45deg, #c53030 30%, #e53e3e 90%)',
                },
                '&:disabled': { background: '#666' },
              }}
            >
              {isLoading ? 'Calculando...' : `Calcular ${tab.label}`}
            </Button>
          </Grid>

          <Grid xs={12} md={6}>
            {calculation && (
              <Chip 
                label={
                  calculation.status === 'success' 
                    ? `✅ Calculado (${calculation.results?.length || 0} elementos)`
                    : calculation.status === 'error'
                    ? '❌ Error en cálculo'
                    : '⏳ Calculando...'
                }
                sx={{ 
                  backgroundColor: calculation.status === 'success' ? '#1b2d1b' : '#2d1b1b',
                  color: calculation.status === 'success' ? '#81c784' : '#ff6b6b',
                  fontWeight: 'bold',
                  width: '100%',
                  height: 40
                }}
              />
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Resultados */}
      {calculation && (
        <Paper sx={{ 
          padding: 3,
          backgroundColor: '#16213e',
          border: '1px solid #0f3460'
        }}>
          {calculation.status === 'success' ? (
            <Box>
              <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
                📊 Resultados del Cálculo
              </Typography>
              
              {/* Tabla de resultados específica para strings */}
              {tab.circuitType === 'dc_strings' && <StringsResultsTable results={calculation.results} />}
              {tab.circuitType === 'level_1_dc' && <Level1ResultsTable results={calculation.results} />}
              {tab.circuitType === 'ac_circuits' && <ACResultsTable results={calculation.results} />}
              {tab.circuitType === 'mv_circuits' && <MVResultsTable results={calculation.results} />}
              
              {/* Estadísticas generales */}
              <Box sx={{ marginTop: 3 }}>
                <Typography variant="body1" sx={{ color: '#fff', marginBottom: 1 }}>
                  📈 Resumen: {calculation.results?.length || 0} elementos calculados
                </Typography>
                
                {/* Mostrar strings críticos si es dc_strings */}
                {tab.circuitType === 'dc_strings' && calculation.results && calculation.results.length > 0 && (
                  <StringsCriticalAnalysis results={calculation.results} />
                )}
              </Box>
            </Box>
          ) : calculation.status === 'error' ? (
            <Alert severity="error" sx={{ backgroundColor: '#2d1b1b', color: '#ff6b6b' }}>
              Error: {calculation.error}
            </Alert>
          ) : null}
        </Paper>
      )}

      {/* Estado vacío */}
      {!calculation && (
        <Paper sx={{ 
          padding: 4, 
          textAlign: 'center',
          backgroundColor: '#16213e',
          border: '1px solid #0f3460'
        }}>
          <Typography variant="h6" sx={{ color: '#a0a0a0', marginBottom: 2, fontSize: '48px' }}>
            ⚡
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
            Listo para calcular {tab.label}
          </Typography>
          <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
            Haz clic en el botón "Calcular" para ejecutar los cálculos
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// Componente para la pestaña de resumen
interface SummaryTabContentProps {
  calculations: CalculationState;
  projectName: string;
  progress: ProjectProgress;
}

function SummaryTabContent({ calculations, projectName, progress }: SummaryTabContentProps) {
  return (
    <Box>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 3 }}>
        📊 Resumen Ejecutivo - {projectName}
      </Typography>

      {/* Estadísticas generales */}
      <Grid container spacing={3} sx={{ marginBottom: 3 }}>
        <Grid xs={12} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#16213e' }}>
            <Typography variant="h4" sx={{ color: '#81c784' }}>
              {progress.completed}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              Secciones Calculadas
            </Typography>
          </Paper>
        </Grid>
        
        <Grid xs={12} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#16213e' }}>
            <Typography variant="h4" sx={{ color: '#e53e3e' }}>
              {calculations.strings?.results?.length || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              Strings DC
            </Typography>
          </Paper>
        </Grid>

        <Grid xs={12} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#16213e' }}>
            <Typography variant="h4" sx={{ color: '#ff9800' }}>
              {calculations.ac?.results?.length || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              Circuitos AC
            </Typography>
          </Paper>
        </Grid>

        <Grid xs={12} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#16213e' }}>
            <Typography variant="h4" sx={{ color: '#9c27b0' }}>
              {Math.round(progress.percentage)}%
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
              Progreso Total
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Estado de cálculos */}
      <Paper sx={{ padding: 3, backgroundColor: '#16213e', marginBottom: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          📋 Estado de Cálculos
        </Typography>
        
        {Object.entries(calculations).map(([key, calc]) => (
          <Box key={key} sx={{ marginBottom: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={calc?.status === 'success' ? '✅' : calc?.status === 'error' ? '❌' : '⏳'}
                size="small"
              />
              <Typography variant="body1" sx={{ color: '#fff', flexGrow: 1 }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
                {calc ? `${calc.results?.length || 0} elementos` : 'Pendiente'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Paper>

      {/* Botón de exportar (placeholder) */}
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<AssessmentIcon />}
          sx={{ 
            background: 'linear-gradient(45deg, #9c27b0 30%, #ba68c8 90%)',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '25px',
            padding: '12px 30px',
          }}
        >
          Exportar Reporte PDF
        </Button>
      </Box>
    </Box>
  );
}

export default CalculationPage;