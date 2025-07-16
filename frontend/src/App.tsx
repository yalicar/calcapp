import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import UploadExcelPage from './pages/UploadExcelPage'
import DCStringsPage from './pages/DCStringsPage'
import CN1InverterPage from './pages/CN1InverterPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:projectName/upload" element={<UploadExcelPage />} />
        <Route path="/projects/:projectName/calculations/strings" element={<DCStringsPage />} />
        <Route path="/projects/:projectName/calculations/cn1-inverter" element={<CN1InverterPage />} />
      </Routes>
    </Router>
  )
}

export default App