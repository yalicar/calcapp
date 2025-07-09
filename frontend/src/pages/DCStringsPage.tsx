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
import CalculateIcon from '@mui/icons-material/Calculate';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VerifiedIcon from '@mui/icons-material/Verified';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import StringCalculator from '../features/calculations/components/StringCalculator';
import NormativeEditor from '../features/normatives/components/NormativeEditor';
import CriticalStringAnalyzer from '../features/calculations/components/CriticalStringAnalyzer';
import StringCalculationEngine from '../features/calculations/components/StringCalculationEngine';
import NormativeValidator from '../features/calculations/components/NormativeValidator';
import StringAnalysisPDFGenerator from '../features/reports/components/StringAnalysisPDFGenerator';

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
      id={`dc-strings-tabpanel-${index}`}
      aria-labelledby={`dc-strings-tab-${index}`}
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

const DCStringsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectName: contextProjectName, setProjectName: setContextProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  
  // Usar proyecto del contexto o URL
  const currentProjectName = contextProjectName || urlProjectName || 'colorado-v1';
  
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState<Array<{type: 'success' | 'error', text: string}>>([]);
  const [hasProjectOverrides, setHasProjectOverrides] = useState(false);
  
  // Lista de proyectos comunes
  const commonProjects = [
    'colorado-v1',
    'test-project',
    'proyecto-prueba',
    'solar-plant-1'
  ];

  // Establecer proyecto desde URL al cargar
  useEffect(() => {
    if (!contextProjectName && urlProjectName) {
      setContextProjectName(urlProjectName);
    }
  }, [contextProjectName, urlProjectName, setContextProjectName]);

  const handleCalculationComplete = (results: any) => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Cálculo ${results.normative} completado: ${results.summary?.successful_calculations || 0}/${results.summary?.total_circuits || 0} strings exitosos`
    }]);
    
    // Detectar si se usaron overrides
    if (results.has_project_overrides) {
      setHasProjectOverrides(true);
    }
  };

  const handleNormativeSaved = () => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Configuración de normativa guardada para ${currentProjectName}`
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
      navigate(`/projects/${newProjectName}/calculations`);
    }
  };

  // Función para volver
  const handleGoBack = () => {
    if (currentProjectName && currentProjectName !== 'colorado-v1') {
      navigate(`/projects/${currentProjectName}/upload`);
    } else {
      navigate('/');
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3, 
    }}>
      {/* Header Principal */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                ⚡ Sistema Completo de Análisis
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
                Todos los módulos integrados para análisis completo de sistemas fotovoltaicos
              </Typography>
            </Box>
            
            {/* Mostrar proyecto actual */}
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
            {hasProjectOverrides && (
              <Chip 
                label="Config Personalizada"
                sx={{ 
                  backgroundColor: '#4a4a3a',
                  color: '#ffcc80',
                  fontWeight: 'bold',
                }}
              />
            )}
            
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
      </Paper>

      {/* Selector de Proyecto */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          📂 Selección de Proyecto
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Proyecto Rápido</InputLabel>
            <Select
              value={currentProjectName}
              onChange={(e) => handleProjectChange(e.target.value)}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
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
                '& fieldset': { borderColor: '#666' },
                '&:hover fieldset': { borderColor: '#888' },
                '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
              },
              '& .MuiInputLabel-root': { color: '#b0b0b0' },
            }}
          />

          {messages.length > 0 && (
            <Button
              variant="outlined"
              onClick={clearMessages}
              size="small"
              sx={{ 
                borderColor: '#666',
                color: '#e0e0e0',
                '&:hover': { borderColor: '#888' },
              }}
            >
              Limpiar Mensajes
            </Button>
          )}
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Flujo completo:</strong> 1️⃣ Configurar normativa → 2️⃣ Ejecutar cálculos → 3️⃣ Analizar strings críticos → 4️⃣ Validar normativas → 5️⃣ Generar reportes
        </Typography>

        {/* Info de ruta actual */}
        {urlProjectName && (
          <Typography variant="body2" sx={{ color: '#ffcc80', marginTop: 1, fontFamily: 'monospace' }}>
            📍 Ruta actual: /projects/{urlProjectName}/calculations
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

      {/* Contenido Principal con Tabs EXPANDIDOS */}
      {currentProjectName ? (
        <Paper elevation={6} sx={{
          backgroundColor: '#3a3a3a',
          borderRadius: '16px',
          border: '1px solid #525252',
          overflow: 'hidden'
        }}>
          {/* Tabs Navigation - TODOS LOS MÓDULOS */}
          <Box sx={{ borderBottom: 1, borderColor: '#525252' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  color: '#b0b0b0',
                  minWidth: '140px',
                  '&.Mui-selected': {
                    color: '#ffb74d'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#ffb74d'
                },
                '& .MuiTabs-scrollButtons': {
                  color: '#fff'
                }
              }}
            >
              <Tab 
                icon={<SettingsIcon />} 
                label="Configurar Normativa" 
                id="tab-0"
                sx={{ fontWeight: 'bold' }}
              />
              <Tab 
                icon={<CalculateIcon />} 
                label="Ejecutar Cálculos" 
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
                label="Motor de Cálculo" 
                id="tab-3"
                sx={{ fontWeight: 'bold' }}
              />
              <Tab 
                icon={<VerifiedIcon />} 
                label="Validador Normativo" 
                id="tab-4"
                sx={{ fontWeight: 'bold' }}
              />
              <Tab 
                icon={<ArticleIcon />} 
                label="Generar Reportes" 
                id="tab-5"
                sx={{ fontWeight: 'bold' }}
              />
            </Tabs>
          </Box>

          {/* Tab Content - TODOS LOS COMPONENTES */}
          
          {/* Tab 0: Configurar Normativa */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
                🔧 Configuración de Normativa para DC Strings
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Personaliza los parámetros normativos específicos para este proyecto. 
                Los cambios se aplicarán automáticamente en los cálculos.
              </Typography>
              
              <NormativeEditor
                projectName={currentProjectName}
                stage="dc_strings"
                onSaved={handleNormativeSaved}
                onError={handleError}
              />
            </Box>
          </TabPanel>

          {/* Tab 1: Ejecutar Cálculos */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
                ⚡ Calculadora de Strings DC
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Ejecuta cálculos de dimensionamiento de conductores usando las normativas 
                {hasProjectOverrides ? ' personalizadas' : ' estándar'}. Los resultados incluyen secciones teóricas y comerciales.
              </Typography>
              
              <StringCalculator
                projectName={currentProjectName}
                onCalculationComplete={handleCalculationComplete}
                onError={handleError}
              />
            </Box>
          </TabPanel>

          {/* Tab 2: Análisis Crítico */}
          <TabPanel value={activeTab} index={2}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#90caf9', marginBottom: 2 }}>
                📊 Analizador de Strings Críticos
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Identifica y analiza los strings con mayores pérdidas, resistencias críticas y puntos de optimización.
                Incluye simulador de cambios y recomendaciones técnicas.
              </Typography>
              
              <CriticalStringAnalyzer />
            </Box>
          </TabPanel>

          {/* Tab 3: Motor de Cálculo */}
          <TabPanel value={activeTab} index={3}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#ce93d8', marginBottom: 2 }}>
                ⚙️ Motor de Cálculo Avanzado
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Motor de cálculo interno con algoritmos optimizados. Permite cálculos precisos con múltiples configuraciones
                y análisis de sensibilidad de parámetros.
              </Typography>
              
              <StringCalculationEngine />
            </Box>
          </TabPanel>

          {/* Tab 4: Validador Normativo */}
          <TabPanel value={activeTab} index={4}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
                ✅ Validador de Cumplimiento Normativo
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Valida el cumplimiento con estándares internacionales (IEC 62548, NEC 2020, IEC 60364, UL 1741).
                Incluye sistema de puntuación y recomendaciones de mejora.
              </Typography>
              
              <NormativeValidator />
            </Box>
          </TabPanel>

          {/* Tab 5: Generar Reportes */}
          <TabPanel value={activeTab} index={5}>
            <Box sx={{ padding: 3 }}>
              <Typography variant="h6" sx={{ color: '#a5d6a7', marginBottom: 2 }}>
                📄 Generador de Reportes PDF
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
                Genera reportes profesionales en PDF integrando todos los análisis realizados.
                Incluye gráficos, validaciones normativas y recomendaciones técnicas.
              </Typography>
              
              <StringAnalysisPDFGenerator />
            </Box>
          </TabPanel>

        </Paper>
      ) : (
        <Paper sx={{ 
          padding: 4, 
          backgroundColor: '#525252', 
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#ffab91', marginBottom: 1 }}>
            ⚠️ Selecciona un Proyecto
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Ingresa el nombre de un proyecto con datos cargados para comenzar
          </Typography>
        </Paper>
      )}

      {/* Información Técnica */}
      <Paper elevation={6} sx={{ 
        padding: 3,
        marginTop: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h6" sx={{ color: '#888', marginBottom: 2 }}>
          💡 Información del Sistema Integrado
        </Typography>
        
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
            <strong>Proyecto actual:</strong> {currentProjectName}<br/>
            <strong>Módulos disponibles:</strong> 6 componentes integrados<br/>
            <strong>Tab activo:</strong> {['Configurar Normativa', 'Ejecutar Cálculos', 'Análisis Crítico', 'Motor de Cálculo', 'Validador Normativo', 'Generar Reportes'][activeTab]}<br/>
            <strong>Configuración:</strong> {hasProjectOverrides ? 'Personalizada aplicada' : 'Usando normativa estándar'}<br/>
            <strong>Backend:</strong> http://localhost:8000<br/>
            <strong>Estado:</strong> {messages.length > 0 ? `${messages.length} mensajes` : 'Todos los módulos listos'}
          </Typography>
        </Box>

        <Box sx={{ marginTop: 2, backgroundColor: '#444', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
            ✅ 🔧 Editor de normativas con parámetros personalizables<br/>
            ✅ ⚡ Calculadora de strings con múltiples normativas<br/>
            ✅ 📊 Analizador de strings críticos con simulaciones<br/>
            ✅ ⚙️ Motor de cálculo avanzado con algoritmos optimizados<br/>
            ✅ ✅ Validador normativo con múltiples estándares<br/>
            ✅ 📄 Generador de reportes PDF profesionales<br/>
            ✅ 🔗 ProjectContext: Integración completa entre módulos
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default DCStringsPage;