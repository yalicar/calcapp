import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import UploadExcelPage from './pages/UploadExcelPage';
import GridExample from './pages/GridExample'
import StringCalculationPage from './pages/StringCalculationPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload/:projectName" element={<UploadExcelPage />} />
        <Route path="/demo" element={<GridExample />} />
        <Route path="/calculate" element={<StringCalculationPage />} />
        {/* 👇 AGREGAR ESTAS RUTAS */}
        <Route path="/projects/:projectName/upload" element={<UploadExcelPage />} />
        <Route path="/projects/:projectName/calculations" element={<StringCalculationPage />} />
      </Routes>
    </Router>
  )
}

export default App