import React, { useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import StringCalculator from '../features/calculations/components/StringCalculator';
import NormativeEditor from '../features/normatives/components/NormativeEditor';

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
  const [projectName, setProjectName] = useState('colorado-v1');
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

  const handleCalculationComplete = (results: any) => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Cálculo ${results.normative} completado: ${results.summary.successful_calculations}/${results.summary.total_circuits} strings exitosos`
    }]);
    
    // Detectar si se usaron overrides
    if (results.has_project_overrides) {
      setHasProjectOverrides(true);
    }
  };

  const handleNormativeSaved = () => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Configuración de normativa guardada para ${projectName}`
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
          <Box>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
              ⚡ Cálculos DC Strings
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
              Configuración de normativas y cálculo de secciones de conductores
            </Typography>
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
              onClick={() => navigate(-1)}
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
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
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
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
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
          <strong>Flujo recomendado:</strong> 1️⃣ Configurar normativa personalizada → 2️⃣ Ejecutar cálculos
        </Typography>
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

      {/* Contenido Principal con Tabs */}
      {projectName ? (
        <Paper elevation={6} sx={{
          backgroundColor: '#3a3a3a',
          borderRadius: '16px',
          border: '1px solid #525252',
          overflow: 'hidden'
        }}>
          {/* Tabs Navigation */}
          <Box sx={{ borderBottom: 1, borderColor: '#525252' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              sx={{
                '& .MuiTab-root': {
                  color: '#b0b0b0',
                  '&.Mui-selected': {
                    color: '#ffb74d'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#ffb74d'
                }
              }}
            >
              <Tab 
                icon={<SettingsIcon />} 
                label="Configurar Normativa" 
                id="dc-strings-tab-0"
                aria-controls="dc-strings-tabpanel-0"
                sx={{ fontWeight: 'bold' }}
              />
              <Tab 
                icon={<CalculateIcon />} 
                label="Ejecutar Cálculos" 
                id="dc-strings-tab-1"
                aria-controls="dc-strings-tabpanel-1"
                sx={{ fontWeight: 'bold' }}
              />
            </Tabs>
          </Box>

          {/* Tab Content */}
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
                projectName={projectName}
                stage="dc_strings"
                onSaved={handleNormativeSaved}
                onError={handleError}
              />
            </Box>
          </TabPanel>

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
                projectName={projectName}
                onCalculationComplete={handleCalculationComplete}
                onError={handleError}
              />
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

      {/* Información Técnica (colapsable) */}
      <Paper elevation={6} sx={{ 
        padding: 3,
        marginTop: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h6" sx={{ color: '#888', marginBottom: 2 }}>
          💡 Información del Sistema
        </Typography>
        
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
            <strong>Proyecto actual:</strong> {projectName || 'No seleccionado'}<br/>
            <strong>Configuración:</strong> {hasProjectOverrides ? 'Personalizada aplicada' : 'Usando normativa estándar'}<br/>
            <strong>Backend:</strong> http://localhost:8000<br/>
            <strong>Estado:</strong> {messages.length > 0 ? `${messages.length} mensajes` : 'Listo'}
          </Typography>
        </Box>

        <Box sx={{ marginTop: 2, backgroundColor: '#444', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
            ✅ Panel database: {projectName ? 'Datos de Trina Solar TSM-720NEG21C.20 (18.44A ISC)' : 'Pendiente'}<br/>
            ✅ Normativas: IEC/NEC con parámetros editables<br/>
            ✅ Cálculos: Secciones comerciales con factores de corrección<br/>
            ✅ Overrides: Configuración por proyecto y etapa
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default DCStringsPage;