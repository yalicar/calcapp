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
  Chip,
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CompareIcon from '@mui/icons-material/Compare';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useNavigate } from 'react-router-dom';
import StringCalculatorEnhanced from '../components/StringCalculatorEnhanced';

const TestEnhancedCalculationPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('colorado-v1');
  const [messages, setMessages] = useState<Array<{type: 'success' | 'error', text: string, timestamp: string}>>([]);
  const [calculationHistory, setCalculationHistory] = useState<Array<any>>([]);
  
  // Lista de proyectos comunes para testing
  const commonProjects = [
    'colorado-v1',
    'test-project',
    'proyecto-prueba',
    'solar-plant-1'
  ];

  const handleCalculationComplete = (results: any) => {
    const now = new Date().toLocaleString();
    
    setMessages(prev => [...prev, {
      type: 'success',
      text: `✅ Cálculo MEJORADO ${results.normative} completado: ${results.summary.successful_calculations}/${results.summary.total_circuits} strings exitosos`,
      timestamp: now
    }]);

    // Agregar al historial
    setCalculationHistory(prev => [...prev, {
      ...results,
      timestamp: now
    }].slice(-5)); // Mantener solo los últimos 5

    // Mostrar información del análisis estadístico
    if (results.statistical_analysis) {
      const criticalString = results.statistical_analysis.critical_string;
      const bestString = results.statistical_analysis.best_string;
      
      setMessages(prev => [...prev, {
        type: 'success',
        text: `📊 String crítico: ${criticalString.string_id} (${criticalString.voltage_drop_pct?.toFixed(3)}%) | Mejor: ${bestString.string_id} (${bestString.voltage_drop_pct?.toFixed(3)}%)`,
        timestamp: now
      }]);
    }
  };

  const handleError = (error: string) => {
    setMessages(prev => [...prev, {
      type: 'error',
      text: `❌ ${error}`,
      timestamp: new Date().toLocaleString()
    }]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const clearHistory = () => {
    setCalculationHistory([]);
  };

  const compareWithOriginal = () => {
    // Navegar a la página original para comparar
    navigate('/test-calculation', { 
      state: { 
        projectName, 
        compareMode: true,
        enhancedResults: calculationHistory[calculationHistory.length - 1] 
      } 
    });
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3, 
    }}>
      {/* Header */}
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
              🚀 Calculadora MEJORADA - Pruebas
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
              Versión mejorada con análisis estadístico, parámetros completos y justificación de fórmulas
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CompareIcon />}
              onClick={compareWithOriginal}
              disabled={calculationHistory.length === 0}
              sx={{ 
                borderColor: '#ffb74d',
                color: '#ffb74d',
                '&:hover': { borderColor: '#ffa726', backgroundColor: 'rgba(255, 183, 77, 0.1)' },
                '&:disabled': { borderColor: '#666', color: '#666' }
              }}
            >
              Comparar con Original
            </Button>

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

      {/* Controles de prueba */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          🎛️ Controles de Prueba MEJORADOS
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Selector rápido de proyectos */}
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

          {/* Input manual para proyectos personalizados */}
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

          {calculationHistory.length > 0 && (
            <Button
              variant="outlined"
              onClick={clearHistory}
              size="small"
              sx={{ 
                borderColor: '#ff9800',
                color: '#ffb74d',
                '&:hover': { borderColor: '#ffa726' },
              }}
            >
              Limpiar Historial ({calculationHistory.length})
            </Button>
          )}
        </Box>

        <Divider sx={{ marginY: 2, backgroundColor: '#666' }} />

        {/* Nuevas características */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', marginBottom: 2 }}>
          <Chip 
            icon={<AutoAwesomeIcon />}
            label="Análisis Estadístico" 
            sx={{ backgroundColor: '#4caf50', color: '#fff' }}
          />
          <Chip 
            icon={<AutoAwesomeIcon />}
            label="Parámetros Completos" 
            sx={{ backgroundColor: '#2196f3', color: '#fff' }}
          />
          <Chip 
            icon={<AutoAwesomeIcon />}
            label="Justificación de Fórmulas" 
            sx={{ backgroundColor: '#ff9800', color: '#fff' }}
          />
          <Chip 
            icon={<AutoAwesomeIcon />}
            label="String Crítico/Mejor" 
            sx={{ backgroundColor: '#9c27b0', color: '#fff' }}
          />
          <Chip 
            icon={<AutoAwesomeIcon />}
            label="Fallback Inteligente" 
            sx={{ backgroundColor: '#607d8b', color: '#fff' }}
          />
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
          <strong>Nuevas funciones:</strong> Esta versión incluye análisis estadístico automático, 
          muestra todos los parámetros de configuración (agrupamiento, temperatura, instalación), 
          y proporciona justificación matemática detallada del string más crítico.
        </Typography>
      </Paper>

      {/* Historial de cálculos */}
      {calculationHistory.length > 0 && (
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#3a3a3a',
          borderRadius: '16px',
          border: '1px solid #525252',
        }}>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            📈 Historial de Cálculos ({calculationHistory.length})
          </Typography>
          
          <Grid container spacing={2}>
            {calculationHistory.slice(-3).map((calc, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Paper sx={{ padding: 2, backgroundColor: '#525252' }}>
                  <Typography variant="body1" sx={{ color: '#ffcc80', fontWeight: 'bold' }}>
                    {calc.normative} - {calc.timestamp}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Strings:</strong> {calc.summary.total_circuits}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Exitosos:</strong> {calc.summary.successful_calculations}
                  </Typography>
                  {calc.statistical_analysis && (
                    <>
                      <Typography variant="body2" sx={{ color: '#ffab91' }}>
                        <strong>Crítico:</strong> {calc.statistical_analysis.critical_string.string_id} 
                        ({calc.statistical_analysis.critical_string.voltage_drop_pct?.toFixed(3)}%)
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                        <strong>Mejor:</strong> {calc.statistical_analysis.best_string.string_id} 
                        ({calc.statistical_analysis.best_string.voltage_drop_pct?.toFixed(3)}%)
                      </Typography>
                    </>
                  )}
                  {calc.has_project_overrides && (
                    <Chip 
                      label="Config Personalizada" 
                      size="small" 
                      sx={{ marginTop: 1, backgroundColor: '#ffcc80', color: '#333' }}
                    />
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Mensajes de estado */}
      {messages.length > 0 && (
        <Box sx={{ marginBottom: 3 }}>
          {messages.slice(-5).map((message, index) => (
            <Alert 
              key={index} 
              severity={message.type} 
              sx={{ 
                marginBottom: 1,
                backgroundColor: message.type === 'success' ? '#2e7d32' : '#d32f2f',
                color: '#fff'
              }}
            >
              <Box>
                <Typography variant="body2">{message.text}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {message.timestamp}
                </Typography>
              </Box>
            </Alert>
          ))}
        </Box>
      )}

      {/* Componente bajo prueba */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
          ⚡ Componente StringCalculatorEnhanced
        </Typography>
        
        {projectName ? (
          <StringCalculatorEnhanced
            projectName={projectName}
            onCalculationComplete={handleCalculationComplete}
            onError={handleError}
          />
        ) : (
          <Paper sx={{ 
            padding: 3, 
            backgroundColor: '#525252', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <Typography sx={{ color: '#ffab91' }}>
              ⚠️ Ingresa un nombre de proyecto para comenzar
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Información de debugging */}
      <Paper elevation={6} sx={{ 
        padding: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          🔍 Información de Debug - Versión Mejorada
        </Typography>
        
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
            <strong>Proyecto:</strong> {projectName || 'No definido'}<br/>
            <strong>Mensajes:</strong> {messages.length}<br/>
            <strong>Historial de cálculos:</strong> {calculationHistory.length}<br/>
            <strong>Endpoint Mejorado IEC:</strong> http://localhost:8000/calculations/calculate-iec-strings-enhanced/{projectName}<br/>
            <strong>Endpoint Mejorado NEC:</strong> http://localhost:8000/calculations/calculate-nec-strings-enhanced/{projectName}<br/>
            <strong>Fallback IEC:</strong> http://localhost:8000/calculations/calculate-iec-strings/{projectName}<br/>
            <strong>Fallback NEC:</strong> http://localhost:8000/calculations/calculate-nec-strings/{projectName}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Mejoras implementadas:</strong>
        </Typography>
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px', marginTop: 1 }}>
          <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
            ✅ Análisis estadístico automático (string crítico vs mejor)<br/>
            ✅ Parámetros completos de configuración visible<br/>
            ✅ Justificación matemática de fórmulas<br/>
            ✅ Tabla mejorada con resaltado de strings importantes<br/>
            ✅ Fallback inteligente si endpoints mejorados no existen<br/>
            ✅ Historial de cálculos para comparación<br/>
            ✅ Procesamiento frontend de análisis estadístico
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Diferencias vs versión original:</strong> Más información, mejor análisis, 
          justificación de cálculos, identificación automática de casos críticos.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TestEnhancedCalculationPage;