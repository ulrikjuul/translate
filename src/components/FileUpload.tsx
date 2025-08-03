import React, { useCallback } from 'react';
import { Box, Button, Paper, Typography, Stack } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { parseXliff } from '../utils/xliffParser';

interface FileUploadProps {
  label: string;
  onFileLoad: (file: any, rawContent?: string) => void;
  fileName?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileLoad, fileName }) => {
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      console.log(`File ${label} size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`File ${label} text length: ${text.length} characters`);
      
      // Count trans-units in raw text using regex
      const transUnitMatches = text.match(/<trans-unit/gi);
      console.log(`File ${label} trans-units in raw text (regex): ${transUnitMatches?.length || 0}`);
      
      const xliffData = parseXliff(text);
      console.log(`File ${label} parsed trans-units: ${xliffData.transUnits.length}`);
      
      onFileLoad(xliffData, text);
    } catch (error) {
      console.error('Error parsing XLIFF file:', error);
      alert('Error parsing XLIFF file. Please check the file format.');
    }
  }, [onFileLoad, label]);
  
  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6">{label}</Typography>
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUpload />}
          fullWidth
        >
          Choose XLIFF File
          <input
            type="file"
            hidden
            accept=".xliff,.xlf"
            onChange={handleFileChange}
          />
        </Button>
        {fileName && (
          <Typography variant="body2" color="text.secondary">
            Loaded: {fileName}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export const FileUploadSection: React.FC = () => {
  const { setFile1, setFile2, setFile3, setFile4, file1, file2, file3, file4 } = useComparisonStore();
  
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        XLIFF Translation Comparison Tool
      </Typography>
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={3} sx={{ mt: 3 }}>
        <Box flex={1}>
          <FileUpload 
            label="File 1" 
            onFileLoad={setFile1}
            fileName={file1?.original}
          />
        </Box>
        <Box flex={1}>
          <FileUpload 
            label="File 2" 
            onFileLoad={setFile2}
            fileName={file2?.original}
          />
        </Box>
        <Box flex={1}>
          <FileUpload 
            label="File 3 (Optional)" 
            onFileLoad={setFile3}
            fileName={file3?.original}
          />
        </Box>
        <Box flex={1}>
          <FileUpload 
            label="File 4 (Optional)" 
            onFileLoad={setFile4}
            fileName={file4?.original}
          />
        </Box>
      </Stack>
    </Box>
  );
};