import React, { useState } from 'react';
import { 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Calculator, 
  RotateCcw, 
  ChevronDown, 
  Edit3, 
  Save, 
  XCircle, 
  Info,
  TrendingUp,
  TrendingDown,
  Play,
  RefreshCw
} from 'lucide-react';

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
    parallel_strings?: number;
    grouping_factor?: number;
    temperature_factor?: number;
    ambient_temp?: number;
    installation_depth?: number;
    cable_max_temp?: number;
    resistivity?: number;
    extraction_source?: string;
    factors_confidence?: string;
  };
  results: any[];
  summary: {
    total_circuits: number;
    successful_calculations: number;
    errors: number;
  };
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

// Componente CriticalStringValidator integrado
interface CriticalStringValidatorProps {
  criticalStringData: {
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
  };
  calculationParams: {
    isc_correction: number;
    parallel_strings: number;
    grouping_factor: number;
    temperature_factor: number;
    ambient_temp: number;
    cable_max_temp: number;
    resistivity: number;
    max_voltage_drop: number;
  };
  onValidationComplete?: (isValid: boolean, comments: string) => void;
}

const CriticalStringValidator: React.FC<CriticalStringValidatorProps> = ({
  criticalStringData,
  calculationParams,
  onValidationComplete
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedParams, setEditedParams] = useState(calculationParams);
  const [recalculatedResults, setRecalculatedResults] = useState<any>(null);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'valid' | 'invalid'>('pending');
  const [userComments, setUserComments] = useState('');
  const [showFormulas, setShowFormulas] = useState(true);

  const recalculateWithNewParams = () => {
    console.log('🔄 Recalculando con nuevos parámetros:', editedParams);
    
    const i_adjusted_new = criticalStringData.i_nominal / (editedParams.temperature_factor * editedParams.grouping_factor);
    const s_teorica_new = (2 * editedParams.resistivity * criticalStringData.length_total_m * i_adjusted_new) / criticalStringData.v_drop_max_volts;
    const resistance_new = (editedParams.resistivity * criticalStringData.length_total_m) / criticalStringData.s_comercial_mm2;
    const v_drop_real_volts_new = resistance_new * i_adjusted_new;
    const v_drop_real_pct_new = (v_drop_real_volts_new / criticalStringData.reference_voltage) * 100;
    const exceeds_limit = v_drop_real_pct_new > editedParams.max_voltage_drop;
    
    const newResults = {
      i_adjusted: i_adjusted_new,
      s_teorica_mm2: s_teorica_new,
      resistance_total_ohm: resistance_new,
      v_drop_real_volts: v_drop_real_volts_new,
      v_drop_real_pct: v_drop_real_pct_new,
      exceeds_limit,
      calculation_valid: !exceeds_limit,
      differences: {
        i_adjusted_diff: i_adjusted_new - criticalStringData.i_adjusted,
        s_teorica_diff: s_teorica_new - criticalStringData.s_teorica_mm2,
        v_drop_pct_diff: v_drop_real_pct_new - criticalStringData.v_drop_real_pct
      }
    };
    
    setRecalculatedResults(newResults);
  };

  const saveChanges = () => {
    recalculateWithNewParams();
    setEditMode(false);
  };

  const cancelChanges = () => {
    setEditedParams(calculationParams);
    setRecalculatedResults(null);
    setEditMode(false);
  };

  const validateCalculations = (isValid: boolean) => {
    setValidationStatus(isValid ? 'valid' : 'invalid');
    onValidationComplete?.(isValid, userComments);
  };

  const getStatusColor = (value: number, limit: number, reverse: boolean = false) => {
    if (reverse) {
      return value <= limit ? 'text-green-400' : value <= limit * 1.1 ? 'text-yellow-400' : 'text-red-400';
    }
    return value >= limit ? 'text-green-400' : value >= limit * 0.9 ? 'text-yellow-400' : 'text-red-400';
  };

  const currentResults = recalculatedResults || {
    i_adjusted: criticalStringData.i_adjusted,
    s_teorica_mm2: criticalStringData.s_teorica_mm2,
    resistance_total_ohm: criticalStringData.resistance_total_ohm,
    v_drop_real_volts: criticalStringData.v_drop_real_volts,
    v_drop_real_pct: criticalStringData.v_drop_real_pct,
    exceeds_limit: criticalStringData.v_drop_real_pct > calculationParams.max_voltage_drop,
    calculation_valid: criticalStringData.v_drop_real_pct <= calculationParams.max_voltage_drop
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-600 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            🔍 Validación del String Crítico
          </h2>
          <p className="text-gray-400 text-sm">
            String ID: {criticalStringData.string_id} | Revisión paso a paso de cálculos
          </p>
        </div>
        
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                onClick={saveChanges}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={cancelChanges}
                className="border border-gray-600 hover:border-gray-500 px-4 py-2 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-gray-900 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Editar Parámetros
            </button>
          )}
        </div>
      </div>

      {/* Estado del String */}
      <div className={`p-4 rounded-lg mb-6 ${currentResults.calculation_valid ? 'bg-green-600' : 'bg-red-600'}`}>
        <div className="text-white font-bold">
          {currentResults.calculation_valid 
            ? `✅ String VÁLIDO: Caída de tensión ${currentResults.v_drop_real_pct.toFixed(3)}% ≤ ${calculationParams.max_voltage_drop}%`
            : `❌ String EXCEDE LÍMITE: Caída de tensión ${currentResults.v_drop_real_pct.toFixed(3)}% > ${calculationParams.max_voltage_drop}%`
          }
        </div>
        {recalculatedResults && (
          <div className="text-white text-sm mt-1">
            📊 Cambio desde cálculo original: {recalculatedResults.differences?.v_drop_pct_diff > 0 ? '+' : ''}{recalculatedResults.differences?.v_drop_pct_diff.toFixed(3)}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parámetros de Entrada */}
        <div className="bg-gray-700 rounded-lg p-4 h-fit">
          <h3 className="text-orange-300 text-lg font-semibold mb-4">📋 Parámetros de Entrada</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Factor ISC</label>
              <input
                type="number"
                value={editMode ? editedParams.isc_correction : calculationParams.isc_correction}
                onChange={(e) => editMode && setEditedParams({...editedParams, isc_correction: Number(e.target.value)})}
                disabled={!editMode}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white disabled:opacity-50"
                step="0.01"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Factor Agrupamiento</label>
              <input
                type="number"
                value={editMode ? editedParams.grouping_factor : calculationParams.grouping_factor}
                onChange={(e) => editMode && setEditedParams({...editedParams, grouping_factor: Number(e.target.value)})}
                disabled={!editMode}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white disabled:opacity-50"
                step="0.01"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Factor Temperatura</label>
              <input
                type="number"
                value={editMode ? editedParams.temperature_factor : calculationParams.temperature_factor}
                onChange={(e) => editMode && setEditedParams({...editedParams, temperature_factor: Number(e.target.value)})}
                disabled={!editMode}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white disabled:opacity-50"
                step="0.01"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Resistividad (Ω·mm²/m)</label>
              <input
                type="number"
                value={editMode ? editedParams.resistivity : calculationParams.resistivity}
                onChange={(e) => editMode && setEditedParams({...editedParams, resistivity: Number(e.target.value)})}
                disabled={!editMode}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white disabled:opacity-50"
                step="0.000001"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Caída Máxima Permitida (%)</label>
              <input
                type="number"
                value={editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop}
                onChange={(e) => editMode && setEditedParams({...editedParams, max_voltage_drop: Number(e.target.value)})}
                disabled={!editMode}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white disabled:opacity-50"
                step="0.1"
              />
            </div>
          </div>
          
          {editMode && (
            <button
              onClick={recalculateWithNewParams}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Recalcular
            </button>
          )}
        </div>

        {/* Datos del String */}
        <div className="bg-gray-700 rounded-lg p-4 h-fit">
          <h3 className="text-orange-300 text-lg font-semibold mb-4">🔌 Datos del String</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-600 pb-2">
              <span className="text-gray-300">Corriente Nominal (A)</span>
              <span className="text-white font-bold">{criticalStringData.i_nominal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-600 pb-2">
              <span className="text-gray-300">Longitud Total (m)</span>
              <span className="text-white font-bold">{criticalStringData.length_total_m}</span>
            </div>
            <div className="flex justify-between border-b border-gray-600 pb-2">
              <span className="text-gray-300">Sección Comercial (mm²)</span>
              <span className="text-white font-bold">{criticalStringData.s_comercial_mm2}</span>
            </div>
            <div className="flex justify-between border-b border-gray-600 pb-2">
              <span className="text-gray-300">Tensión Referencia (V)</span>
              <span className="text-white font-bold">{criticalStringData.reference_voltage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Material Cable</span>
              <span className="text-white font-bold">{criticalStringData.cable_material}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fórmulas y Cálculos Paso a Paso */}
      <div className="bg-gray-700 rounded-lg mt-6">
        <button
          onClick={() => setShowFormulas(!showFormulas)}
          className="w-full flex items-center justify-between p-4 bg-gray-600 rounded-t-lg hover:bg-gray-500 transition-colors"
        >
          <span className="text-orange-300 text-lg font-semibold">📐 Cálculos Paso a Paso</span>
          <ChevronDown className={`w-5 h-5 text-white transition-transform ${showFormulas ? 'rotate-180' : ''}`} />
        </button>
        
        {showFormulas && (
          <div className="p-4 space-y-6">
            {/* Paso 1: Corriente Ajustada */}
            <div className="bg-gray-600 rounded-lg p-4">
              <h4 className="text-orange-300 text-lg font-semibold mb-3">Paso 1: Corriente Ajustada</h4>
              
              <div className="bg-gray-800 p-3 rounded mb-3 text-center">
                <div className="text-white font-mono text-lg">
                  I_ajustada = I_nominal / (Factor_temp × Factor_agrup)
                </div>
              </div>
              
              <div className="text-gray-300 mb-2">
                I_ajustada = {criticalStringData.i_nominal} / ({editMode ? editedParams.temperature_factor : calculationParams.temperature_factor} × {editMode ? editedParams.grouping_factor : calculationParams.grouping_factor})
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-white text-lg font-bold">
                  I_ajustada = {currentResults.i_adjusted.toFixed(2)} A
                </div>
                
                {recalculatedResults?.differences?.i_adjusted_diff && (
                  <span className={`px-2 py-1 rounded text-sm ${
                    Math.abs(recalculatedResults.differences.i_adjusted_diff) > 0.1 ? 'bg-yellow-600' : 'bg-green-600'
                  } text-white`}>
                    Cambio: {recalculatedResults.differences.i_adjusted_diff > 0 ? '+' : ''}{recalculatedResults.differences.i_adjusted_diff.toFixed(3)} A
                  </span>
                )}
              </div>
            </div>

            {/* Paso 2: Sección Teórica */}
            <div className="bg-gray-600 rounded-lg p-4">
              <h4 className="text-orange-300 text-lg font-semibold mb-3">Paso 2: Sección Teórica Mínima</h4>
              
              <div className="bg-gray-800 p-3 rounded mb-3 text-center">
                <div className="text-white font-mono text-lg">
                  S = (2 × ρ × L × I_ajustada) / ΔV_max
                </div>
              </div>
              
              <div className="text-gray-300 mb-2">
                S = (2 × {(editMode ? editedParams.resistivity : calculationParams.resistivity).toFixed(6)} × {criticalStringData.length_total_m} × {currentResults.i_adjusted.toFixed(2)}) / {criticalStringData.v_drop_max_volts}
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-white text-lg font-bold">
                  S = {currentResults.s_teorica_mm2.toFixed(3)} mm²
                </div>
                
                <div className={`text-sm font-bold ${
                  currentResults.s_teorica_mm2 <= criticalStringData.s_comercial_mm2 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currentResults.s_teorica_mm2 <= criticalStringData.s_comercial_mm2 
                    ? '✅ Sección comercial suficiente' 
                    : '❌ Sección comercial insuficiente'
                  }
                </div>
                
                {recalculatedResults?.differences?.s_teorica_diff && (
                  <span className={`px-2 py-1 rounded text-sm ${
                    Math.abs(recalculatedResults.differences.s_teorica_diff) > 0.5 ? 'bg-yellow-600' : 'bg-green-600'
                  } text-white`}>
                    Cambio: {recalculatedResults.differences.s_teorica_diff > 0 ? '+' : ''}{recalculatedResults.differences.s_teorica_diff.toFixed(3)} mm²
                  </span>
                )}
              </div>
            </div>

            {/* Paso 3: Caída de Tensión Real */}
            <div className="bg-gray-600 rounded-lg p-4">
              <h4 className="text-orange-300 text-lg font-semibold mb-3">Paso 3: Caída de Tensión Real</h4>
              
              <div className="bg-gray-800 p-3 rounded mb-3 text-center">
                <div className="text-white font-mono text-lg">
                  ΔV = R × I = (ρ × L / S_comercial) × I_ajustada
                </div>
              </div>
              
              <div className="text-gray-300 mb-2">
                R = ({(editMode ? editedParams.resistivity : calculationParams.resistivity).toFixed(6)} × {criticalStringData.length_total_m}) / {criticalStringData.s_comercial_mm2} = {currentResults.resistance_total_ohm.toFixed(4)} Ω
              </div>
              
              <div className="text-gray-300 mb-3">
                ΔV = {currentResults.resistance_total_ohm.toFixed(4)} × {currentResults.i_adjusted.toFixed(2)} = {currentResults.v_drop_real_volts.toFixed(2)} V
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className={`text-lg font-bold ${
                  getStatusColor(currentResults.v_drop_real_pct, editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop, true)
                }`}>
                  ΔV% = {currentResults.v_drop_real_pct.toFixed(3)}%
                </div>
                
                <div className={`text-sm font-bold ${
                  currentResults.v_drop_real_pct <= (editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop) 
                    ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currentResults.v_drop_real_pct <= (editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop)
                    ? `✅ Dentro del límite (≤ ${editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop}%)`
                    : `❌ Excede límite (> ${editMode ? editedParams.max_voltage_drop : calculationParams.max_voltage_drop}%)`
                  }
                </div>
                
                {recalculatedResults?.differences?.v_drop_pct_diff && (
                  <span className={`px-2 py-1 rounded text-sm ${
                    Math.abs(recalculatedResults.differences.v_drop_pct_diff) > 0.1 ? 'bg-yellow-600' : 'bg-green-600'
                  } text-white`}>
                    Cambio: {recalculatedResults.differences.v_drop_pct_diff > 0 ? '+' : ''}{recalculatedResults.differences.v_drop_pct_diff.toFixed(3)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validación por Usuario */}
      <div className="bg-gray-700 rounded-lg p-4 mt-6">
        <h3 className="text-orange-300 text-lg font-semibold mb-4">✅ Validación por Usuario</h3>
        
        <textarea
          value={userComments}
          onChange={(e) => setUserComments(e.target.value)}
          className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white resize-none h-24 mb-4"
          placeholder="Ingresa tus observaciones sobre los cálculos..."
        />
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => validateCalculations(true)}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Validar como Correcto
          </button>
          
          <button
            onClick={() => validateCalculations(false)}
            className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
          >
            <X className="w-4 h-4" />
            Marcar como Incorrecto
          </button>
        </div>
        
        {validationStatus !== 'pending' && (
          <div className={`mt-4 p-4 rounded-lg ${
            validationStatus === 'valid' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            <div className="text-white">
              {validationStatus === 'valid' 
                ? '✅ Cálculos validados como correctos por el usuario'
                : '❌ Cálculos marcados como incorrectos por el usuario'
              }
            </div>
            {userComments && (
              <div className="text-white text-sm mt-2">
                Comentarios: {userComments}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente principal StringCalculatorEnhanced
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
      
      const enhancedEndpoint = selectedNormative === 'IEC' 
        ? `http://localhost:8000/calculations/calculate-iec-strings-enhanced/${projectName}`
        : `http://localhost:8000/calculations/calculate-nec-strings-enhanced/${projectName}`;
      
      console.log(`📡 Intentando endpoint mejorado: ${enhancedEndpoint}`);
      
      let response = await fetch(enhancedEndpoint);
      
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

  const extractRealFactorsFromResponse = (originalResults: any) => {
    console.log('🔍 Extrayendo factores reales desde respuesta del backend...');
    
    if (originalResults.factors_debug) {
      console.log('✅ Usando factors_debug del backend');
      return {
        ...originalResults.factors_debug,
        extraction_source: 'backend_factors_debug',
        factors_confidence: 'high'
      };
    }
    
    const factors = extractFactorsFromMetadata(originalResults);
    const estimatedFactors = estimateFactorsFromResults(originalResults);
    
    return {
      ...factors,
      ...estimatedFactors,
      extraction_source: 'metadata_and_estimation',
      factors_confidence: 'medium'
    };
  };

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
    
    const sampleResult = results[0];
    
    let grouping_factor = 1.0;
    if (sampleResult.i_nominal && sampleResult.i_adjusted) {
      const ratio = sampleResult.i_nominal / sampleResult.i_adjusted;
      grouping_factor = Math.min(ratio, 1.0);
      console.log(`🔍 Factor agrupamiento estimado: ${grouping_factor.toFixed(3)} (desde I_nom=${sampleResult.i_nominal}, I_adj=${sampleResult.i_adjusted})`);
    }
    
    let ambient_temp = 25;
    let resistivity = 0.018595;
    
    if (sampleResult.resistivity_ohm_mm2_per_m) {
      resistivity = sampleResult.resistivity_ohm_mm2_per_m;
      
      const rho_20c = 0.017241;
      const alpha = 0.00393;
      
      ambient_temp = 20 + ((resistivity / rho_20c) - 1) / alpha;
      console.log(`🔍 Temperatura estimada: ${ambient_temp.toFixed(1)}°C (desde resistividad=${resistivity.toFixed(6)})`);
    }
    
    const temperature_factor = 1.0;
    
    return {
      grouping_factor: Number(grouping_factor.toFixed(3)),
      temperature_factor,
      ambient_temp: Math.round(ambient_temp),
      resistivity: Number(resistivity.toFixed(6))
    };
  };

  const enhanceResultsWithAnalysis = (originalResults: any): CalculationResult => {
    const results = originalResults.results || [];
    
    if (results.length === 0) {
      return originalResults;
    }

    const realFactors = extractRealFactorsFromResponse(originalResults);
    console.log('✅ Factores reales extraídos:', realFactors);

    const criticalString = results.reduce((max: any, current: any) => {
      const currentDrop = current.v_drop_real_pct || 0;
      const maxDrop = max.v_drop_real_pct || 0;
      return currentDrop > maxDrop ? current : max;
    });

    const bestString = results.reduce((min: any, current: any) => {
      const currentDrop = current.v_drop_real_pct || 999;
      const minDrop = min.v_drop_real_pct || 999;
      return currentDrop < minDrop ? current : min;
    });

    const formula_justification = generateFormulaJustification(criticalString, realFactors);

    const enhancedParams = {
      ...originalResults.calculation_params,
      ...realFactors
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

  const extractParallelStrings = (results: any): number => {
    try {
      if (results.metadata?.number_of_parallel_strings) {
        return results.metadata.number_of_parallel_strings;
      }
      if (results.metadata?.parallel_strings) {
        return results.metadata.parallel_strings;
      }
      if (results.calculation_params?.parallel_strings) {
        return results.calculation_params.parallel_strings;
      }
      
      const stringIds = results.results?.map((r: any) => r.string_id) || [];
      if (stringIds.length > 0) {
        const prefixes = stringIds.map((id: string) => id.split('-').slice(0, 3).join('-'));
        const uniquePrefixes = [...new Set(prefixes)];
        const avgStringsPerPrefix = stringIds.length / uniquePrefixes.length;
        
        if (avgStringsPerPrefix > 1) {
          console.log(`🔍 Strings paralelo estimado: ${Math.round(avgStringsPerPrefix)} (desde ${stringIds.length} strings, ${uniquePrefixes.length} prefijos únicos)`);
          return Math.round(avgStringsPerPrefix);
        }
      }
      
      return 1;
    } catch (error) {
      console.error('Error extrayendo parallel_strings:', error);
      return 1;
    }
  };

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

  // Función para obtener datos del string crítico para el validador
  const getCriticalStringData = () => {
    if (!calculationResults?.statistical_analysis) return null;
    
    const criticalStringId = calculationResults.statistical_analysis.critical_string.string_id;
    const criticalResult = calculationResults.results.find(r => r.string_id === criticalStringId);
    
    if (!criticalResult) return null;
    
    return {
      string_id: criticalResult.string_id,
      i_nominal: criticalResult.i_nominal || 0,
      i_adjusted: criticalResult.i_adjusted || 0,
      length_total_m: criticalResult.length_total_m || 0,
      s_teorica_mm2: criticalResult.s_teorica_mm2 || 0,
      s_comercial_mm2: criticalResult.s_comercial_mm2 || 0,
      v_drop_real_pct: criticalResult.v_drop_real_pct || 0,
      v_drop_real_volts: criticalResult.v_drop_real_volts || 0,
      v_drop_max_volts: criticalResult.v_drop_max_volts || 0,
      resistance_total_ohm: criticalResult.resistance_total_ohm || 0,
      resistivity_ohm_mm2_per_m: criticalResult.resistivity_ohm_mm2_per_m || 0,
      reference_voltage: criticalResult.reference_voltage || 0,
      cable_material: criticalResult.cable_material || 'copper'
    };
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-600">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            ⚡ Calculadora Mejorada de Strings DC
          </h2>
          <p className="text-gray-400 text-sm">
            Proyecto: {projectName} | Con análisis estadístico y factores REALES
          </p>
        </div>
        
        {calculationResults && (
          <div className="flex items-center gap-2">
            {calculationResults.has_project_overrides && (
              <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded font-bold">
                Config Personalizada
              </span>
            )}
            {calculationResults.calculation_params.extraction_source && (
              <span className={`px-2 py-1 text-white text-xs rounded font-bold ${
                calculationResults.calculation_params.factors_confidence === 'high' ? 'bg-green-600' : 'bg-orange-600'
              }`}>
                Factores: {calculationResults.calculation_params.factors_confidence}
              </span>
            )}
            <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded font-bold">
              {calculationResults.normative}
            </span>
          </div>
        )}
      </div>

      {/* Controles de Cálculo */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <h3 className="text-white text-lg font-semibold mb-4">🎛️ Controles de Cálculo</h3>
        
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex flex-col">
            <label className="text-gray-300 text-sm mb-1">Normativa</label>
            <select
              value={selectedNormative}
              onChange={(e) => setSelectedNormative(e.target.value as 'IEC' | 'NEC')}
              className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white min-w-[150px]"
            >
              {normatives.map((norm) => (
                <option key={norm.value} value={norm.value}>
                  {norm.label} - {norm.description}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={executeCalculation}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {loading ? 'Calculando...' : 'Ejecutar Cálculo Mejorado'}
          </button>

          {calculationResults && (
            <button
              onClick={clearResults}
              disabled={loading}
              className="border border-gray-600 hover:border-gray-500 px-4 py-2 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              Limpiar Resultados
            </button>
          )}

          {lastCalculationTime && (
            <span className="text-gray-400 text-sm ml-auto">
              Último cálculo: {lastCalculationTime}
            </span>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {calculationStatus === 'success' && (
        <div className="bg-green-600 p-4 rounded-lg mb-4 text-white">
          <CheckCircle className="w-5 h-5 inline mr-2" />
          Cálculo completado exitosamente con análisis estadístico y factores reales
        </div>
      )}
      
      {calculationStatus === 'error' && (
        <div className="bg-red-600 p-4 rounded-lg mb-4 text-white">
          <X className="w-5 h-5 inline mr-2" />
          Error en el cálculo. Revisa la configuración del proyecto.
        </div>
      )}

      {/* Resultados del Cálculo */}
      {calculationResults && (
        <div className="space-y-6">
          {/* Análisis Estadístico */}
          {calculationResults.statistical_analysis && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-orange-300 text-lg font-semibold mb-4">📊 Análisis Estadístico de Strings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* String Crítico */}
                <div className="bg-red-600 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-white" />
                    <h4 className="text-white font-bold">String Más Crítico</h4>
                  </div>
                  <div className="space-y-1 text-red-100">
                    <div><strong>ID:</strong> {calculationResults.statistical_analysis.critical_string.string_id}</div>
                    <div><strong>Caída V:</strong> {calculationResults.statistical_analysis.critical_string.voltage_drop_pct?.toFixed(3)}%</div>
                    <div><strong>Longitud:</strong> {calculationResults.statistical_analysis.critical_string.length_m}m</div>
                    <div><strong>Sección:</strong> {calculationResults.statistical_analysis.critical_string.section_mm2}mm²</div>
                  </div>
                </div>

                {/* String Mejor */}
                <div className="bg-green-600 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-white" />
                    <h4 className="text-white font-bold">String Mejor Condición</h4>
                  </div>
                  <div className="space-y-1 text-green-100">
                    <div><strong>ID:</strong> {calculationResults.statistical_analysis.best_string.string_id}</div>
                    <div><strong>Caída V:</strong> {calculationResults.statistical_analysis.best_string.voltage_drop_pct?.toFixed(3)}%</div>
                    <div><strong>Longitud:</strong> {calculationResults.statistical_analysis.best_string.length_m}m</div>
                    <div><strong>Sección:</strong> {calculationResults.statistical_analysis.best_string.section_mm2}mm²</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validador del String Crítico */}
          {calculationResults.statistical_analysis && getCriticalStringData() && (
            <CriticalStringValidator
              criticalStringData={getCriticalStringData()!}
              calculationParams={{
                isc_correction: calculationResults.calculation_params.isc_correction,
                parallel_strings: calculationResults.calculation_params.parallel_strings || 1,
                grouping_factor: calculationResults.calculation_params.grouping_factor || 1,
                temperature_factor: calculationResults.calculation_params.temperature_factor || 1,
                ambient_temp: calculationResults.calculation_params.ambient_temp || 25,
                cable_max_temp: calculationResults.calculation_params.cable_max_temp || 90,
                resistivity: calculationResults.calculation_params.resistivity || 0.018595,
                max_voltage_drop: calculationResults.calculation_params.max_voltage_drop
              }}
              onValidationComplete={(isValid, comments) => {
                console.log(`Validación: ${isValid ? 'CORRECTO' : 'INCORRECTO'}`);
                console.log(`Comentarios: ${comments}`);
                // Aquí puedes agregar lógica para guardar la validación
              }}
            />
          )}

          {/* Resumen Mejorado */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-orange-300 text-lg font-semibold mb-4">📊 Resumen del Cálculo</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-600 rounded-lg p-4">
                <h4 className="text-white font-bold mb-2">🔌 Panel</h4>
                <div className="space-y-1 text-gray-300 text-sm">
                  <div><strong>Modelo:</strong> {calculationResults.panel_info.model}</div>
                  <div><strong>Isc:</strong> {calculationResults.panel_info.isc} A</div>
                  <div><strong>Potencia:</strong> {calculationResults.panel_info.power} W</div>
                </div>
              </div>
              
              <div className="bg-gray-600 rounded-lg p-4">
                <h4 className="text-white font-bold mb-2">⚙️ Parámetros</h4>
                <div className="space-y-1 text-gray-300 text-sm">
                  <div><strong>Factor Isc:</strong> {calculationResults.calculation_params.isc_correction}</div>
                  <div><strong>Material:</strong> {calculationResults.calculation_params.cable_material}</div>
                  <div><strong>Strings paralelo:</strong> {calculationResults.calculation_params.parallel_strings || 'N/A'}</div>
                  <div><strong>Caída máx:</strong> {calculationResults.calculation_params.max_voltage_drop}%</div>
                </div>
              </div>
              
              <div className="bg-gray-600 rounded-lg p-4">
                <h4 className="text-white font-bold mb-2">🌡️ Factores REALES</h4>
                <div className="space-y-1 text-gray-300 text-sm">
                  <div><strong>Factor agrup:</strong> {calculationResults.calculation_params.grouping_factor || 'N/A'}</div>
                  <div><strong>Factor temp:</strong> {calculationResults.calculation_params.temperature_factor || 'N/A'}</div>
                  <div><strong>Temp ambiente:</strong> {calculationResults.calculation_params.ambient_temp || 'N/A'}°C</div>
                  <div><strong>Resistividad:</strong> {calculationResults.calculation_params.resistivity?.toFixed(6) || 'N/A'}</div>
                </div>
                {calculationResults.calculation_params.extraction_source && (
                  <div className="text-orange-300 text-xs mt-2">
                    💡 Fuente: {calculationResults.calculation_params.extraction_source}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de Resultados */}
          {calculationResults.results.length > 0 && (
            <div className="bg-gray-700 rounded-lg">
              <div className="p-4 bg-gray-600 rounded-t-lg">
                <h3 className="text-orange-300 text-lg font-semibold">
                  📋 Resultados Detallados ({calculationResults.results.length} strings)
                </h3>
              </div>
              
              <div className="p-4 max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left text-white font-bold py-2">String ID</th>
                      <th className="text-left text-white font-bold py-2">I Ajustada (A)</th>
                      <th className="text-left text-white font-bold py-2">Longitud (m)</th>
                      <th className="text-left text-white font-bold py-2">S Comercial (mm²)</th>
                      <th className="text-left text-white font-bold py-2">Caída V (%)</th>
                      <th className="text-left text-white font-bold py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculationResults.results.map((result, index) => {
                      const isCritical = calculationResults.statistical_analysis?.critical_string.string_id === result.string_id;
                      const isBest = calculationResults.statistical_analysis?.best_string.string_id === result.string_id;
                      
                      return (
                        <tr 
                          key={index}
                          className={`border-b border-gray-600 ${
                            isCritical ? 'bg-red-600/20' : isBest ? 'bg-green-600/20' : 'hover:bg-gray-600'
                          }`}
                        >
                          <td className="text-white py-2 font-mono text-xs">
                            {result.string_id || `String ${index + 1}`}
                            {isCritical && <span className="ml-2 px-1 bg-red-600 text-white text-xs rounded">CRÍTICO</span>}
                            {isBest && <span className="ml-2 px-1 bg-green-600 text-white text-xs rounded">MEJOR</span>}
                          </td>
                          <td className="text-white py-2">
                            {result.i_adjusted ? Number(result.i_adjusted).toFixed(2) : 'N/A'}
                          </td>
                          <td className="text-white py-2">
                            {result.length_total_m ? Number(result.length_total_m).toFixed(1) : 'N/A'}
                          </td>
                          <td className="text-white py-2 font-bold">
                            {result.s_comercial_mm2 || 'N/A'}
                          </td>
                          <td className="text-white py-2 font-bold">
                            {result.v_drop_real_pct ? Number(result.v_drop_real_pct).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-2">
                            {result.calculation_status === 'ERROR' || result.error ? (
                              <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Error</span>
                            ) : result.voltage_status === 'OK' ? (
                              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">OK</span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Check</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado inicial */}
      {!calculationResults && calculationStatus === 'idle' && (
        <div className="bg-gray-700 rounded-lg p-8 text-center">
          <h3 className="text-orange-300 text-xl font-semibold mb-2">
            ⚡ Calculadora Mejorada Lista
          </h3>
          <p className="text-gray-400">
            Incluye análisis estadístico, extracción de factores reales y validación de cálculos del string crítico
          </p>
        </div>
      )}
    </div>
  );
};

export default StringCalculatorEnhanced;