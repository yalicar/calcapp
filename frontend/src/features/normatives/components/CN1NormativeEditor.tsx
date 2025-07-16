/**
 * CN1NormativeEditor.tsx
 * 
 * Editor de parámetros normativos para cables principales CN1.
 * CORREGIDO: Usa los mismos parámetros que NormativeEditor pero con interfaz CN1
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
  CircularProgress,
  Chip,
  Grid,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

// ✅ CORREGIDO: Usar los mismos parámetros que NormativeEditor
interface CN1EditableParams {
  isc_safety_factor: number;
  parallel_strings: number;
  cable_material: string;
  cable_max_temp: number;
  max_voltage_drop: number;
  ambient_temp: number;
}

interface CN1NormativeEditorProps {
  projectName: string;
  stage: string;
  onSaved?: () => void;
  onError?: (error: string) => void;
}

interface NormativeConfig {
  project_name?: string;
  stage?: string;
  custom_parameters?: any;
  display_name?: string;
  description?: string;
}

const CN1NormativeEditor: React.FC<CN1NormativeEditorProps> = ({
  projectName,
  stage,
  onSaved,
  onError
}) => {
  // Estados principales
  const [loading, setLoading] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [availableNormatives, setAvailableNormatives] = useState<string[]>(['IEC', 'NEC']);
  const [selectedBaseNorm, setSelectedBaseNorm] = useState<string>('IEC');
  const [normativeConfig, setNormativeConfig] = useState<NormativeConfig | null>(null);
  
  // ✅ CORREGIDO: Parámetros iguales a NormativeEditor
  const [parameters, setParameters] = useState<CN1EditableParams>({
    isc_safety_factor: 1.25,
    parallel_strings: 1,
    cable_material: 'copper',
    cable_max_temp: 90,
    max_voltage_drop: 1.5,
    ambient_temp: 35
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Efectos
  useEffect(() => {
    loadAvailableNormatives();
    checkProjectStatus();
  }, [projectName]);

  useEffect(() => {
    if (hasCustomConfig) {
      console.log('🔄 CN1: Detectada configuración personalizada, cargando parámetros...');
      loadCustomConfig();
    }
  }, [hasCustomConfig, stage, projectName]);

  useEffect(() => {
    if (projectName) {
      checkProjectStatus();
    }
  }, [projectName, stage]);

  // Funciones de carga
  const loadAvailableNormatives = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/calculations/normatives/available`);
      if (response.ok) {
        const data = await response.json();
        const normNames = Object.keys(data.normatives || {});
        setAvailableNormatives(normNames.length > 0 ? normNames : ['IEC', 'NEC']);
        console.log('✅ CN1: Normativas disponibles:', normNames);
      }
    } catch (error) {
      console.error('❌ CN1: Error cargando normativas disponibles:', error);
    }
  };

  const checkProjectStatus = async () => {
    try {
      console.log(`🔍 CN1: Verificando status para proyecto: ${projectName}, etapa: ${stage}`);
      const response = await fetch(`${API_BASE_URL}/calculations/projects/${projectName}/normative-status`);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 CN1: Status response completo:', data);
        
        const stageHasConfig = data.stages?.[stage]?.override_exists || false;
        console.log(`📝 CN1: ${stage} tiene config: ${stageHasConfig}`);
        
        setHasCustomConfig(stageHasConfig);
        console.log(`✅ CN1: hasCustomConfig actualizado a: ${stageHasConfig}`);
      } else {
        console.log('⚠️ CN1: Error en response:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ CN1: Error verificando status:', error);
    }
  };

  const loadCustomConfig = async () => {
    setLoading(true);
    try {
      console.log(`🔧 CN1: Cargando config personalizada para: ${projectName}/${stage}`);
      const response = await fetch(`${API_BASE_URL}/calculations/projects/${projectName}/normatives/${stage}/parameters`);
      
      console.log(`📡 CN1: Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📝 CN1: Config personalizada cargada:', data);
        setNormativeConfig(data);
        
        // ✅ CORREGIDO: Mapear igual que NormativeEditor
        if (data.custom_parameters) {
          const customParams = data.custom_parameters;
          console.log('🔄 CN1: Mapeando parámetros desde:', customParams);
          
          const newParams: CN1EditableParams = {
            isc_safety_factor: 1.25,
            parallel_strings: 1,
            cable_material: 'copper',
            cable_max_temp: 90,
            max_voltage_drop: 1.5,
            ambient_temp: 35
          };
          
          // ✅ MAPEO CORRECTO: Misma estructura que NormativeEditor
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
          
          console.log('✅ CN1: Parámetros mapeados:', newParams);
          setParameters(newParams);
          setHasUnsavedChanges(false);
          console.log('✅ CN1: Parámetros cargados desde config personalizada');
        }
      } else {
        console.log('⚠️ CN1: No se encontró configuración personalizada - status:', response.status);
      }
    } catch (error) {
      console.error('❌ CN1: Error cargando configuración:', error);
      if (onError) {
        onError(`Error cargando configuración CN1: ${error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Funciones de manejo de cambios
  const handleParameterChange = (paramKey: keyof CN1EditableParams, newValue: any) => {
    setParameters(prev => ({
      ...prev,
      [paramKey]: newValue
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // ✅ CORREGIDO: Guardado igual que NormativeEditor
  const saveParameters = async () => {
    setSaveStatus('saving');
    setLoading(true);
    
    try {
      // ✅ ESTRUCTURA YAML CORRECTA: Igual que NormativeEditor
      const yamlOverrides = {
        correction_factors: {
          isc_safety_factor: parameters.isc_safety_factor,
          parallel_strings: parameters.parallel_strings
        },
        cable: {
          material: parameters.cable_material,
          max_temp: parameters.cable_max_temp
        },
        voltage_drop: {
          max_percentage: parameters.max_voltage_drop
        },
        temperature_correction: {
          ambient_design: parameters.ambient_temp
        },
        installation: {
          method: "buried",
          depth_cm: 50
        }
      };

      console.log('💾 CN1: Guardando parámetros:', yamlOverrides);

      const response = await fetch(
        `${API_BASE_URL}/calculations/projects/${projectName}/normatives/${stage}/parameters`,
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
        console.log('✅ CN1: Guardado exitoso:', result);
        
        setHasUnsavedChanges(false);
        setSaveStatus('success');
        
        // Forzar recarga del status
        await checkProjectStatus();
        
        setTimeout(async () => {
          await loadCustomConfig();
        }, 300);
        
        if (onSaved) {
          onSaved();
        }
        
        setTimeout(() => setSaveStatus('idle'), 3000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error guardando parámetros CN1');
      }
    } catch (error) {
      console.error('❌ CN1: Error guardando:', error);
      setSaveStatus('error');
      if (onError) {
        onError(`Error guardando parámetros CN1: ${error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const createCustomNormative = async () => {
    console.log(`🛠️ CN1: Creando normativa personalizada para ${stage} desde base ${selectedBaseNorm}`);
    await saveParameters();
  };

  const resetNormative = async () => {
    if (!confirm(`¿Estás seguro de resetear la normativa CN1 personalizada para ${stage}? Se perderán todos los cambios.`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`🗑️ CN1: Eliminando normativa: ${projectName}/${stage}`);
      const url = `${API_BASE_URL}/calculations/projects/${projectName}/normatives/${stage}/parameters`;
      
      const response = await fetch(url, { method: 'DELETE' });
      
      if (response.ok) {
        console.log('✅ CN1: Normativa reseteada');
        
        setHasCustomConfig(false);
        setNormativeConfig(null);
        setHasUnsavedChanges(false);
        setSaveStatus('idle');
        
        // ✅ VALORES POR DEFECTO CORRECTOS
        setParameters({
          isc_safety_factor: 1.25,
          parallel_strings: 1,
          cable_material: 'copper',
          cable_max_temp: 90,
          max_voltage_drop: 1.5,
          ambient_temp: 35
        });
        
        await checkProjectStatus();
        
        if (onSaved) {
          onSaved();
        }
      } else {
        throw new Error(`HTTP ${response.status}: Error eliminando configuración CN1`);
      }
    } catch (error) {
      console.error('❌ CN1: Error reseteando:', error);
      if (onError) {
        onError(`Error reseteando normativa CN1: ${error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const reloadFromBase = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/normatives/${selectedBaseNorm}/parameters`);
      if (response.ok) {
        const baseParams = await response.json();
        console.log('🔄 CN1: Parámetros base cargados:', baseParams);
        
        alert(`Normativa CN1 ${selectedBaseNorm} cargada:\n` + 
              `- Disponible para consulta\n` + 
              `- Usa "Crear Personalizada CN1" para editar parámetros\n` +
              `- Los parámetros base se pueden ver en la consola del navegador`);
              
      } else {
        throw new Error('Error cargando parámetros base CN1');
      }
    } catch (error) {
      console.error('❌ CN1: Error cargando parámetros base:', error);
      if (onError) {
        onError(`Error cargando parámetros base CN1: ${error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={6} sx={{ 
      padding: 3,
      backgroundColor: '#3d6b50',
      borderRadius: '16px',
      border: '1px solid #4a7c59',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SettingsIcon sx={{ color: '#81c784', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ color: '#81c784', fontWeight: 'bold' }}>
              🔧 Editor de Normativa CN1 - {stage.toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
              Proyecto: {projectName} | Configuración de cables principales
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasCustomConfig && (
            <Chip 
              label="CN1 Personalizada"
              sx={{ 
                backgroundColor: '#5d4e37',
                color: '#ffd54f',
                fontWeight: 'bold',
              }}
            />
          )}
          
          {loading && <CircularProgress size={20} sx={{ color: '#81c784' }} />}
          
          <Typography variant="caption" sx={{ color: '#c8e6c9' }}>
            Status: {hasCustomConfig ? 'CN1 SÍ' : 'CN1 NO'}
          </Typography>
        </Box>
      </Box>

      {/* Status messages */}
      {saveStatus === 'success' && (
        <Alert severity="success" sx={{ marginBottom: 2, backgroundColor: '#2e7d32', color: '#fff' }}>
          Parámetros CN1 guardados exitosamente
        </Alert>
      )}
      
      {saveStatus === 'error' && (
        <Alert severity="error" sx={{ marginBottom: 2, backgroundColor: '#d32f2f', color: '#fff' }}>
          Error guardando parámetros CN1
        </Alert>
      )}

      {hasUnsavedChanges && (
        <Alert severity="warning" sx={{ marginBottom: 2, backgroundColor: '#ff9800', color: '#fff' }}>
          Tienes cambios CN1 sin guardar
        </Alert>
      )}

      {/* Selector de normativa base CN1 */}
      {!hasCustomConfig && (
        <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#4a7c59' }}>
          <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
            📋 Crear Normativa CN1 Personalizada
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: '#c8e6c9' }}>Normativa Base CN1</InputLabel>
              <Select
                value={selectedBaseNorm}
                onChange={(e) => setSelectedBaseNorm(e.target.value)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4a7c59' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
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
                backgroundColor: '#81c784',
                color: '#000',
                '&:hover': { backgroundColor: '#66bb6a' },
              }}
            >
              Crear CN1 Personalizada
            </Button>
            
            <Button
              variant="outlined"
              onClick={reloadFromBase}
              startIcon={<RefreshIcon />}
              disabled={loading}
              sx={{ 
                borderColor: '#4a7c59',
                color: '#e8f5e8',
                '&:hover': { borderColor: '#81c784' },
              }}
            >
              Ver Base CN1
            </Button>
          </Box>
        </Paper>
      )}

      {/* ✅ EDITOR CORREGIDO: Parámetros iguales a NormativeEditor */}
      {hasCustomConfig && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Typography variant="h6" sx={{ color: '#81c784' }}>
              ⚙️ Parámetros CN1 Editables
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
                Resetear CN1
              </Button>
              
              {hasUnsavedChanges && (
                <Button
                  variant="contained"
                  onClick={saveParameters}
                  startIcon={<SaveIcon />}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    backgroundColor: '#81c784',
                    color: '#000',
                    '&:hover': { backgroundColor: '#66bb6a' },
                  }}
                >
                  Guardar CN1
                </Button>
              )}
            </Box>
          </Box>

          <Divider sx={{ marginBottom: 3, backgroundColor: '#4a7c59' }} />

          {/* ✅ FACTORES DE CORRECCIÓN: Iguales a NormativeEditor */}
          <Paper sx={{ padding: 2, marginBottom: 2, backgroundColor: '#4a7c59' }}>
            <Typography variant="body1" sx={{ color: '#81c784', fontWeight: 'bold', marginBottom: 2 }}>
              ⚡ Factores de Corrección CN1
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Factor de Seguridad Isc CN1"
                  type="number"
                  value={parameters.isc_safety_factor}
                  onChange={(e) => handleParameterChange('isc_safety_factor', parseFloat(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1.0, max: 2.0, step: 0.01 }}
                  helperText="Factor de seguridad para corriente de cortocircuito (1.0 - 2.0)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#4a7c59' },
                      '&:hover fieldset': { borderColor: '#81c784' },
                      '&.Mui-focused fieldset': { borderColor: '#81c784' },
                    },
                    '& .MuiInputLabel-root': { color: '#c8e6c9' },
                    '& .MuiFormHelperText-root': { color: '#c8e6c9' },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Strings en Paralelo CN1"
                  type="number"
                  value={parameters.parallel_strings}
                  onChange={(e) => handleParameterChange('parallel_strings', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 50, step: 1 }}
                  helperText="Número de strings conectados en paralelo (1 - 50)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#4a7c59' },
                      '&:hover fieldset': { borderColor: '#81c784' },
                      '&.Mui-focused fieldset': { borderColor: '#81c784' },
                    },
                    '& .MuiInputLabel-root': { color: '#c8e6c9' },
                    '& .MuiFormHelperText-root': { color: '#c8e6c9' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* ✅ CONFIGURACIÓN DE CABLE: Igual a NormativeEditor */}
          <Paper sx={{ padding: 2, marginBottom: 2, backgroundColor: '#4a7c59' }}>
            <Typography variant="body1" sx={{ color: '#81c784', fontWeight: 'bold', marginBottom: 2 }}>
              🔌 Configuración de Cable CN1
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#c8e6c9' }}>Material del Cable CN1</InputLabel>
                  <Select
                    value={parameters.cable_material}
                    onChange={(e) => handleParameterChange('cable_material', e.target.value)}
                    sx={{
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4a7c59' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
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
                  label="Temperatura Máxima CN1 (°C)"
                  type="number"
                  value={parameters.cable_max_temp}
                  onChange={(e) => handleParameterChange('cable_max_temp', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 60, max: 120, step: 5 }}
                  helperText="Temperatura máxima de operación del cable (60 - 120°C)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#4a7c59' },
                      '&:hover fieldset': { borderColor: '#81c784' },
                      '&.Mui-focused fieldset': { borderColor: '#81c784' },
                    },
                    '& .MuiInputLabel-root': { color: '#c8e6c9' },
                    '& .MuiFormHelperText-root': { color: '#c8e6c9' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* ✅ CAÍDA DE TENSIÓN: Igual a NormativeEditor */}
          <Paper sx={{ padding: 2, backgroundColor: '#4a7c59' }}>
            <Typography variant="body1" sx={{ color: '#81c784', fontWeight: 'bold', marginBottom: 2 }}>
              📉 Caída de Tensión y Temperatura CN1
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Máximo Porcentaje CN1 (%)"
                  type="number"
                  value={parameters.max_voltage_drop}
                  onChange={(e) => handleParameterChange('max_voltage_drop', parseFloat(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0.5, max: 5.0, step: 0.1 }}
                  helperText="Máxima caída de tensión permitida (0.5 - 5.0%)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#4a7c59' },
                      '&:hover fieldset': { borderColor: '#81c784' },
                      '&.Mui-focused fieldset': { borderColor: '#81c784' },
                    },
                    '& .MuiInputLabel-root': { color: '#c8e6c9' },
                    '& .MuiFormHelperText-root': { color: '#c8e6c9' },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Temperatura Ambiente CN1 (°C)"
                  type="number"
                  value={parameters.ambient_temp}
                  onChange={(e) => handleParameterChange('ambient_temp', parseInt(e.target.value))}
                  size="small"
                  fullWidth
                  inputProps={{ min: 20, max: 60, step: 5 }}
                  helperText="Temperatura ambiente de diseño (20 - 60°C)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#4a7c59' },
                      '&:hover fieldset': { borderColor: '#81c784' },
                      '&.Mui-focused fieldset': { borderColor: '#81c784' },
                    },
                    '& .MuiInputLabel-root': { color: '#c8e6c9' },
                    '& .MuiFormHelperText-root': { color: '#c8e6c9' },
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Estado cuando no hay config CN1 */}
      {!hasCustomConfig && (
        <Box sx={{ 
          padding: 3, 
          backgroundColor: '#4a7c59', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#81c784' }}>
            📋 Sin Configuración CN1 Personalizada
          </Typography>
          <Typography variant="body2" sx={{ color: '#c8e6c9', marginTop: 1 }}>
            Selecciona una normativa base y crea una configuración CN1 personalizada para este proyecto
          </Typography>
        </Box>
      )}

      {/* Información técnica CN1 */}
      <Paper sx={{ 
        padding: 2, 
        marginTop: 3,
        backgroundColor: '#4a7c59',
        border: '1px solid #5a8c69'
      }}>
        <Typography variant="body2" sx={{ color: '#c8e6c9', fontFamily: 'monospace' }}>
          <strong>Proyecto:</strong> {projectName} |
          <strong> Stage:</strong> {stage} |
          <strong> Endpoint:</strong> /calculations/projects/{projectName}/normatives/{stage}/parameters |
          <strong> CN1 Config:</strong> {hasCustomConfig ? 'Sí' : 'No'} |
          <strong> Estado:</strong> {loading ? 'Cargando' : saveStatus === 'saving' ? 'Guardando' : 'Listo'}
        </Typography>
      </Paper>
    </Paper>
  );
};

export default CN1NormativeEditor;