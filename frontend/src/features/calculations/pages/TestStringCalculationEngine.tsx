import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StringCalculationEngine from '../components/StringCalculationEngine';

const TestStringCalculationEngine: React.FC = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('colorado-v1');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleCalculationComplete = (calculationResults: any) => {
    setResults(calculationResults);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setResults(null);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c2c2c 0%, #3a3a3a 50%, #424242 100%)',
      padding: 3
    }}>
      <Paper sx={{ padding: 3, marginBottom: 3, backgroundColor: '#3a3a3a', borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
              🧪 Prueba Motor de Cálculos
            </Typography>
            <Typography variant="body2" sx={{ color: '#b0b0b0', marginTop: 1 }}>
              Componente independiente StringCalculationEngine
            </Typography>
          </Box>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ 
              borderColor: '#666',
              color: '#e0e0e0',
              '&:hover': { borderColor: '#777' },
            }}
          >
            Volver
          </Button>
        </Box>
        
        <TextField
          label="Nombre del Proyecto"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          sx={{
            marginTop: 2,
            '& .MuiOutlinedInput-root': { 
              color: '#fff',
              '& fieldset': { borderColor: '#666' },
            },
            '& .MuiInputLabel-root': { color: '#b0b0b0' },
          }}
        />
      </Paper>

      <StringCalculationEngine
        projectName={projectName}
        onCalculationComplete={handleCalculationComplete}
        onError={handleError}
        onNormativeChange={(norm) => console.log('Normativa:', norm)}
      />

      {error && (
        <Alert severity="error" sx={{ marginTop: 2, backgroundColor: '#d32f2f', color: '#fff' }}>
          {error}
        </Alert>
      )}

      {results && (
        <Paper sx={{ padding: 3, marginTop: 3, backgroundColor: '#525252', borderRadius: '8px' }}>
          <Typography variant="h6" sx={{ color: '#ffcc80', marginBottom: 2 }}>
            📊 Resultados ({results.summary?.total_circuits || 0} strings)
          </Typography>
          <Box sx={{ backgroundColor: '#333', padding: 2, borderRadius: '4px', overflow: 'auto' }}>
            <pre style={{ color: '#fff', fontSize: '12px', margin: 0 }}>
              {JSON.stringify(results, null, 2)}
            </pre>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default TestStringCalculationEngine;