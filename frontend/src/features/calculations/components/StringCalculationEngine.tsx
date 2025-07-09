import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';

interface StringCalculationEngineProps {
  projectName: string;
  onCalculationComplete?: (results: any) => void;
  onError?: (error: string) => void;
  onNormativeChange?: (normative: string) => void;
  onCriticalStringFound?: (criticalString: any, allResults: any) => void;
}

const StringCalculationEngine: React.FC<StringCalculationEngineProps> = ({
  projectName,
  onCalculationComplete,
  onError,
  onNormativeChange,
  onCriticalStringFound
}) => {
  const [selectedNormative, setSelectedNormative] = useState<'IEC' | 'NEC'>('IEC');
  const [loading, setLoading] = useState(false);
  const [lastCalculationTime, setLastCalculationTime] = useState<string>('');
  const [calculationStatus, setCalculationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | false>('summary');

  const normatives = [
    { value: 'IEC', label: 'IEC', description: 'Estándar Internacional' },
    { value: 'NEC', label: 'NEC', description: 'Código Eléctrico Nacional (US)' }
  ];

  const handleNormativeChange = (newNormative: 'IEC' | 'NEC') => {
    setSelectedNormative(newNormative);
    onNormativeChange?.(newNormative);
  };

  const handleAccordionChange = (panel: string) => (event: any, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const executeCalculation = async () => {
    if (!projectName) {
      onError?.('No hay proyecto seleccionado');
      return;
    }

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
        const calculationResults = await response.json();
        console.log('✅ Resultados obtenidos:', calculationResults);
        
        // 💾 GUARDAR RESULTADOS en el estado local
        setResults(calculationResults);
        setCalculationStatus('success');
        setLastCalculationTime(new Date().toLocaleString());
        
        // 🔍 ENCONTRAR STRING CRÍTICO
        if (calculationResults.results?.length > 0) {
          const criticalString = calculationResults.results.reduce((max: any, current: any) => {
            const currentDrop = current.v_drop_real_pct || 0;
            const maxDrop = max.v_drop_real_pct || 0;
            return currentDrop > maxDrop ? current : max;
          });
          
          console.log('🎯 String crítico encontrado:', criticalString);
          onCriticalStringFound?.(criticalString, calculationResults);
        }
        
        // Callback de éxito
        onCalculationComplete?.(calculationResults);
        
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
    setResults(null);
    setCalculationStatus('idle');
    setLastCalculationTime('');
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
            ⚡ Motor de Cálculos y Resultados
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Proyecto: {projectName}
          </Typography>
        </Box>
        
        {lastCalculationTime && (
          <Typography variant="caption" sx={{ color: '#888' }}>
            Último: {lastCalculationTime}
          </Typography>
        )}
      </Box>

      {/* Status Messages */}
      {calculationStatus === 'success' && (
        <Alert 
          severity="success" 
          sx={{ marginBottom: 2, backgroundColor: '#2e7d32', color: '#fff' }}
        >
          Cálculo completado con {selectedNormative} - {results?.summary?.total_circuits || 0} strings procesados
        </Alert>
      )}
      
      {calculationStatus === 'error' && (
        <Alert 
          severity="error" 
          sx={{ marginBottom: 2, backgroundColor: '#d32f2f', color: '#fff' }}
        >
          Error en el cálculo. Revisa la configuración del proyecto.
        </Alert>
      )}

      {/* Controles de Cálculo */}
      <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#525252' }}>
        <Typography variant="h6" sx={{ color: '#fff', marginBottom: 2 }}>
          🎛️ Controles
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Normativa</InputLabel>
            <Select
              value={selectedNormative}
              onChange={(e) => handleNormativeChange(e.target.value as 'IEC' | 'NEC')}
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
            disabled={loading || !projectName}
            startIcon={loading ? <CircularProgress size={16} /> : <CalculateIcon />}
            sx={{ 
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
              '&:disabled': { backgroundColor: '#666' }
            }}
          >
            {loading ? 'Calculando...' : 'Ejecutar Cálculo'}
          </Button>

          {results && (
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
        </Box>
      </Paper>

      {/* Resultados */}
      {results && (
        <Box>
          {/* Resumen */}
          <Accordion 
            expanded={expanded === 'summary'} 
            onChange={handleAccordionChange('summary')}
            sx={{ backgroundColor: '#525252', marginBottom: 2 }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#666' }}
            >
              <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                📊 Resumen del Cálculo
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                      🔌 Panel
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Modelo:</strong> {results.panel_info?.model || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Isc:</strong> {results.panel_info?.isc || 0} A
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Potencia:</strong> {results.panel_info?.power || 0} W
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                      ⚙️ Parámetros
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Normativa:</strong> {results.normative}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Material:</strong> {results.calculation_params?.cable_material || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      <strong>Caída máx:</strong> {results.calculation_params?.max_voltage_drop || 0}%
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                      📈 Estadísticas
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 16 }} />
                      <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                        {results.summary?.successful_calculations || 0} exitosos
                      </Typography>
                    </Box>
                    {results.summary?.errors > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
                        <ErrorIcon sx={{ color: '#f44336', fontSize: 16 }} />
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          {results.summary.errors} errores
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon sx={{ color: '#2196f3', fontSize: 16 }} />
                      <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                        {results.summary?.total_circuits || 0} total
                      </Typography>
                    </Box>
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
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Tabla de Resultados */}
          <Accordion 
            expanded={expanded === 'table'} 
            onChange={handleAccordionChange('table')}
            sx={{ backgroundColor: '#525252' }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#666' }}
            >
              <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                📋 Tabla de Resultados ({results.results?.length || 0} strings)
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ padding: 0 }}>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        String ID
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        I Ajustada (A)
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Longitud (m)
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        S Comercial (mm²)
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Caída V (%)
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                        Estado
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(results.results || []).map((result: any, index: number) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          backgroundColor: index % 2 === 0 ? '#525252' : '#5a5a5a',
                          '&:hover': { backgroundColor: '#666' }
                        }}
                      >
                        <TableCell sx={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                          {result.string_id || `String ${index + 1}`}
                        </TableCell>
                        <TableCell sx={{ color: '#fff' }}>
                          {result.i_adjusted ? Number(result.i_adjusted).toFixed(2) : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ color: '#fff' }}>
                          {result.length_total_m ? Number(result.length_total_m).toFixed(1) : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>
                          {result.s_comercial_mm2 || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>
                          {result.v_drop_real_pct ? Number(result.v_drop_real_pct).toFixed(3) : 'N/A'}
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
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Estado inicial */}
      {!results && calculationStatus === 'idle' && (
        <Box sx={{ 
          padding: 4, 
          backgroundColor: '#525252', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#ffcc80' }}>
            📋 Listo para calcular
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
            Selecciona normativa y ejecuta el cálculo
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StringCalculationEngine;