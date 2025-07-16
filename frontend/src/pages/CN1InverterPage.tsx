/**
 * CN1InverterPage.tsx
 * 
 * Página principal de cálculos y análisis de cables principales CN1.
 * Incluye FlowNavigator para mostrar progreso en paso "cn1-inverter".
 * 
 * Funcionalidades:
 * - Cálculos de cables principales (Combiner Box → Inversor)
 * - Configuración de normativas CN1
 * - Validaciones específicas para corrientes combinadas
 * - Generación de reportes CN1
 * - Navegación desde/hacia DC Strings
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalculateIcon from '@mui/icons-material/Calculate';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VerifiedIcon from '@mui/icons-material/Verified';
import TuneIcon from '@mui/icons-material/Tune';
import CableIcon from '@mui/icons-material/Cable';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import FlowNavigator from '../components/FlowNavigator';
import CN1StringCalculator from '../features/calculations/components/CN1StringCalculator';
import CN1NormativeEditor from '../features/normatives/components/CN1NormativeEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cn1-inverter-tabpanel-${index}`}
      aria-labelledby={`cn1-inverter-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ paddingTop: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const CN1InverterPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectName: contextProjectName, setProjectName: setContextProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  
  // Usar proyecto del contexto o URL
  const currentProjectName = contextProjectName || urlProjectName || 'colorado-v1';
  
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState<Array<{type: 'success' | 'error', text: string}>>([]);
  const [hasProjectOverrides, setHasProjectOverrides] = useState(false);
  const [hasCalculations, setHasCalculations] = useState(false);
  
  // Lista de proyectos comunes
  const commonProjects = [
    'colorado-v1',
    'test-project',
    'proyecto-prueba',
    'solar-plant-1'
  ];

  // Definir pasos del flujo para FlowNavigator
  const flowSteps = [
    { id: 'home', title: 'Proyecto', description: 'Crear o seleccionar proyecto' },
    { id: 'upload', title: 'Datos', description: 'Subir archivo Excel' },
    { id: 'calculations', title: 'Cálculos', description: 'Análisis de strings DC' },
    { id: 'cn1-inverter', title: 'CN1 Inversor', description: 'Cables principales' }
  ];

  // Manejar navegación del FlowNavigator
  const handleStepNavigation = (stepId: string) => {
    if (stepId === 'home') {
      navigate('/');
    } else if (stepId === 'upload') {
      navigate(`/projects/${currentProjectName}/upload`);
    } else if (stepId === 'calculations') {
      navigate(`/projects/${currentProjectName}/calculations/strings`);
    }
  };

  // Establecer proyecto desde URL al cargar
  useEffect(() => {
    if (!contextProjectName && urlProjectName) {
      setContextProjectName(urlProjectName);
    }
  }, [contextProjectName, urlProjectName, setContextProjectName]);

  const handleCalculationComplete = (results: any) => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Cálculo CN1 ${results.normative} completado: ${results.summary?.successful_calculations || 0}/${results.summary?.total_circuits || 0} cables principales exitosos`
    }]);
    
    // Detectar si se usaron overrides
    if (results.has_project_overrides) {
      setHasProjectOverrides(true);
    }
    
    // Marcar que se han realizado cálculos
    setHasCalculations(true);
  };

  const handleNormativeSaved = () => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Configuración de normativa CN1 guardada para ${currentProjectName}`
    }]);
    setHasProjectOverrides(true);
  };

  const handleError = (error: string) => {
    setMessages(prev => [...prev, {
      type: 'error',
      text: `❌ ${error}`
    }]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Función para cambio de proyecto
  const handleProjectChange = (newProjectName: string) => {
    if (setContextProjectName) {
      setContextProjectName(newProjectName);
    }
    // Si hay URL con parámetros, navegar a la nueva ruta
    if (urlProjectName) {
      navigate(`/projects/${newProjectName}/calculations/cn1-inverter`);
    }
  };

  // Función para volver a DC Strings
  const handleGoBackToStrings = () => {
    navigate(`/projects/${currentProjectName}/calculations/strings`);
  };

  // Función para continuar (placeholder para futura expansión)
  const handleContinueToNext = () => {
    // TODO: Implementar navegación a siguiente etapa (AC, MV, etc.)
    setMessages(prev => [...prev, {
      type: 'success',
      text: `🚧 Función en desarrollo: Continuar a siguiente etapa`
    }]);
  };

  return (
    <>
      <FlowNavigator 
        steps={flowSteps} 
        currentStep="cn1-inverter"
        onStepClick={handleStepNavigation}
      />
      
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a4d3a 0%, #2d5a47 50%, #3a6b54 100%)',
        padding: 3,
        paddingTop: '120px', // Espacio para FlowNavigator
      }}>
        {/* Header Principal */}
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#2d5a47',
          borderRadius: '16px',
          border: '1px solid #4a7c59',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ElectricalServicesIcon sx={{ color: '#81c784', fontSize: 48 }} />
              <Box>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  🔌 Sistema CN1 - Cables Principales
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginTop: 1 }}>
                  Análisis completo de conductores desde Combiner Box hasta Inversor
                </Typography>
              </Box>
              
              {/* Mostrar proyecto actual */}
              <Chip 
                label={currentProjectName}
                sx={{ 
                  backgroundColor: '#4a7c59',
                  color: '#e8f5e8',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {hasProjectOverrides && (
                <Chip 
                  label="Config CN1 Personalizada"
                  sx={{ 
                    backgroundColor: '#5d4e37',
                    color: '#ffd54f',
                    fontWeight: 'bold',
                  }}
                />
              )}
              
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleGoBackToStrings}
                sx={{ 
                  borderColor: '#81c784',
                  color: '#e8f5e8',
                  '&:hover': { borderColor: '#a5d6a7', backgroundColor: 'rgba(129, 199, 132, 0.1)' },
                }}
              >
                ← DC Strings
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Selector de Proyecto */}
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#2d5a47',
          borderRadius: '16px',
          border: '1px solid #4a7c59',
        }}>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            📂 Selección de Proyecto - CN1
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ color: '#c8e6c9' }}>Proyecto Rápido</InputLabel>
              <Select
                value={currentProjectName}
                onChange={(e) => handleProjectChange(e.target.value)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4a7c59' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                {commonProjects.map((project) => (
                  <MenuItem key={project} value={project}>
                    {project}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="O Escribe Proyecto"
              value={currentProjectName}
              onChange={(e) => handleProjectChange(e.target.value)}
              size="small"
              sx={{
                minWidth: 200,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#4a7c59' },
                  '&:hover fieldset': { borderColor: '#81c784' },
                  '&.Mui-focused fieldset': { borderColor: '#81c784' },
                },
                '& .MuiInputLabel-root': { color: '#c8e6c9' },
              }}
            />

            {messages.length > 0 && (
              <Button
                variant="outlined"
                onClick={clearMessages}
                size="small"
                sx={{ 
                  borderColor: '#4a7c59',
                  color: '#e8f5e8',
                  '&:hover': { borderColor: '#81c784' },
                }}
              >
                Limpiar Mensajes
              </Button>
            )}
          </Box>

          <Typography variant="body2" sx={{ color: '#c8e6c9', marginTop: 2 }}>
            <strong>Flujo CN1:</strong> 1️⃣ Configurar normativa CN1 → 2️⃣ Ejecutar cálculos principales → 3️⃣ Analizar cables críticos → 4️⃣ Validar cumplimiento → 5️⃣ Generar reportes
          </Typography>

          {/* Info de ruta actual */}
          {urlProjectName && (
            <Typography variant="body2" sx={{ color: '#ffd54f', marginTop: 1, fontFamily: 'monospace' }}>
              📍 Ruta actual: /projects/{urlProjectName}/calculations/cn1-inverter
            </Typography>
          )}
        </Paper>

        {/* Mensajes de Estado */}
        {messages.length > 0 && (
          <Box sx={{ marginBottom: 3 }}>
            {messages.slice(-3).map((message, index) => (
              <Alert 
                key={index} 
                severity={message.type} 
                sx={{ 
                  marginBottom: 1,
                  backgroundColor: message.type === 'success' ? '#2e7d32' : '#d32f2f',
                  color: '#fff'
                }}
              >
                {message.text}
              </Alert>
            ))}
          </Box>
        )}

        {/* Contenido Principal con Tabs CN1 */}
        {currentProjectName ? (
          <Paper elevation={6} sx={{
            backgroundColor: '#2d5a47',
            borderRadius: '16px',
            border: '1px solid #4a7c59',
            overflow: 'hidden'
          }}>
            {/* Tabs Navigation - MÓDULOS CN1 */}
            <Box sx={{ borderBottom: 1, borderColor: '#4a7c59' }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': {
                    color: '#c8e6c9',
                    minWidth: '140px',
                    '&.Mui-selected': {
                      color: '#81c784'
                    }
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#81c784'
                  },
                  '& .MuiTabs-scrollButtons': {
                    color: '#fff'
                  }
                }}
              >
                <Tab 
                  icon={<SettingsIcon />} 
                  label="Configurar CN1" 
                  id="tab-0"
                  sx={{ fontWeight: 'bold' }}
                />
                <Tab 
                  icon={<CalculateIcon />} 
                  label="Calcular CN1" 
                  id="tab-1"
                  sx={{ fontWeight: 'bold' }}
                />
                <Tab 
                  icon={<AnalyticsIcon />} 
                  label="Análisis Crítico" 
                  id="tab-2"
                  sx={{ fontWeight: 'bold' }}
                />
                <Tab 
                  icon={<TuneIcon />} 
                  label="Motor CN1" 
                  id="tab-3"
                  sx={{ fontWeight: 'bold' }}
                />
                <Tab 
                  icon={<VerifiedIcon />} 
                  label="Validador CN1" 
                  id="tab-4"
                  sx={{ fontWeight: 'bold' }}
                />
                <Tab 
                  icon={<ArticleIcon />} 
                  label="Reportes CN1" 
                  id="tab-5"
                  sx={{ fontWeight: 'bold' }}
                />
              </Tabs>
            </Box>

            {/* Tab Content - COMPONENTES CN1 */}
            
            {/* Tab 0: Configurar Normativa CN1 */}
            <TabPanel value={activeTab} index={0}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
                  🔧 Configuración de Normativa para CN1
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Personaliza los parámetros normativos específicos para cables principales CN1. 
                  Los cambios se aplicarán en los cálculos de cables combiner → inversor.
                </Typography>
                
                <CN1NormativeEditor
                  projectName={currentProjectName}
                  stage="cn1_inverter"
                  onSaved={handleNormativeSaved}
                  onError={handleError}
                />
              </Box>
            </TabPanel>

            {/* Tab 1: Calcular CN1 */}
            <TabPanel value={activeTab} index={1}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
                  ⚡ Calculadora de Cables Principales CN1
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Ejecuta cálculos de dimensionamiento para cables principales desde combiner boxes hasta inversores
                  {hasProjectOverrides ? ' usando configuración CN1 personalizada' : ' usando normativa estándar CN1'}. 
                  Maneja corrientes combinadas y distancias mayores.
                </Typography>
                
                <CN1StringCalculator
                  projectName={currentProjectName}
                  onCalculationComplete={handleCalculationComplete}
                  onError={handleError}
                />
              </Box>
            </TabPanel>

            {/* Tab 2: Análisis Crítico CN1 */}
            <TabPanel value={activeTab} index={2}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#90caf9', marginBottom: 2 }}>
                  📊 Analizador de Cables CN1 Críticos
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Identifica cables principales con mayores pérdidas, resistencias críticas y oportunidades de optimización.
                  Análisis específico para corrientes combinadas y distancias largas.
                </Typography>
                
                <Box sx={{ 
                  backgroundColor: '#4a7c59',
                  borderRadius: 2,
                  padding: 3,
                  textAlign: 'center'
                }}>
                  <Typography variant="h6" sx={{ color: '#ffd54f', marginBottom: 2 }}>
                    🚧 CN1 Analizador Crítico
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                    Componente en desarrollo - Análisis específico para cables principales
                  </Typography>
                </Box>
              </Box>
            </TabPanel>

            {/* Tab 3: Motor CN1 */}
            <TabPanel value={activeTab} index={3}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#ce93d8', marginBottom: 2 }}>
                  ⚙️ Motor de Cálculo CN1 Avanzado
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Motor de cálculo especializado para cables principales. Algoritmos optimizados para corrientes altas
                  y análisis de sensibilidad para parámetros CN1.
                </Typography>
                
                <Box sx={{ 
                  backgroundColor: '#4a7c59',
                  borderRadius: 2,
                  padding: 3,
                  textAlign: 'center'
                }}>
                  <Typography variant="h6" sx={{ color: '#ffd54f', marginBottom: 2 }}>
                    🚧 CN1 Motor de Cálculo
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                    Componente en desarrollo - Motor especializado para CN1
                  </Typography>
                </Box>
              </Box>
            </TabPanel>

            {/* Tab 4: Validador CN1 */}
            <TabPanel value={activeTab} index={4}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
                  ✅ Validador de Cumplimiento CN1
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Valida el cumplimiento específico para cables principales con estándares de corrientes combinadas
                  y distancias extendidas según normativas internacionales.
                </Typography>
                
                <Box sx={{ 
                  backgroundColor: '#4a7c59',
                  borderRadius: 2,
                  padding: 3,
                  textAlign: 'center'
                }}>
                  <Typography variant="h6" sx={{ color: '#ffd54f', marginBottom: 2 }}>
                    🚧 CN1 Validador Normativo
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                    Componente en desarrollo - Validaciones específicas CN1
                  </Typography>
                </Box>
              </Box>
            </TabPanel>

            {/* Tab 5: Reportes CN1 */}
            <TabPanel value={activeTab} index={5}>
              <Box sx={{ padding: 3 }}>
                <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
                  📄 Generador de Reportes CN1
                </Typography>
                <Typography variant="body2" sx={{ color: '#c8e6c9', marginBottom: 3 }}>
                  Genera reportes profesionales específicos para cables principales integrando análisis CN1.
                  Incluye gráficos de corrientes combinadas y validaciones de distancias extendidas.
                </Typography>
                
                <Box sx={{ 
                  backgroundColor: '#4a7c59',
                  borderRadius: 2,
                  padding: 3,
                  textAlign: 'center'
                }}>
                  <Typography variant="h6" sx={{ color: '#ffd54f', marginBottom: 2 }}>
                    🚧 CN1 Generador PDF
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                    Componente en desarrollo - Reportes específicos para cables principales
                  </Typography>
                </Box>
              </Box>
            </TabPanel>

          </Paper>
        ) : (
          <Paper sx={{ 
            padding: 4, 
            backgroundColor: '#4a7c59', 
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <Typography variant="h6" sx={{ color: '#ffab91', marginBottom: 1 }}>
              ⚠️ Selecciona un Proyecto para CN1
            </Typography>
            <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
              Ingresa el nombre de un proyecto con datos cargados para comenzar con CN1
            </Typography>
          </Paper>
        )}

        {/* Navegación entre Etapas */}
        <Paper elevation={6} sx={{ 
          padding: 3,
          marginTop: 3,
          backgroundColor: '#2d5a47',
          borderRadius: '16px',
          border: '1px solid #4a7c59',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#90caf9', marginBottom: 1 }}>
                🔄 Navegación de Etapas
              </Typography>
              <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                Etapa actual: <strong>CN1 - Cables Principales</strong> (Combiner Box → Inversor)
              </Typography>
              {hasCalculations && (
                <Typography variant="body2" sx={{ color: '#4caf50', marginTop: 1, fontWeight: 'bold' }}>
                  ✅ Cálculos CN1 completados - Listo para siguiente etapa
                </Typography>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleGoBackToStrings}
                sx={{ 
                  borderColor: '#81c784',
                  color: '#e8f5e8',
                  '&:hover': { borderColor: '#a5d6a7', backgroundColor: 'rgba(129, 199, 132, 0.1)' },
                }}
              >
                ← DC Strings
              </Button>
              
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleContinueToNext}
                disabled={!currentProjectName}
                sx={{ 
                  backgroundColor: hasCalculations ? '#4caf50' : '#2196f3',
                  color: '#fff',
                  fontWeight: 'bold',
                  padding: '12px 24px',
                  '&:hover': { 
                    backgroundColor: hasCalculations ? '#388e3c' : '#1976d2' 
                  },
                  '&:disabled': {
                    backgroundColor: '#4a7c59',
                    color: '#999'
                  }
                }}
              >
                {hasCalculations ? 'Continuar →' : 'Siguiente Etapa →'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Información Técnica CN1 */}
        <Paper elevation={6} sx={{ 
          padding: 3,
          marginTop: 3,
          backgroundColor: '#2d5a47',
          borderRadius: '16px',
          border: '1px solid #4a7c59',
        }}>
          <Typography variant="h6" sx={{ color: '#888', marginBottom: 2 }}>
            💡 Información del Sistema CN1
          </Typography>
          
          <Box sx={{ backgroundColor: '#4a7c59', padding: 2, borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#e8f5e8', fontFamily: 'monospace' }}>
              <strong>Proyecto actual:</strong> {currentProjectName}<br/>
              <strong>Etapa:</strong> CN1 - Cables Principales<br/>
              <strong>Tipo de cables:</strong> Combiner Box → Inversor<br/>
              <strong>Hoja Excel:</strong> dc_cn1_circuits<br/>
              <strong>Tab activo:</strong> {['Configurar CN1', 'Calcular CN1', 'Análisis Crítico', 'Motor CN1', 'Validador CN1', 'Reportes CN1'][activeTab]}<br/>
              <strong>Configuración:</strong> {hasProjectOverrides ? 'CN1 personalizada aplicada' : 'Usando normativa CN1 estándar'}<br/>
              <strong>Cálculos CN1:</strong> {hasCalculations ? 'Completados' : 'Pendientes'}<br/>
              <strong>Backend:</strong> http://localhost:8000<br/>
              <strong>Estado:</strong> {messages.length > 0 ? `${messages.length} mensajes` : 'Todos los módulos CN1 listos'}
            </Typography>
          </Box>

          <Box sx={{ marginTop: 2, backgroundColor: '#3d6b50', padding: 2, borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
              ✅ 🔧 CN1NormativeEditor: Configuración específica para cables principales<br/>
              ✅ ⚡ CN1StringCalculator: Cálculos de corrientes combinadas<br/>
              🚧 📊 CN1CriticalAnalyzer: Análisis de cables principales críticos<br/>
              🚧 ⚙️ CN1CalculationEngine: Motor especializado para CN1<br/>
              🚧 ✅ CN1NormativeValidator: Validaciones específicas CN1<br/>
              🚧 📄 CN1PDFGenerator: Reportes para cables principales<br/>
              ✅ 🔗 ProjectContext: Integración completa CN1<br/>
              ✅ 🔄 Navegación bidireccional: DC Strings ↔ CN1 Inversor
            </Typography>
          </Box>
        </Paper>
      </Box>
    </>
  );
};

export default CN1InverterPage;