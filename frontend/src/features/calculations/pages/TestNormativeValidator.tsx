import React, { useState, useEffect } from 'react';
import { Play, Save, Upload, RotateCcw, Info, Database, FileText, AlertCircle } from 'lucide-react';
import NormativeValidator from '../components/NormativeValidator';

// Interfaces para datos del proyecto
interface ProjectData {
  projectName: string;
  timestamp: string;
  stringData: {
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
  };
  calculationResults?: any;
}

// Datos de prueba predefinidos (como fallback)
const TEST_SCENARIOS = {
  optimal: {
    name: "Configuración Óptima",
    description: "Parámetros que cumplen con todos los estándares",
    parameters: {
      voltage: 600,
      current: 8.5,
      power: 5100,
      voltageDrop: 1.8,
      shortCircuitCurrent: 9.2,
      operatingTemperature: 45,
      ambientTemperature: 25,
      cableSection: 16,
      cableLength: 150,
      insulationLevel: "Clase I",
      protectionType: "Fusible"
    }
  },
  warning: {
    name: "Configuración con Advertencias",
    description: "Parámetros que generan advertencias pero son aceptables",
    parameters: {
      voltage: 800,
      current: 10.2,
      power: 8160,
      voltageDrop: 2.5,
      shortCircuitCurrent: 11.8,
      operatingTemperature: 72,
      ambientTemperature: 35,
      cableSection: 12,
      cableLength: 200,
      insulationLevel: "Clase I",
      protectionType: "Interruptor"
    }
  },
  critical: {
    name: "Configuración Crítica",
    description: "Parámetros que violan múltiples normativas",
    parameters: {
      voltage: 1200,
      current: 15.5,
      power: 18600,
      voltageDrop: 4.2,
      shortCircuitCurrent: 22.5,
      operatingTemperature: 95,
      ambientTemperature: 45,
      cableSection: 6,
      cableLength: 300,
      insulationLevel: "Clase I",
      protectionType: "Ninguno"
    }
  },
  mixed: {
    name: "Configuración Mixta",
    description: "Algunos parámetros críticos y otros óptimos",
    parameters: {
      voltage: 750,
      current: 12.0,
      power: 9000,
      voltageDrop: 1.2,
      shortCircuitCurrent: 13.8,
      operatingTemperature: 88,
      ambientTemperature: 28,
      cableSection: 25,
      cableLength: 100,
      insulationLevel: "Clase II",
      protectionType: "Fusible"
    }
  }
};

const TestNormativeValidator: React.FC = () => {
  const [currentParameters, setCurrentParameters] = useState(TEST_SCENARIOS.optimal.parameters);
  const [selectedScenario, setSelectedScenario] = useState<string>('optimal');
  const [selectedStandards, setSelectedStandards] = useState<string[]>(['iec_62548', 'nec_2020']);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [overallScore, setOverallScore] = useState<number>(0);
  const [showDetailedResults, setShowDetailedResults] = useState(true);
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  // 🎯 NUEVOS ESTADOS PARA DATOS REALES
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [dataSource, setDataSource] = useState<'test' | 'project' | 'saved'>('test');
  const [error, setError] = useState<string>('');

  // 🔄 CARGAR DATOS DEL PROYECTO
  const loadProjectData = async () => {
    setIsLoadingProject(true);
    setError('');
    
    try {
      // Intentar cargar desde localStorage primero
      const savedProjectData = localStorage.getItem('currentProjectCalculation');
      if (savedProjectData) {
        const projectInfo = JSON.parse(savedProjectData);
        
        // Adaptar datos del proyecto al formato del validador
        const adaptedParameters = {
          voltage: projectInfo.results?.voltage || projectInfo.voltage || 600,
          current: projectInfo.results?.current || projectInfo.current || 8.5,
          power: projectInfo.results?.power || (projectInfo.voltage * projectInfo.current) || 5100,
          voltageDrop: projectInfo.results?.voltageDrop || projectInfo.voltageDrop || 2.0,
          shortCircuitCurrent: projectInfo.results?.shortCircuitCurrent || (projectInfo.current * 1.25) || 10.6,
          operatingTemperature: projectInfo.results?.operatingTemperature || projectInfo.operatingTemperature || 50,
          ambientTemperature: projectInfo.ambientTemperature || 25,
          cableSection: projectInfo.cableSection || 16,
          cableLength: projectInfo.cableLength || 150,
          insulationLevel: projectInfo.insulationLevel || "Clase I",
          protectionType: projectInfo.protectionType || "Fusible"
        };

        setProjectData({
          projectName: projectInfo.projectName || 'Proyecto Actual',
          timestamp: projectInfo.timestamp || new Date().toISOString(),
          stringData: adaptedParameters
        });

        setCurrentParameters(adaptedParameters);
        setDataSource('project');
        setSelectedScenario('project');
        setIsCustomMode(false);
      } else {
        // Si no hay datos en localStorage, intentar cargar desde backend
        const response = await fetch('http://localhost:8000/api/v1/calculations/saved-results');
        if (response.ok) {
          const results = await response.json();
          setSavedResults(results);
          
          if (results.length > 0) {
            // Usar el resultado más reciente
            const latestResult = results[results.length - 1];
            const adaptedParameters = {
              voltage: latestResult.voltage || 600,
              current: latestResult.current || 8.5,
              power: latestResult.power || 5100,
              voltageDrop: latestResult.voltageDrop || 2.0,
              shortCircuitCurrent: latestResult.shortCircuitCurrent || 10.6,
              operatingTemperature: latestResult.operatingTemperature || 50,
              ambientTemperature: latestResult.ambientTemperature || 25,
              cableSection: latestResult.cableSection || 16,
              cableLength: latestResult.cableLength || 150,
              insulationLevel: latestResult.insulationLevel || "Clase I",
              protectionType: latestResult.protectionType || "Fusible"
            };

            setCurrentParameters(adaptedParameters);
            setDataSource('saved');
            setSelectedScenario('saved');
          }
        } else {
          throw new Error('No se pudieron cargar los datos del proyecto');
        }
      }
    } catch (err) {
      setError('No se encontraron datos del proyecto. Usando datos de prueba.');
      console.error('Error cargando datos del proyecto:', err);
    } finally {
      setIsLoadingProject(false);
    }
  };

  // 🎯 CARGAR RESULTADOS ESPECÍFICOS
  const loadSpecificResult = (result: any) => {
    const adaptedParameters = {
      voltage: result.voltage || 600,
      current: result.current || 8.5,
      power: result.power || 5100,
      voltageDrop: result.voltageDrop || 2.0,
      shortCircuitCurrent: result.shortCircuitCurrent || 10.6,
      operatingTemperature: result.operatingTemperature || 50,
      ambientTemperature: result.ambientTemperature || 25,
      cableSection: result.cableSection || 16,
      cableLength: result.cableLength || 150,
      insulationLevel: result.insulationLevel || "Clase I",
      protectionType: result.protectionType || "Fusible"
    };

    setCurrentParameters(adaptedParameters);
    setDataSource('saved');
    setSelectedScenario('saved');
    setIsCustomMode(false);
  };

  // Cargar datos del proyecto al montar el componente
  useEffect(() => {
    loadProjectData();
  }, []);

  // Manejar cambio de escenario
  const handleScenarioChange = (scenarioKey: string) => {
    if (scenarioKey === 'project' && projectData) {
      setCurrentParameters(projectData.stringData);
      setDataSource('project');
    } else if (scenarioKey in TEST_SCENARIOS) {
      setCurrentParameters(TEST_SCENARIOS[scenarioKey as keyof typeof TEST_SCENARIOS].parameters);
      setDataSource('test');
    }
    
    setSelectedScenario(scenarioKey);
    setIsCustomMode(false);
  };

  // Manejar cambio de parámetros individuales
  const handleParameterChange = (key: string, value: any) => {
    setCurrentParameters(prev => ({
      ...prev,
      [key]: value
    }));
    setIsCustomMode(true);
    setSelectedScenario('custom');
  };

  // Resetear a valores por defecto
  const resetToDefault = () => {
    if (projectData) {
      setCurrentParameters(projectData.stringData);
      setSelectedScenario('project');
      setDataSource('project');
    } else {
      setCurrentParameters(TEST_SCENARIOS.optimal.parameters);
      setSelectedScenario('optimal');
      setDataSource('test');
    }
    setIsCustomMode(false);
  };

  // Guardar configuración actual
  const saveCurrentConfig = () => {
    const config = {
      parameters: currentParameters,
      standards: selectedStandards,
      timestamp: new Date().toISOString(),
      dataSource,
      projectInfo: projectData
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `normative_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cargar configuración desde archivo
  const loadConfigFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          setCurrentParameters(config.parameters);
          setSelectedStandards(config.standards || ['iec_62548', 'nec_2020']);
          setIsCustomMode(true);
          setSelectedScenario('custom');
          setDataSource('test');
        } catch (error) {
          alert('Error al cargar el archivo de configuración');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Test: Validador de Normativas</h1>
              <p className="text-gray-600 mt-2">Prueba el validador con diferentes escenarios y parámetros</p>
              
              {/* 🎯 INDICADOR DE FUENTE DE DATOS */}
              <div className="flex items-center space-x-2 mt-3">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dataSource === 'project' ? 'bg-green-100 text-green-800' :
                  dataSource === 'saved' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {dataSource === 'project' ? '📊 Datos del Proyecto' :
                   dataSource === 'saved' ? '💾 Datos Guardados' :
                   '🧪 Datos de Prueba'}
                </div>
                {projectData && (
                  <span className="text-sm text-gray-600">
                    Proyecto: {projectData.projectName}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadProjectData}
                disabled={isLoadingProject}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Database className={`w-4 h-4 ${isLoadingProject ? 'animate-spin' : ''}`} />
                <span>Cargar Proyecto</span>
              </button>
              
              <button
                onClick={saveCurrentConfig}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Config</span>
              </button>
              
              <label className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Cargar Config</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={loadConfigFromFile}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={resetToDefault}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* 🚨 MENSAJE DE ERROR */}
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">Advertencia</span>
              </div>
              <p className="text-yellow-700 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Selector de escenarios - ACTUALIZADO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Botón para datos del proyecto */}
            {projectData && (
              <button
                onClick={() => handleScenarioChange('project')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedScenario === 'project'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-1">📊 Proyecto Actual</div>
                <div className="text-sm text-gray-500">{projectData.projectName}</div>
              </button>
            )}
            
            {/* Botones de escenarios de prueba */}
            {Object.entries(TEST_SCENARIOS).map(([key, scenario]) => (
              <button
                key={key}
                onClick={() => handleScenarioChange(key)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedScenario === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-1">{scenario.name}</div>
                <div className="text-sm text-gray-500">{scenario.description}</div>
              </button>
            ))}
          </div>

          {/* 📋 RESULTADOS GUARDADOS */}
          {savedResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Resultados Guardados</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {savedResults.slice(-3).map((result, index) => (
                  <button
                    key={index}
                    onClick={() => loadSpecificResult(result)}
                    className="p-3 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-sm">
                      {result.projectName || `Cálculo ${index + 1}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600">
                      V: {result.voltage}V, I: {result.current}A
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Indicador de modo personalizado */}
          {isCustomMode && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-orange-600" />
                <span className="text-orange-800 font-medium">Modo Personalizado</span>
              </div>
              <p className="text-orange-700 text-sm mt-1">
                Los parámetros han sido modificados manualmente
              </p>
            </div>
          )}
        </div>

        {/* Panel de configuración de parámetros - SIN CAMBIOS */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Configuración de Parámetros</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Parámetros Eléctricos */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Parámetros Eléctricos</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voltaje (V)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.voltage}
                    onChange={(e) => handleParameterChange('voltage', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corriente (A)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentParameters.current}
                    onChange={(e) => handleParameterChange('current', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Potencia (W)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.power}
                    onChange={(e) => handleParameterChange('power', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caída de Tensión (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentParameters.voltageDrop}
                    onChange={(e) => handleParameterChange('voltageDrop', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corriente de Cortocircuito (A)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentParameters.shortCircuitCurrent}
                    onChange={(e) => handleParameterChange('shortCircuitCurrent', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Parámetros Térmicos */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-red-600">Parámetros Térmicos</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperatura Operativa (°C)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.operatingTemperature}
                    onChange={(e) => handleParameterChange('operatingTemperature', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperatura Ambiente (°C)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.ambientTemperature}
                    onChange={(e) => handleParameterChange('ambientTemperature', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Parámetros de Cableado */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-600">Parámetros de Cableado</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sección del Cable (mm²)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.cableSection}
                    onChange={(e) => handleParameterChange('cableSection', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitud del Cable (m)
                  </label>
                  <input
                    type="number"
                    value={currentParameters.cableLength}
                    onChange={(e) => handleParameterChange('cableLength', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Aislamiento
                  </label>
                  <select
                    value={currentParameters.insulationLevel}
                    onChange={(e) => handleParameterChange('insulationLevel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Clase I">Clase I</option>
                    <option value="Clase II">Clase II</option>
                    <option value="Clase III">Clase III</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Protección
                  </label>
                  <select
                    value={currentParameters.protectionType}
                    onChange={(e) => handleParameterChange('protectionType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Fusible">Fusible</option>
                    <option value="Interruptor">Interruptor</option>
                    <option value="Ninguno">Ninguno</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Configuración de estándares */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-3">Estándares a Validar</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'iec_62548', name: 'IEC 62548' },
                { id: 'nec_2020', name: 'NEC 2020' },
                { id: 'iec_60364', name: 'IEC 60364' },
                { id: 'ul_1741', name: 'UL 1741' }
              ].map((standard) => (
                <label key={standard.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedStandards.includes(standard.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStandards([...selectedStandards, standard.id]);
                      } else {
                        setSelectedStandards(selectedStandards.filter(id => id !== standard.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">{standard.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Opciones de visualización */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-3">Opciones de Visualización</h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showDetailedResults}
                  onChange={(e) => setShowDetailedResults(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium">Mostrar resultados detallados</span>
              </label>
            </div>
          </div>
        </div>

        {/* Validador de Normativas */}
        <NormativeValidator
          parameters={currentParameters}
          selectedStandards={selectedStandards}
          onValidationComplete={setValidationResults}
          onScoreChange={setOverallScore}
          showDetailedResults={showDetailedResults}
          enableExport={true}
        />

        {/* Resumen de resultados */}
        {validationResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Resumen de Validación</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total de validaciones:</span>
                    <span className="font-medium">{validationResults.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Errores críticos:</span>
                    <span className="font-medium text-red-600">
                      {validationResults.filter(r => r.severity === 'error').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Advertencias:</span>
                    <span className="font-medium text-yellow-600">
                      {validationResults.filter(r => r.severity === 'warning').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Validaciones exitosas:</span>
                    <span className="font-medium text-green-600">
                      {validationResults.filter(r => r.severity === 'success').length}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span>Score general:</span>
                    <span className={`font-bold ${
                      overallScore >= 90 ? 'text-green-600' :
                      overallScore >= 70 ? 'text-yellow-600' :
                      overallScore >= 50 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {overallScore.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Recomendaciones Principales</h3>
                <div className="space-y-2">
                  {validationResults
                    .filter(r => r.severity === 'error' && r.recommendation)
                    .slice(0, 3)
                    .map((result, index) => (
                      <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        <div className="font-medium text-red-800">
                          {result.category}
                        </div>
                        <div className="text-red-700">
                          {result.recommendation}
                        </div>
                      </div>
                    ))}
                  {validationResults.filter(r => r.severity === 'error' && r.recommendation).length === 0 && (
                    <div className="text-sm text-gray-500 italic">
                      No hay recomendaciones críticas
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 🎯 INFORMACIÓN DEL PROYECTO ACTUAL */}
            {projectData && dataSource === 'project' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-3">Información del Proyecto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Nombre del Proyecto:</div>
                    <div className="text-sm text-gray-600">{projectData.projectName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Última Actualización:</div>
                    <div className="text-sm text-gray-600">
                      {new Date(projectData.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Fuente de Datos:</div>
                    <div className="text-sm text-gray-600">
                      {dataSource === 'project' ? 'Cálculos del proyecto actual' : 
                       dataSource === 'saved' ? 'Resultados guardados en backend' : 
                       'Datos de prueba'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Estado de Validación:</div>
                    <div className={`text-sm font-medium ${
                      overallScore >= 90 ? 'text-green-600' :
                      overallScore >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {overallScore >= 90 ? '✅ Cumple con normativas' :
                       overallScore >= 70 ? '⚠️ Requiere atención' :
                       '❌ No cumple con normativas'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 📊 COMPARACIÓN CON RESULTADOS ANTERIORES */}
        {savedResults.length > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Historial de Validaciones</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proyecto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voltaje
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Corriente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Caída de Tensión
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {savedResults.slice(-5).reverse().map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.projectName || `Proyecto ${index + 1}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.voltage || 'N/A'}V
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.current || 'N/A'}A
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.voltageDrop || 'N/A'}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => loadSpecificResult(result)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Cargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestNormativeValidator;