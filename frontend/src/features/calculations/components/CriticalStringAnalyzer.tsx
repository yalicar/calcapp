import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Calculate,
  Info,
  TrendingUp,
  Cable,
  Bolt,
  Thermostat,
  Refresh,
  BarChart,
  Settings,
  PlayArrow,
  RotateLeft,
  ExpandMore
} from '@mui/icons-material';

// Tipos
interface CalculationResults {
  project_name: string;
  circuit_type: string;
  normative: string;
  has_project_overrides: boolean;
  panel_info: {
    model: string;
    isc: number;
    power: number;
  };
  calculation_params: {
    isc_correction: number;
    cable_material: string;
    installation_method: string;
    max_voltage_drop: number;
    parallel_strings: number;
    installation_depth: number;
    ambient_design_temp: number;
    cable_max_temp: number;
  };
  calculation_factors: any;
  results: StringResult[];
  summary: {
    total_circuits: number;
    successful_calculations: number;
    errors: number;
  };
  saved_at: string;
}

interface StringResult {
  string_id: string;
  i_nominal: number;
  i_adjusted: number;
  length_total_m: number;
  s_teorica_mm2: number;
  s_comercial_mm2: number;
  v_drop_real_pct: number;
  v_drop_real_volts: number;
  v_drop_max_volts: number;
  resistance_total_ohm: number;
  resistivity_ohm_mm2_per_m: number;
  reference_voltage: number;
  cable_material: string;
  voltage_status: string;
}

interface SimulationParams {
  newCableSection: number;
  newResistivity: number;
  newMaxVoltageDrop: number;
  newTemperatureFactor: number;
}

interface SimulationResult {
  original: StringResult;
  simulated: StringResult;
  improvements: {
    voltage_drop_reduction: number;
    resistance_reduction: number;
    status_change: boolean;
  };
}

const EnhancedCriticalStringAnalyzer: React.FC = () => {
  const [projectName, setProjectName] = useState('colorado-v1');
  const [normative, setNormative] = useState('IEC');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [criticalString, setCriticalString] = useState<StringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | false>('critical');
  
  // Estados para simulación
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulationParams, setSimulationParams] = useState<SimulationParams>({
    newCableSection: 4,
    newResistivity: 0.018595,
    newMaxVoltageDrop: 5,
    newTemperatureFactor: 1.0
  });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const handleAccordionChange = (panel: string) => (event: any, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Cargar resultados guardados
  const loadSavedResults = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/calculations/get-saved-results/${projectName}/dc_strings/${normative.toLowerCase()}`);
      
      if (!response.ok) {
        throw new Error(`No se encontraron resultados guardados para ${projectName} - ${normative}`);
      }
      
      const data: CalculationResults = await response.json();
      setResults(data);
      
      // Encontrar el string más crítico
      const critical = data.results.reduce((prev, current) => 
        prev.v_drop_real_pct > current.v_drop_real_pct ? prev : current
      );
      setCriticalString(critical);
      
      // Preparar datos para distribución
      prepareDistributionData(data.results, data.calculation_params.max_voltage_drop);
      
      // Inicializar parámetros de simulación
      setSimulationParams({
        newCableSection: critical.s_comercial_mm2,
        newResistivity: critical.resistivity_ohm_mm2_per_m,
        newMaxVoltageDrop: data.calculation_params.max_voltage_drop,
        newTemperatureFactor: 1.0
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Preparar datos para el gráfico de distribución
  const prepareDistributionData = (strings: StringResult[], maxDrop: number) => {
    const ranges = [
      { range: '0-1%', min: 0, max: 1, count: 0, color: '#4caf50' },
      { range: '1-2%', min: 1, max: 2, count: 0, color: '#8bc34a' },
      { range: '2-3%', min: 2, max: 3, count: 0, color: '#ffeb3b' },
      { range: '3-4%', min: 3, max: 4, count: 0, color: '#ff9800' },
      { range: '4-5%', min: 4, max: 5, count: 0, color: '#f44336' },
      { range: '>5%', min: 5, max: 100, count: 0, color: '#d32f2f' }
    ];

    strings.forEach(string => {
      const drop = string.v_drop_real_pct;
      const range = ranges.find(r => drop >= r.min && drop < r.max) || ranges[ranges.length - 1];
      range.count++;
    });

    console.log('📊 Datos del gráfico:', ranges);
    setDistributionData(ranges);
  };

  // Simular cambios en el string crítico
  const simulateChanges = () => {
    if (!criticalString) return;

    const originalResistance = criticalString.resistance_total_ohm;
    const newResistance = (simulationParams.newResistivity * criticalString.length_total_m) / simulationParams.newCableSection;
    const newVoltageDrop = (newResistance * criticalString.i_adjusted);
    const newVoltageDropPct = (newVoltageDrop / criticalString.reference_voltage) * 100;
    
    const simulatedString: StringResult = {
      ...criticalString,
      s_comercial_mm2: simulationParams.newCableSection,
      resistance_total_ohm: newResistance,
      v_drop_real_volts: newVoltageDrop,
      v_drop_real_pct: newVoltageDropPct,
      voltage_status: newVoltageDropPct <= simulationParams.newMaxVoltageDrop ? 'OK' : 'WARNING'
    };

    const improvements = {
      voltage_drop_reduction: criticalString.v_drop_real_pct - newVoltageDropPct,
      resistance_reduction: ((originalResistance - newResistance) / originalResistance) * 100,
      status_change: criticalString.voltage_status !== simulatedString.voltage_status
    };

    setSimulationResult({
      original: criticalString,
      simulated: simulatedString,
      improvements
    });
  };

  // Resetear simulación
  const resetSimulation = () => {
    if (criticalString) {
      setSimulationParams({
        newCableSection: criticalString.s_comercial_mm2,
        newResistivity: criticalString.resistivity_ohm_mm2_per_m,
        newMaxVoltageDrop: results?.calculation_params.max_voltage_drop || 5,
        newTemperatureFactor: 1.0
      });
      setSimulationResult(null);
    }
  };

  useEffect(() => {
    loadSavedResults();
  }, []);

  // Función para formatear números
  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3
    }}>
      {/* Header */}
      <Paper elevation={6} sx={{ 
        padding: 3, 
        marginBottom: 3, 
        backgroundColor: '#3a3a3a', 
        borderRadius: '16px',
        border: '1px solid #525252'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TrendingUp sx={{ fontSize: 32, color: '#ffcc80' }} />
            <Box>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                🔥 Análisis Avanzado de String Crítico
              </Typography>
              <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                Proyecto: {projectName} | Normativa: {normative}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Controles de selección */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Proyecto</InputLabel>
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
              <MenuItem value="colorado-v1">Colorado V1</MenuItem>
              <MenuItem value="test-project">Test Project</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Normativa</InputLabel>
            <Select
              value={normative}
              onChange={(e) => setNormative(e.target.value)}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
                '& .MuiSvgIcon-root': { color: '#fff' },
              }}
            >
              <MenuItem value="IEC">IEC</MenuItem>
              <MenuItem value="NEC">NEC</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={loadSavedResults}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Calculate />}
            sx={{ 
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
              '&:disabled': { backgroundColor: '#666' }
            }}
          >
            {loading ? 'Cargando...' : 'Cargar Análisis'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ marginBottom: 3, backgroundColor: '#d32f2f', color: '#fff' }}>
          {error}
        </Alert>
      )}

      {results && criticalString && (
        <>
          {/* Información del proyecto */}
          <Paper elevation={6} sx={{ 
            padding: 3, 
            marginBottom: 3, 
            backgroundColor: '#3a3a3a', 
            borderRadius: '16px',
            border: '1px solid #525252'
          }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              📊 Información del Proyecto
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ padding: 2, backgroundColor: '#525252', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    🔌 Panel Solar
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Modelo:</strong> {results.panel_info.model}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Potencia:</strong> {results.panel_info.power}W
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>ISC:</strong> {formatNumber(results.panel_info.isc)}A
                  </Typography>
                  {results.has_project_overrides && (
                    <Chip 
                      label="Config Personalizada"
                      size="small"
                      sx={{ 
                        marginTop: 1,
                        backgroundColor: '#ffcc80',
                        color: '#333',
                        fontWeight: 'bold'
                      }}
                    />
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ padding: 2, backgroundColor: '#525252', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    ⚙️ Parámetros de Cálculo
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Factor ISC:</strong> {formatNumber(results.calculation_params.isc_correction)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Material:</strong> {results.calculation_params.cable_material}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Caída máx:</strong> {formatNumber(results.calculation_params.max_voltage_drop)}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Temp. ambiente:</strong> {results.calculation_params.ambient_design_temp}°C
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Desarrollo de cálculos - NUEVA SECCIÓN */}
          <Accordion 
            expanded={expanded === 'calculations'} 
            onChange={handleAccordionChange('calculations')}
            sx={{ backgroundColor: '#3a3a3a', marginBottom: 2 }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#525252' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Calculate sx={{ color: '#ffcc80' }} />
                <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                  🧮 Desarrollo de Cálculos y Fórmulas
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {criticalString && (
                <Box sx={{ padding: 2 }}>
                  <Typography variant="h6" sx={{ color: '#fff', marginBottom: 3 }}>
                    📐 Cálculo Paso a Paso para: <span style={{ color: '#ffcc80' }}>{criticalString.string_id}</span>
                  </Typography>

                  {/* Parámetros de entrada */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#4caf50', marginBottom: 2 }}>
                      📋 1. Parámetros de Entrada
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>I_nominal:</strong> {formatNumber(criticalString.i_nominal)} A
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Corriente nominal del panel (ISC del datasheet)
                          </Typography>
                        </Box>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>Longitud total:</strong> {formatNumber(criticalString.length_total_m)} m
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Distancia del string desde paneles hasta inversor
                          </Typography>
                        </Box>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>Resistividad (ρ):</strong> {formatNumber(criticalString.resistivity_ohm_mm2_per_m, 6)} Ω·mm²/m
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Resistividad del material del cable ({criticalString.cable_material})
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>Factor ISC:</strong> {formatNumber(results.calculation_params.isc_correction)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Factor de corrección por condiciones de irradiancia
                          </Typography>
                        </Box>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>Tensión referencia:</strong> {formatNumber(criticalString.reference_voltage)} V
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Tensión nominal del sistema DC
                          </Typography>
                        </Box>
                        <Box sx={{ padding: 1, backgroundColor: '#666', borderRadius: '4px', marginBottom: 1 }}>
                          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                            <strong>Caída máxima permitida:</strong> {formatNumber(results.calculation_params.max_voltage_drop)}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                            Límite normativo de caída de tensión
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Paso 2: Corriente ajustada */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#2196f3', marginBottom: 2 }}>
                      ⚡ 2. Cálculo de Corriente Ajustada
                    </Typography>
                    <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px', marginBottom: 2 }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        <strong>Fórmula:</strong> I_ajustada = I_nominal × Factor_ISC
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        I_ajustada = {formatNumber(criticalString.i_nominal)} A × {formatNumber(results.calculation_params.isc_correction)}
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#4caf50', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                        I_ajustada = {formatNumber(criticalString.i_adjusted)} A
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                      La corriente ajustada considera condiciones máximas de irradiancia según normativa {results.normative}
                    </Typography>
                  </Paper>

                  {/* Paso 3: Resistencia del cable */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#ff9800', marginBottom: 2 }}>
                      🔌 3. Resistencia del Cable
                    </Typography>
                    <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px', marginBottom: 2 }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        <strong>Fórmula:</strong> R = ρ × L / S
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        R = {formatNumber(criticalString.resistivity_ohm_mm2_per_m, 6)} Ω·mm²/m × {formatNumber(criticalString.length_total_m)} m / {formatNumber(criticalString.s_comercial_mm2)} mm²
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#ff9800', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                        R = {formatNumber(criticalString.resistance_total_ohm, 4)} Ω
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                      Donde: ρ = resistividad, L = longitud total, S = sección comercial del cable
                    </Typography>
                  </Paper>

                  {/* Paso 4: Caída de tensión */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#f44336', marginBottom: 2 }}>
                      📉 4. Caída de Tensión
                    </Typography>
                    <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px', marginBottom: 2 }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        <strong>Fórmula:</strong> ΔV = I × R
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        ΔV = {formatNumber(criticalString.i_adjusted)} A × {formatNumber(criticalString.resistance_total_ohm, 4)} Ω
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#f44336', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                        ΔV = {formatNumber(criticalString.v_drop_real_volts)} V
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                      Caída de tensión absoluta en el cable debido a la resistencia
                    </Typography>
                  </Paper>

                  {/* Paso 5: Porcentaje de caída */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#9c27b0', marginBottom: 2 }}>
                      📊 5. Porcentaje de Caída de Tensión
                    </Typography>
                    <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px', marginBottom: 2 }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        <strong>Fórmula:</strong> %ΔV = (ΔV / V_ref) × 100
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        %ΔV = ({formatNumber(criticalString.v_drop_real_volts)} V / {formatNumber(criticalString.reference_voltage)} V) × 100
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#9c27b0', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                        %ΔV = {formatNumber(criticalString.v_drop_real_pct)}%
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                      Porcentaje de caída respecto a la tensión nominal del sistema
                    </Typography>
                  </Paper>

                  {/* Paso 6: Sección teórica */}
                  <Paper sx={{ padding: 2, marginBottom: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#607d8b', marginBottom: 2 }}>
                      📏 6. Sección Teórica Mínima
                    </Typography>
                    <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px', marginBottom: 2 }}>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        <strong>Fórmula:</strong> S_min = (ρ × L × I) / ΔV_max
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px' }}>
                        S_min = ({formatNumber(criticalString.resistivity_ohm_mm2_per_m, 6)} × {formatNumber(criticalString.length_total_m)} × {formatNumber(criticalString.i_adjusted)}) / {formatNumber(criticalString.v_drop_max_volts)}
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#607d8b', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                        S_min = {formatNumber(criticalString.s_teorica_mm2)} mm²
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                      Sección mínima teórica para no exceder la caída de tensión máxima permitida
                    </Typography>
                  </Paper>

                  {/* Verificación de cumplimiento */}
                  <Paper sx={{ 
                    padding: 2, 
                    backgroundColor: criticalString.voltage_status === 'OK' ? '#2e7d32' : '#f57c00', 
                    borderRadius: '8px' 
                  }}>
                    <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
                      ✅ 7. Verificación de Cumplimiento
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body1" sx={{ color: '#fff', marginBottom: 1 }}>
                          <strong>Sección comercial:</strong> {formatNumber(criticalString.s_comercial_mm2)} mm²
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff', marginBottom: 1 }}>
                          <strong>Sección teórica mín:</strong> {formatNumber(criticalString.s_teorica_mm2)} mm²
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff' }}>
                          <strong>Resultado:</strong> {criticalString.s_comercial_mm2 >= criticalString.s_teorica_mm2 ? '✅ CUMPLE' : '❌ NO CUMPLE'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body1" sx={{ color: '#fff', marginBottom: 1 }}>
                          <strong>Caída real:</strong> {formatNumber(criticalString.v_drop_real_pct)}%
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff', marginBottom: 1 }}>
                          <strong>Caída máxima:</strong> {formatNumber(results.calculation_params.max_voltage_drop)}%
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff' }}>
                          <strong>Estado:</strong> {criticalString.voltage_status === 'OK' ? '✅ DENTRO DEL LÍMITE' : '⚠️ CERCA DEL LÍMITE'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Referencias normativas */}
                  <Paper sx={{ padding: 2, marginTop: 3, backgroundColor: '#37474f', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#b0bec5', marginBottom: 2 }}>
                      📚 Referencias Normativas
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0', marginBottom: 1 }}>
                      <strong>Normativa aplicada:</strong> {results.normative}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0', marginBottom: 1 }}>
                      <strong>Factor de corrección ISC:</strong> Según {results.normative} para condiciones STC
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0', marginBottom: 1 }}>
                      <strong>Caída de tensión máxima:</strong> {formatNumber(results.calculation_params.max_voltage_drop)}% según normativa {results.normative}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Material del cable:</strong> {results.calculation_params.cable_material} - Resistividad: {formatNumber(criticalString.resistivity_ohm_mm2_per_m, 6)} Ω·mm²/m
                    </Typography>
                  </Paper>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
          <Accordion 
            expanded={expanded === 'distribution'} 
            onChange={handleAccordionChange('distribution')}
            sx={{ backgroundColor: '#3a3a3a', marginBottom: 2 }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#525252' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BarChart sx={{ color: '#ffcc80' }} />
                <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                  📊 Distribución de Caídas de Tensión
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {distributionData.map((item, index) => (
                  <Grid item xs={6} md={2} key={index}>
                    <Box sx={{ 
                      padding: 2, 
                      backgroundColor: '#525252', 
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <Box sx={{ 
                        width: '100%', 
                        height: 8, 
                        backgroundColor: item.color, 
                        borderRadius: '4px',
                        marginBottom: 1
                      }} />
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                        {item.count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#b0b0b0' }}>
                        {item.range}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" sx={{ color: '#b0b0b0', marginTop: 2, display: 'block' }}>
                Total: {distributionData.reduce((sum, item) => sum + item.count, 0)} strings analizados
              </Typography>
            </AccordionDetails>
          </Accordion>

          {/* String más crítico */}
          <Accordion 
            expanded={expanded === 'critical'} 
            onChange={handleAccordionChange('critical')}
            sx={{ backgroundColor: '#3a3a3a', marginBottom: 2 }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#525252' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Warning sx={{ color: '#ffcc80' }} />
                <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                  🔥 String Más Crítico: {criticalString.string_id}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert 
                severity={criticalString.voltage_status === 'OK' ? 'success' : 'warning'} 
                sx={{ marginBottom: 3 }}
              >
                <strong>{criticalString.string_id}</strong> - Caída de tensión: {formatNumber(criticalString.v_drop_real_pct)}%
                ({formatNumber(criticalString.v_drop_real_volts)}V de {formatNumber(criticalString.v_drop_max_volts)}V máx)
              </Alert>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  Parámetros Detallados
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setShowSimulator(!showSimulator)}
                  startIcon={<Settings />}
                  sx={{ 
                    backgroundColor: '#9c27b0',
                    '&:hover': { backgroundColor: '#7b1fa2' }
                  }}
                >
                  {showSimulator ? 'Ocultar Simulador' : 'Mostrar Simulador'}
                </Button>
              </Box>

              {/* Simulador de cambios */}
              {showSimulator && (
                <Paper sx={{ 
                  padding: 3, 
                  marginBottom: 3, 
                  backgroundColor: '#525252', 
                  borderRadius: '8px' 
                }}>
                  <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
                    🔧 Simulador de Cambios
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ marginBottom: 2 }}>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="Sección Cable (mm²)"
                        type="number"
                        inputProps={{ step: 0.5 }}
                        value={simulationParams.newCableSection}
                        onChange={(e) => setSimulationParams({
                          ...simulationParams,
                          newCableSection: parseFloat(e.target.value) || 0
                        })}
                        sx={{
                          '& .MuiOutlinedInput-root': { 
                            color: '#fff',
                            '& fieldset': { borderColor: '#666' },
                          },
                          '& .MuiInputLabel-root': { color: '#b0b0b0' },
                        }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="Resistividad (Ω·mm²/m)"
                        type="number"
                        inputProps={{ step: 0.001 }}
                        value={simulationParams.newResistivity}
                        onChange={(e) => setSimulationParams({
                          ...simulationParams,
                          newResistivity: parseFloat(e.target.value) || 0
                        })}
                        sx={{
                          '& .MuiOutlinedInput-root': { 
                            color: '#fff',
                            '& fieldset': { borderColor: '#666' },
                          },
                          '& .MuiInputLabel-root': { color: '#b0b0b0' },
                        }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="Caída Tensión Máx (%)"
                        type="number"
                        inputProps={{ step: 0.1 }}
                        value={simulationParams.newMaxVoltageDrop}
                        onChange={(e) => setSimulationParams({
                          ...simulationParams,
                          newMaxVoltageDrop: parseFloat(e.target.value) || 0
                        })}
                        sx={{
                          '& .MuiOutlinedInput-root': { 
                            color: '#fff',
                            '& fieldset': { borderColor: '#666' },
                          },
                          '& .MuiInputLabel-root': { color: '#b0b0b0' },
                        }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          onClick={simulateChanges}
                          startIcon={<PlayArrow />}
                          sx={{ 
                            backgroundColor: '#4caf50',
                            '&:hover': { backgroundColor: '#388e3c' }
                          }}
                        >
                          Simular
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={resetSimulation}
                          startIcon={<RotateLeft />}
                          sx={{ 
                            borderColor: '#666',
                            color: '#e0e0e0',
                            '&:hover': { borderColor: '#888' }
                          }}
                        >
                          Reset
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Resultados de simulación */}
                  {simulationResult && (
                    <Paper sx={{ 
                      padding: 2, 
                      backgroundColor: '#666', 
                      borderRadius: '8px' 
                    }}>
                      <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
                        📈 Resultados de Simulación
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center', padding: 2, backgroundColor: '#444', borderRadius: '8px' }}>
                            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Caída de Tensión</Typography>
                            <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                              {formatNumber(simulationResult.simulated.v_drop_real_pct)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#81c784' }}>
                              {simulationResult.improvements.voltage_drop_reduction > 0 ? '↓' : '↑'} 
                              {formatNumber(Math.abs(simulationResult.improvements.voltage_drop_reduction))}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center', padding: 2, backgroundColor: '#444', borderRadius: '8px' }}>
                            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Resistencia</Typography>
                            <Typography variant="h5" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                              {formatNumber(simulationResult.simulated.resistance_total_ohm, 3)}Ω
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64b5f6' }}>
                              ↓ {formatNumber(simulationResult.improvements.resistance_reduction)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center', padding: 2, backgroundColor: '#444', borderRadius: '8px' }}>
                            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>Estado</Typography>
                            <Chip 
                              label={simulationResult.simulated.voltage_status}
                              sx={{ 
                                backgroundColor: simulationResult.simulated.voltage_status === 'OK' ? '#4caf50' : '#ff9800',
                                color: '#fff',
                                fontWeight: 'bold'
                              }}
                            />
                            {simulationResult.improvements.status_change && (
                              <Typography variant="caption" sx={{ color: '#4caf50', display: 'block', marginTop: 1 }}>
                                ¡Mejorado!
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  )}
                </Paper>
              )}

              <TableContainer sx={{ backgroundColor: '#525252', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Parámetro
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Valor
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Unidad
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Estado
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>String ID</TableCell>
                      <TableCell sx={{ color: '#fff', fontFamily: 'monospace' }}>{criticalString.string_id}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                      <TableCell>
                        <Chip 
                          label="CRÍTICO" 
                          size="small"
                          sx={{ backgroundColor: '#ff9800', color: '#fff' }}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Corriente Nominal</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.i_nominal)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>A</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Corriente Ajustada</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.i_adjusted)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>A</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Longitud Total</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.length_total_m)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>m</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Sección Teórica</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.s_teorica_mm2)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>mm²</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Sección Comercial</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.s_comercial_mm2)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>mm²</TableCell>
                      <TableCell>
                        <Chip 
                          label={criticalString.s_comercial_mm2 >= criticalString.s_teorica_mm2 ? 'OK' : 'REVISAR'}
                          size="small"
                          sx={{ 
                            backgroundColor: criticalString.s_comercial_mm2 >= criticalString.s_teorica_mm2 ? '#4caf50' : '#f44336',
                            color: '#fff'
                          }}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#444' }}>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Caída Tensión Real</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>{formatNumber(criticalString.v_drop_real_pct)}</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>%</TableCell>
                      <TableCell>
                        <Chip 
                          label={criticalString.voltage_status}
                          size="small"
                          sx={{ 
                            backgroundColor: criticalString.voltage_status === 'OK' ? '#4caf50' : '#ff9800',
                            color: '#fff',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Caída Tensión (Volts)</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.v_drop_real_volts)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>V</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Resistencia Total</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.resistance_total_ohm, 3)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>Ω</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#fff' }}>Tensión Referencia</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{formatNumber(criticalString.reference_voltage)}</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>V</TableCell>
                      <TableCell sx={{ color: '#b0b0b0' }}>-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          {/* Resumen de cálculos */}
          <Paper elevation={6} sx={{ 
            padding: 3, 
            backgroundColor: '#3a3a3a', 
            borderRadius: '16px',
            border: '1px solid #525252'
          }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              📈 Resumen de Cálculos
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  padding: 3, 
                  backgroundColor: '#525252', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <CheckCircle sx={{ fontSize: 48, color: '#4caf50', marginBottom: 2 }} />
                  <Typography variant="h3" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                    {results.summary.successful_calculations}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                    Cálculos Exitosos
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  padding: 3, 
                  backgroundColor: '#525252', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <Calculate sx={{ fontSize: 48, color: '#2196f3', marginBottom: 2 }} />
                  <Typography variant="h3" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                    {results.summary.total_circuits}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                    Total Circuitos
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  padding: 3, 
                  backgroundColor: '#525252', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <Error sx={{ fontSize: 48, color: '#f44336', marginBottom: 2 }} />
                  <Typography variant="h3" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                    {results.summary.errors}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
                    Errores
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Información de guardado */}
          <Alert 
            severity="info" 
            sx={{ 
              marginTop: 3,
              backgroundColor: '#1976d2',
              color: '#fff'
            }}
          >
            <strong>Análisis completado:</strong> Resultados cargados desde archivo guardado el {new Date(results.saved_at).toLocaleString()}
          </Alert>
        </>
      )}

      {/* Estado inicial */}
      {!results && !loading && !error && (
        <Paper sx={{ 
          padding: 4, 
          backgroundColor: '#3a3a3a', 
          borderRadius: '16px',
          textAlign: 'center',
          border: '1px solid #525252'
        }}>
          <TrendingUp sx={{ fontSize: 64, color: '#666', marginBottom: 2 }} />
          <Typography variant="h6" sx={{ color: '#ffcc80' }}>
            📋 Listo para analizar
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
            Selecciona proyecto y normativa, luego carga el análisis
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default EnhancedCriticalStringAnalyzer;