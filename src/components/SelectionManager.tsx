import React, { useRef } from 'react';
import { Box, Button, Stack, Snackbar, Alert, Typography, Tooltip } from '@mui/material';
import { Save, Upload, Info } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import type { SelectionConfig } from '../types/xliff';

export const SelectionManager: React.FC = () => {
  const { exportSelectionConfig, importSelectionConfig, comparisonResults } = useComparisonStore();
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSelection = () => {
    try {
      const config = exportSelectionConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `translation-selection-${timestamp}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      setSnackbar({
        open: true,
        message: `Selection saved to ${filename}`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save selection configuration',
        severity: 'error'
      });
    }
  };

  const handleLoadSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config: SelectionConfig = JSON.parse(content);
        
        // Validate config structure
        if (!config.version || !config.selections) {
          throw new Error('Invalid selection configuration file');
        }
        
        importSelectionConfig(config);
        
        const applied = config.selections.filter(s => s.selectedVersion).length;
        setSnackbar({
          open: true,
          message: `Loaded ${applied} selections from ${file.name}`,
          severity: 'success'
        });
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Failed to load selection configuration. Please check the file format.',
          severity: 'error'
        });
      }
    };
    
    reader.readAsText(file);
    
    // Reset input so the same file can be loaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasSelections = comparisonResults.some(r => r.selectedVersion);

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Selection Management
        </Typography>
        
        <Tooltip title="Save your current selections to a JSON file for later use">
          <Button
            variant="outlined"
            startIcon={<Save />}
            onClick={handleSaveSelection}
            disabled={!hasSelections}
            size="small"
          >
            Save Selection
          </Button>
        </Tooltip>
        
        <Tooltip title="Load a previously saved selection configuration">
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => fileInputRef.current?.click()}
            size="small"
          >
            Load Selection
          </Button>
        </Tooltip>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleLoadSelection}
        />
      </Stack>
      
      {hasSelections && (
        <Alert severity="info" icon={<Info />} sx={{ mt: 2 }}>
          <Typography variant="body2">
            Your selections are ready to be saved. This allows you to preserve your work and reload it later
            to continue refining or to use with an improved exporter.
          </Typography>
        </Alert>
      )}
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};