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
  Collapse,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalculateIcon from '@mui/icons-material/Calculate';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import PowerIcon from '@mui/icons-material/Power';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SummarizeIcon from '@mui/icons-material/Summarize';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';

// Configuración API
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);

  // Establecer el proyecto desde la URL
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  const currentProjectName = projectName || urlProjectName;

  // Calcular progreso - solo cuenta strings por ahora
  const getProgress = (): ProjectProgress => {
    const completed = calculations.strings?.status === 'success' ? 1 : 0;
    const total = 1; // Solo strings por ahora
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
  };

  const progress = getProgress();

  // Configuración de pestañas - solo strings habilitada
  const tabs = [
    {
      label: "Strings DC",
      icon: <ElectricalServicesIcon />,
      description: "Cálculo de strings fotovoltaicos",
      circuitType: "dc_strings",
      enabled: true
    },
    {
      label: "Nivel 1 DC",
      icon: <PowerIcon />,
      description: "Combinadores y concentradores DC",
      circuitType: "level_1_dc", 
      enabled: false
    },
    {
      label: "Circuitos AC",
      icon: <ElectricalServicesIcon />,
      description: "Circuitos de corriente alterna",
      circuitType: "ac_circuits",
      enabled: false
    },
    {
      label: "Media Tensión",
      icon: <FlashOnIcon />,
      description: "Circuitos de media tensión",
      circuitType: "mv_circuits",
      enabled: false
    },
    {
      label: "Resumen",
      icon: <SummarizeIcon />,
      description: "Resumen ejecutivo y reportes",
      circuitType: "summary",
      enabled: true
    }
  ];

  // Función para ejecutar cálculo de strings
  const executeStringCalculation = async () => {
    if (!currentProjectName) {
      setError("No hay proyecto seleccionado");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.get(
        `${API_BASE_URL}/calculations/calculate-strings/${currentProjectName}`
      );

      console.log('String calculation response:', response.data);
      
      const calculationResult: CalculationResult = {
        results: response.data.results || response.data,
        summary: response.data.summary,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      setCalculations(prev => ({
        ...prev,
        strings: calculationResult
      }));

      setSuccess(`Cálculo de strings completado exitosamente. ${calculationResult.results.length} strings calculados.`);

    } catch (error: any) {
      console.error('Error calculando strings:', error);
      
      const calculationResult: CalculationResult = {
        results: [],
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.response?.data?.detail || error.message
      };

      setCalculations(prev => ({
        ...prev,
        strings: calculationResult
      }));

      setError(`Error en cálculo de strings: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para limpiar resultados
  const clearResults = () => {
    setCalculations({
      strings: null,
      level1: null,
      ac: null,
      mv: null,
    });
    setError("");
    setSuccess("");
  };

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
        background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Paper elevation={6} sx={{ 
          padding: 4, 
          textAlign: 'center',
          backgroundColor: '#3a3a3a',
          borderRadius: '16px',
          border: '1px solid #525252',
        }}>
          <Typography variant="h5" sx={{ color: '#ffa726', marginBottom: 2, fontSize: '48px' }}>
            !
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            No hay proyecto seleccionado
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/projects')}
            sx={{ 
              backgroundColor: '#666',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: '#555',
              },
            }}
          >
            Seleccionar Proyecto
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3, 
    }}>
      {/* Header del proyecto */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
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
              Cálculos Eléctricos
            </Typography>
            <Chip 
              label={currentProjectName}
              sx={{ 
                backgroundColor: '#525252',
                color: '#e0e0e0',
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
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#525252' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
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
                borderColor: '#666',
                color: '#e0e0e0',
                '&:hover': { borderColor: '#777', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
              }}
            >
              Volver
            </Button>
          </Box>
        </Box>

        {/* Barra de progreso */}
        <Box sx={{ marginTop: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Progreso del proyecto
            </Typography>
            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
              {progress.completed}/{progress.total} secciones calculadas ({Math.round(progress.percentage)}%)
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress.percentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#525252',
              '& .MuiLinearProgress-bar': {
                backgroundColor: progress.percentage === 100 ? '#81c784' : '#ffb74d',
                borderRadius: 4,
              },
            }}
          />
        </Box>
      </Paper>

      {/* Mensajes de estado */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ marginBottom: 2, backgroundColor: '#4a3a3a', color: '#ffab91' }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ marginBottom: 2, backgroundColor: '#3a4a3a', color: '#a5d6a7' }}
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      )}

      {/* Pestañas principales */}
      <Paper elevation={6} sx={{ 
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
        overflow: 'hidden'
      }}>
        {/* Navegación de pestañas */}
        <Box sx={{ borderBottom: 1, borderColor: '#525252' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#b0b0b0',
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '14px',
                minHeight: '72px',
                '&.Mui-selected': {
                  color: '#ffb74d',
                },
                '&.Mui-disabled': {
                  color: '#666',
                  opacity: 0.5,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#ffb74d',
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
                  disabled={!tab.enabled}
                  icon={tab.icon}
                  label={
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {tab.label}
                        {!tab.enabled && " (Próximamente)"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                        {tab.description}
                      </Typography>
                      {status && (
                        <Chip
                          size="small"
                          label={status === 'success' ? 'Calculado' : status === 'error' ? 'Error' : 'Calculando'}
                          sx={{ 
                            marginTop: 0.5,
                            height: 16,
                            fontSize: '10px',
                            backgroundColor: status === 'success' ? '#3a4a3a' : status === 'error' ? '#4a3a3a' : '#4a4a3a',
                            color: status === 'success' ? '#a5d6a7' : status === 'error' ? '#ffab91' : '#ffcc80',
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
            {index === 0 ? (
              // Pestaña de strings (habilitada)
              <StringsTabContent
                calculation={calculations.strings}
                onCalculate={executeStringCalculation}
                onClear={clearResults}
                isLoading={isLoading}
                norm={norm}
                isAnalysisExpanded={isAnalysisExpanded}
                setIsAnalysisExpanded={setIsAnalysisExpanded}
              />
            ) : index < tabs.length - 1 ? (
              // Pestañas de otros cálculos (deshabilitadas)
              <DisabledTabContent tab={tab} />
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

// Componente para pestañas deshabilitadas
function DisabledTabContent({ tab }: { tab: any }) {
  return (
    <Paper sx={{ 
      padding: 4, 
      textAlign: 'center',
      backgroundColor: '#525252',
      border: '1px solid #666'
    }}>
      <Typography variant="h6" sx={{ color: '#b0b0b0', marginBottom: 2, fontSize: '48px' }}>
        🚧
      </Typography>
      <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
        {tab.label} - Próximamente
      </Typography>
      <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
        Esta funcionalidad está en desarrollo y estará disponible en futuras versiones.
      </Typography>
    </Paper>
  );
}

// Componente principal para la pestaña de strings
interface StringsTabContentProps {
  calculation: CalculationResult | null;
  onCalculate: () => void;
  onClear: () => void;
  isLoading: boolean;
  norm: string;
  isAnalysisExpanded: boolean;
  setIsAnalysisExpanded: (expanded: boolean) => void;
}

function StringsTabContent({ 
  calculation, 
  onCalculate, 
  onClear, 
  isLoading, 
  norm,
  isAnalysisExpanded,
  setIsAnalysisExpanded 
}: StringsTabContentProps) {
  return (
    <Box>
      {/* Header de la pestaña */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
          <ElectricalServicesIcon sx={{ marginRight: 1, verticalAlign: 'middle' }} />
          Cálculo de Strings DC
        </Typography>
        <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
          Cálculo de corrientes, secciones de cable y caídas de tensión para strings fotovoltaicos según normativa {norm}
        </Typography>
      </Box>

      {/* Panel de control */}
      <Paper sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#525252',
        border: '1px solid #666'
      }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 1 }}>
              Normativa aplicable:
            </Typography>
            <Chip 
              label={`Normativa ${norm}`}
              sx={{ 
                backgroundColor: '#666',
                color: '#fff',
                fontWeight: 'bold',
              }}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {calculation && (
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={onClear}
                  sx={{ 
                    borderColor: '#888',
                    color: '#e0e0e0',
                    '&:hover': { borderColor: '#999', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                  }}
                >
                  Limpiar
                </Button>
              )}
              
              <Button
                variant="contained"
                onClick={onCalculate}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <CalculateIcon />}
                sx={{ 
                  backgroundColor: '#666',
                  color: 'white',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  '&:hover': {
                    backgroundColor: '#777',
                  },
                  '&:disabled': { backgroundColor: '#444' },
                }}
              >
                {isLoading ? 'Calculando...' : 'Calcular Strings'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Resultados */}
      {calculation && (
        <Paper sx={{ 
          backgroundColor: '#525252',
          border: '1px solid #666',
          overflow: 'hidden'
        }}>
          {calculation.status === 'success' ? (
            <Box>
              {/* Header de resultados */}
              <Box sx={{ padding: 3, borderBottom: '1px solid #666' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#a5d6a7' }}>
                    Resultados del Cálculo
                  </Typography>
                  <Chip 
                    label={`${calculation.results?.length || 0} strings calculados`}
                    sx={{ 
                      backgroundColor: '#3a4a3a',
                      color: '#a5d6a7',
                      fontWeight: 'bold',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
                  Calculado el {new Date(calculation.timestamp).toLocaleString()}
                </Typography>
              </Box>
              
              {/* Tabla de resultados */}
              <Box sx={{ padding: 3 }}>
                <StringsResultsTable results={calculation.results} />
              </Box>
              
              {/* Análisis crítico expandible */}
              {calculation.results && calculation.results.length > 0 && (
                <Box>
                  <Box 
                    sx={{ 
                      padding: 2, 
                      borderTop: '1px solid #666',
                      backgroundColor: '#666',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                  >
                    <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                      Análisis Crítico
                    </Typography>
                    <IconButton sx={{ color: '#ffcc80' }}>
                      {isAnalysisExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  
                  <Collapse in={isAnalysisExpanded}>
                    <Box sx={{ padding: 3 }}>
                      <StringsCriticalAnalysis results={calculation.results} />
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Box>
          ) : calculation.status === 'error' ? (
            <Box sx={{ padding: 3 }}>
              <Alert severity="error" sx={{ backgroundColor: '#4a3a3a', color: '#ffab91' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', marginBottom: 1 }}>
                  Error en el cálculo:
                </Typography>
                <Typography variant="body2">
                  {calculation.error}
                </Typography>
              </Alert>
            </Box>
          ) : null}
        </Paper>
      )}

      {/* Estado vacío */}
      {!calculation && (
        <Paper sx={{ 
          padding: 4, 
          textAlign: 'center',
          backgroundColor: '#525252',
          border: '1px solid #666'
        }}>
          <Typography variant="h6" sx={{ color: '#b0b0b0', marginBottom: 2, fontSize: '48px' }}>
            ⚡
          </Typography>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
            Listo para calcular strings DC
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Los cálculos incluyen corrientes nominales, secciones de cable, caídas de tensión y pérdidas Joule
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// Componente para tabla de resultados de strings DC - MEJORADO
function StringsResultsTable({ results }: { results: any[] }) {
  const columns: GridColDef[] = [
    { 
      field: "string_id", 
      headerName: "String ID", 
      width: 150,
      pinned: 'left',
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 'bold', color: '#ffb74d' }}>
          {params.value}
        </Typography>
      )
    },
    { 
      field: "length_total_m", 
      headerName: "Longitud (m)", 
      width: 130,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(2)}` : 'N/A',
      renderCell: (params) => (
        <Typography sx={{ fontFamily: 'monospace' }}>
          {params.formattedValue} m
        </Typography>
      )
    },
    { 
      field: "i_nominal", 
      headerName: "I Nominal (A)", 
      width: 130,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(2)}` : 'N/A',
      renderCell: (params) => (
        <Typography sx={{ fontFamily: 'monospace' }}>
          {params.formattedValue} A
        </Typography>
      )
    },
    { 
      field: "i_adjusted", 
      headerName: "I Ajustada (A)", 
      width: 140,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(2)}` : 'N/A',
      renderCell: (params) => (
        <Typography sx={{ fontFamily: 'monospace', color: '#a5d6a7' }}>
          {params.formattedValue} A
        </Typography>
      )
    },
    { 
      field: "s_teorica_mm2", 
      headerName: "S Teórica (mm²)", 
      width: 150,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(3)}` : 'N/A',
      renderCell: (params) => (
        <Typography sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {params.formattedValue} mm²
        </Typography>
      )
    },
    { 
      field: "s_comercial_mm2", 
      headerName: "S Comercial (mm²)", 
      width: 160,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(0)}` : 'N/A',
      renderCell: (params) => (
        <Chip
          label={`${params.formattedValue} mm²`}
          size="small"
          sx={{ 
            backgroundColor: '#3a4a3a',
            color: '#a5d6a7',
            fontWeight: 'bold',
            fontFamily: 'monospace'
          }}
        />
      )
    },
    { 
      field: "v_drop_real_pct", 
      headerName: "Caída V (%)", 
      width: 130,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(3)}` : 'N/A',
      renderCell: (params) => {
        const value = params.row?.v_drop_real_pct;
        const isOverLimit = value != null && value > 1.5;
        return (
          <Typography sx={{ 
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: isOverLimit ? '#ffab91' : '#a5d6a7',
            backgroundColor: isOverLimit ? 'rgba(255, 171, 145, 0.1)' : 'transparent',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {params.formattedValue}%
          </Typography>
        );
      }
    },
    { 
      field: "v_drop_real_volts", 
      headerName: "Caída V (V)", 
      width: 130,
      type: 'number',
      valueFormatter: (value) => value != null ? `${Number(value).toFixed(2)}` : 'N/A',
      renderCell: (params) => (
        <Typography sx={{ fontFamily: 'monospace' }}>
          {params.formattedValue} V
        </Typography>
      )
    },
    { 
      field: "voltage_status", 
      headerName: "Estado", 
      width: 120,
      renderCell: (params) => {
        const value = params.value;
        let color, bgColor, label;
        
        switch(value) {
          case 'OK':
            color = '#a5d6a7';
            bgColor = 'rgba(165, 214, 167, 0.1)';
            label = 'OK';
            break;
          case 'WARNING':
            color = '#ffcc80';
            bgColor = 'rgba(255, 204, 128, 0.1)';
            label = 'Warning';
            break;
          case 'CRITICAL':
            color = '#ffab91';
            bgColor = 'rgba(255, 171, 145, 0.1)';
            label = 'Critical';
            break;
          default:
            color = '#888';
            bgColor = 'transparent';
            label = 'Unknown';
        }
        
        return (
          <Chip
            label={label}
            size="small"
            sx={{ 
              backgroundColor: bgColor,
              color: color,
              fontWeight: 'bold',
              border: `1px solid ${color}`
            }}
          />
        );
      }
    }
  ];

  const validResults = results.filter(result => !result.error);
  const errorResults = results.filter(result => result.error);

  // Estadísticas rápidas
  const stats = {
    total: validResults.length,
    overLimit: validResults.filter(r => r.v_drop_real_pct > 1.5).length,
    avgVoltDrop: validResults.length > 0 
      ? (validResults.reduce((sum, r) => sum + (r.v_drop_real_pct || 0), 0) / validResults.length).toFixed(3)
      : '0',
    totalLosses: validResults.reduce((sum, r) => sum + (r.joule_losses_w || 0), 0).toFixed(2)
  };

  return (
    <Box>
      {/* Estadísticas rápidas */}
      <Grid container spacing={2} sx={{ marginBottom: 3 }}>
        <Grid item xs={6} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#666' }}>
            <Typography variant="h6" sx={{ color: '#a5d6a7' }}>
              {stats.total}
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Total Strings
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: stats.overLimit > 0 ? '#4a3a3a' : '#666' }}>
            <Typography variant="h6" sx={{ color: stats.overLimit > 0 ? '#ffab91' : '#a5d6a7' }}>
              {stats.overLimit}
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Fuera de Límite
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#666' }}>
            <Typography variant="h6" sx={{ color: '#ffcc80' }}>
              {stats.avgVoltDrop}%
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Caída Promedio
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper sx={{ padding: 2, textAlign: 'center', backgroundColor: '#666' }}>
            <Typography variant="h6" sx={{ color: '#ffb74d' }}>
              {stats.totalLosses} W
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Pérdidas Totales
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabla principal */}
      <Box sx={{ height: 500, width: '100%', marginBottom: 2 }}>
        <DataGrid
          rows={validResults.map((row, index) => ({ ...row, id: index }))}
          columns={columns}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          checkboxSelection
          disableRowSelectionOnClick
          sx={{
            backgroundColor: '#3a3a3a',
            color: '#eee',
            border: '1px solid #525252',
            borderRadius: '12px',
            
            // Headers mejorados
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#666',
              color: '#ffffff !important',
              fontWeight: 'bold',
              fontSize: '14px',
              borderBottom: '2px solid #ffb74d',
            },
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: '#666',
              color: '#ffffff !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              color: '#ffffff !important',
              fontWeight: 'bold',
            },
            
            // Iconos y controles
            '& .MuiDataGrid-columnSeparator': {
              color: '#fff !important',
              visibility: 'visible',
            },
            '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root': {
              color: '#fff !important',
            },
            '& .MuiDataGrid-sortIcon, & .MuiDataGrid-filterIcon, & .MuiDataGrid-menuIcon': {
              color: '#fff !important',
            },
            
            // Celdas
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #525252',
              borderRight: '1px solid #525252',
              color: '#e0e0e0',
            },
            
            // Filas
            '& .MuiDataGrid-row': {
              backgroundColor: '#3a3a3a',
              '&:hover': {
                backgroundColor: '#666 !important',
              },
              '&.Mui-selected': {
                backgroundColor: 'rgba(255, 183, 77, 0.2) !important',
                '&:hover': {
                  backgroundColor: 'rgba(255, 183, 77, 0.3) !important',
                },
              },
            },
            
            // Footer
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: '#525252',
              color: '#fff',
              borderTop: '2px solid #666',
            },
            '& .MuiTablePagination-root': {
              color: '#fff',
            },
            '& .MuiTablePagination-selectIcon, & .MuiIconButton-root': {
              color: '#fff',
            },
            
            // Checkboxes
            '& .MuiCheckbox-root': {
              color: '#ffb74d',
              '&.Mui-checked': { 
                color: '#ffb74d',
              },
            },
            
            // Scrollbars
            '& .MuiDataGrid-virtualScroller': {
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#525252',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#ffb74d',
                borderRadius: '4px',
              },
            },
          }}
        />
      </Box>

      {/* Mostrar errores si los hay */}
      {errorResults.length > 0 && (
        <Alert severity="warning" sx={{ backgroundColor: '#4a4a3a', color: '#ffcc80' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', marginBottom: 1 }}>
            {errorResults.length} strings con errores:
          </Typography>
          {errorResults.slice(0, 5).map((err, i) => (
            <Typography key={i} variant="body2" sx={{ fontSize: '12px', marginLeft: 2 }}>
              • {err.string_id}: {err.error}
            </Typography>
          ))}
          {errorResults.length > 5 && (
            <Typography variant="body2" sx={{ fontSize: '12px', marginLeft: 2, fontStyle: 'italic' }}>
              ... y {errorResults.length - 5} más
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}

// Componente para análisis crítico mejorado
function StringsCriticalAnalysis({ results }: { results: any[] }) {
  const validResults = results.filter(r => !r.error && r.v_drop_real_pct !== null);
  
  if (validResults.length === 0) {
    return (
      <Typography variant="body1" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
        No hay datos válidos para análisis
      </Typography>
    );
  }

  // Análisis detallado
  const analysis = {
    longest: validResults.reduce((max, curr) => 
      curr.length_total_m > max.length_total_m ? curr : max
    ),
    shortest: validResults.reduce((min, curr) => 
      curr.length_total_m < min.length_total_m ? curr : min
    ),
    highestVoltDrop: validResults.reduce((max, curr) => 
      curr.v_drop_real_pct > max.v_drop_real_pct ? curr : max
    ),
    lowestVoltDrop: validResults.reduce((min, curr) => 
      curr.v_drop_real_pct < min.v_drop_real_pct ? curr : min
    ),
    highestLosses: validResults.reduce((max, curr) => 
      curr.joule_losses_w > max.joule_losses_w ? curr : max
    ),
    overLimitStrings: validResults.filter(r => r.v_drop_real_pct > 1.5),
    avgLength: (validResults.reduce((sum, r) => sum + r.length_total_m, 0) / validResults.length).toFixed(2),
    avgVoltDrop: (validResults.reduce((sum, r) => sum + r.v_drop_real_pct, 0) / validResults.length).toFixed(3),
    totalPowerLoss: validResults.reduce((sum, r) => sum + r.joule_losses_w, 0).toFixed(2)
  };

  return (
    <Box>
      {/* Strings críticos */}
      <Grid container spacing={3} sx={{ marginBottom: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, backgroundColor: '#4a4a3a', border: '1px solid #ffcc80' }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              String más crítico (mayor caída)
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>ID:</Typography>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                {analysis.highestVoltDrop.string_id}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Longitud:</Typography>
              <Typography variant="body2" sx={{ color: '#fff' }}>
                {analysis.highestVoltDrop.length_total_m.toFixed(2)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Caída de tensión:</Typography>
              <Typography variant="body2" sx={{ color: '#ffab91', fontWeight: 'bold' }}>
                {analysis.highestVoltDrop.v_drop_real_pct.toFixed(3)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Sección comercial:</Typography>
              <Typography variant="body2" sx={{ color: '#fff' }}>
                {analysis.highestVoltDrop.s_comercial_mm2} mm²
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, backgroundColor: '#3a4a3a', border: '1px solid #a5d6a7' }}>
            <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
              String más eficiente (menor caída)
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>ID:</Typography>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                {analysis.lowestVoltDrop.string_id}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Longitud:</Typography>
              <Typography variant="body2" sx={{ color: '#fff' }}>
                {analysis.lowestVoltDrop.length_total_m.toFixed(2)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Caída de tensión:</Typography>
              <Typography variant="body2" sx={{ color: '#a5d6a7', fontWeight: 'bold' }}>
                {analysis.lowestVoltDrop.v_drop_real_pct.toFixed(3)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Sección comercial:</Typography>
              <Typography variant="body2" sx={{ color: '#fff' }}>
                {analysis.lowestVoltDrop.s_comercial_mm2} mm²
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Resumen estadístico */}
      <Paper sx={{ padding: 3, backgroundColor: '#666', border: '1px solid #525252' }}>
        <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
          Resumen Estadístico
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 1 }}>
              Cumplimiento normativo:
            </Typography>
            <Typography variant="h6" sx={{ 
              color: analysis.overLimitStrings.length === 0 ? '#a5d6a7' : '#ffab91',
              fontWeight: 'bold'
            }}>
              {validResults.length - analysis.overLimitStrings.length}/{validResults.length} strings
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              {analysis.overLimitStrings.length === 0 
                ? 'Todos dentro del límite (≤1.5%)'
                : `${analysis.overLimitStrings.length} strings exceden el límite`}
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 1 }}>
              Rangos de longitud:
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff' }}>
              {analysis.shortest.length_total_m.toFixed(1)}m - {analysis.longest.length_total_m.toFixed(1)}m
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Promedio: {analysis.avgLength}m
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 1 }}>
              Pérdidas totales:
            </Typography>
            <Typography variant="h6" sx={{ color: '#ffcc80', fontWeight: 'bold' }}>
              {analysis.totalPowerLoss} W
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Caída promedio: {analysis.avgVoltDrop}%
            </Typography>
          </Grid>
        </Grid>

        {/* Strings fuera de límite */}
        {analysis.overLimitStrings.length > 0 && (
          <Box sx={{ marginTop: 3, padding: 2, backgroundColor: '#4a3a3a', borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#ffab91', fontWeight: 'bold', marginBottom: 1 }}>
              Strings que exceden límite normativo (&gt;1.5%):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {analysis.overLimitStrings.slice(0, 10).map((string, i) => (
                <Chip
                  key={i}
                  label={`${string.string_id}: ${string.v_drop_real_pct.toFixed(2)}%`}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 171, 145, 0.2)',
                    color: '#ffab91',
                    border: '1px solid #ffab91'
                  }}
                />
              ))}
              {analysis.overLimitStrings.length > 10 && (
                <Chip
                  label={`+${analysis.overLimitStrings.length - 10} más`}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 171, 145, 0.1)',
                    color: '#ffab91',
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>
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
  const stringsResult = calculations.strings;
  const hasData = stringsResult && stringsResult.status === 'success' && stringsResult.results.length > 0;

  return (
    <Box>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 3 }}>
        <SummarizeIcon sx={{ marginRight: 1, verticalAlign: 'middle' }} />
        Resumen Ejecutivo - {projectName}
      </Typography>

      {/* Estadísticas generales */}
      <Grid container spacing={3} sx={{ marginBottom: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ padding: 3, textAlign: 'center', backgroundColor: '#525252' }}>
            <Typography variant="h3" sx={{ color: '#a5d6a7', fontWeight: 'bold' }}>
              {progress.completed}
            </Typography>
            <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
              Secciones Calculadas
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', marginTop: 1 }}>
              de {progress.total} total
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper sx={{ padding: 3, textAlign: 'center', backgroundColor: '#525252' }}>
            <Typography variant="h3" sx={{ color: '#ffb74d', fontWeight: 'bold' }}>
              {stringsResult?.results?.length || 0}
            </Typography>
            <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
              Strings Calculados
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', marginTop: 1 }}>
              circuitos DC
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper sx={{ padding: 3, textAlign: 'center', backgroundColor: '#525252' }}>
            <Typography variant="h3" sx={{ color: '#ffcc80', fontWeight: 'bold' }}>
              {hasData ? 
                stringsResult.results.filter(r => r.v_drop_real_pct <= 1.5).length 
                : 0}
            </Typography>
            <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
              Strings Conformes
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', marginTop: 1 }}>
              dentro de límites
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper sx={{ padding: 3, textAlign: 'center', backgroundColor: '#525252' }}>
            <Typography variant="h3" sx={{ color: '#ce93d8', fontWeight: 'bold' }}>
              {Math.round(progress.percentage)}%
            </Typography>
            <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
              Progreso Total
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', marginTop: 1 }}>
              del proyecto
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Estado detallado */}
      <Paper sx={{ padding: 3, backgroundColor: '#525252', marginBottom: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          Estado Detallado del Proyecto
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
              <Typography variant="body1" sx={{ color: '#a5d6a7', fontWeight: 'bold', marginBottom: 1 }}>
                Strings DC
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                {stringsResult ? 
                  `${stringsResult.results?.length || 0} elementos calculados` :
                  'Pendiente de cálculo'
                }
              </Typography>
              {stringsResult?.timestamp && (
                <Typography variant="caption" sx={{ color: '#888' }}>
                  Último cálculo: {new Date(stringsResult.timestamp).toLocaleString()}
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ padding: 2, backgroundColor: '#4a4a3a', borderRadius: '8px', opacity: 0.6 }}>
              <Typography variant="body1" sx={{ color: '#ffcc80', fontWeight: 'bold', marginBottom: 1 }}>
                Otros Cálculos
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                Nivel 1 DC, AC y MV próximamente
              </Typography>
              <Typography variant="caption" sx={{ color: '#888' }}>
                En desarrollo
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Resumen de resultados si hay datos */}
      {hasData && (
        <Paper sx={{ padding: 3, backgroundColor: '#525252' }}>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            Resumen de Resultados de Strings
          </Typography>
          <StringsCriticalAnalysis results={stringsResult.results} />
        </Paper>
      )}

      {/* Botón de exportar */}
      <Box sx={{ textAlign: 'center', marginTop: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<AssessmentIcon />}
          disabled={!hasData}
          sx={{ 
            backgroundColor: hasData ? '#666' : '#444',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '8px',
            padding: '12px 30px',
            '&:hover': hasData ? {
              backgroundColor: '#777',
            } : {},
          }}
        >
          {hasData ? 'Exportar Reporte PDF' : 'Complete los cálculos para exportar'}
        </Button>
      </Box>
    </Box>
  );
}

export default CalculationPage;