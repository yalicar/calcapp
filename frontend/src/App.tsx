
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import UploadExcelPage from './pages/UploadExcelPage';
import GridExample from './pages/GridExample'


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload/:projectName" element={<UploadExcelPage />} />
        <Route path="/demo" element={<GridExample />} />
      </Routes>
    </Router>
  )
}

export default App
