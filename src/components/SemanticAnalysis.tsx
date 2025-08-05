import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  Paper,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  Upload,
  Download,
  ContentCopy,
  CheckCircle,
  Warning,
  Visibility,
  Search
} from '@mui/icons-material';
import { parseXliff } from '../utils/xliffParser';
import type { TransUnit } from '../types/xliff';

interface AnalysisData {
  id: string;
  lineNumber: number;
  source: string;
  target: string;
  sourceText: string; // Plain text version
  targetText: string; // Plain text version
}

interface FlaggedUnit {
  lineNumber: number;
  id: string;
  riskLevel: 'high' | 'medium' | 'low';
  reason: string;
}

export const SemanticAnalysis: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [xliffContent, setXliffContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<AnalysisData[]>([]);
  const [flaggedUnits, setFlaggedUnits] = useState<FlaggedUnit[]>([]);
  const [flaggedInput, setFlaggedInput] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setXliffContent(content);
      setFileName(file.name);
      
      try {
        const parsed = parseXliff(content);
        const data: AnalysisData[] = parsed.transUnits
          .filter(unit => unit.target && unit.target.trim() !== '') // Only include non-empty targets
          .map((unit, index) => ({
            id: unit.id,
            lineNumber: index + 1,
            source: unit.source,
            target: unit.target,
            sourceText: unit.sourceText || unit.source,
            targetText: unit.targetText || unit.target
          }));
        
        setAnalysisData(data);
        setActiveStep(1);
        setSnackbar({ open: true, message: `Loaded ${data.length} trans-units for analysis` });
      } catch (error) {
        setSnackbar({ open: true, message: 'Error parsing XLIFF file' });
      }
    };
    
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportForAnalysis = () => {
    // Create TSV format for easy copy-paste to spreadsheet
    const headers = ['Line#', 'ID', 'Source', 'Target'];
    const rows = analysisData.map(item => [
      item.lineNumber,
      item.id,
      item.sourceText,
      item.targetText
    ]);
    
    const tsv = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(tsv);
    setSnackbar({ open: true, message: 'Table copied to clipboard! Paste into spreadsheet for Gemini analysis.' });
  };

  const downloadCSV = () => {
    // Create CSV format for download
    const headers = ['Line#', 'ID', 'Source', 'Target'];
    const rows = analysisData.map(item => [
      item.lineNumber,
      item.id,
      `"${item.sourceText.replace(/"/g, '""')}"`,
      `"${item.targetText.replace(/"/g, '""')}"`
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace('.xliff', '')}_analysis.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importFlaggedResults = () => {
    try {
      // Parse the input - expecting format like:
      // Line#,Risk,Reason
      // 5,high,Translation refers to different concept
      // 12,medium,Possible terminology mismatch
      
      const lines = flaggedInput.trim().split('\n');
      const flagged: FlaggedUnit[] = [];
      
      lines.forEach(line => {
        // Try different delimiters
        let parts = line.split('\t');
        if (parts.length < 3) {
          parts = line.split(',');
        }
        
        if (parts.length >= 3) {
          const lineNum = parseInt(parts[0].trim());
          const risk = parts[1].trim().toLowerCase() as 'high' | 'medium' | 'low';
          const reason = parts.slice(2).join(',').trim();
          
          if (!isNaN(lineNum) && ['high', 'medium', 'low'].includes(risk)) {
            const analysisItem = analysisData.find(a => a.lineNumber === lineNum);
            if (analysisItem) {
              flagged.push({
                lineNumber: lineNum,
                id: analysisItem.id,
                riskLevel: risk,
                reason
              });
            }
          }
        }
      });
      
      if (flagged.length > 0) {
        setFlaggedUnits(flagged);
        setActiveStep(3);
        setShowResults(true);
        setSnackbar({ open: true, message: `Imported ${flagged.length} flagged translations` });
      } else {
        setSnackbar({ open: true, message: 'No valid flagged units found. Check format: Line#, Risk Level, Reason' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error parsing flagged results' });
    }
  };

  const getRiskColor = (risk: 'high' | 'medium' | 'low') => {
    return {
      high: 'error',
      medium: 'warning',
      low: 'info'
    }[risk] as 'error' | 'warning' | 'info';
  };

  const exportFlaggedXLIFF = () => {
    // Create a report of flagged units
    const report = flaggedUnits.map(unit => {
      const data = analysisData.find(a => a.lineNumber === unit.lineNumber);
      return {
        id: unit.id,
        risk: unit.riskLevel,
        reason: unit.reason,
        source: data?.sourceText || '',
        target: data?.targetText || ''
      };
    });
    
    const reportText = `SEMANTIC ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
File: ${fileName}
Total Flagged: ${flaggedUnits.length}

HIGH RISK (${flaggedUnits.filter(u => u.riskLevel === 'high').length}):
${flaggedUnits
  .filter(u => u.riskLevel === 'high')
  .map(u => {
    const data = analysisData.find(a => a.lineNumber === u.lineNumber);
    return `
ID: ${u.id}
Reason: ${u.reason}
Source: ${data?.sourceText || ''}
Target: ${data?.targetText || ''}
---`;
  }).join('\n')}

MEDIUM RISK (${flaggedUnits.filter(u => u.riskLevel === 'medium').length}):
${flaggedUnits
  .filter(u => u.riskLevel === 'medium')
  .map(u => {
    const data = analysisData.find(a => a.lineNumber === u.lineNumber);
    return `
ID: ${u.id}
Reason: ${u.reason}
Source: ${data?.sourceText || ''}
Target: ${data?.targetText || ''}
---`;
  }).join('\n')}

LOW RISK (${flaggedUnits.filter(u => u.riskLevel === 'low').length}):
${flaggedUnits
  .filter(u => u.riskLevel === 'low')
  .map(u => {
    const data = analysisData.find(a => a.lineNumber === u.lineNumber);
    return `
ID: ${u.id}
Reason: ${u.reason}
Source: ${data?.sourceText || ''}
Target: ${data?.targetText || ''}
---`;
  }).join('\n')}
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace('.xliff', '')}_semantic_analysis.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Semantic Translation Analysis
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Analyze translations for semantic mismatches using AI assistance
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Upload XLIFF File</StepLabel>
          <StepContent>
            <Typography variant="body2" paragraph>
              Select the XLIFF file you want to analyze for translation accuracy
            </Typography>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose XLIFF File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xliff,.xlf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Export for Analysis</StepLabel>
          <StepContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>File loaded:</strong> {fileName}
                <br />
                <strong>Trans-units:</strong> {analysisData.length}
              </Typography>
            </Alert>
            
            <Typography variant="body2" paragraph>
              Export the translation pairs in a format suitable for AI analysis:
            </Typography>
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<ContentCopy />}
                onClick={exportForAnalysis}
              >
                Copy Table to Clipboard
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={downloadCSV}
              >
                Download CSV
              </Button>
            </Stack>
            
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Next steps:</strong>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Paste the table into Google Sheets or Excel</li>
                  <li>Use Gemini/ChatGPT to analyze for semantic mismatches</li>
                  <li>Ask it to return a table with: Line#, Risk Level (high/medium/low), Reason</li>
                </ol>
              </Typography>
            </Alert>
            
            <Button
              sx={{ mt: 2 }}
              onClick={() => setActiveStep(2)}
            >
              Continue to Import Results
            </Button>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Import Analysis Results</StepLabel>
          <StepContent>
            <Typography variant="body2" paragraph>
              Paste the results from AI analysis below. Expected format:
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 1, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="caption" component="pre">
{`Line#	Risk	Reason
5	high	Translation refers to pressure instead of temperature
12	medium	Technical term translated incorrectly
23	low	Minor style inconsistency`}
              </Typography>
            </Paper>
            
            <TextField
              multiline
              rows={10}
              fullWidth
              variant="outlined"
              placeholder="Paste AI analysis results here..."
              value={flaggedInput}
              onChange={(e) => setFlaggedInput(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={importFlaggedResults}
                disabled={!flaggedInput.trim()}
              >
                Import Results
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setActiveStep(1);
                  setFlaggedInput('');
                }}
              >
                Back
              </Button>
            </Stack>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Review Flagged Translations</StepLabel>
          <StepContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Analysis complete!</strong> Found {flaggedUnits.length} potentially problematic translations.
              </Typography>
            </Alert>
            
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`High Risk: ${flaggedUnits.filter(u => u.riskLevel === 'high').length}`}
                color="error"
                size="small"
              />
              <Chip
                label={`Medium Risk: ${flaggedUnits.filter(u => u.riskLevel === 'medium').length}`}
                color="warning"
                size="small"
              />
              <Chip
                label={`Low Risk: ${flaggedUnits.filter(u => u.riskLevel === 'low').length}`}
                color="info"
                size="small"
              />
            </Stack>
            
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={exportFlaggedXLIFF}
              sx={{ mb: 2 }}
            >
              Export Analysis Report
            </Button>
          </StepContent>
        </Step>
      </Stepper>

      {showResults && (
        <Paper elevation={2} sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Flagged Translations
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Risk</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flaggedUnits
                  .sort((a, b) => {
                    const riskOrder = { high: 0, medium: 1, low: 2 };
                    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                  })
                  .map((unit) => {
                    const data = analysisData.find(a => a.lineNumber === unit.lineNumber);
                    return (
                      <TableRow key={unit.lineNumber}>
                        <TableCell>
                          <Chip
                            label={unit.riskLevel.toUpperCase()}
                            color={getRiskColor(unit.riskLevel)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{unit.id}</TableCell>
                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {data?.sourceText}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {data?.targetText}
                        </TableCell>
                        <TableCell>{unit.reason}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};