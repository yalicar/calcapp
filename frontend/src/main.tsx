import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ProjectProvider } from './context/ProjectContext.tsx' // ✅ importa tu provider

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </React.StrictMode>
)
