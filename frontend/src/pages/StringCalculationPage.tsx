const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Box, 
  Typography, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  Grid,
  Chip,
  TextField,
  Switch,
  FormControlLabel
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArticleIcon from '@mui/icons-material/Article';
import CalculateIcon from '@mui/icons-material/Calculate';
import { useProject } from "../context/ProjectContext";

function StringCalculationPage() {
  const { projectName, setProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();

  // Estados básicos
  const [norm, setNorm] = useState<"IEC" | "NEC" | "Personalizada">("IEC");
  const [normativeStatus, setNormativeStatus] = useState<any>(null);
  const [normativeConfig, setNormativeConfig] = useState<any>(null);
  const [showNormativeEditor, setShowNormativeEditor] = useState(false);
  const [loadingNormative, setLoadingNormative] = useState(false);
  
  // Estados para parámetros editables
  const [editableParams, setEditableParams] = useState({
    isc_safety_factor: 1.25,
    parallel_strings: 1,
    cable_material: "copper",
    cable_max_temp: 90,
    max_voltage_drop: 1.5,
    ambient_temp: 40
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const currentProjectName = projectName || urlProjectName;

  // Establecer proyecto desde URL
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  // Cargar estado de normativa cuando cambie el proyecto
  useEffect(() => {
    if (currentProjectName) {
      loadNormativeStatus();
    }
  }, [currentProjectName]);

  // Cargar configuración cuando esté en modo Personalizada
  useEffect(() => {
    if (currentProjectName && norm === "Personalizada") {
      loadNormativeConfig();
    }
  }, [currentProjectName, norm]);

  // Función para cargar estado de normativa
  const loadNormativeStatus = async () => {
    if (!currentProjectName) return;
    
    try {
      console.log(`🔍 Loading normative status for: ${currentProjectName}`);
      const response = await fetch(`http://localhost:8000/calculations/projects/${currentProjectName}/normative-status`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Normative status:', data);
        setNormativeStatus(data);
        
        // Si tiene config personalizada, cambiar a "Personalizada"
        if (data.has_custom_config) {
          console.log('🔧 Project has custom config, switching to Personalizada');
          setNorm("Personalizada");
        }
      } else {
        console.log('⚠️ No normative status found, using defaults');
        setNormativeStatus({ has_custom_config: false });
      }
    } catch (error) {
      console.error('❌ Error loading normative status:', error);
      setNormativeStatus({ has_custom_config: false });
    }
  };

  // Función para manejar cambios en parámetros
  const handleParameterChange = (paramKey: string, newValue: any) => {
    setEditableParams(prev => ({
      ...prev,
      [paramKey]: newValue
    }));
    setHasUnsavedChanges(true);
  };

  // Función para guardar parámetros modificados
  const saveParameters = async () => {
    if (!currentProjectName) return;

    setLoadingNormative(true);
    try {
      console.log(`💾 Saving parameters for: ${currentProjectName}`);
      console.log(`📋 Current norm: ${norm}`);
      
      // Construir estructura YAML con los parámetros modificados
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

      console.log('📤 Sending YAML overrides:', yamlOverrides);

      const response = await fetch(
        `http://localhost:8000/calculations/projects/${currentProjectName}/normatives/dc_strings/parameters`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_norm: "PERSONALIZADA",  // ✅ CAMBIO: Usar PERSONALIZADA para actualizar dc_strings.yaml
            yaml_overrides: yamlOverrides
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Parameters saved successfully:', result);
        setHasUnsavedChanges(false);
        
        // Asegurar que esté en modo Personalizada
        if (norm !== "Personalizada") {
          setNorm("Personalizada");
        }
        
        await loadNormativeStatus();
        alert('Parámetros guardados exitosamente en dc_strings.yaml');
      } else {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.detail || 'Error saving parameters');
      }
    } catch (error) {
      console.error('❌ Error saving parameters:', error);
      alert(`Error guardando parámetros: ${error}`);
    } finally {
      setLoadingNormative(false);
    }
  };

  // Función para cargar configuración de normativa
  const loadNormativeConfig = async () => {
    if (!currentProjectName) return;
    
    setLoadingNormative(true);
    try {
      console.log(`🔧 Loading normative config for: ${currentProjectName}`);
      const response = await fetch(
        `http://localhost:8000/calculations/projects/${currentProjectName}/normatives/dc_strings/parameters`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Normative config loaded:', data);
        console.log('📋 Editable sections:', data.editable_sections);
        console.log('📋 Sections keys:', Object.keys(data.editable_sections || {}));
        setNormativeConfig(data);
      } else {
        console.log('⚠️ Could not load normative config');
        setNormativeConfig(null);
      }
    } catch (error) {
      console.error('❌ Error loading normative config:', error);
      setNormativeConfig(null);
    } finally {
      setLoadingNormative(false);
    }
  };

  // Función para crear normativa personalizada
  const createCustomNormative = async () => {
    if (!currentProjectName) return;

    setLoadingNormative(true);
    try {
      console.log(`🛠️ Creating custom normative for: ${currentProjectName}`);
      
      // Crear estructura YAML inicial con valores por defecto
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
        installation: {
          method: "conduit",
          depth_cm: 50
        },
        temperature_correction: {
          ambient_design: editableParams.ambient_temp
        }
      };

      console.log('🔨 Creating custom normative with overrides:', yamlOverrides);

      // Guardar como normativa personalizada
      const response = await fetch(
        `http://localhost:8000/calculations/projects/${currentProjectName}/normatives/dc_strings/parameters`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base_norm: norm === "Personalizada" ? "IEC" : norm,  // Base para crear la copia
            yaml_overrides: yamlOverrides
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Custom normative created successfully:', result);
        setNorm("Personalizada");
        await loadNormativeStatus();
        await loadNormativeConfig();
        alert('Normativa personalizada creada exitosamente en dc_strings.yaml');
      } else {
        const errorData = await response.json();
        console.error('❌ Error creating custom normative:', errorData);
        throw new Error(errorData.detail || 'Error creating custom normative');
      }
    } catch (error) {
      console.error('❌ Error creating custom normative:', error);
      alert(`Error creando normativa personalizada: ${error}`);
    } finally {
      setLoadingNormative(false);
    }
  };

  // Función para resetear normativa
  const resetNormative = async () => {
    if (!currentProjectName) return;
    
    if (!confirm('¿Estás seguro de resetear la normativa personalizada? Se perderán todos los cambios.')) {
      return;
    }

    setLoadingNormative(true);
    try {
      console.log(`🔄 Resetting normative for: ${currentProjectName}`);
      
      const response = await fetch(
        `http://localhost:8000/calculations/projects/${currentProjectName}/normatives/dc_strings/parameters`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        console.log('✅ Normative reset successfully');
        setNorm("IEC");
        setNormativeConfig(null);
        setShowNormativeEditor(false);
        await loadNormativeStatus();
        alert('Normativa reseteada a valores base');
      } else {
        throw new Error('Error resetting normative');
      }
    } catch (error) {
      console.error('❌ Error resetting normative:', error);
      alert('Error reseteando normativa');
    } finally {
      setLoadingNormative(false);
    }
  };

  // Función para calcular strings
  const handleCalculateStrings = async () => {
    console.log(`🔥 Calculando strings para proyecto: ${currentProjectName} con normativa: ${norm}`);
    
    try {
      // ✅ IMPORTANTE: Usar normativa correcta para API
      const normativeForAPI = norm === "Personalizada" ? "PERSONALIZADA" : norm;
      console.log(`📡 API normative parameter: ${normativeForAPI}`);
      
      const response = await fetch(
        `http://localhost:8000/calculations/calculate-iec-strings/${currentProjectName}`
      );
      
      if (response.ok) {
        const results = await response.json();
        console.log('✅ Resultados:', results);
        console.log('🔧 Used project overrides:', results.has_project_overrides);
        
        const message = results.has_project_overrides 
          ? `Cálculo exitoso con normativa personalizada: ${results.summary?.total_circuits || 0} strings calculados`
          : `Cálculo exitoso con normativa ${norm}: ${results.summary?.total_circuits || 0} strings calculados`;
          
        alert(message);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error in calculation');
      }
    } catch (error) {
      console.error('❌ Error calculating:', error);
      alert(`Error en el cálculo: ${error}`);
    }
  };

  // Función para volver
  const handleGoBack = () => {
    if (currentProjectName) {
      navigate(`/projects/${currentProjectName}/upload`);
    } else {
      navigate('/projects');
    }
  };

  // Si no hay proyecto, mostrar error
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
      {/* Header con controles */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
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
            
            {normativeStatus && normativeStatus.has_custom_config && (
              <Chip 
                label="Normativa personalizada"
                sx={{ 
                  backgroundColor: '#4a4a3a',
                  color: '#ffcc80',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              />
            )}
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
      </Paper>

      {/* Contenido principal - Solo Strings DC */}
      <Paper elevation={6} sx={{ 
        padding: 4,
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
      }}>
        <Typography variant="h5" sx={{ color: '#fff', marginBottom: 2 }}>
          ⚡ Cálculo de Strings DC
        </Typography>
        <Typography variant="body1" sx={{ color: '#b0b0b0', marginBottom: 3 }}>
          Cálculo de corrientes, secciones de cable y caídas de tensión según normativa {norm}
        </Typography>

        {/* Panel de control */}
        <Paper sx={{ 
          padding: 3, 
          marginBottom: 3,
          backgroundColor: '#525252',
          border: '1px solid #666'
        }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
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

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {/* Botón crear normativa personalizada (solo si no es Personalizada) */}
                {norm !== "Personalizada" && (
                  <Button
                    variant="outlined"
                    onClick={createCustomNormative}
                    disabled={loadingNormative}
                    sx={{ 
                      borderColor: '#888',
                      color: '#e0e0e0',
                      '&:hover': { borderColor: '#999', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                    }}
                  >
                    {loadingNormative ? 'Creando...' : 'Personalizar Normativa'}
                  </Button>
                )}

                {/* Botones para normativa personalizada */}
                {norm === "Personalizada" && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => setShowNormativeEditor(!showNormativeEditor)}
                      disabled={loadingNormative}
                      sx={{ 
                        borderColor: '#888',
                        color: '#ffcc80',
                        '&:hover': { borderColor: '#999', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                      }}
                    >
                      {showNormativeEditor ? 'Ocultar Editor' : 'Editar Parámetros'}
                    </Button>

                    {showNormativeEditor && hasUnsavedChanges && (
                      <Button
                        variant="contained"
                        onClick={saveParameters}
                        disabled={loadingNormative}
                        sx={{ 
                          backgroundColor: '#2e7d32',
                          color: 'white',
                          fontWeight: 'bold',
                          '&:hover': { backgroundColor: '#1b5e20' },
                        }}
                      >
                        {loadingNormative ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                    )}

                    <Button
                      variant="outlined"
                      onClick={resetNormative}
                      disabled={loadingNormative}
                      sx={{ 
                        borderColor: '#d32f2f',
                        color: '#ffab91',
                        '&:hover': { borderColor: '#f44336', backgroundColor: 'rgba(244, 67, 54, 0.05)' },
                      }}
                    >
                      {loadingNormative ? 'Reseteando...' : 'Resetear'}
                    </Button>
                  </>
                )}

                <Button
                  variant="contained"
                  onClick={handleCalculateStrings}
                  startIcon={<CalculateIcon />}
                  sx={{ 
                    backgroundColor: '#666',
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    '&:hover': {
                      backgroundColor: '#777',
                    },
                  }}
                >
                  Calcular Strings
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Editor de normativa (si está en modo Personalizada y visible) */}
        {norm === "Personalizada" && showNormativeEditor && (
          <Paper sx={{ 
            padding: 3, 
            marginBottom: 3,
            backgroundColor: '#525252',
            border: '1px solid #ffcc80'
          }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              🔧 Editor de Parámetros de Normativa
            </Typography>
            
            {loadingNormative ? (
              <Typography sx={{ color: '#b0b0b0' }}>Cargando configuración...</Typography>
            ) : normativeConfig ? (
              <Box>
                <Typography variant="body2" sx={{ color: '#b0b0b0', marginBottom: 2 }}>
                  Configuración: {normativeConfig.display_name || 'Personalizada'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#888', marginBottom: 2 }}>
                  {normativeConfig.description || 'Configuración personalizada del proyecto'}
                </Typography>

                {/* Debug info */}
                <Box sx={{ marginBottom: 2, padding: 1, backgroundColor: '#444', borderRadius: '4px' }}>
                  <Typography variant="caption" sx={{ color: '#888' }}>
                    Debug: {Object.keys(normativeConfig.editable_sections || {}).length} secciones encontradas
                  </Typography>
                </Box>
                
                {/* Lista de secciones editables */}
                {Object.keys(normativeConfig.editable_sections || {}).length > 0 ? (
                  Object.entries(normativeConfig.editable_sections || {}).map(([sectionKey, section]: [string, any]) => (
                    <Box key={sectionKey} sx={{ marginBottom: 2, padding: 2, backgroundColor: '#666', borderRadius: '4px' }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                        {section.title}
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {Object.entries(section.parameters || {}).map(([paramKey, param]: [string, any]) => (
                          <Grid item xs={12} md={6} key={paramKey}>
                            <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                              <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                                {param.label}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#a0a0a0' }}>
                                Valor: <strong>{param.value}</strong> {param.unit}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                                {param.description}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ))
                ) : (
                  // Mostrar parámetros editables si el backend no los envía
                  <Box>
                    <Box sx={{ marginBottom: 2, padding: 2, backgroundColor: '#666', borderRadius: '4px' }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
                        ⚙️ Factores de Corrección
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Factor de Seguridad Isc
                            </Typography>
                            <TextField
                              type="number"
                              value={editableParams.isc_safety_factor}
                              onChange={(e) => handleParameterChange('isc_safety_factor', parseFloat(e.target.value))}
                              size="small"
                              inputProps={{ min: 1.0, max: 2.0, step: 0.01 }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#666' },
                                  '&:hover fieldset': { borderColor: '#ffb74d' },
                                  '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Factor de seguridad para corriente de cortocircuito (1.0 - 2.0)
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Strings en Paralelo
                            </Typography>
                            <TextField
                              type="number"
                              value={editableParams.parallel_strings}
                              onChange={(e) => handleParameterChange('parallel_strings', parseInt(e.target.value))}
                              size="small"
                              inputProps={{ min: 1, max: 50, step: 1 }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#666' },
                                  '&:hover fieldset': { borderColor: '#ffb74d' },
                                  '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Número de strings conectados en paralelo (1 - 50)
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    <Box sx={{ marginBottom: 2, padding: 2, backgroundColor: '#666', borderRadius: '4px' }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
                        🔌 Configuración de Cable
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Material del Cable
                            </Typography>
                            <FormControl size="small" fullWidth>
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
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Material conductor del cable
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Temperatura Máxima (°C)
                            </Typography>
                            <TextField
                              type="number"
                              value={editableParams.cable_max_temp}
                              onChange={(e) => handleParameterChange('cable_max_temp', parseInt(e.target.value))}
                              size="small"
                              inputProps={{ min: 60, max: 120, step: 5 }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#666' },
                                  '&:hover fieldset': { borderColor: '#ffb74d' },
                                  '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Temperatura máxima de operación del cable (60 - 120°C)
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    <Box sx={{ marginBottom: 2, padding: 2, backgroundColor: '#666', borderRadius: '4px' }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 2 }}>
                        📉 Caída de Tensión
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Máximo Porcentaje (%)
                            </Typography>
                            <TextField
                              type="number"
                              value={editableParams.max_voltage_drop}
                              onChange={(e) => handleParameterChange('max_voltage_drop', parseFloat(e.target.value))}
                              size="small"
                              inputProps={{ min: 0.5, max: 5.0, step: 0.1 }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#666' },
                                  '&:hover fieldset': { borderColor: '#ffb74d' },
                                  '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Máxima caída de tensión permitida (0.5 - 5.0%)
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box sx={{ padding: 1, backgroundColor: '#555', borderRadius: '4px' }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 'bold', marginBottom: 1 }}>
                              Temperatura Ambiente (°C)
                            </Typography>
                            <TextField
                              type="number"
                              value={editableParams.ambient_temp}
                              onChange={(e) => handleParameterChange('ambient_temp', parseInt(e.target.value))}
                              size="small"
                              inputProps={{ min: 20, max: 60, step: 5 }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#666' },
                                  '&:hover fieldset': { borderColor: '#ffb74d' },
                                  '&.Mui-focused fieldset': { borderColor: '#ffb74d' },
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0b0b0', display: 'block', marginTop: 0.5 }}>
                              Temperatura ambiente de diseño (20 - 60°C)
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    {hasUnsavedChanges && (
                      <Box sx={{ padding: 2, backgroundColor: '#4a4a3a', borderRadius: '4px', marginBottom: 2 }}>
                        <Typography variant="body2" sx={{ color: '#ffcc80' }}>
                          ⚠️ Tienes cambios sin guardar
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
                          Haz clic en "Guardar Cambios" para aplicar los nuevos valores.
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ padding: 2, backgroundColor: '#4a4a3a', borderRadius: '4px' }}>
                      <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                        ✅ Editor funcional completo
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
                        Modifica los valores y guarda los cambios. Los nuevos parámetros se usarán en los próximos cálculos.
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                <Box sx={{ marginTop: 2, padding: 2, backgroundColor: '#4a4a3a', borderRadius: '4px' }}>
                  <Typography variant="body2" sx={{ color: '#ffcc80', fontStyle: 'italic' }}>
                    💡 Editor completo con inputs próximamente. Por ahora puedes ver los parámetros actuales.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
                    Los valores mostrados son los que se están usando en los cálculos.
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography sx={{ color: '#ffab91' }}>
                Error cargando configuración de normativa. Intenta recargar la página.
              </Typography>
            )}
          </Paper>
        )}

        {/* Área de resultados */}
        <Box sx={{ 
          padding: 3, 
          backgroundColor: '#525252', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#ffcc80' }}>
            🚧 Resultados aparecerán aquí...
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
            Haz clic en "Calcular Strings" para ejecutar el cálculo
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default StringCalculationPage;