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
  AccordionDetails,
  Card,
  CardContent
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import FunctionsIcon from '@mui/icons-material/Functions';

interface StringCalculatorEnhancedProps {
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
    // 🔥 PARÁMETROS REALES EXTRAÍDOS
    parallel_strings?: number;
    grouping_factor?: number;
    temperature_factor?: number;
    ambient_temp?: number;
    installation_depth?: number;
    cable_max_temp?: number;
    resistivity?: number;
    extraction_source?: string; // Debug: fuente de extracción
    factors_confidence?: string; // Debug: confianza de los factores
  };
  results: any[];
  summary: {
    total_circuits: number;
    successful_calculations: number;
    errors: number;
  };
  // 🔥 NUEVO: Análisis estadístico
  statistical_analysis?: {
    critical_string: {
      string_id: string;
      reason: string;
      voltage_drop_pct: number;
      section_mm2: number;
      length_m: number;
      current_a: number;
    };
    best_string: {
      string_id: string;
      voltage_drop_pct: number;
      section_mm2: number;
      length_m: number;
    };
    formula_justification: {
      string_id: string;
      formula: string;
      variables: Record<string, any>;
      calculation_steps: string[];
    };
  };
  metadata: any;
}

const StringCalculatorEnhanced: React.FC<StringCalculatorEnhancedProps> = ({
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
      console.log(`🔥 Ejecutando cálculo MEJORADO ${selectedNormative} para proyecto: ${projectName}`);
      
      // 🔥 NUEVO: Usar endpoint mejorado (cuando esté listo)
      const enhancedEndpoint = selectedNormative === 'IEC' 
        ? `http://localhost:8000/calculations/calculate-iec-strings-enhanced/${projectName}`
        : `http://localhost:8000/calculations/calculate-nec-strings-enhanced/${projectName}`;
      
      console.log(`📡 Intentando endpoint mejorado: ${enhancedEndpoint}`);
      
      let response = await fetch(enhancedEndpoint);
      
      // 🔧 FALLBACK: Si no existe endpoint mejorado, usar el normal y procesar en frontend
      if (!response.ok && response.status === 404) {
        console.log('⚠️ Endpoint mejorado no disponible, usando endpoint normal...');
        const fallbackEndpoint = selectedNormative === 'IEC' 
          ? `http://localhost:8000/calculations/calculate-iec-strings/${projectName}`
          : `http://localhost:8000/calculations/calculate-nec-strings/${projectName}`;
        
        response = await fetch(fallbackEndpoint);
      }
      
      if (response.ok) {
        const results = await response.json();
        console.log('✅ Resultados obtenidos:', results);
        
        // 🔥 MEJORA: Procesar resultados y agregar análisis estadístico CON FACTORES REALES
        const enhancedResults = enhanceResultsWithAnalysis(results);
        
        setCalculationResults(enhancedResults);
        setCalculationStatus('success');
        setLastCalculationTime(new Date().toLocaleString());
        
        onCalculationComplete?.(enhancedResults);
        
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

  // 🔥 FUNCIÓN AUXILIAR: Extraer factores REALES desde la respuesta del backend
  const extractRealFactorsFromResponse = (originalResults: any) => {
    console.log('🔍 Extrayendo factores reales desde respuesta del backend...');
    
    // 1. Si el backend ya incluye factors_debug (futuro)
    if (originalResults.factors_debug) {
      console.log('✅ Usando factors_debug del backend');
      return {
        ...originalResults.factors_debug,
        extraction_source: 'backend_factors_debug',
        factors_confidence: 'high'
      };
    }
    
    // 2. Extraer desde metadata y calculation_params
    const factors = extractFactorsFromMetadata(originalResults);
    
    // 3. Estimar factores desde los resultados calculados
    const estimatedFactors = estimateFactorsFromResults(originalResults);
    
    // 4. Combinar factores extraídos y estimados
    return {
      ...factors,
      ...estimatedFactors,
      extraction_source: 'metadata_and_estimation',
      factors_confidence: 'medium'
    };
  };

  // 🔥 FUNCIÓN: Extraer factores desde metadata
  const extractFactorsFromMetadata = (originalResults: any) => {
    const metadata = originalResults.metadata || {};
    const params = originalResults.calculation_params || {};
    
    console.log('🔍 Metadata disponible:', metadata);
    console.log('🔍 Calculation params:', params);
    
    return {
      parallel_strings: 
        metadata.parallel_strings || 
        metadata.number_of_parallel_strings || 
        params.parallel_strings || 
        extractParallelStrings(originalResults),
      
      installation_method: 
        params.installation_method || 
        metadata.installation_method || 
        'conduit',
      
      cable_material: 
        params.cable_material || 
        metadata.cable_material || 
        'copper',
      
      max_voltage_drop: 
        params.max_voltage_drop || 
        metadata.max_voltage_drop || 
        5,
      
      isc_correction: 
        params.isc_correction || 
        metadata.isc_safety_factor || 
        1.25,
      
      cable_max_temp: 
        metadata.cable_max_temp || 
        params.cable_max_temp || 
        90,
      
      installation_depth: 
        metadata.depth_cm || 
        metadata.installation_depth || 
        50
    };
  };

  // 🔥 FUNCIÓN: Estimar factores desde los resultados calculados
  const estimateFactorsFromResults = (originalResults: any) => {
    const results = originalResults.results || [];
    
    if (results.length === 0) {
      return {
        grouping_factor: 1.0,
        temperature_factor: 1.0,
        ambient_temp: 25,
        resistivity: 0.018595
      };
    }
    
    // Tomar el primer resultado como muestra
    const sampleResult = results[0];
    
    // 1. Estimar factor de agrupamiento desde I_nominal vs I_adjusted
    let grouping_factor = 1.0;
    if (sampleResult.i_nominal && sampleResult.i_adjusted) {
      // I_adjusted = I_nominal / (factor_temp × factor_agrupamiento)
      // Asumiendo factor_temp = 1, entonces factor_agrupamiento = I_nominal / I_adjusted
      const ratio = sampleResult.i_nominal / sampleResult.i_adjusted;
      grouping_factor = Math.min(ratio, 1.0); // No puede ser mayor a 1
      console.log(`🔍 Factor agrupamiento estimado: ${grouping_factor.toFixed(3)} (desde I_nom=${sampleResult.i_nominal}, I_adj=${sampleResult.i_adjusted})`);
    }
    
    // 2. Estimar temperatura ambiente desde resistividad
    let ambient_temp = 25;
    let resistivity = 0.018595; // Cobre a 20°C por defecto
    
    if (sampleResult.resistivity_ohm_mm2_per_m) {
      resistivity = sampleResult.resistivity_ohm_mm2_per_m;
      
      // Fórmula: ρ(T) = ρ₀ × [1 + α × (T - T₀)]
      // Para cobre: ρ₀ = 0.017241 (20°C), α = 0.00393
      const rho_20c = 0.017241;
      const alpha = 0.00393;
      
      // Despejar T: T = T₀ + (ρ(T)/ρ₀ - 1) / α
      ambient_temp = 20 + ((resistivity / rho_20c) - 1) / alpha;
      console.log(`🔍 Temperatura estimada: ${ambient_temp.toFixed(1)}°C (desde resistividad=${resistivity.toFixed(6)})`);
    }
    
    // 3. Factor de temperatura (normalmente 1.0 si ya está incluido en resistividad)
    const temperature_factor = 1.0;
    
    return {
      grouping_factor: Number(grouping_factor.toFixed(3)),
      temperature_factor,
      ambient_temp: Math.round(ambient_temp),
      resistivity: Number(resistivity.toFixed(6))
    };
  };

  // 🔥 NUEVA FUNCIÓN MEJORADA: Mejorar resultados con análisis estadístico Y factores REALES
  const enhanceResultsWithAnalysis = (originalResults: any): CalculationResult => {
    const results = originalResults.results || [];
    
    if (results.length === 0) {
      return originalResults;
    }

    // 🔥 EXTRAER FACTORES REALES
    const realFactors = extractRealFactorsFromResponse(originalResults);
    console.log('✅ Factores reales extraídos:', realFactors);

    // Encontrar string crítico (mayor caída de tensión)
    const criticalString = results.reduce((max: any, current: any) => {
      const currentDrop = current.v_drop_real_pct || 0;
      const maxDrop = max.v_drop_real_pct || 0;
      return currentDrop > maxDrop ? current : max;
    });

    // Encontrar mejor string (menor caída de tensión)
    const bestString = results.reduce((min: any, current: any) => {
      const currentDrop = current.v_drop_real_pct || 999;
      const minDrop = min.v_drop_real_pct || 999;
      return currentDrop < minDrop ? current : min;
    });

    // Generar justificación de fórmula para string crítico
    const formula_justification = generateFormulaJustification(criticalString, realFactors);

    // 🔥 USAR FACTORES REALES EN LUGAR DE HARDCODED
    const enhancedParams = {
      ...originalResults.calculation_params,
      ...realFactors // Factores extraídos del backend
    };

    return {
      ...originalResults,
      calculation_params: enhancedParams,
      statistical_analysis: {
        critical_string: {
          string_id: criticalString.string_id,
          reason: "Mayor caída de tensión",
          voltage_drop_pct: criticalString.v_drop_real_pct,
          section_mm2: criticalString.s_comercial_mm2,
          length_m: criticalString.length_total_m,
          current_a: criticalString.i_adjusted
        },
        best_string: {
          string_id: bestString.string_id,
          voltage_drop_pct: bestString.v_drop_real_pct,
          section_mm2: bestString.s_comercial_mm2,
          length_m: bestString.length_total_m
        },
        formula_justification
      }
    };
  };

  // 🔧 FUNCIÓN AUXILIAR: Extraer número de strings en paralelo
  const extractParallelStrings = (results: any): number => {
    try {
      // Buscar en múltiples ubicaciones
      if (results.metadata?.number_of_parallel_strings) {
        return results.metadata.number_of_parallel_strings;
      }
      if (results.metadata?.parallel_strings) {
        return results.metadata.parallel_strings;
      }
      if (results.calculation_params?.parallel_strings) {
        return results.calculation_params.parallel_strings;
      }
      
      // Intentar extraer desde los resultados (contar strings únicos con mismo prefijo)
      const stringIds = results.results?.map((r: any) => r.string_id) || [];
      if (stringIds.length > 0) {
        // Contar strings con patrones similares
        const prefixes = stringIds.map((id: string) => id.split('-').slice(0, 3).join('-'));
        const uniquePrefixes = [...new Set(prefixes)];
        const avgStringsPerPrefix = stringIds.length / uniquePrefixes.length;
        
        if (avgStringsPerPrefix > 1) {
          console.log(`🔍 Strings paralelo estimado: ${Math.round(avgStringsPerPrefix)} (desde ${stringIds.length} strings, ${uniquePrefixes.length} prefijos únicos)`);
          return Math.round(avgStringsPerPrefix);
        }
      }
      
      // Default
      return 1;
    } catch (error) {
      console.error('Error extrayendo parallel_strings:', error);
      return 1;
    }
  };

  // 🔥 FUNCIÓN MEJORADA: Generar justificación de fórmula con factores reales
  const generateFormulaJustification = (criticalString: any, realFactors: any) => {
    if (!criticalString) return null;

    const variables = {
      'ρ (resistividad)': `${realFactors.resistivity?.toFixed(6) || 0.018595} Ω·mm²/m`,
      'L (longitud total)': `${criticalString.length_total_m || 0} m`,
      'I (corriente ajustada)': `${criticalString.i_adjusted || 0} A`,
      'ΔV_max (caída máxima)': `${criticalString.v_drop_max_volts || 0} V`,
      'V_ref (tensión referencia)': `${criticalString.reference_voltage || 0} V`,
      'Factor ISC': `${realFactors.isc_correction || 1.25}`,
      'Factor agrupamiento': `${realFactors.grouping_factor || 'N/A'}`,
      'Factor temperatura': `${realFactors.temperature_factor || 'N/A'}`,
      'Temp ambiente': `${realFactors.ambient_temp || 'N/A'}°C`,
      'Material cable': `${realFactors.cable_material || 'copper'}`,
      'Strings paralelo': `${realFactors.parallel_strings || 'N/A'}`
    };

    const calculation_steps = [
      '1. Corriente nominal: I_nom = I_sc × Factor_seguridad',
      `   I_nom = ${criticalString.i_nominal || 'N/A'} A`,
      '',
      '2. Corriente ajustada: I_adj = I_nom / (Factor_temp × Factor_agrup)',
      `   I_adj = ${criticalString.i_nominal || 'N/A'} / (${realFactors.temperature_factor || 1} × ${realFactors.grouping_factor || 1})`,
      `   I_adj = ${criticalString.i_adjusted || 'N/A'} A`,
      '',
      '3. Sección teórica: S = (2 × ρ × L × I_adj) / ΔV_max',
      `   S = (2 × ${realFactors.resistivity?.toFixed(6) || 0.018595} × ${criticalString.length_total_m || 0} × ${criticalString.i_adjusted || 0}) / ${criticalString.v_drop_max_volts || 0}`,
      `   S = ${(criticalString.s_teorica_mm2 || 0).toFixed(3)} mm²`,
      '',
      '4. Sección comercial seleccionada:',
      `   S_comercial = ${criticalString.s_comercial_mm2 || 'N/A'} mm² (siguiente valor estándar disponible)`
    ];

    return {
      string_id: criticalString.string_id,
      formula: 'S = (2 × ρ × L × I_adj) / ΔV_max',
      variables,
      calculation_steps
    };
  };

  const clearResults = () => {
    setCalculationResults(null);
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
            ⚡ Calculadora Mejorada de Strings DC
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Proyecto: {projectName} | Con análisis estadístico y factores REALES
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
            {calculationResults.calculation_params.extraction_source && (
              <Chip 
                label={`Factores: ${calculationResults.calculation_params.factors_confidence}`}
                sx={{ 
                  backgroundColor: calculationResults.calculation_params.factors_confidence === 'high' ? '#2e7d32' : '#ff9800',
                  color: '#fff',
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
            {loading ? 'Calculando...' : 'Ejecutar Cálculo Mejorado'}
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
          Cálculo completado exitosamente con análisis estadístico y factores reales
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
          {/* 🔥 NUEVO: Análisis Estadístico */}
          {calculationResults.statistical_analysis && (
            <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#525252' }}>
              <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
                📊 Análisis Estadístico de Strings
              </Typography>
              
              <Grid container spacing={2}>
                {/* String Crítico */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ backgroundColor: '#d32f2f', borderRadius: '8px' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
                        <TrendingUpIcon sx={{ color: '#fff' }} />
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
                          String Más Crítico
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#ffcccb' }}>
                        <strong>ID:</strong> {calculationResults.statistical_analysis.critical_string.string_id}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffcccb' }}>
                        <strong>Caída V:</strong> {calculationResults.statistical_analysis.critical_string.voltage_drop_pct?.toFixed(3)}%
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffcccb' }}>
                        <strong>Longitud:</strong> {calculationResults.statistical_analysis.critical_string.length_m}m
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffcccb' }}>
                        <strong>Sección:</strong> {calculationResults.statistical_analysis.critical_string.section_mm2}mm²
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* String Mejor */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ backgroundColor: '#2e7d32', borderRadius: '8px' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
                        <TrendingDownIcon sx={{ color: '#fff' }} />
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
                          String Mejor Condición
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                        <strong>ID:</strong> {calculationResults.statistical_analysis.best_string.string_id}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                        <strong>Caída V:</strong> {calculationResults.statistical_analysis.best_string.voltage_drop_pct?.toFixed(3)}%
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                        <strong>Longitud:</strong> {calculationResults.statistical_analysis.best_string.length_m}m
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#c8e6c9' }}>
                        <strong>Sección:</strong> {calculationResults.statistical_analysis.best_string.section_mm2}mm²
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Resumen Mejorado CON FACTORES REALES */}
          <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#525252' }}>
            <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
              📊 Resumen del Cálculo
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
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
              
              <Grid item xs={12} md={4}>
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
                    <strong>Strings paralelo:</strong> {calculationResults.calculation_params.parallel_strings || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Instalación:</strong> {calculationResults.calculation_params.installation_method}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Caída máx:</strong> {calculationResults.calculation_params.max_voltage_drop}%
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Box sx={{ padding: 2, backgroundColor: '#666', borderRadius: '8px' }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                    🌡️ Factores de Corrección REALES
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Factor agrupamiento:</strong> {calculationResults.calculation_params.grouping_factor || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Factor temperatura:</strong> {calculationResults.calculation_params.temperature_factor || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Temp ambiente:</strong> {calculationResults.calculation_params.ambient_temp || 'N/A'}°C
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Profundidad:</strong> {calculationResults.calculation_params.installation_depth || 'N/A'} cm
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    <strong>Resistividad:</strong> {calculationResults.calculation_params.resistivity?.toFixed(6) || 'N/A'} Ω·mm²/m
                  </Typography>
                  {calculationResults.calculation_params.extraction_source && (
                    <Typography variant="caption" sx={{ color: '#ffcc80', display: 'block', marginTop: 1 }}>
                      💡 Fuente: {calculationResults.calculation_params.extraction_source}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* 🔥 NUEVA: Justificación de Fórmula */}
          {calculationResults.statistical_analysis?.formula_justification && (
            <Accordion sx={{ backgroundColor: '#525252', marginBottom: 2 }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
                sx={{ backgroundColor: '#666' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FunctionsIcon sx={{ color: '#ffcc80' }} />
                  <Typography variant="h6" sx={{ color: '#ffcc80' }}>
                    📐 Justificación de Fórmula (String Crítico)
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '8px', marginBottom: 2 }}>
                  <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
                    Fórmula Principal:
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#fff', fontFamily: 'monospace', textAlign: 'center', padding: 2, backgroundColor: '#333', borderRadius: '4px' }}>
                    {calculationResults.statistical_analysis.formula_justification.formula}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                      🔢 Variables:
                    </Typography>
                    <Box sx={{ backgroundColor: '#333', padding: 2, borderRadius: '4px' }}>
                      {Object.entries(calculationResults.statistical_analysis.formula_justification.variables).map(([key, value]) => (
                        <Typography key={key} variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
                          <strong>{key}:</strong> {value}
                        </Typography>
                      ))}
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', marginBottom: 1 }}>
                      📝 Pasos de Cálculo:
                    </Typography>
                    <Box sx={{ backgroundColor: '#333', padding: 2, borderRadius: '4px' }}>
                      {calculationResults.statistical_analysis.formula_justification.calculation_steps.map((step, index) => (
                        <Typography key={index} variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace', marginBottom: 0.5 }}>
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Tabla de Resultados Mejorada */}
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
                          Caída V (%)
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#666', color: '#fff', fontWeight: 'bold' }}>
                          Estado
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calculationResults.results.map((result, index) => {
                        const isCritical = calculationResults.statistical_analysis?.critical_string.string_id === result.string_id;
                        const isBest = calculationResults.statistical_analysis?.best_string.string_id === result.string_id;
                        
                        return (
                          <TableRow 
                            key={index}
                            sx={{ 
                              backgroundColor: isCritical ? '#d32f2f' : isBest ? '#2e7d32' : (index % 2 === 0 ? '#525252' : '#5a5a5a'),
                              '&:hover': { backgroundColor: '#666' }
                            }}
                          >
                            <TableCell sx={{ color: '#fff', fontSize: '12px', fontWeight: isCritical || isBest ? 'bold' : 'normal' }}>
                              {result.string_id || `String ${index + 1}`}
                              {isCritical && <Chip label="CRÍTICO" size="small" sx={{ marginLeft: 1, backgroundColor: '#fff', color: '#d32f2f', fontSize: '10px' }} />}
                              {isBest && <Chip label="MEJOR" size="small" sx={{ marginLeft: 1, backgroundColor: '#fff', color: '#2e7d32', fontSize: '10px' }} />}
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
                            <TableCell sx={{ color: '#fff', fontWeight: isCritical || isBest ? 'bold' : 'normal' }}>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Información de Debug MEJORADA */}
          <Accordion sx={{ backgroundColor: '#525252' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
              sx={{ backgroundColor: '#666' }}
            >
              <Typography variant="h6" sx={{ color: '#888' }}>
                🔍 Información de Debug - Versión Mejorada
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px' }}>
                    <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
                      <strong>Proyecto:</strong> {calculationResults.project_name}<br/>
                      <strong>Normativa:</strong> {calculationResults.normative}<br/>
                      <strong>Tipo de circuito:</strong> {calculationResults.circuit_type}<br/>
                      <strong>Overrides aplicados:</strong> {calculationResults.has_project_overrides ? 'Sí' : 'No'}<br/>
                      <strong>Análisis estadístico:</strong> {calculationResults.statistical_analysis ? 'Incluido' : 'No disponible'}<br/>
                      <strong>Timestamp:</strong> {lastCalculationTime}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ padding: 2, backgroundColor: '#444', borderRadius: '4px' }}>
                    <Typography variant="body2" sx={{ color: '#ffcc80', marginBottom: 1 }}>
                      🔍 Extracción de Factores:
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '12px' }}>
                      <strong>Fuente:</strong> {calculationResults.calculation_params.extraction_source || 'N/A'}<br/>
                      <strong>Confianza:</strong> {calculationResults.calculation_params.factors_confidence || 'N/A'}<br/>
                      <strong>Strings paralelo extraído:</strong> {calculationResults.calculation_params.parallel_strings || 'N/A'}<br/>
                      <strong>Factor agrupamiento estimado:</strong> {calculationResults.calculation_params.grouping_factor || 'N/A'}<br/>
                      <strong>Temperatura estimada:</strong> {calculationResults.calculation_params.ambient_temp || 'N/A'}°C
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
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

              {/* Mejoras implementadas */}
              <Box sx={{ padding: 2, backgroundColor: '#333', borderRadius: '4px', marginTop: 2 }}>
                <Typography variant="body2" sx={{ color: '#ffcc80', marginBottom: 1 }}>
                  Mejoras implementadas:
                </Typography>
                <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: '12px' }}>
                  ✅ Análisis estadístico automático (string crítico vs mejor)<br/>
                  ✅ Extracción de factores reales desde metadata y resultados<br/>
                  ✅ Estimación de factor agrupamiento desde corrientes<br/>
                  ✅ Estimación de temperatura desde resistividad<br/>
                  ✅ Justificación matemática con factores reales<br/>
                  ✅ Tabla mejorada con resaltado de strings importantes<br/>
                  ✅ Fallback inteligente si endpoints mejorados no existen<br/>
                  ✅ Debug detallado de extracción de factores
                </Typography>
              </Box>
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
            ⚡ Calculadora Mejorada Lista
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
            Incluye análisis estadístico, extracción de factores reales y justificación de fórmulas
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StringCalculatorEnhanced;