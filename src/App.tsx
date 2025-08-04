import React, { useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, ToggleButton, ToggleButtonGroup, Box, Divider, Typography } from '@mui/material';
import { CompareArrows, ViewList } from '@mui/icons-material';
import { FileUploadSection } from './components/FileUpload';
import { ComparisonView } from './components/ComparisonView';
import { AllStringsView } from './components/AllStringsView';
import { ExportActions } from './components/ExportActions';
import { AutoLoadFiles } from './components/AutoLoadFiles';
import { AdditionalFileUpload } from './components/AdditionalFileUpload';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [viewMode, setViewMode] = useState<'comparison' | 'allStrings'>('comparison');
  
  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newMode: 'comparison' | 'allStrings' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        px: { xs: 1, sm: 2, md: 3 }, 
        py: { xs: 2, sm: 3, md: 4 },
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <AutoLoadFiles />
        
        <AdditionalFileUpload />
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom align="center">
          Or Upload Files Manually
        </Typography>
        <FileUploadSection />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="view mode"
          >
            <ToggleButton value="comparison" aria-label="comparison view">
              <CompareArrows sx={{ mr: 1 }} />
              Comparison View (Unique Strings)
            </ToggleButton>
            <ToggleButton value="allStrings" aria-label="all strings view">
              <ViewList sx={{ mr: 1 }} />
              All Strings View (All {' '}
              <span style={{ fontWeight: 'bold' }}>17,000+</span> Strings)
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {viewMode === 'comparison' ? (
          <>
            <ComparisonView />
            <ExportActions />
          </>
        ) : (
          <AllStringsView />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App
