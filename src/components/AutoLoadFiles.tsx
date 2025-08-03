import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Stack, Paper, LinearProgress, Alert, Chip } from '@mui/material';
import { CloudDownload, CheckCircle, Error } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { parseXliff, extractFileIdentifier } from '../utils/xliffParser';

interface FileInfo {
  filename: string;
  identifier: string;
  sortOrder: number;
}

export const AutoLoadFiles: React.FC = () => {
  const { setFile, reset, files } = useComparisonStore();
  const [loading, setLoading] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);

  // Function to fetch and parse the file list
  const fetchFileList = async () => {
    try {
      // Fetch a list of XLIFF files from the public folder
      const response = await fetch('/xliff-files.json');
      
      // Check if the response is JSON (not HTML 404 page)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // File doesn't exist or server returned HTML
        return [];
      }
      
      if (!response.ok) {
        return [];
      }
      
      const fileList = await response.json();
      return fileList.files || [];
    } catch (error) {
      // JSON parsing error or network error
      // This is expected when the file doesn't exist
      return [];
    }
  };

  // Function to sort files by number, with LATEST at the end
  const sortFiles = (files: string[]): FileInfo[] => {
    return files
      .map(filename => {
        const identifier = extractFileIdentifier(filename);
        let sortOrder = 999999; // Default for non-numeric files
        
        if (identifier === 'LATEST') {
          sortOrder = 1000000; // Ensure LATEST is always last
        } else if (/^\d+$/.test(identifier)) {
          sortOrder = parseInt(identifier, 10);
        }
        
        return { filename, identifier, sortOrder };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // Function to load a single XLIFF file
  const loadXliffFile = async (filename: string, index: number) => {
    try {
      const response = await fetch(`/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
      }
      
      const text = await response.text();
      const xliffData = parseXliff(text);
      
      // Extract identifier from filename
      const fileIdentifier = extractFileIdentifier(filename);
      xliffData.fileIdentifier = fileIdentifier;
      xliffData.original = filename;
      
      // Set file in store (index + 1 because file numbers start at 1)
      setFile(index + 1, xliffData, text);
      
      return filename;
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      throw error;
    }
  };

  // Function to load all XLIFF files
  const loadAllFiles = async () => {
    setLoading(true);
    setLoadedFiles([]);
    setErrors([]);
    reset(); // Clear existing files
    
    try {
      // Get list of files
      let fileList = await fetchFileList();
      
      // If no file list, show helpful message
      if (fileList.length === 0) {
        setErrors(['Please create /public/xliff-files.json with your XLIFF file list (see example below)']);
        setLoading(false);
        return;
      }
      
      // Sort files
      const sortedFiles = sortFiles(fileList);
      setAvailableFiles(sortedFiles);
      
      // Load files in order (up to 10)
      const filesToLoad = sortedFiles.slice(0, 10);
      const loaded: string[] = [];
      const failed: string[] = [];
      
      for (let i = 0; i < filesToLoad.length; i++) {
        try {
          await loadXliffFile(filesToLoad[i].filename, i);
          loaded.push(filesToLoad[i].filename);
          setLoadedFiles([...loaded]);
        } catch (error) {
          failed.push(filesToLoad[i].filename);
          setErrors([...failed]);
        }
      }
      
      if (loaded.length > 0) {
        console.log(`Successfully loaded ${loaded.length} files`);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setErrors(['Failed to load file list']);
    } finally {
      setLoading(false);
    }
  };

  // Check if any files are already loaded
  const hasLoadedFiles = Object.values(files).some(f => f !== null);

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Auto-Load XLIFF Files
          </Typography>
          <Button
            variant="contained"
            startIcon={loading ? null : <CloudDownload />}
            onClick={loadAllFiles}
            disabled={loading}
          >
            {loading ? 'Loading...' : hasLoadedFiles ? 'Reload Files' : 'Load Files from Public Folder'}
          </Button>
        </Stack>
        
        <Typography variant="body2" color="text.secondary">
          Place XLIFF files in the <code>/public</code> folder. Files will be sorted by number (lowest first) with LATEST at the end.
        </Typography>
        
        {loading && <LinearProgress />}
        
        {availableFiles.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Available files (sorted):
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {availableFiles.map((file, index) => (
                <Chip
                  key={file.filename}
                  label={`${index + 1}. ${file.identifier}`}
                  size="small"
                  color={loadedFiles.includes(file.filename) ? 'success' : 'default'}
                  icon={loadedFiles.includes(file.filename) ? <CheckCircle /> : undefined}
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {loadedFiles.length > 0 && (
          <Alert severity="success">
            Successfully loaded {loadedFiles.length} file{loadedFiles.length !== 1 ? 's' : ''}
          </Alert>
        )}
        
        {errors.length > 0 && (
          <Alert severity={errors[0].includes('Please create') ? 'warning' : 'error'}>
            {errors.join(', ')}
          </Alert>
        )}
        
        <Alert severity="info">
          <Typography variant="body2" component="div">
            <strong>How to use:</strong>
            <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Place your XLIFF files in the <code>/public</code> folder</li>
              <li>Name your files with identifiers in parentheses (e.g., <code>translation (61).xlf</code>, <code>translation (185).xlf</code>)</li>
              <li>Create <code>/public/xliff-files.json</code> with your file list: <code>{`{"files": ["translation (61).xlf", "translation (185).xlf", "translation (latest).xlf"]}`}</code></li>
              <li>Click "Load Files from Public Folder" above</li>
            </ol>
          </Typography>
        </Alert>
      </Stack>
    </Paper>
  );
};