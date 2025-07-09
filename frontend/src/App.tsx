import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import UploadExcelPage from './pages/UploadExcelPage';
import GridExample from './pages/GridExample'
import StringCalculationPage from './pages/StringCalculationPage'
import DCStringsPage from './pages/DCStringsPage';
import TestEnhancedCalculationPage from './features/calculations/pages/TestEnhancedCalculationPage';
import TestStringCalculationEngine from './features/calculations/pages/TestStringCalculationEngine';
import TestNormativePage from './features/normatives/pages/TestNormativePage'
import TestCalculationPage from './features/calculations/pages/TestCalculationPage';
import TestCriticalStringAnalyzer from './features/calculations/pages/TestCriticalStringAnalyzer';
import TestNormativeValidator from './features/calculations/pages/TestNormativeValidator';
import TestStringAnalysisReport from './features/reports/pages/TestStringAnalysisReport';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload/:projectName" element={<UploadExcelPage />} />
        <Route path="/demo" element={<GridExample />} />
        <Route path="/calculate" element={<StringCalculationPage />} />
        
        {/* Rutas de proyectos */}
        <Route path="/projects/:projectName/upload" element={<UploadExcelPage />} />
        <Route path="/projects/:projectName/calculations" element={<StringCalculationPage />} />
        <Route path="/test-calculation" element={<TestCalculationPage />} />
        <Route path="/dc-strings" element={<DCStringsPage />} />
        <Route path="/test-enhanced-calc" element={<TestEnhancedCalculationPage />} />
        
        {/* ✅ RUTAS CORREGIDAS */}
        <Route path="/test-engine" element={<TestStringCalculationEngine />} />
        <Route path="/test-analyzer" element={<TestCriticalStringAnalyzer />} />
        <Route path="/test-normative" element={<TestNormativePage />} />
        <Route path="/test-pdf-generator" element={<TestStringAnalysisReport />} />
        <Route path="/projects/:projectName/reports" element={<TestStringAnalysisReport />} />

        {/* 🎯 NUEVA RUTA: Validador de Normativas */}
        <Route path="/test-validator" element={<TestNormativeValidator />} />
      </Routes>
    </Router>
  )
}

export default App