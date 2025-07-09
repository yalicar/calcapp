const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
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
import NormativeEditor from '../components/NormativeEditor';

const TestNormativePage: React.FC = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('colorado-v1');
  const [selectedStage, setSelectedStage] = useState('dc_strings');
  const [messages, setMessages] = useState<Array<{type: 'success' | 'error', text: string}>>([]);
  const [projectStatus, setProjectStatus] = useState<any>(null);
  
  // Lista de proyectos comunes para testing
  const commonProjects = [
    'colorado-v1',
    'test-project',
    'proyecto-prueba',
    'solar-plant-1'
  ];

  const stages = [
    { value: 'dc_strings', label: 'DC Strings' },
    { value: 'level_1_dc', label: 'Level 1 DC' },
    { value: 'ac_circuits', label: 'AC Circuits' },
    { value: 'mv_circuits', label: 'MV Circuits' }
  ];

  const handleSaved = () => {
    setMessages(prev => [...prev, {
      type: 'success',
      text: `Normativa de ${selectedStage} guardada exitosamente para ${projectName}`
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

  // Función para verificar status de cualquier proyecto
  const checkProjectStatus = async (projectToCheck: string) => {
    try {
      const response = await fetch(`http://localhost:8000/calculations/projects/${projectToCheck}/normative-status`);
      if (response.ok) {
        const data = await response.json();
        setProjectStatus(data);
        
        const hasAnyConfig = data.has_custom_config;
        const stagesWithConfig = Object.entries(data.stages)
          .filter(([_, stage]: [string, any]) => stage.override_exists)
          .map(([stageName, _]) => stageName);
          
        setMessages(prev => [...prev, {
          type: 'success',
          text: `${projectToCheck}: ${hasAnyConfig ? `Config en ${stagesWithConfig.join(', ')}` : 'Sin configuración personalizada'}`
        }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'error',
          text: `Error verificando ${projectToCheck}: ${response.status}`
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        text: `Error conectando con ${projectToCheck}: ${error}`
      }]);
    }
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
              🧪 Prueba de Editor de Normativas
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
              Página de desarrollo para probar el componente NormativeEditor
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Etapa</InputLabel>
            <Select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
                '& .MuiSvgIcon-root': { color: '#fff' },
              }}
            >
              {stages.map((stage) => (
                <MenuItem key={stage.value} value={stage.value}>
                  {stage.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Botones de acción */}
          <Button
            variant="contained"
            onClick={() => checkProjectStatus(projectName)}
            size="small"
            sx={{ 
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
            }}
          >
            📋 Verificar Status
          </Button>

          <Button
            variant="outlined"
            onClick={async () => {
              clearMessages();
              for (const project of commonProjects) {
                await checkProjectStatus(project);
              }
            }}
            size="small"
            sx={{ 
              borderColor: '#666',
              color: '#e0e0e0',
              '&:hover': { borderColor: '#888' },
            }}
          >
            🔍 Verificar Todos
          </Button>

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
          <strong>Instrucciones:</strong> Usa el selector rápido o escribe un proyecto personalizado. 
          Haz clic en "📋 Verificar Status" para ver qué etapas tienen configuración personalizada.
        </Typography>
      </Paper>

      {/* Panel de status del proyecto actual */}
      {projectStatus && (
        <Paper elevation={6} sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#3a3a3a',
          borderRadius: '16px',
          border: '1px solid #525252',
        }}>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            📊 Status de {projectStatus.project_name}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
            <Typography variant="body2" sx={{ 
              color: projectStatus.has_custom_config ? '#a5d6a7' : '#ffab91',
              fontWeight: 'bold'
            }}>
              {projectStatus.has_custom_config ? '✅ Tiene configuración personalizada' : '❌ Sin configuración personalizada'}
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 1 }}>
            <strong>Estado por etapas:</strong>
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(projectStatus.stages || {}).map(([stageName, stage]: [string, any]) => (
              <Box 
                key={stageName}
                sx={{ 
                  padding: 1,
                  backgroundColor: stage.override_exists ? '#2e7d32' : '#525252',
                  borderRadius: '4px',
                  minWidth: '120px'
                }}
              >
                <Typography variant="caption" sx={{ 
                  color: '#fff',
                  fontWeight: 'bold',
                  display: 'block'
                }}>
                  {stageName.toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: stage.override_exists ? '#c8e6c9' : '#b0b0b0'
                }}>
                  {stage.override_exists ? '✅ Personalizada' : '⚪ Sin config'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

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
          📝 Componente NormativeEditor
        </Typography>
        
        {projectName ? (
          <NormativeEditor
            projectName={projectName}
            stage={selectedStage}
            onSaved={handleSaved}
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
            <strong>Etapa:</strong> {selectedStage}<br/>
            <strong>URL Status:</strong> http://localhost:8000/calculations/projects/{projectName}/normative-status<br/>
            <strong>URL Parámetros:</strong> http://localhost:8000/calculations/projects/{projectName}/normatives/{selectedStage}/parameters<br/>
            <strong>Mensajes:</strong> {messages.length}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Endpoints que debe probar:</strong>
        </Typography>
        <Box sx={{ backgroundColor: '#525252', padding: 2, borderRadius: '8px', marginTop: 1 }}>
          <Typography variant="body2" sx={{ color: '#a5d6a7', fontFamily: 'monospace' }}>
            GET http://localhost:8000/calculations/normatives/available<br/>
            GET http://localhost:8000/calculations/projects/{projectName}/normative-status<br/>
            GET http://localhost:8000/calculations/projects/{projectName}/normatives/{selectedStage}/parameters<br/>
            PUT http://localhost:8000/calculations/projects/{projectName}/normatives/{selectedStage}/parameters<br/>
            DELETE http://localhost:8000/calculations/projects/{projectName}/normatives/{selectedStage}/parameters
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 2 }}>
          <strong>Nota:</strong> Asegúrate de que el backend esté corriendo en http://localhost:8000
        </Typography>
      </Paper>
    </Box>
  );
};

export default TestNormativePage;