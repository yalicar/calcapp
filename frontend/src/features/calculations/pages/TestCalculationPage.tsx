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
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import StringCalculator from '../components/StringCalculator';

const TestCalculationPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('colorado-v1');
  const [messages, setMessages] = useState<Array<{type: 'success' | 'error', text: string}>>([]);
  
  // Lista de proyectos comunes para testing
  const commonProjects = [
    'colorado-v1',
    'test-project',
    'proyecto-prueba',
    'solar-plant-1'
  ];

  const handleCalculationComplete = (results: any) => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `Cálculo ${results.normative} completado: ${results.summary.successful_calculations}/${results.summary.total_circuits} strings exitosos`
    }]);
  };

  const handleError = (error: string) => {
    setMessages(prev => [...prev, {
      type: 'error',
      text: error
    }]);
  };

  const clearMessages = () => {
    setMessages([]);
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
              ⚡ Prueba de Calculadora de Strings
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
              Página de desarrollo para probar el componente StringCalculator
            </Typography>
          </Box>

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
          🎛️ Controles de Prueba
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
        </Box>

        <Divider sx={{ marginY: 2, backgroundColor: '#666' }} />

        <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
          <strong>Instrucciones:</strong> Selecciona un proyecto con datos de Excel cargados. 
          El componente ejecutará cálculos de strings DC usando los endpoints del backend.
        </Typography>
      </Paper>

      {/* Mensajes de estado */}
      {messages.length > 0 && (
        <Box sx={{ marginBottom: 3 }}>
          {messages.map((message, index) => (
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

      {/* Componente bajo prueba */}
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
          ⚡ Componente StringCalculator
        </Typography>
        
        {projectName ? (
          <StringCalculator
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
          🔍 Información de Debug
        </Typography>
        
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
            <strong>Proyecto:</strong> {projectName || 'No definido'}<br/>
            <strong>Mensajes:</strong> {messages.length}<br/>
            <strong>Endpoint IEC:</strong> http://localhost:8000/calculations/calculate-iec-strings/{projectName}<br/>
            <strong>Endpoint NEC:</strong> http://localhost:8000/calculations/calculate-nec-strings/{projectName}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Requisitos:</strong>
        </Typography>
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px', marginTop: 1 }}>
          <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
            ✅ Backend corriendo en http://localhost:8000<br/>
            ✅ Proyecto con Excel cargado (hoja 'dc_string_circuits')<br/>
            ✅ Configuración de normativas disponible<br/>
            📋 Resultados incluyen: panel info, parámetros, tabla de strings, resumen
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Funcionalidades:</strong> Selección de normativa, ejecución de cálculos, 
          visualización de resultados, detección automática de configuración personalizada.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TestCalculationPage;