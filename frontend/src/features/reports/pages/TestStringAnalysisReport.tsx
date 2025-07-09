import React from 'react';
import StringAnalysisPDFGenerator from '../components/StringAnalysisPDFGenerator';

const TestStringAnalysisReport: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🧪 Prueba del Generador de PDFs - Strings Críticos
          </h1>
          <p className="text-gray-600 mt-2">
            Esta es una página de prueba independiente para el generador de reportes PDF
          </p>
        </div>
        
        {/* Aquí va el componente principal */}
        <StringAnalysisPDFGenerator />
      </div>
    </div>
  );
};

export default TestStringAnalysisReport;