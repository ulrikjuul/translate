import React from 'react';
import { Box, Button, Stack, Alert, Snackbar } from '@mui/material';
import { Download, RestartAlt } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { generateXliff } from '../utils/xliffParser';

export const ExportActions: React.FC = () => {
  const { getMergedFile, reset, comparisonResults } = useComparisonStore();
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
    !r.selectedVersion && (r.file1Target || r.file2Target)
  ).length;
  
  if (comparisonResults.length === 0) return null;
  
  return (
    <Box sx={{ mt: 4 }}>
      {unselectedCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unselectedCount} translation{unselectedCount !== 1 ? 's' : ''} still need a version selected.
        </Alert>
      )}
      
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={unselectedCount > 0}
        >
          Export Merged XLIFF
        </Button>
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