import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Zap, 
  Settings, 
  BarChart3, 
  Shield, 
  TrendingUp,
  ChevronRight,
  Clock,
  CheckCircle
} from 'lucide-react';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  status: 'available' | 'coming-soon' | 'in-development';
  category: 'analysis' | 'validation' | 'optimization';
  fileName: string; // Nombre del archivo que se creará
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'string-analysis',
    title: 'Análisis de Strings Críticos',
    description: 'Reporte completo de análisis de strings críticos con cálculos detallados, validaciones normativas y recomendaciones técnicas.',
    icon: <Zap className="w-8 h-8" />,
    route: '/reports/string-analysis',
    status: 'available',
    category: 'analysis',
    fileName: 'TestStringAnalysisReport.tsx'
  },
  {
    id: 'inverter-analysis',
    title: 'Análisis de Inversores',
    description: 'Reporte de rendimiento y eficiencia de inversores, análisis de armónicos y cumplimiento normativo.',
    icon: <Settings className="w-8 h-8" />,
    route: '/reports/inverter-analysis',
    status: 'coming-soon',
    category: 'analysis',
    fileName: 'TestInverterAnalysisReport.tsx'
  },
  {
    id: 'system-performance',
    title: 'Rendimiento del Sistema',
    description: 'Análisis completo del rendimiento del sistema fotovoltaico, pérdidas y optimizaciones.',
    icon: <BarChart3 className="w-8 h-8" />,
    route: '/reports/system-performance',
    status: 'coming-soon',
    category: 'analysis',
    fileName: 'TestSystemPerformanceReport.tsx'
  },
  {
    id: 'normative-compliance',
    title: 'Cumplimiento Normativo',
    description: 'Reporte de cumplimiento con estándares internacionales (IEC, NEC, UL) y normativas locales.',
    icon: <Shield className="w-8 h-8" />,
    route: '/reports/normative-compliance',
    status: 'in-development',
    category: 'validation',
    fileName: 'TestNormativeComplianceReport.tsx'
  },
  {
    id: 'optimization',
    title: 'Optimización del Sistema',
    description: 'Reporte de oportunidades de optimización, recomendaciones de mejora y análisis costo-beneficio.',
    icon: <TrendingUp className="w-8 h-8" />,
    route: '/reports/optimization',
    status: 'coming-soon',
    category: 'optimization',
    fileName: 'TestOptimizationReport.tsx'
  },
  {
    id: 'executive-summary',
    title: 'Resumen Ejecutivo',
    description: 'Reporte ejecutivo consolidado con los puntos clave, conclusiones y recomendaciones principales.',
    icon: <FileText className="w-8 h-8" />,
    route: '/reports/executive-summary',
    status: 'in-development',
    category: 'analysis',
    fileName: 'TestExecutiveSummaryReport.tsx'
  }
];

const ReportSelector: React.FC = () => {
  const navigate = useNavigate();

  const handleReportSelect = (report: ReportType) => {
    if (report.status === 'available') {
      navigate(report.route);
    }
  };

  const getStatusBadge = (status: ReportType['status']) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Disponible
          </span>
        );
      case 'coming-soon':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Próximamente
          </span>
        );
      case 'in-development':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Settings className="w-3 h-3 mr-1" />
            En Desarrollo
          </span>
        );
    }
  };

  const getCategoryColor = (category: ReportType['category']) => {
    switch (category) {
      case 'analysis':
        return 'text-blue-600';
      case 'validation':
        return 'text-green-600';
      case 'optimization':
        return 'text-purple-600';
    }
  };

  const groupedReports = REPORT_TYPES.reduce((acc, report) => {
    if (!acc[report.category]) {
      acc[report.category] = [];
    }
    acc[report.category].push(report);
    return acc;
  }, {} as Record<string, ReportType[]>);

  const categoryNames = {
    analysis: 'Análisis',
    validation: 'Validación',
    optimization: 'Optimización'
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Generador de Reportes
        </h1>
        <p className="text-gray-600 text-lg">
          Seleccione el tipo de reporte que desea generar para su proyecto fotovoltaico
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <strong>Estructura de archivos:</strong> Cada reporte tendrá su propio archivo en 
            <code className="bg-blue-100 px-1 rounded mx-1">src/features/reports/pages/</code> 
            y su generador en 
            <code className="bg-blue-100 px-1 rounded mx-1">src/features/reports/components/</code>
          </p>
        </div>
      </div>

      {Object.entries(groupedReports).map(([category, reports]) => (
        <div key={category} className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <div className={`w-1 h-8 rounded ${
              category === 'analysis' ? 'bg-blue-600' :
              category === 'validation' ? 'bg-green-600' : 'bg-purple-600'
            }`} />
            {categoryNames[category as keyof typeof categoryNames]}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleReportSelect(report)}
                className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 transition-all duration-200 ${
                  report.status === 'available'
                    ? 'hover:shadow-lg hover:border-blue-300 cursor-pointer transform hover:-translate-y-1'
                    : 'opacity-75 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${getCategoryColor(report.category)}`}>
                    {report.icon}
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {report.title}
                </h3>

                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  {report.description}
                </p>

                {/* Mostrar nombre del archivo */}
                <div className="mb-4 p-2 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-600">
                    <strong>Archivo:</strong> {report.fileName}
                  </p>
                </div>

                {report.status === 'available' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-600">
                      Generar Reporte
                    </span>
                    <ChevronRight className="w-5 h-5 text-blue-600" />
                  </div>
                )}

                {report.status !== 'available' && (
                  <div className="text-sm text-gray-500">
                    {report.status === 'coming-soon' && 'Estará disponible pronto'}
                    {report.status === 'in-development' && 'Actualmente en desarrollo'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Información sobre la estructura */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📁 Estructura de Archivos Planificada
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Componentes (Generadores):</h4>
            <ul className="text-sm text-gray-600 space-y-1 font-mono">
              <li>• StringAnalysisPDFGenerator.tsx ✅</li>
              <li>• InverterAnalysisPDFGenerator.tsx</li>
              <li>• SystemPerformancePDFGenerator.tsx</li>
              <li>• NormativeCompliancePDFGenerator.tsx</li>
              <li>• OptimizationPDFGenerator.tsx</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Páginas de Prueba:</h4>
            <ul className="text-sm text-gray-600 space-y-1 font-mono">
              <li>• TestStringAnalysisReport.tsx ✅</li>
              <li>• TestInverterAnalysisReport.tsx</li>
              <li>• TestSystemPerformanceReport.tsx</li>
              <li>• TestNormativeComplianceReport.tsx</li>
              <li>• TestOptimizationReport.tsx</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportSelector;