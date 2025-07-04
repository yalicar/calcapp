// 📁 src/pages/StringCalculationPage/index.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Alert, Paper, Tabs, Tab, Typography, Chip } from "@mui/material";

import { useProject } from "../../context/ProjectContext";
import { useCalculations } from "./hooks/useCalculations";
import { useNormativeConfig } from "./hooks/useNormativeConfig";
import { NormType } from "./types";
import { TABS_CONFIG, calculateProgress, getCalculationKey } from "./constants";

import ProjectHeader from "./components/ProjectHeader";
import StringsTab from "./components/StringsTab";
import ConfigTab from "./components/ConfigTab";
import SummaryTab from "./components/SummaryTab";

function StringCalculationPage() {
  const { projectName, setProjectName } = useProject();
  const { projectName: urlProjectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
  const [norm, setNorm] = useState<NormType>("IEC");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentProjectName = projectName || urlProjectName;

  // Custom hooks
  const calculations = useCalculations(currentProjectName, norm);
  const normativeConfig = useNormativeConfig(currentProjectName, norm, activeTab);
  const progress = calculateProgress(calculations.data);

  // Establecer proyecto desde URL
  useEffect(() => {
    if (!projectName && urlProjectName) {
      setProjectName(urlProjectName);
    }
  }, [projectName, urlProjectName, setProjectName]);

  // Handlers
  const handleGoBack = () => {
    if (currentProjectName) {
      navigate(`/projects/${currentProjectName}/upload`);
    } else {
      navigate('/projects');
    }
  };

  const handleNormChange = (newNorm: NormType) => {
    setNorm(newNorm);
    normativeConfig.setData(null);
    normativeConfig.setHasChanges(false);
  };

  const renderTabContent = () => {
    const tab = TABS_CONFIG[activeTab];
    
    switch (tab.circuitType) {
      case "dc_strings":
        return (
          <StringsTab
            calculation={calculations.data.strings}
            onCalculate={calculations.executeStrings}
            onClear={calculations.clear}
            isLoading={calculations.isLoading}
            norm={norm}
            onError={setError}
            onSuccess={setSuccess}
          />
        );
      
      case "config":
        return (
          <ConfigTab
            config={normativeConfig.data}
            setConfig={normativeConfig.setData}
            norm={norm}
            isLoading={normativeConfig.isLoading}
            onSave={normativeConfig.save}
            onReset={normativeConfig.reset}
            hasUnsavedChanges={normativeConfig.hasChanges}
            setHasUnsavedChanges={normativeConfig.setHasChanges}
            onError={setError}
            onSuccess={setSuccess}
          />
        );
      
      case "summary":
        return (
          <SummaryTab
            calculations={calculations.data}
            projectName={currentProjectName!}
            progress={progress}
          />
        );
      
      default:
        return (
          <Paper sx={{ padding: 4, textAlign: 'center', backgroundColor: '#525252' }}>
            <Typography variant="h6" sx={{ color: '#b0b0b0', marginBottom: 2, fontSize: '48px' }}>
              🚧
            </Typography>
            <Typography variant="h6" sx={{ color: '#fff', marginBottom: 1 }}>
              {tab.label} - Próximamente
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
              Esta funcionalidad está en desarrollo.
            </Typography>
          </Paper>
        );
    }
  };

  if (!currentProjectName) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)', padding: 3 }}>
        <Alert severity="error">No hay proyecto seleccionado</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3
    }}>
      <ProjectHeader
        projectName={currentProjectName}
        norm={norm}
        onNormChange={handleNormChange}
        onGoBack={handleGoBack}
        progress={progress}
        hasProjectOverrides={normativeConfig.data?.has_project_overrides}
      />

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ marginBottom: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")} sx={{ marginBottom: 2 }}>
          {success}
        </Alert>
      )}

      {normativeConfig.hasChanges && (
        <Alert severity="warning" sx={{ marginBottom: 2 }}>
          Tienes cambios sin guardar en la configuración de normativa.
        </Alert>
      )}

      {/* Pestañas */}
      <Paper elevation={6} sx={{ 
        backgroundColor: '#3a3a3a',
        borderRadius: '16px',
        border: '1px solid #525252',
        overflow: 'hidden'
      }}>
        {/* Navegación */}
        <Box sx={{ borderBottom: 1, borderColor: '#525252' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#b0b0b0',
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '14px',
                minHeight: '72px',
                '&.Mui-selected': { color: '#ffb74d' },
                '&.Mui-disabled': { color: '#666', opacity: 0.5 },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#ffb74d',
                height: 3,
              },
            }}
          >
            {TABS_CONFIG.map((tab, index) => {
              const calculation = index < TABS_CONFIG.length - 2 ? 
                calculations.data[getCalculationKey(tab.circuitType)] : null;
              const status = calculation?.status;
              
              return (
                <Tab
                  key={index}
                  disabled={!tab.enabled}
                  label={
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {tab.label}
                        {!tab.enabled && " (Próximamente)"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                        {tab.description}
                      </Typography>
                      {status && (
                        <Chip
                          size="small"
                          label={status === 'success' ? 'Calculado' : status === 'error' ? 'Error' : 'Calculando'}
                          sx={{ 
                            marginTop: 0.5,
                            height: 16,
                            fontSize: '10px',
                            backgroundColor: status === 'success' ? '#3a4a3a' : status === 'error' ? '#4a3a3a' : '#4a4a3a',
                            color: status === 'success' ? '#a5d6a7' : status === 'error' ? '#ffab91' : '#ffcc80',
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
        </Box>

        {/* Contenido */}
        <Box sx={{ p: 3 }}>
          {renderTabContent()}
        </Box>
      </Paper>
    </Box>
  );
}

export default StringCalculationPage;