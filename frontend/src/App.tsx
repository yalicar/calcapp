import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import UploadExcelPage from './pages/UploadExcelPage';
import GridExample from './pages/GridExample'
import StringCalculationPage from './pages/StringCalculationPage'
// 👇 NUEVO: Importar la página de prueba de normativas
import TestNormativePage from './features/normatives/pages/TestNormativePage'
import TestCalculationPage from './features/calculations/pages/TestCalculationPage';
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
        
        {/* 👇 NUEVA: Página de prueba de normativas */}
        <Route path="/test-normative" element={<TestNormativePage />} />
      </Routes>
    </Router>
  )
}

export default App