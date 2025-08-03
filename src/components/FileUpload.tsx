import React, { useCallback } from 'react';
import { Box, Button, Paper, Typography, Stack, Grid } from '@mui/material';
import { CloudUpload, CheckCircle } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { parseXliff, extractFileIdentifier } from '../utils/xliffParser';

interface FileUploadProps {
  fileNum: number;
  onFileLoad: (file: any, rawContent?: string) => void;
  file?: any;
}

export const FileUpload: React.FC<FileUploadProps> = ({ fileNum, onFileLoad, file }) => {
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    
    try {
      const text = await uploadedFile.text();
      console.log(`File ${fileNum} size: ${uploadedFile.size} bytes (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`File ${fileNum} text length: ${text.length} characters`);
      
      // Count trans-units in raw text using regex
      const transUnitMatches = text.match(/<trans-unit/gi);
      console.log(`File ${fileNum} trans-units in raw text (regex): ${transUnitMatches?.length || 0}`);
      
      const xliffData = parseXliff(text);
      console.log(`File ${fileNum} parsed trans-units: ${xliffData.transUnits.length}`);
      
      // Extract identifier from filename
      const fileIdentifier = extractFileIdentifier(uploadedFile.name);
      xliffData.fileIdentifier = fileIdentifier;
      console.log(`File ${fileNum} identifier: ${fileIdentifier}`);
      
      onFileLoad(xliffData, text);
    } catch (error) {
      console.error('Error parsing XLIFF file:', error);
      alert('Error parsing XLIFF file. Please check the file format.');
    }
  }, [onFileLoad, fileNum]);
  
  const isLoaded = !!file;
  const identifier = file?.fileIdentifier || `File ${fileNum}`;
  
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2,
        height: '100%',
        bgcolor: isLoaded ? 'action.hover' : 'background.paper',
        border: isLoaded ? '2px solid' : '2px dashed',
        borderColor: isLoaded ? 'primary.main' : 'divider'
      }}
    >
      <Stack spacing={1} alignItems="center" height="100%">
        <Typography 
          variant="subtitle1" 
          fontWeight={isLoaded ? 'bold' : 'normal'}
          color={isLoaded ? 'primary' : 'text.secondary'}
        >
          {identifier}
        </Typography>
        
        {isLoaded && (
          <CheckCircle color="success" fontSize="small" />
        )}
        
        <Button
          variant={isLoaded ? "outlined" : "contained"}
          component="label"
          startIcon={<CloudUpload />}
          size="small"
          fullWidth
        >
          {isLoaded ? 'Replace' : 'Upload'}
          <input
            type="file"
            hidden
            accept=".xliff,.xlf"
            onChange={handleFileChange}
          />
        </Button>
        
        {file && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>
              {file.original || 'Unnamed'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {file.transUnits.length} strings
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export const FileUploadSection: React.FC = () => {
  const store = useComparisonStore();
  const { setFile, getFile } = store;
  
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        XLIFF Translation Comparison Tool
      </Typography>
      <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 3 }}>
        Upload 2-10 XLIFF files to compare translations
      </Typography>
      
      <Grid container spacing={2}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
          <Grid item xs={6} sm={4} md={3} lg={2.4} key={num}>
            <FileUpload 
              fileNum={num}
              onFileLoad={(file, raw) => setFile(num, file, raw)}
              file={getFile(num)}
            />
          </Grid>
        ))}
      </Grid>
      
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Files are automatically compared when at least 2 are uploaded
        </Typography>
      </Box>
    </Box>
  );
};