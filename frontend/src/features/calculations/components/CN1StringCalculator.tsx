/**
 * CN1StringCalculator.tsx
 * 
 * Calculadora completa de cables principales CN1 (Combiner Box → Inversor)
 * Basado en StringCalculator.tsx pero especializado para cables principales
 * 
 * Diferencias vs StringCalculator:
 * - Stage: "cn1_inverter" 
 * - Excel sheet: "dc_cn1_circuits"
 * - Endpoints: calculate-iec-cn1 / calculate-nec-cn1
 * - Distancias típicas: 200-600m (vs 50-100m strings)
 * - Corrientes combinadas de múltiples strings
 * - Usa normativa CN1 personalizada configurada
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import CableIcon from '@mui/icons-material/Cable';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';

interface CN1StringCalculatorProps {
  projectName: string;
  onCalculationComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

interface CN1CalculationResult {
  project_name: string;
  normative: string;
  circuit_type: string;
  has_project_overrides: boolean;
  panel_info: {
    model: string;
    isc: number;
    power: number;
  };
  calculation_params: {
    cn1_current_derating_factor: number;
    cable_material: string;
    installation_method: string;
    cn1_max_voltage_drop_percent: number;
    cn1_safety_factor: number;
    cn1_ambient_temperature_c: number;
  };
  results: any[];
  summary: {
    total_circuits: number;
    successful_calculations: number;
    errors: number;
  };
  metadata: any;
}

const CN1StringCalculator: React.FC<CN1StringCalculatorProps> = ({
  projectName,
  onCalculationComplete,
  onError
}) => {
  const [selectedNormative, setSelectedNormative] = useState<'IEC' | 'NEC'>('IEC');
  const [loading, setLoading] = useState(false);
  const [calculationResults, setCalculationResults] = useState<CN1CalculationResult | null>(null);
  const [calculationStatus, setCalculationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastCalculationTime, setLastCalculationTime] = useState<string>('');

  const normatives = [
    { value: 'IEC', label: 'IEC CN1', description: 'Estándar Internacional - Cables Principales' },
    { value: 'NEC', label: 'NEC CN1', description: 'Código Eléctrico Nacional (US) - Cables Principales' }
  ];

  const executeCalculation = async () => {
    setLoading(true);
    setCalculationStatus('idle');
    
    try {
      console.log(`🔥 CN1: Ejecutando cálculo ${selectedNormative} para proyecto: ${projectName}`);
      
      // 🔧 ENDPOINTS ESPECÍFICOS PARA CN1
      const endpoint = selectedNormative === 'IEC' 
        ? `http://localhost:8000/calculations/calculate-iec-cn1/${projectName}`
        : `http://localhost:8000/calculations/calculate-nec-cn1/${projectName}`;
      
      console.log(`📡 CN1: Endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const results = await response.json();
        console.log('✅ CN1: Resultados obtenidos:', results);
        console.log('📋 CN1: Primer resultado completo:', JSON.stringify(results.results[0], null, 2));
        console.log('🔍 CN1: Campos disponibles:', Object.keys(results.results[0] || {}));
        
        setCalculationResults(results);
        setCalculationStatus('success');
        setLastCalculationTime(new Date().toLocaleString());
        
        // Callback de éxito
        onCalculationComplete?.(results);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ CN1: Error en cálculo:', error);
      setCalculationStatus('error');
      onError?.(`Error ejecutando cálculo CN1 ${selectedNormative}: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setCalculationResults(null);
    setCalculationStatus('idle');
    setLastCalculationTime('');
  };

  // Función para obtener valor de campo con múltiples posibles nombres
  const getFieldValue = (result: any, possibleFields: string[]) => {
    for (const field of possibleFields) {
      if (result[field] !== undefined && result[field] !== null) {
        return result[field];
      }
    }
    return null;
  };

  return (
    <Paper elevation={6} sx={{ 
      padding: 3,
      backgroundColor: '#3d6b50',  // Verde CN1
      borderRadius: '16px',
      border: '1px solid #4a7c59',
    }}>
      {/* Header CN1 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CableIcon sx={{ color: '#81c784', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ color: '#81c784', fontWeight: 'bold' }}>
              ⚡ Calculadora de Cables Principales CN1
            </Typography>
            <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
              Ejecuta cálculos de dimensionamiento para cables principales desde combiner boxes hasta inversores usando normativa estándar CN1. Maneja corrientes combinadas y distancias mayores.
            </Typography>
            <Typography variant="body2" sx={{ color: '#c8e6c9', marginTop: 0.5 }}>
              Proyecto: {projectName}
            </Typography>
          </Box>
        </Box>
        
        {calculationResults && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {calculationResults.has_project_overrides && (
              <Chip 
                label="Config CN1 Personalizada"
                sx={{ 
                  backgroundColor: '#5d4e37',
                  color: '#ffd54f',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              />
            )}
            <Chip 
              label={`${calculationResults.normative} CN1`}
              sx={{ 
                backgroundColor: '#4a7c59',
                color: '#e8f5e8',
                fontWeight: 'bold',
              }}
            />
          </Box>
        )}
      </Box>

      {/* Info diferencial CN1 */}
      <Alert severity="info" sx={{ marginBottom: 3, backgroundColor: '#1976d2', color: '#fff' }}>
        <Typography variant="body2">
          <strong>🔌 CN1 vs Strings:</strong> Cables principales con corrientes combinadas y distancias mayores (200-600m típico).
          Los datos se leen desde la hoja <code>dc_cn1_circuits</code> del Excel.
        </Typography>
      </Alert>

      {/* Controles de Cálculo CN1 */}
      <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#4a7c59' }}>
        <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
          🎛️ Controles de Cálculo CN1
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: '#c8e6c9' }}>Normativa CN1</InputLabel>
            <Select
              value={selectedNormative}
              onChange={(e) => setSelectedNormative(e.target.value as 'IEC' | 'NEC')}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4a7c59' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#81c784' },
                '& .MuiSvgIcon-root': { color: '#fff' },
              }}
            >
              {normatives.map((norm) => (
                <MenuItem key={norm.value} value={norm.value}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {norm.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      {norm.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={executeCalculation}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CalculateIcon />}
            sx={{ 
              backgroundColor: '#81c784',
              color: '#000',
              '&:hover': { backgroundColor: '#66bb6a' },
              '&:disabled': { backgroundColor: '#666' }
            }}
          >
            {loading ? 'Calculando CN1...' : 'Ejecutar Cálculo CN1'}
          </Button>

          {calculationResults && (
            <Button
              variant="outlined"
              onClick={clearResults}
              disabled={loading}
              sx={{ 
                borderColor: '#4a7c59',
                color: '#e8f5e8',
                '&:hover': { borderColor: '#81c784' },
              }}
            >
              Limpiar Resultados
            </Button>
          )}

          {lastCalculationTime && (
            <Typography variant="caption" sx={{ color: '#c8e6c9', marginLeft: 'auto' }}>
              Último cálculo CN1: {lastCalculationTime}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Status Messages CN1 */}
      {calculationStatus === 'success' && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ marginBottom: 2, backgroundColor: '#2e7d32', color: '#fff' }}
        >
          Cálculo CN1 completado exitosamente con normativa {calculationResults?.normative}
        </Alert>
      )}
      
      {calculationStatus === 'error' && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ marginBottom: 2, backgroundColor: '#d32f2f', color: '#fff' }}
        >
          Error en el cálculo CN1. Revisa la configuración del proyecto y la hoja dc_cn1_circuits.
        </Alert>
      )}

      {/* Resultados del Cálculo CN1 */}
      {calculationResults && (
        <Box>
          {/* Resumen General CN1 */}
          <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#4a7c59' }}>
            <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 2 }}>
              📊 Resumen del Cálculo CN1
            </Typography>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ padding: 2, backgroundColor: '#5a8c69', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    🔌 Información del Panel CN1
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Modelo:</strong> {calculationResults.panel_info.model}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Isc:</strong> {calculationResults.panel_info.isc} A
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Potencia:</strong> {calculationResults.panel_info.power} W
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ padding: 2, backgroundColor: '#5a8c69', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    ⚙️ Parámetros CN1 de Cálculo
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Factor Reducción CN1:</strong> {calculationResults.calculation_params.cn1_current_derating_factor}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Factor Seguridad CN1:</strong> {calculationResults.calculation_params.cn1_safety_factor}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Caída máx CN1:</strong> {calculationResults.calculation_params.cn1_max_voltage_drop_percent}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                    <strong>Temp Ambiente CN1:</strong> {calculationResults.calculation_params.cn1_ambient_temperature_c}°C
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={12}>
                <Box sx={{ padding: 2, backgroundColor: '#5a8c69', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    📈 Estadísticas del Cálculo CN1
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                        <strong>{calculationResults.summary.successful_calculations}</strong> cables CN1 exitosos
                      </Typography>
                    </Box>
                    
                    {calculationResults.summary.errors > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon sx={{ color: '#f44336', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                          <strong>{calculationResults.summary.errors}</strong> errores CN1
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#e8f5e8' }}>
                        <strong>{calculationResults.summary.total_circuits}</strong> cables principales totales
                      </Typography>
                    </Box>
                    
                    {calculationResults.has_project_overrides && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label="Normativa CN1 Personalizada Aplicada"
                          size="small"
                          sx={{ 
                            backgroundColor: '#ffd54f',
                            color: '#333',
                            fontWeight: 'bold'
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Tabla de Resultados CN1 */}
          {calculationResults.results.length > 0 && (
            <Accordion sx={{ backgroundColor: '#4a7c59', marginBottom: 2 }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
                sx={{ backgroundColor: '#5a8c69' }}
              >
                <Typography variant="h6" sx={{ color: '#81c784' }}>
                  📋 Resultados Detallados CN1 ({calculationResults.results.length} cables principales)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ padding: 0 }}>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Cable CN1 ID
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          I Combinada (A)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          I Ajustada CN1 (A)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Longitud CN1 (m)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          S Teórica (mm²)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          S Comercial (mm²)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Caída V CN1 (V)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Caída V CN1 (%)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          V Drop Máx (V)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Pérdidas Joule (W)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Resistencia CN1 (Ω)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Material
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#5a8c69', color: '#fff', fontWeight: 'bold' }}>
                          Estado CN1
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calculationResults.results.map((result, index) => {
                        return (
                          <TableRow 
                            key={index}
                            sx={{ 
                              backgroundColor: index % 2 === 0 ? '#4a7c59' : '#5a8c69',
                              '&:hover': { backgroundColor: '#6a9679' }
                            }}
                          >
                            <TableCell sx={{ color: '#fff', fontSize: '12px' }}>
                              {result.cn1_cable_id || result.string_id || `CN1 Cable ${index + 1}`}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.i_combined || result.i_nominal ? Number(result.i_combined || result.i_nominal).toFixed(2) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.i_adjusted ? Number(result.i_adjusted).toFixed(2) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.length_total_m ? Number(result.length_total_m).toFixed(1) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.s_teorica_mm2 ? Number(result.s_teorica_mm2).toFixed(3) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>
                              {result.s_comercial_mm2 || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.v_drop_real_volts ? Number(result.v_drop_real_volts).toFixed(2) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.v_drop_real_pct ? Number(result.v_drop_real_pct).toFixed(3) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.v_drop_max_volts ? Number(result.v_drop_max_volts).toFixed(1) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.joule_losses_w ? Number(result.joule_losses_w).toFixed(1) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.resistance_total_ohm ? Number(result.resistance_total_ohm).toFixed(4) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontSize: '11px' }}>
                              {result.cable_material || 'Cobre'}
                            </TableCell>
                            <TableCell>
                              {result.calculation_status === 'ERROR' || result.error ? (
                                <Chip 
                                  label="Error" 
                                  size="small" 
                                  sx={{ backgroundColor: '#f44336', color: '#fff', fontSize: '10px' }}
                                />
                              ) : result.voltage_status === 'OK' ? (
                                <Chip 
                                  label="OK" 
                                  size="small" 
                                  sx={{ backgroundColor: '#4caf50', color: '#fff', fontSize: '10px' }}
                                />
                              ) : (
                                <Chip 
                                  label="Check" 
                                  size="small" 
                                  sx={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '10px' }}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Información de Debug CN1 */}
          <Accordion sx={{ backgroundColor: '#4a7c59' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#5a8c69' }}
            >
              <Typography variant="h6" sx={{ color: '#c8e6c9' }}>
                🔍 Información Técnica CN1
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ padding: 2, backgroundColor: '#3d6b50', borderRadius: '4px' }}>
                <Typography variant="body2" sx={{ color: '#e8f5e8', fontFamily: 'monospace' }}>
                  <strong>Proyecto:</strong> {calculationResults.project_name}<br/>
                  <strong>Normativa CN1:</strong> {calculationResults.normative}<br/>
                  <strong>Tipo de circuito:</strong> {calculationResults.circuit_type} (CN1)<br/>
                  <strong>Overrides CN1 aplicados:</strong> {calculationResults.has_project_overrides ? 'Sí' : 'No'}<br/>
                  <strong>Hoja Excel:</strong> dc_cn1_circuits<br/>
                  <strong>Timestamp:</strong> {lastCalculationTime}
                </Typography>
              </Box>
              
              {/* Debug de campos del primer resultado CN1 */}
              {calculationResults.results.length > 0 && (
                <Box sx={{ padding: 2, backgroundColor: '#2e5a3e', borderRadius: '4px', marginTop: 2 }}>
                  <Typography variant="body2" sx={{ color: '#81c784', marginBottom: 1 }}>
                    🔍 Campos disponibles en el primer resultado CN1:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e8f5e8', fontFamily: 'monospace', fontSize: '12px' }}>
                    {Object.keys(calculationResults.results[0]).join(', ')}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Estado inicial CN1 */}
      {!calculationResults && calculationStatus === 'idle' && (
        <Box sx={{ 
          padding: 4, 
          backgroundColor: '#4a7c59', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#81c784', marginBottom: 1 }}>
            ⚡ Listo para Calcular CN1
          </Typography>
          <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
            Selecciona una normativa CN1 y ejecuta el cálculo para dimensionar cables principales
          </Typography>
          <Typography variant="body2" sx={{ color: '#c8e6c9', marginTop: 1 }}>
            📊 Datos desde hoja: <strong>dc_cn1_circuits</strong>
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CN1StringCalculator;