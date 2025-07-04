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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';

interface StringCalculatorProps {
  projectName: string;
  onCalculationComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

interface CalculationResult {
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
    isc_correction: number;
    cable_material: string;
    installation_method: string;
    max_voltage_drop: number;
  };
  results: any[];
  summary: {
    total_circuits: number;
    successful_calculations: number;
    errors: number;
  };
  metadata: any;
}

const StringCalculator: React.FC<StringCalculatorProps> = ({
  projectName,
  onCalculationComplete,
  onError
}) => {
  const [selectedNormative, setSelectedNormative] = useState<'IEC' | 'NEC'>('IEC');
  const [loading, setLoading] = useState(false);
  const [calculationResults, setCalculationResults] = useState<CalculationResult | null>(null);
  const [calculationStatus, setCalculationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastCalculationTime, setLastCalculationTime] = useState<string>('');

  const normatives = [
    { value: 'IEC', label: 'IEC', description: 'Estándar Internacional' },
    { value: 'NEC', label: 'NEC', description: 'Código Eléctrico Nacional (US)' }
  ];

  const executeCalculation = async () => {
    setLoading(true);
    setCalculationStatus('idle');
    
    try {
      console.log(`🔥 Ejecutando cálculo ${selectedNormative} para proyecto: ${projectName}`);
      
      const endpoint = selectedNormative === 'IEC' 
        ? `http://localhost:8000/calculations/calculate-iec-strings/${projectName}`
        : `http://localhost:8000/calculations/calculate-nec-strings/${projectName}`;
      
      console.log(`📡 Endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const results = await response.json();
        console.log('✅ Resultados obtenidos:', results);
        console.log('📋 Primer resultado completo:', JSON.stringify(results.results[0], null, 2));
        console.log('🔍 Campos disponibles:', Object.keys(results.results[0] || {}));
        
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
      console.error('❌ Error en cálculo:', error);
      setCalculationStatus('error');
      onError?.(`Error ejecutando cálculo ${selectedNormative}: ${error}`);
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
      backgroundColor: '#3a3a3a',
      borderRadius: '16px',
      border: '1px solid #525252',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold' }}>
            ⚡ Calculadora de Strings DC
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Proyecto: {projectName}
          </Typography>
        </Box>
        
        {calculationResults && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {calculationResults.has_project_overrides && (
              <Chip 
                label="Config Personalizada"
                sx={{ 
                  backgroundColor: '#4a4a3a',
                  color: '#ffcc80',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              />
            )}
            <Chip 
              label={calculationResults.normative}
              sx={{ 
                backgroundColor: '#525252',
                color: '#e0e0e0',
                fontWeight: 'bold',
              }}
            />
          </Box>
        )}
      </Box>

      {/* Controles de Cálculo */}
      <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#525252' }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          🎛️ Controles de Cálculo
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Normativa</InputLabel>
            <Select
              value={selectedNormative}
              onChange={(e) => setSelectedNormative(e.target.value as 'IEC' | 'NEC')}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb74d' },
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
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
              '&:disabled': { backgroundColor: '#666' }
            }}
          >
            {loading ? 'Calculando...' : 'Ejecutar Cálculo'}
          </Button>

          {calculationResults && (
            <Button
              variant="outlined"
              onClick={clearResults}
              disabled={loading}
              sx={{ 
                borderColor: '#666',
                color: '#e0e0e0',
                '&:hover': { borderColor: '#888' },
              }}
            >
              Limpiar Resultados
            </Button>
          )}

          {lastCalculationTime && (
            <Typography variant="caption" sx={{ color: '#888', marginLeft: 'auto' }}>
              Último cálculo: {lastCalculationTime}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Status Messages */}
      {calculationStatus === 'success' && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ marginBottom: 2, backgroundColor: '#2e7d32', color: '#fff' }}
        >
          Cálculo completado exitosamente con normativa {calculationResults?.normative}
        </Alert>
      )}
      
      {calculationStatus === 'error' && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ marginBottom: 2, backgroundColor: '#d32f2f', color: '#fff' }}
        >
          Error en el cálculo. Revisa la configuración del proyecto.
        </Alert>
      )}

      {/* Resultados del Cálculo */}
      {calculationResults && (
        <Box>
          {/* Resumen General */}
          <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#525252' }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              📊 Resumen del Cálculo
            </Typography>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    🔌 Información del Panel
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Modelo:</strong> {calculationResults.panel_info.model}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Isc:</strong> {calculationResults.panel_info.isc} A
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Potencia:</strong> {calculationResults.panel_info.power} W
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    ⚙️ Parámetros de Cálculo
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Factor Isc:</strong> {calculationResults.calculation_params.isc_correction}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Material:</strong> {calculationResults.calculation_params.cable_material}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Caída máx:</strong> {calculationResults.calculation_params.max_voltage_drop}%
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={12}>
                <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    📈 Estadísticas del Cálculo
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                        <strong>{calculationResults.summary.successful_calculations}</strong> exitosos
                      </Typography>
                    </Box>
                    
                    {calculationResults.summary.errors > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon sx={{ color: '#f44336', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          <strong>{calculationResults.summary.errors}</strong> errores
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                        <strong>{calculationResults.summary.total_circuits}</strong> circuitos totales
                      </Typography>
                    </Box>
                    
                    {calculationResults.has_project_overrides && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label="Normativa Personalizada Aplicada"
                          size="small"
                          sx={{ 
                            backgroundColor: '#ffcc80',
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

          {/* Tabla de Resultados */}
          {calculationResults.results.length > 0 && (
            <Accordion sx={{ backgroundColor: '#525252', marginBottom: 2 }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
                sx={{ backgroundColor: '#666' }}
              >
                <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                  📋 Resultados Detallados ({calculationResults.results.length} strings)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ padding: 0 }}>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          String ID
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          I Nominal (A)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          I Ajustada (A)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Longitud (m)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          S Teórica (mm²)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          S Comercial (mm²)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Caída V (V)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Caída V (%)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          V Drop Máx (V)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Pérdidas Joule (W)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Resistencia (Ω)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Resistividad
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          V Ref (V)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Material
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Estado
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calculationResults.results.map((result, index) => {
                        return (
                          <TableRow 
                            key={index}
                            sx={{ 
                              backgroundColor: index % 2 === 0 ? '#525252' : '#5a5a5a',
                              '&:hover': { backgroundColor: '#666' }
                            }}
                          >
                            <TableCell sx={{ color: '#fff', fontSize: '12px' }}>
                              {result.string_id || `String ${index + 1}`}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.i_nominal ? Number(result.i_nominal).toFixed(2) : 'N/A'}
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
                              {result.resistivity_ohm_mm2_per_m ? Number(result.resistivity_ohm_mm2_per_m).toFixed(6) : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff' }}>
                              {result.reference_voltage || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontSize: '11px' }}>
                              {result.cable_material || 'N/A'}
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

          {/* Información de Debug */}
          <Accordion sx={{ backgroundColor: '#525252' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#666' }}
            >
              <Typography variant="h6" sx={{ color: '#888' }}>
                🔍 Información Técnica
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px' }}>
                <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
                  <strong>Proyecto:</strong> {calculationResults.project_name}<br/>
                  <strong>Normativa:</strong> {calculationResults.normative}<br/>
                  <strong>Tipo de circuito:</strong> {calculationResults.circuit_type}<br/>
                  <strong>Overrides aplicados:</strong> {calculationResults.has_project_overrides ? 'Sí' : 'No'}<br/>
                  <strong>Timestamp:</strong> {lastCalculationTime}
                </Typography>
              </Box>
              
              {/* Debug de campos del primer resultado */}
              {calculationResults.results.length > 0 && (
                <Box sx={{ padding: 2, backgroundColor: '#333', borderRadius: '4px', marginTop: 2 }}>
                  <Typography variant="body2" sx={{ color: '#ffcc80', marginBottom: 1 }}>
                    🔍 Campos disponibles en el primer resultado:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '12px' }}>
                    {Object.keys(calculationResults.results[0]).join(', ')}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Estado inicial */}
      {!calculationResults && calculationStatus === 'idle' && (
        <Box sx={{ 
          padding: 4, 
          backgroundColor: '#525252', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 1 }}>
            ⚡ Listo para Calcular
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Selecciona una normativa y ejecuta el cálculo para ver los resultados
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StringCalculator;