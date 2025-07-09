const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';

interface NormativeEditorProps {
  projectName: string;
  stage?: string;
  onSaved?: () => void;
  onError?: (error: string) => void;
}

interface EditableParams {
  isc_safety_factor: number;
  parallel_strings: number;
  cable_material: string;
  cable_max_temp: number;
  max_voltage_drop: number;
  ambient_temp: number;
}

interface NormativeConfig {
  project_name?: string;
  stage?: string;
  custom_parameters?: any;
  display_name?: string;
  description?: string;
}

const NormativeEditor: React.FC<NormativeEditorProps> = ({
  projectName,
  stage = 'dc_strings',
  onSaved,
  onError
}) => {
  // Estados principales
  const [loading, setLoading] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [availableNormatives, setAvailableNormatives] = useState<string[]>(['IEC', 'NEC']);
  const [selectedBaseNorm, setSelectedBaseNorm] = useState<string>('IEC');
  const [normativeConfig, setNormativeConfig] = useState<NormativeConfig | null>(null);
  
  // Estados para parámetros editables
  const [editableParams, setEditableParams] = useState<EditableParams>({
    isc_safety_factor: 1.25,
    parallel_strings: 1,
    cable_material: 'copper',
    cable_max_temp: 90,
    max_voltage_drop: 1.5,
    ambient_temp: 40
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Efectos
  useEffect(() => {
    loadAvailableNormatives();
    checkProjectStatus();
  }, [projectName]);

  // IMPORTANTE: Cargar config cuando detectamos que hay configuración personalizada
  useEffect(() => {
    if (hasCustomConfig) {
      console.log('🔄 Detectada configuración personalizada, cargando parámetros...');
      loadCustomConfig();
    }
  }, [hasCustomConfig, stage, projectName]);

  // NUEVO: Verificar status cuando cambia el proyecto o etapa
  useEffect(() => {
    if (projectName) {
      checkProjectStatus();
    }
  }, [projectName, stage]);

  // Funciones de carga
  const loadAvailableNormatives = async () => {
    try {
      const response = await fetch('http://localhost:8000/calculations/normatives/available');
      if (response.ok) {
        const data = await response.json();
        const normNames = Object.keys(data.normatives || {});
        setAvailableNormatives(normNames.length > 0 ? normNames : ['IEC', 'NEC']);
        console.log('✅ Normativas disponibles:', normNames);
      }
    } catch (error) {
      console.error('❌ Error cargando normativas disponibles:', error);
    }
  };

  const checkProjectStatus = async () => {
    try {
      console.log(`🔍 Verificando status para proyecto: ${projectName}, etapa: ${stage}`);
      const response = await fetch(`http://localhost:8000/calculations/projects/${projectName}/normative-status`);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Status response completo:', data);
        
        const stageHasConfig = data.stages?.[stage]?.override_exists || false;
        console.log(`📝 ${stage} tiene config: ${stageHasConfig}`);
        
        setHasCustomConfig(stageHasConfig);
        console.log(`✅ hasCustomConfig actualizado a: ${stageHasConfig}`);
      } else {
        console.log('⚠️ Error en response:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error verificando status:', error);
    }
  };

  const loadCustomConfig = async () => {
    setLoading(true);
    try {
      console.log(`🔧 Cargando config personalizada para: ${projectName}/${stage}`);
      const response = await fetch(`http://localhost:8000/calculations/projects/${projectName}/normatives/${stage}/parameters`);
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📝 Config personalizada cargada:', data);
        setNormativeConfig(data);
        
        // Extraer parámetros editables del config custom
        if (data.custom_parameters) {
          const customParams = data.custom_parameters;
          console.log('🔄 Mapeando parámetros desde:', customParams);
          
          // Crear nuevos parámetros basados en los valores guardados
          const newParams: EditableParams = {
            // Valores por defecto primero
            isc_safety_factor: 1.25,
            parallel_strings: 1,
            cable_material: 'copper',
            cable_max_temp: 90,
            max_voltage_drop: 1.5,
            ambient_temp: 40
          };
          
          // Mapear desde la estructura YAML guardada
          if (customParams.correction_factors) {
            if (customParams.correction_factors.isc_safety_factor !== undefined) {
              newParams.isc_safety_factor = customParams.correction_factors.isc_safety_factor;
            }
            if (customParams.correction_factors.parallel_strings !== undefined) {
              newParams.parallel_strings = customParams.correction_factors.parallel_strings;
            }
          }
          
          if (customParams.cable) {
            if (customParams.cable.material !== undefined) {
              newParams.cable_material = customParams.cable.material;
            }
            if (customParams.cable.max_temp !== undefined) {
              newParams.cable_max_temp = customParams.cable.max_temp;
            }
          }
          
          if (customParams.voltage_drop) {
            if (customParams.voltage_drop.max_percentage !== undefined) {
              newParams.max_voltage_drop = customParams.voltage_drop.max_percentage;
            }
          }
          
          if (customParams.temperature_correction) {
            if (customParams.temperature_correction.ambient_design !== undefined) {
              newParams.ambient_temp = customParams.temperature_correction.ambient_design;
            }
          }
          
          console.log('✅ Parámetros mapeados:', newParams);
          setEditableParams(newParams);
          setHasUnsavedChanges(false); // Importante: marcar como guardado
          console.log('✅ Parámetros cargados desde config personalizada');
        } else {
          console.log('⚠️ No se encontraron custom_parameters en la respuesta');
        }
      } else {
        console.log('⚠️ No se encontró configuración personalizada - status:', response.status);
      }
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
      onError?.(`Error cargando configuración: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Funciones de manejo de cambios
  const handleParameterChange = (paramKey: keyof EditableParams, newValue: any) => {
    setEditableParams(prev => ({
      ...prev,
      [paramKey]: newValue
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // Funciones de guardado
  const saveParameters = async () => {
    setSaveStatus('saving');
    setLoading(true);
    
    try {
      // Construir estructura YAML
      const yamlOverrides = {
        correction_factors: {
          isc_safety_factor: editableParams.isc_safety_factor,
          parallel_strings: editableParams.parallel_strings
        },
        cable: {
          material: editableParams.cable_material,
          max_temp: editableParams.cable_max_temp
        },
        voltage_drop: {
          max_percentage: editableParams.max_voltage_drop
        },
        temperature_correction: {
          ambient_design: editableParams.ambient_temp
        },
        installation: {
          method: "conduit",
          depth_cm: 50
        }
      };

      console.log('💾 Guardando parámetros:', yamlOverrides);

      const response = await fetch(
        `http://localhost:8000/calculations/projects/${projectName}/normatives/${stage}/parameters`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_norm: selectedBaseNorm,
            yaml_overrides: yamlOverrides
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Guardado exitoso:', result);
        
        setHasUnsavedChanges(false);
        setSaveStatus('success');
        
        // FORZAR recarga del status inmediatamente
        console.log('🔄 Forzando recarga después de guardar...');
        await checkProjectStatus();
        
        // Pequeña pausa para asegurar que el archivo se escribió
        setTimeout(async () => {
          console.log('🔄 Recargando configuración para verificar valores guardados...');
          await loadCustomConfig();
        }, 300);
        
        // Callback de éxito
        onSaved?.();
        
        // Auto-hide success status
        setTimeout(() => setSaveStatus('idle'), 3000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error guardando parámetros');
      }
    } catch (error) {
      console.error('❌ Error guardando:', error);
      setSaveStatus('error');
      onError?.(`Error guardando parámetros: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const createCustomNormative = async () => {
    console.log(`🛠️ Creando normativa personalizada para ${stage} desde base ${selectedBaseNorm}`);
    await saveParameters();
  };

  const resetNormative = async () => {
    if (!confirm(`¿Estás seguro de resetear la normativa personalizada para ${stage}? Se perderán todos los cambios.`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`🗑️ Eliminando normativa: ${projectName}/${stage}`);
      const url = `http://localhost:8000/calculations/projects/${projectName}/normatives/${stage}/parameters`;
      console.log(`📡 DELETE URL: ${url}`);
      
      const response = await fetch(url, { method: 'DELETE' });
      
      console.log(`📡 DELETE Response status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Normativa reseteada:', result);
        
        setHasCustomConfig(false);
        setNormativeConfig(null);
        setHasUnsavedChanges(false);
        setSaveStatus('idle');
        
        // Resetear a valores por defecto
        setEditableParams({
          isc_safety_factor: 1.25,
          parallel_strings: 1,
          cable_material: 'copper',
          cable_max_temp: 90,
          max_voltage_drop: 1.5,
          ambient_temp: 40
        });
        
        // Forzar recarga del status
        await checkProjectStatus();
        
        onSaved?.();
      } else {
        const errorData = await response.text();
        console.error('❌ Error response:', response.status, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.error('❌ Error reseteando:', error);
      onError?.(`Error reseteando normativa: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const reloadFromBase = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/calculations/normatives/${selectedBaseNorm}/parameters`);
      if (response.ok) {
        const baseParams = await response.json();
        console.log('🔄 Parámetros base cargados:', baseParams);
        
        // Mostrar información de los parámetros base
        alert(`Normativa ${selectedBaseNorm} cargada:\n` + 
              `- Disponible para consulta\n` + 
              `- Usa "Crear Personalizada" para editar parámetros\n` +
              `- Los parámetros base se pueden ver en la consola del navegador`);
              
      } else {
        throw new Error('Error cargando parámetros base');
      }
    } catch (error) {
      console.error('❌ Error cargando parámetros base:', error);
      onError?.(`Error cargando parámetros base: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={6} sx={{ 
      padding: 3,
      backgroundColor: '#3a3a3a',
      borderRadius: '16px',
      border: '1px solid #525252',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold' }}>
            🔧 Editor de Normativa - {stage.toUpperCase()}
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Proyecto: {projectName}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasCustomConfig && (
            <Chip 
              label="Personalizada"
              sx={{ 
                backgroundColor: '#4a4a3a',
                color: '#ffcc80',
                fontWeight: 'bold',
              }}
            />
          )}
          
          {loading && <CircularProgress size={20} sx={{ color: '#ffcc80' }} />}
          
          {/* Botón temporal de debug */}
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              console.log('🔄 Forzando recarga de status...');
              await checkProjectStatus();
              console.log('🔧 Forzando carga de config...');
              await loadCustomConfig();
            }}
            sx={{ 
              borderColor: '#666',
              color: '#e0e0e0',
              fontSize: '10px',
              '&:hover': { borderColor: '#888' },
            }}
          >
            🔄 Debug
          </Button>
          
          {/* Información de debug en vivo */}
          <Typography variant="caption" sx={{ color: '#888' }}>
            Status: {hasCustomConfig ? 'SÍ' : 'NO'} | Strings: {editableParams.parallel_strings}
          </Typography>
        </Box>
      </Box>

      {/* Status messages */}
      {saveStatus === 'success' && (
        <Alert severity="success" sx={{ marginBottom: 2 }}>
          Parámetros guardados exitosamente
        </Alert>
      )}
      
      {saveStatus === 'error' && (
        <Alert severity="error" sx={{ marginBottom: 2 }}>
          Error guardando parámetros
        </Alert>
      )}

      {hasUnsavedChanges && (
        <Alert severity="warning" sx={{ marginBottom: 2 }}>
          Tienes cambios sin guardar
        </Alert>
      )}

      {/* Selector de normativa base */}
      {!hasCustomConfig && (
        <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252' }}>
          <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
            📋 Crear Normativa Personalizada
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: '#fff' }}>Normativa Base</InputLabel>
              <Select
                value={selectedBaseNorm}
                onChange={(e) => setSelectedBaseNorm(e.target.value)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                {availableNormatives.map((norm) => (
                  <MenuItem key={norm} value={norm}>{norm}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={createCustomNormative}
              disabled={loading}
              sx={{ 
                backgroundColor: '#2e7d32',
                '&:hover': { backgroundColor: '#1b5e20' },
              }}
            >
              Crear Personalizada
            </Button>
            
            <Button
              variant="outlined"
              onClick={reloadFromBase}
              startIcon={<RefreshIcon />}
              disabled={loading}
              sx={{ 
                borderColor: '#666',
                color: '#e0e0e0',
                '&:hover': { borderColor: '#888' },
              }}
            >
              Ver Base
            </Button>
          </Box>
        </Paper>
      )}

      {/* Editor de parámetros - MOSTRAR SIEMPRE si hay config personalizada */}
      {hasCustomConfig && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Typography variant="h6" sx={{ color: '#ffcc80' }}>
              ⚙️ Parámetros Editables
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={resetNormative}
                startIcon={<DeleteIcon />}
                disabled={loading}
                size="small"
                sx={{ 
                  borderColor: '#d32f2f',
                  color: '#ffab91',
                  '&:hover': { borderColor: '#f44336' },
                }}
              >
                Resetear
              </Button>
              
              {hasUnsavedChanges && (
                <Button
                  variant="contained"
                  onClick={saveParameters}
                  startIcon={<SaveIcon />}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    backgroundColor: '#2e7d32',
                    '&:hover': { backgroundColor: '#1b5e20' },
                  }}
                >
                  Guardar
                </Button>
              )}
            </Box>
          </Box>

          <Divider sx={{ marginBottom: 3, backgroundColor: '#666' }} />

          {/* Factores de Corrección */}
          <Paper sx={{ padding: 2, marginBottom: 2, backgroundColor: '#525252' }}>
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
              ⚡ Factores de Corrección
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Factor de Seguridad Isc"
                  type="number"
                  value={editableParams.isc_safety_factor}
                  onChange={(e) => handleParameterChange('isc_safety_factor', parseFloat(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1.0, max: 2.0, step: 0.01 }}
                  helperText="Factor de seguridad para corriente de cortocircuito (1.0 - 2.0)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#666' },
                      '&:hover fieldset': { borderColor: '#ffb74d' },
                      '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                    },
                    '& .MuiInputLabel-root': { color: '#b0b0b0' },
                    '& .MuiFormHelperText-root': { color: '#888' },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Strings en Paralelo"
                  type="number"
                  value={editableParams.parallel_strings}
                  onChange={(e) => handleParameterChange('parallel_strings', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 50, step: 1 }}
                  helperText="Número de strings conectados en paralelo (1 - 50)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#666' },
                      '&:hover fieldset': { borderColor: '#ffb74d' },
                      '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                    },
                    '& .MuiInputLabel-root': { color: '#b0b0b0' },
                    '& .MuiFormHelperText-root': { color: '#888' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Configuración de Cable */}
          <Paper sx={{ padding: 2, marginBottom: 2, backgroundColor: '#525252' }}>
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
              🔌 Configuración de Cable
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#b0b0b0' }}>Material del Cable</InputLabel>
                  <Select
                    value={editableParams.cable_material}
                    onChange={(e) => handleParameterChange('cable_material', e.target.value)}
                    sx={{
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
                      '& .MuiSvgIcon-root': { color: '#fff' },
                    }}
                  >
                    <MenuItem value="copper">Cobre</MenuItem>
                    <MenuItem value="aluminum">Aluminio</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Temperatura Máxima (°C)"
                  type="number"
                  value={editableParams.cable_max_temp}
                  onChange={(e) => handleParameterChange('cable_max_temp', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 60, max: 120, step: 5 }}
                  helperText="Temperatura máxima de operación del cable (60 - 120°C)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#666' },
                      '&:hover fieldset': { borderColor: '#ffb74d' },
                      '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                    },
                    '& .MuiInputLabel-root': { color: '#b0b0b0' },
                    '& .MuiFormHelperText-root': { color: '#888' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Caída de Tensión */}
          <Paper sx={{ padding: 2, backgroundColor: '#525252' }}>
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
              📉 Caída de Tensión y Temperatura
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Máximo Porcentaje (%)"
                  type="number"
                  value={editableParams.max_voltage_drop}
                  onChange={(e) => handleParameterChange('max_voltage_drop', parseFloat(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0.5, max: 5.0, step: 0.1 }}
                  helperText="Máxima caída de tensión permitida (0.5 - 5.0%)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#666' },
                      '&:hover fieldset': { borderColor: '#ffb74d' },
                      '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                    },
                    '& .MuiInputLabel-root': { color: '#b0b0b0' },
                    '& .MuiFormHelperText-root': { color: '#888' },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Temperatura Ambiente (°C)"
                  type="number"
                  value={editableParams.ambient_temp}
                  onChange={(e) => handleParameterChange('ambient_temp', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 20, max: 60, step: 5 }}
                  helperText="Temperatura ambiente de diseño (20 - 60°C)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#666' },
                      '&:hover fieldset': { borderColor: '#ffb74d' },
                      '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                    },
                    '& .MuiInputLabel-root': { color: '#b0b0b0' },
                    '& .MuiFormHelperText-root': { color: '#888' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Estado cuando no hay config */}
      {!hasCustomConfig && (
        <Box sx={{ 
          padding: 3, 
          backgroundColor: '#525252', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#ffcc80' }}>
            📋 Sin Configuración Personalizada
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
            Selecciona una normativa base y crea una configuración personalizada para este proyecto
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default NormativeEditor;