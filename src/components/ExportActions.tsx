import React from 'react';
import { Box, Button, Stack, Alert, Snackbar, Typography } from '@mui/material';
import { Download, RestartAlt, Info } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { generateXliff } from '../utils/xliffParser';
import { RegressionChecker } from './RegressionChecker';

export const ExportActions: React.FC = () => {
  const { getMergedFile, reset, comparisonResults, files } = useComparisonStore();
  const [showSuccess, setShowSuccess] = React.useState(false);
  
  const handleExport = () => {
    const mergedFile = getMergedFile();
    if (!mergedFile) return;
    
    const xliffContent = generateXliff(mergedFile);
    const blob = new Blob([xliffContent], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `merged-translations-${timestamp}.xliff`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    setShowSuccess(true);
  };
  
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset? All comparison data will be lost.')) {
      reset();
    }
  };
  
  const unselectedCount = comparisonResults.filter(r => 
    !r.selectedVersion && r.inFiles.length > 0
  ).length;
  
  const selectedCount = comparisonResults.filter(r => 
    r.selectedVersion && r.inFiles.length > 0
  ).length;
  
  // Calculate how many trans-units will be exported (those with non-empty targets)
  const mergedFile = getMergedFile();
  const exportableCount = mergedFile?.transUnits.filter(unit => 
    unit.target && unit.target.trim() !== ''
  ).length || 0;
  const totalCount = mergedFile?.transUnits.length || 0;
  const skippedCount = totalCount - exportableCount;
  
  // Find if LATEST file exists
  const hasLatestFile = Object.values(files).some(file => 
    file?.fileIdentifier === 'LATEST'
  );
  
  if (comparisonResults.length === 0) return null;
  
  return (
    <Box sx={{ mt: 4 }}>
      <Stack spacing={2} sx={{ mb: 2 }}>
        {unselectedCount > 0 && (
          <Alert 
            severity="info" 
            icon={<Info />}
          >
            <Typography variant="body2">
              <strong>{selectedCount}</strong> strings have explicit selections.
              <br />
              <strong>{unselectedCount}</strong> strings will use {hasLatestFile ? 'LATEST' : 'the most recent'} version as default.
            </Typography>
          </Alert>
        )}
        {skippedCount > 0 && (
          <Alert 
            severity="warning" 
            icon={<Info />}
          >
            <Typography variant="body2">
              <strong>{exportableCount}</strong> trans-units with translations will be exported.
              <br />
              <strong>{skippedCount}</strong> trans-units with empty targets will be skipped to preserve existing translations.
            </Typography>
          </Alert>
        )}
      </Stack>
      
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Download />}
          onClick={handleExport}
        >
          Export Merged XLIFF
        </Button>
        <RegressionChecker />
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          startIcon={<RestartAlt />}
          onClick={handleReset}
        >
          Start Over
        </Button>
      </Stack>
      
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        message="XLIFF file exported successfully!"
      />
    </Box>
  );
};