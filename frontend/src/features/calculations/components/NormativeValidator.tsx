import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  FileText, 
  Settings,
  Zap,
  Shield,
  ThermometerSun,
  Cable,
  Activity,
  Download,
  RefreshCw
} from 'lucide-react';

// Tipos de datos
interface ValidationResult {
  isValid: boolean;
  score: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  category: string;
  recommendation?: string;
  reference?: string;
}

interface NormativeStandard {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
}

interface ElectricalParameters {
  voltage: number;
  current: number;
  power: number;
  voltageDrop: number;
  shortCircuitCurrent: number;
  operatingTemperature: number;
  ambientTemperature: number;
  cableSection: number;
  cableLength: number;
  insulationLevel: string;
  protectionType: string;
}

interface NormativeValidatorProps {
  parameters: ElectricalParameters;
  selectedStandards?: string[];
  onValidationComplete?: (results: ValidationResult[]) => void;
  onScoreChange?: (score: number) => void;
  showDetailedResults?: boolean;
  enableExport?: boolean;
}

// Estándares disponibles
const AVAILABLE_STANDARDS: NormativeStandard[] = [
  {
    id: 'iec_62548',
    name: 'IEC 62548',
    version: '2016',
    region: 'Internacional',
    description: 'Requisitos de diseño para sistemas fotovoltaicos'
  },
  {
    id: 'nec_2020',
    name: 'NEC 2020',
    version: '2020',
    region: 'Estados Unidos',
    description: 'National Electrical Code - Artículo 690'
  },
  {
    id: 'iec_60364',
    name: 'IEC 60364',
    version: '2018',
    region: 'Internacional',
    description: 'Instalaciones eléctricas de baja tensión'
  },
  {
    id: 'ul_1741',
    name: 'UL 1741',
    version: '2020',
    region: 'Estados Unidos',
    description: 'Inversores, convertidores y controladores para sistemas FV'
  }
];

const NormativeValidator: React.FC<NormativeValidatorProps> = ({
  parameters,
  selectedStandards = ['iec_62548', 'nec_2020'],
  onValidationComplete,
  onScoreChange,
  showDetailedResults = true,
  enableExport = false
}) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [overallScore, setOverallScore] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const [activeStandards, setActiveStandards] = useState<string[]>(selectedStandards);
  const [showSettings, setShowSettings] = useState(false);

  // Validadores específicos por normativa
  const validateIEC62548 = (params: ElectricalParameters): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // Validación de caída de tensión (IEC 62548)
    if (params.voltageDrop > 3.0) {
      results.push({
        isValid: false,
        score: 0,
        message: `Caída de tensión excesiva: ${params.voltageDrop.toFixed(2)}% (máximo 3%)`,
        severity: 'error',
        category: 'Pérdidas Eléctricas',
        recommendation: 'Aumentar la sección del cable o reducir la longitud del string',
        reference: 'IEC 62548:2016, Sección 7.3.2'
      });
    } else if (params.voltageDrop > 2.0) {
      results.push({
        isValid: true,
        score: 70,
        message: `Caída de tensión aceptable: ${params.voltageDrop.toFixed(2)}%`,
        severity: 'warning',
        category: 'Pérdidas Eléctricas',
        recommendation: 'Considerar optimización para reducir pérdidas',
        reference: 'IEC 62548:2016, Sección 7.3.2'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Caída de tensión óptima: ${params.voltageDrop.toFixed(2)}%`,
        severity: 'success',
        category: 'Pérdidas Eléctricas',
        reference: 'IEC 62548:2016, Sección 7.3.2'
      });
    }

    // Validación de temperatura operativa
    if (params.operatingTemperature > 85) {
      results.push({
        isValid: false,
        score: 0,
        message: `Temperatura operativa excesiva: ${params.operatingTemperature}°C (máximo 85°C)`,
        severity: 'error',
        category: 'Condiciones Térmicas',
        recommendation: 'Mejorar ventilación o considerar cables con mayor resistencia térmica',
        reference: 'IEC 62548:2016, Sección 6.2.1'
      });
    } else if (params.operatingTemperature > 70) {
      results.push({
        isValid: true,
        score: 80,
        message: `Temperatura operativa alta: ${params.operatingTemperature}°C`,
        severity: 'warning',
        category: 'Condiciones Térmicas',
        recommendation: 'Monitorear condiciones térmicas regularmente',
        reference: 'IEC 62548:2016, Sección 6.2.1'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Temperatura operativa adecuada: ${params.operatingTemperature}°C`,
        severity: 'success',
        category: 'Condiciones Térmicas',
        reference: 'IEC 62548:2016, Sección 6.2.1'
      });
    }

    // Validación de corriente de cortocircuito
    const maxShortCircuit = params.current * 1.25; // Factor de seguridad IEC
    if (params.shortCircuitCurrent > maxShortCircuit) {
      results.push({
        isValid: false,
        score: 0,
        message: `Corriente de cortocircuito excesiva: ${params.shortCircuitCurrent.toFixed(2)}A (máximo ${maxShortCircuit.toFixed(2)}A)`,
        severity: 'error',
        category: 'Protección Eléctrica',
        recommendation: 'Instalar protecciones adicionales o rediseñar el string',
        reference: 'IEC 62548:2016, Sección 8.1.3'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Corriente de cortocircuito dentro de límites: ${params.shortCircuitCurrent.toFixed(2)}A`,
        severity: 'success',
        category: 'Protección Eléctrica',
        reference: 'IEC 62548:2016, Sección 8.1.3'
      });
    }

    return results;
  };

  const validateNEC2020 = (params: ElectricalParameters): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // Validación de caída de tensión (NEC 690.8)
    if (params.voltageDrop > 3.0) {
      results.push({
        isValid: false,
        score: 0,
        message: `Caída de tensión excede límite NEC: ${params.voltageDrop.toFixed(2)}% (máximo 3%)`,
        severity: 'error',
        category: 'Pérdidas Eléctricas',
        recommendation: 'Aumentar calibre del conductor según NEC Table 310.15(B)(16)',
        reference: 'NEC 2020, Artículo 690.8(A)(1)'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Caída de tensión cumple NEC: ${params.voltageDrop.toFixed(2)}%`,
        severity: 'success',
        category: 'Pérdidas Eléctricas',
        reference: 'NEC 2020, Artículo 690.8(A)(1)'
      });
    }

    // Validación de capacidad de corriente (NEC 690.8)
    const minCableSection = params.current * 1.25; // 125% de la corriente nominal
    if (params.cableSection < minCableSection) {
      results.push({
        isValid: false,
        score: 0,
        message: `Sección de cable insuficiente: ${params.cableSection}mm² (mínimo ${minCableSection.toFixed(2)}mm²)`,
        severity: 'error',
        category: 'Dimensionamiento',
        recommendation: 'Aumentar sección del cable según NEC Table 310.15(B)(16)',
        reference: 'NEC 2020, Artículo 690.8(B)(1)'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Sección de cable adecuada: ${params.cableSection}mm²`,
        severity: 'success',
        category: 'Dimensionamiento',
        reference: 'NEC 2020, Artículo 690.8(B)(1)'
      });
    }

    // Validación de aislamiento (NEC 690.35)
    const requiredInsulation = params.voltage > 600 ? 'Clase II' : 'Clase I';
    if (params.insulationLevel !== requiredInsulation) {
      results.push({
        isValid: false,
        score: 0,
        message: `Nivel de aislamiento incorrecto: ${params.insulationLevel} (requerido: ${requiredInsulation})`,
        severity: 'error',
        category: 'Aislamiento',
        recommendation: `Usar conductores con aislamiento ${requiredInsulation}`,
        reference: 'NEC 2020, Artículo 690.35(A)'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Nivel de aislamiento correcto: ${params.insulationLevel}`,
        severity: 'success',
        category: 'Aislamiento',
        reference: 'NEC 2020, Artículo 690.35(A)'
      });
    }

    return results;
  };

  const validateIEC60364 = (params: ElectricalParameters): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // Validación de protección contra sobrecorriente
    if (params.protectionType !== 'Fusible' && params.protectionType !== 'Interruptor') {
      results.push({
        isValid: false,
        score: 0,
        message: `Tipo de protección no especificado o inadecuado: ${params.protectionType}`,
        severity: 'error',
        category: 'Protección',
        recommendation: 'Instalar fusibles o interruptores apropiados',
        reference: 'IEC 60364-4-43, Sección 433.2'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Protección adecuada: ${params.protectionType}`,
        severity: 'success',
        category: 'Protección',
        reference: 'IEC 60364-4-43, Sección 433.2'
      });
    }

    return results;
  };

  const validateUL1741 = (params: ElectricalParameters): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // Validación de compatibilidad con inversor
    if (params.voltage > 1000) {
      results.push({
        isValid: false,
        score: 0,
        message: `Voltaje excede límite UL 1741: ${params.voltage}V (máximo 1000V)`,
        severity: 'error',
        category: 'Compatibilidad',
        recommendation: 'Verificar compatibilidad con inversor certificado UL 1741',
        reference: 'UL 1741, Sección 9.1.1'
      });
    } else {
      results.push({
        isValid: true,
        score: 100,
        message: `Voltaje compatible con UL 1741: ${params.voltage}V`,
        severity: 'success',
        category: 'Compatibilidad',
        reference: 'UL 1741, Sección 9.1.1'
      });
    }

    return results;
  };

  // Ejecutar validaciones
  const performValidation = async () => {
    setIsValidating(true);
    let allResults: ValidationResult[] = [];

    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ejecutar validaciones según estándares seleccionados
    if (activeStandards.includes('iec_62548')) {
      allResults = [...allResults, ...validateIEC62548(parameters)];
    }
    if (activeStandards.includes('nec_2020')) {
      allResults = [...allResults, ...validateNEC2020(parameters)];
    }
    if (activeStandards.includes('iec_60364')) {
      allResults = [...allResults, ...validateIEC60364(parameters)];
    }
    if (activeStandards.includes('ul_1741')) {
      allResults = [...allResults, ...validateUL1741(parameters)];
    }

    // Calcular score general
    const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
    const averageScore = allResults.length > 0 ? totalScore / allResults.length : 0;

    setValidationResults(allResults);
    setOverallScore(averageScore);
    setIsValidating(false);

    // Callbacks
    onValidationComplete?.(allResults);
    onScoreChange?.(averageScore);
  };

  // Efectos
  useEffect(() => {
    performValidation();
  }, [parameters, activeStandards]);

  // Utilidades
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      case 'success': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Pérdidas Eléctricas': return <Zap className="w-4 h-4" />;
      case 'Condiciones Térmicas': return <ThermometerSun className="w-4 h-4" />;
      case 'Protección Eléctrica': return <Shield className="w-4 h-4" />;
      case 'Dimensionamiento': return <Cable className="w-4 h-4" />;
      case 'Aislamiento': return <Shield className="w-4 h-4" />;
      case 'Protección': return <Shield className="w-4 h-4" />;
      case 'Compatibilidad': return <Activity className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      overallScore,
      parameters,
      activeStandards,
      validationResults
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_results_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Agrupar resultados por categoría
  const groupedResults = validationResults.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, ValidationResult[]>);

  const criticalErrors = validationResults.filter(r => r.severity === 'error').length;
  const warnings = validationResults.filter(r => r.severity === 'warning').length;
  const passed = validationResults.filter(r => r.severity === 'success').length;

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Validador de Normativas</h1>
              <p className="text-gray-600">Verificación de cumplimiento de estándares internacionales</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {enableExport && (
              <button
                onClick={exportResults}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configurar</span>
            </button>
            <button
              onClick={performValidation}
              disabled={isValidating}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
              <span>Validar</span>
            </button>
          </div>
        </div>

        {/* Score y estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg">
            <div className="text-sm font-medium">Score General</div>
            <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(1)}%
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="text-sm font-medium text-red-800">Errores Críticos</div>
            <div className="text-2xl font-bold text-red-600">{criticalErrors}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="text-sm font-medium text-yellow-800">Advertencias</div>
            <div className="text-2xl font-bold text-yellow-600">{warnings}</div>
          </div>
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-800">Validaciones Exitosas</div>
            <div className="text-2xl font-bold text-green-600">{passed}</div>
          </div>
        </div>
      </div>

      {/* Configuración de estándares */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Configuración de Estándares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_STANDARDS.map((standard) => (
              <div key={standard.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={activeStandards.includes(standard.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setActiveStandards([...activeStandards, standard.id]);
                        } else {
                          setActiveStandards(activeStandards.filter(id => id !== standard.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-medium">{standard.name}</span>
                  </label>
                  <span className="text-sm text-gray-500">{standard.version}</span>
                </div>
                <div className="text-sm text-gray-600 mb-1">{standard.region}</div>
                <div className="text-sm text-gray-500">{standard.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados de validación */}
      {showDetailedResults && (
        <div className="space-y-4">
          {Object.entries(groupedResults).map(([category, results]) => (
            <div key={category} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                {getCategoryIcon(category)}
                <h2 className="text-xl font-bold">{category}</h2>
                <span className="text-sm text-gray-500">({results.length} validaciones)</span>
              </div>
              
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${getSeverityColor(result.severity)}`}>
                    <div className="flex items-start space-x-3">
                      {getSeverityIcon(result.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{result.message}</span>
                          <span className={`text-sm font-bold ${getScoreColor(result.score)}`}>
                            {result.score}%
                          </span>
                        </div>
                        
                        {result.recommendation && (
                          <div className="text-sm text-gray-700 mb-2">
                            <strong>Recomendación:</strong> {result.recommendation}
                          </div>
                        )}
                        
                        {result.reference && (
                          <div className="text-xs text-gray-500">
                            <strong>Referencia:</strong> {result.reference}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isValidating && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-lg">Validando parámetros...</span>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!isValidating && validationResults.length === 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No hay resultados de validación</h3>
          <p className="text-gray-500 mb-4">Selecciona al menos un estándar para comenzar la validación</p>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Configurar Estándares
          </button>
        </div>
      )}
    </div>
  );
};

export default NormativeValidator;