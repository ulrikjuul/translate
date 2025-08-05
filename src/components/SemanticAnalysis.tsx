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
  Snackbar,
  Slider,
  FormControl,
  FormLabel
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
  source: string;
  target: string;
  semanticScore: number;
  qualityCategory: 'good' | 'acceptable' | 'poor';
  analysisNotes: string;
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
  const [poorThreshold, setPoorThreshold] = useState(60);
  const [showFullList, setShowFullList] = useState(false);
  
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
      // Line#,ID,Source,Target,Semantic_Score,Quality_Category,Analysis_Notes
      
      const lines = flaggedInput.trim().split('\n');
      const flagged: FlaggedUnit[] = [];
      let isHeaderSkipped = false;
      
      lines.forEach((line, index) => {
        // Skip empty lines
        if (!line.trim()) return;
        
        // Skip header if it contains "Line#" or "Semantic_Score"
        if (!isHeaderSkipped && (line.includes('Line#') || line.includes('Semantic_Score'))) {
          isHeaderSkipped = true;
          return;
        }
        
        // Parse CSV line (handle commas in quoted fields)
        const parts = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        
        if (parts.length >= 7) {
          const lineNum = parseInt(parts[0].replace(/"/g, '').trim());
          const id = parts[1].replace(/"/g, '').trim();
          const source = parts[2].replace(/"/g, '').trim();
          const target = parts[3].replace(/"/g, '').trim();
          const score = parseInt(parts[4].replace(/"/g, '').trim());
          const category = parts[5].replace(/"/g, '').trim().toLowerCase() as 'good' | 'acceptable' | 'poor';
          const notes = parts[6].replace(/"/g, '').trim();
          
          if (!isNaN(lineNum) && !isNaN(score) && ['good', 'acceptable', 'poor'].includes(category)) {
            flagged.push({
              lineNumber: lineNum,
              id,
              source,
              target,
              semanticScore: score,
              qualityCategory: category,
              analysisNotes: notes
            });
          }
        }
      });
      
      if (flagged.length > 0) {
        // Sort by score (lowest first) to show worst matches at top
        flagged.sort((a, b) => a.semanticScore - b.semanticScore);
        setFlaggedUnits(flagged);
        setActiveStep(3);
        setShowResults(true);
        setSnackbar({ open: true, message: `Imported ${flagged.length} analyzed translations` });
      } else {
        setSnackbar({ open: true, message: 'No valid results found. Check format matches: Line#,ID,Source,Target,Semantic_Score,Quality_Category,Analysis_Notes' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error parsing results. Make sure format matches expected structure.' });
    }
  };

  const getQualityColor = (category: 'good' | 'acceptable' | 'poor') => {
    return {
      good: 'success',
      acceptable: 'warning',
      poor: 'error'
    }[category] as 'success' | 'warning' | 'error';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= poorThreshold) return 'warning';
    return 'error';
  };

  const getQualityCategory = (score: number): 'good' | 'acceptable' | 'poor' => {
    if (score >= 80) return 'good';
    if (score >= poorThreshold) return 'acceptable';
    return 'poor';
  };

  const exportFlaggedXLIFF = () => {
    const poorUnits = flaggedUnits.filter(u => u.qualityCategory === 'poor');
    const acceptableUnits = flaggedUnits.filter(u => u.qualityCategory === 'acceptable');
    const goodUnits = flaggedUnits.filter(u => u.qualityCategory === 'good');
    
    const reportText = `SEMANTIC ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
File: ${fileName}
Total Analyzed: ${flaggedUnits.length}

SUMMARY:
- Poor Quality (Score < 60): ${poorUnits.length}
- Acceptable Quality (Score 60-79): ${acceptableUnits.length}
- Good Quality (Score 80+): ${goodUnits.length}

POOR QUALITY TRANSLATIONS (${poorUnits.length}):
${poorUnits.map(u => `
ID: ${u.id}
Semantic Score: ${u.semanticScore}/100
Analysis: ${u.analysisNotes}
Source: ${u.source}
Target: ${u.target}
---`).join('\n')}

ACCEPTABLE QUALITY TRANSLATIONS (${acceptableUnits.length}):
${acceptableUnits.slice(0, 10).map(u => `
ID: ${u.id}
Semantic Score: ${u.semanticScore}/100
Analysis: ${u.analysisNotes}
Source: ${u.source}
Target: ${u.target}
---`).join('\n')}
${acceptableUnits.length > 10 ? `\n... and ${acceptableUnits.length - 10} more acceptable quality translations` : ''}

GOOD QUALITY TRANSLATIONS: ${goodUnits.length} units with scores 80+
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

  const exportAnnotatedXLIFF = () => {
    try {
      // Create a map of scores by ID
      const scoreMap = new Map<string, FlaggedUnit>();
      flaggedUnits.forEach(unit => {
        scoreMap.set(unit.id, unit);
      });

      // Parse the original XLIFF
      const parser = new DOMParser();
      const doc = parser.parseFromString(xliffContent, 'text/xml');
      
      // Add quality annotations to trans-units
      const transUnits = doc.getElementsByTagName('trans-unit');
      for (let i = 0; i < transUnits.length; i++) {
        const unit = transUnits[i];
        const id = unit.getAttribute('id');
        
        if (id && scoreMap.has(id)) {
          const scoreData = scoreMap.get(id)!;
          const qualityCategory = getQualityCategory(scoreData.semanticScore);
          
          // Add attributes for quality data
          unit.setAttribute('semantic-score', scoreData.semanticScore.toString());
          unit.setAttribute('quality-category', qualityCategory);
          
          // Add note element with analysis
          const noteElement = doc.createElement('note');
          noteElement.setAttribute('from', 'semantic-analysis');
          noteElement.textContent = `Score: ${scoreData.semanticScore}/100. ${scoreData.analysisNotes}`;
          
          // Insert note after target element
          const targetElement = unit.getElementsByTagName('target')[0];
          if (targetElement && targetElement.nextSibling) {
            unit.insertBefore(noteElement, targetElement.nextSibling);
          } else {
            unit.appendChild(noteElement);
          }
        }
      }
      
      // Serialize back to string
      const serializer = new XMLSerializer();
      const annotatedXML = serializer.serializeToString(doc);
      
      // Download the annotated file
      const blob = new Blob([annotatedXML], { type: 'text/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace('.xliff', '')}_annotated.xliff`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSnackbar({ open: true, message: 'Annotated XLIFF exported successfully!' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Error exporting annotated XLIFF' });
    }
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
              <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem' }}>
{`Line#,ID,Source,Target,Semantic_Score,Quality_Category,Analysis_Notes
1,16764,GUE Translations Master,GUE Übersetzungen Master,80,good,Good semantic preservation
2,16765,Discover Scuba,Schnuppertauchen,45,poor,Significant semantic differences
3,16766,Introduction,Einführung,80,good,Good semantic preservation`}
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
          <StepLabel>Review Analysis Results</StepLabel>
          <StepContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Analysis complete!</strong> Analyzed {flaggedUnits.length} translations.
              </Typography>
            </Alert>
            
            <FormControl sx={{ mb: 3, width: '100%' }}>
              <FormLabel>
                Poor Quality Threshold: {poorThreshold}
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  (Scores below {poorThreshold} are marked as poor quality)
                </Typography>
              </FormLabel>
              <Slider
                value={poorThreshold}
                onChange={(e, value) => setPoorThreshold(value as number)}
                min={30}
                max={80}
                step={5}
                marks={[
                  { value: 30, label: '30' },
                  { value: 50, label: '50' },
                  { value: 60, label: '60' },
                  { value: 70, label: '70' },
                  { value: 80, label: '80' }
                ]}
                valueLabelDisplay="auto"
                color="warning"
              />
            </FormControl>
            
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`Poor (< ${poorThreshold}): ${flaggedUnits.filter(u => getQualityCategory(u.semanticScore) === 'poor').length}`}
                color="error"
                size="small"
              />
              <Chip
                label={`Acceptable (${poorThreshold}-79): ${flaggedUnits.filter(u => getQualityCategory(u.semanticScore) === 'acceptable').length}`}
                color="warning"
                size="small"
              />
              <Chip
                label={`Good (80+): ${flaggedUnits.filter(u => getQualityCategory(u.semanticScore) === 'good').length}`}
                color="success"
                size="small"
              />
            </Stack>
            
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={exportFlaggedXLIFF}
              >
                Export Analysis Report
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Download />}
                onClick={exportAnnotatedXLIFF}
              >
                Export Full XLIFF with Annotations
              </Button>
            </Stack>
            
            <Button
              variant="outlined"
              onClick={() => setShowFullList(true)}
            >
              View All Strings with Quality Scores
            </Button>
          </StepContent>
        </Step>
      </Stepper>

      {showResults && (
        <Paper elevation={2} sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Semantic Analysis Results
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Score</TableCell>
                  <TableCell>Quality</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Analysis</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flaggedUnits.map((unit) => (
                  <TableRow 
                    key={unit.lineNumber}
                    sx={{ 
                      backgroundColor: unit.qualityCategory === 'poor' ? 'error.lighter' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={unit.semanticScore}
                        color={getScoreColor(unit.semanticScore)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={unit.qualityCategory.toUpperCase()}
                        color={getQualityColor(unit.qualityCategory)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{unit.id}</TableCell>
                    <TableCell sx={{ maxWidth: 250, fontSize: '0.75rem' }}>
                      <Tooltip title={unit.source}>
                        <Typography variant="body2" noWrap>
                          {unit.source}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 250, fontSize: '0.75rem' }}>
                      <Tooltip title={unit.target}>
                        <Typography variant="body2" noWrap>
                          {unit.target}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, fontSize: '0.75rem' }}>
                      {unit.analysisNotes}
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Full List Dialog */}
      <Dialog 
        open={showFullList} 
        onClose={() => setShowFullList(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          All Strings with Quality Scores
          <Typography variant="body2" color="text.secondary">
            Total: {analysisData.length} strings | Analyzed: {flaggedUnits.length} strings
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line#</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Quality</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Analysis</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analysisData.map((item) => {
                  const flaggedUnit = flaggedUnits.find(f => f.id === item.id);
                  const hasScore = !!flaggedUnit;
                  const qualityCategory = hasScore ? getQualityCategory(flaggedUnit.semanticScore) : null;
                  
                  return (
                    <TableRow 
                      key={item.lineNumber}
                      sx={{ 
                        backgroundColor: hasScore && qualityCategory === 'poor' ? 'error.lighter' : 
                                       hasScore && qualityCategory === 'acceptable' ? 'warning.lighter' : 
                                       hasScore ? 'success.lighter' : 'inherit',
                        opacity: hasScore ? 1 : 0.6
                      }}
                    >
                      <TableCell>{item.lineNumber}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{item.id}</TableCell>
                      <TableCell>
                        {hasScore ? (
                          <Chip
                            label={flaggedUnit.semanticScore}
                            color={getScoreColor(flaggedUnit.semanticScore)}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasScore && qualityCategory ? (
                          <Chip
                            label={qualityCategory.toUpperCase()}
                            color={getQualityColor(qualityCategory)}
                            size="small"
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">Not analyzed</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 250, fontSize: '0.75rem' }}>
                        <Tooltip title={item.sourceText}>
                          <Typography variant="body2" noWrap>
                            {item.sourceText}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 250, fontSize: '0.75rem' }}>
                        <Tooltip title={item.targetText}>
                          <Typography variant="body2" noWrap>
                            {item.targetText}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300, fontSize: '0.75rem' }}>
                        {hasScore ? flaggedUnit.analysisNotes : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFullList(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={exportAnnotatedXLIFF}
            startIcon={<Download />}
          >
            Export Full XLIFF with Annotations
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};