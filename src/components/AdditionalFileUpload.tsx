import React, { useState, useRef } from 'react';
import { 
  Paper, 
  Button, 
  Typography, 
  Stack, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Add, UploadFile } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { parseXliff, extractFileIdentifier } from '../utils/xliffParser';

export const AdditionalFileUpload: React.FC = () => {
  const { addAdditionalFile, getNextFileSlot, files } = useComparisonStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customIdentifier, setCustomIdentifier] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const nextSlot = getNextFileSlot();
  const loadedCount = Object.values(files).filter(f => f !== null).length;
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      // Extract identifier from filename
      const identifier = extractFileIdentifier(file.name);
      setCustomIdentifier(identifier);
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      const text = await selectedFile.text();
      const xliffData = parseXliff(text);
      
      // Use custom identifier if provided, otherwise use extracted one
      xliffData.fileIdentifier = customIdentifier || extractFileIdentifier(selectedFile.name);
      xliffData.original = selectedFile.name;
      
      addAdditionalFile(xliffData, text);
      
      setDialogOpen(false);
      setSelectedFile(null);
      setCustomIdentifier('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(`Failed to parse XLIFF file: ${err}`);
    }
  };
  
  const handleClose = () => {
    setDialogOpen(false);
    setSelectedFile(null);
    setCustomIdentifier('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  if (!nextSlot) {
    return (
      <Alert severity="info">
        Maximum 10 files can be loaded. Remove existing files to add more.
      </Alert>
    );
  }
  
  return (
    <>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="subtitle1">
              Additional Files
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {loadedCount} of 10 files loaded. {10 - loadedCount} slots available.
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            disabled={!nextSlot}
          >
            Add File
          </Button>
        </Stack>
      </Paper>
      
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Additional XLIFF File</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlf,.xliff"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="additional-file-input"
            />
            <label htmlFor="additional-file-input">
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadFile />}
                fullWidth
              >
                {selectedFile ? selectedFile.name : 'Choose XLIFF File'}
              </Button>
            </label>
            
            {selectedFile && (
              <TextField
                label="File Identifier"
                value={customIdentifier}
                onChange={(e) => setCustomIdentifier(e.target.value)}
                helperText="Customize how this file appears in the comparison (e.g., '999', 'TEST', 'v2')"
                fullWidth
              />
            )}
            
            {error && (
              <Alert severity="error">{error}</Alert>
            )}
            
            <Alert severity="info">
              This file will be added to slot {nextSlot} and included in the comparison.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            variant="contained" 
            disabled={!selectedFile}
          >
            Add to Comparison
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};