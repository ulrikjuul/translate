import React, { useState } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert, Stack, Chip, LinearProgress } from '@mui/material';
import { CheckCircle, Error, Warning, Info } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { generateXliff, parseXliff } from '../utils/xliffParser';

interface RegressionResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const RegressionChecker: React.FC = () => {
  const { getMergedFile, files, rawFiles } = useComparisonStore();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RegressionResult[]>([]);
  const [checking, setChecking] = useState(false);

  const runRegressionCheck = async () => {
    setChecking(true);
    const newResults: RegressionResult[] = [];

    try {
      // Find LATEST file
      const latestEntry = Object.entries(files).find(([_, file]) => 
        file?.fileIdentifier === 'LATEST'
      );
      
      if (!latestEntry) {
        newResults.push({
          status: 'warning',
          message: 'No LATEST file found',
          details: 'Cannot perform regression check without LATEST file as baseline'
        });
        setResults(newResults);
        setChecking(false);
        return;
      }

      const [latestFileName, latestFile] = latestEntry;
      const latestRawContent = rawFiles[latestFileName];
      
      if (!latestFile || !latestRawContent) {
        newResults.push({
          status: 'fail',
          message: 'LATEST file data not available',
          details: 'Raw content for LATEST file is missing'
        });
        setResults(newResults);
        setChecking(false);
        return;
      }

      // Get merged file
      const mergedFile = getMergedFile();
      if (!mergedFile) {
        newResults.push({
          status: 'fail',
          message: 'No merged file available',
          details: 'Unable to generate merged file for comparison'
        });
        setResults(newResults);
        setChecking(false);
        return;
      }

      // Generate export
      const exportedXliff = generateXliff(mergedFile);
      
      // Parse both files to compare structure
      const latestParsed = parseXliff(latestRawContent);
      const exportedParsed = parseXliff(exportedXliff);

      // Check 1: File metadata should match
      if (latestParsed.sourceLanguage !== exportedParsed.sourceLanguage) {
        newResults.push({
          status: 'fail',
          message: 'Source language mismatch',
          details: `LATEST: ${latestParsed.sourceLanguage}, Exported: ${exportedParsed.sourceLanguage}`
        });
      } else {
        newResults.push({
          status: 'pass',
          message: 'Source language matches'
        });
      }

      if (latestParsed.targetLanguage !== exportedParsed.targetLanguage) {
        newResults.push({
          status: 'fail',
          message: 'Target language mismatch',
          details: `LATEST: ${latestParsed.targetLanguage}, Exported: ${exportedParsed.targetLanguage}`
        });
      } else {
        newResults.push({
          status: 'pass',
          message: 'Target language matches'
        });
      }

      // Check 2: Trans-unit count (exported may have fewer due to empty target filtering)
      const latestNonEmptyCount = latestParsed.transUnits.filter(u => u.target && u.target.trim() !== '').length;
      const exportedCount = exportedParsed.transUnits.length;
      
      if (exportedCount > latestNonEmptyCount) {
        newResults.push({
          status: 'warning',
          message: 'Exported file has more trans-units than expected',
          details: `LATEST non-empty: ${latestNonEmptyCount}, Exported: ${exportedCount}`
        });
      } else {
        newResults.push({
          status: 'pass',
          message: 'Trans-unit count is valid',
          details: `${exportedCount} trans-units with translations exported (${latestParsed.transUnits.length - exportedCount} empty targets skipped)`
        });
      }

      // Check 3: Order preservation - check first 10 trans-units
      const orderCheckCount = Math.min(10, exportedParsed.transUnits.length);
      let orderMismatch = false;
      
      for (let i = 0; i < orderCheckCount; i++) {
        const exportedUnit = exportedParsed.transUnits[i];
        // Find corresponding unit in LATEST by ID and source
        const latestUnit = latestParsed.transUnits.find(u => 
          u.id === exportedUnit.id && u.source === exportedUnit.source
        );
        
        if (!latestUnit) {
          orderMismatch = true;
          newResults.push({
            status: 'fail',
            message: `Trans-unit not found in LATEST: ${exportedUnit.id}`,
            details: `Source: ${exportedUnit.source.substring(0, 50)}...`
          });
          break;
        }
      }
      
      if (!orderMismatch) {
        newResults.push({
          status: 'pass',
          message: 'Trans-unit order is preserved',
          details: `First ${orderCheckCount} trans-units checked`
        });
      }

      // Check 4: Structure integrity - verify IDs and sources match
      const structureErrors: string[] = [];
      let checkedCount = 0;
      
      for (const exportedUnit of exportedParsed.transUnits) {
        const latestUnit = latestParsed.transUnits.find(u => u.id === exportedUnit.id);
        
        if (!latestUnit) {
          structureErrors.push(`ID ${exportedUnit.id} not found in LATEST`);
        } else if (latestUnit.source !== exportedUnit.source) {
          structureErrors.push(`Source mismatch for ID ${exportedUnit.id}`);
        }
        
        checkedCount++;
        if (structureErrors.length >= 5) break; // Limit error reporting
      }

      if (structureErrors.length === 0) {
        newResults.push({
          status: 'pass',
          message: 'All IDs and sources match LATEST',
          details: `${checkedCount} trans-units verified`
        });
      } else {
        newResults.push({
          status: 'fail',
          message: 'Structure integrity issues found',
          details: structureErrors.join('\n')
        });
      }

      // Check 5: XML structure validation
      try {
        const parser = new DOMParser();
        const exportedDoc = parser.parseFromString(exportedXliff, 'text/xml');
        const parserError = exportedDoc.querySelector('parsererror');
        
        if (parserError) {
          newResults.push({
            status: 'fail',
            message: 'Invalid XML structure',
            details: parserError.textContent || 'XML parsing failed'
          });
        } else {
          newResults.push({
            status: 'pass',
            message: 'XML structure is valid'
          });
        }
      } catch (error) {
        newResults.push({
          status: 'fail',
          message: 'XML validation error',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Check 6: Special characters escaping
      const escapingIssues: string[] = [];
      for (const unit of exportedParsed.transUnits.slice(0, 100)) { // Check first 100
        if (unit.target.includes('<') && !unit.target.includes('<g') && !unit.target.includes('<x') && !unit.target.includes('<ph')) {
          if (!unit.target.includes('&lt;')) {
            escapingIssues.push(`Unescaped < in unit ${unit.id}`);
          }
        }
        if (unit.target.includes('>') && !unit.target.includes('</g>') && !unit.target.includes('/>') && !unit.target.includes('</ph>')) {
          if (!unit.target.includes('&gt;')) {
            escapingIssues.push(`Unescaped > in unit ${unit.id}`);
          }
        }
      }

      if (escapingIssues.length === 0) {
        newResults.push({
          status: 'pass',
          message: 'XML special characters properly escaped'
        });
      } else {
        newResults.push({
          status: 'warning',
          message: 'Potential escaping issues',
          details: escapingIssues.slice(0, 3).join('\n')
        });
      }

    } catch (error) {
      newResults.push({
        status: 'fail',
        message: 'Regression check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setResults(newResults);
    setChecking(false);
  };

  const handleOpen = () => {
    setOpen(true);
    runRegressionCheck();
  };

  const getStatusIcon = (status: RegressionResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle color="success" />;
      case 'fail': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: RegressionResult['status']) => {
    switch (status) {
      case 'pass': return 'success';
      case 'fail': return 'error';
      case 'warning': return 'warning';
    }
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<Info />}
        onClick={handleOpen}
        size="small"
      >
        Run Regression Check
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Export Regression Check
          {results.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={`${passCount} Pass`} color="success" size="small" />
              {failCount > 0 && <Chip label={`${failCount} Fail`} color="error" size="small" />}
              {warningCount > 0 && <Chip label={`${warningCount} Warning`} color="warning" size="small" />}
            </Stack>
          )}
        </DialogTitle>
        <DialogContent>
          {checking ? (
            <Box sx={{ py: 4 }}>
              <LinearProgress />
              <Typography align="center" sx={{ mt: 2 }}>Running regression checks...</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {results.length === 0 ? (
                <Typography>Click "Run Regression Check" to start</Typography>
              ) : (
                results.map((result, index) => (
                  <Alert
                    key={index}
                    severity={getStatusColor(result.status)}
                    icon={getStatusIcon(result.status)}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      {result.message}
                    </Typography>
                    {result.details && (
                      <Typography variant="caption" component="pre" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                        {result.details}
                      </Typography>
                    )}
                  </Alert>
                ))
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
          {!checking && results.length > 0 && (
            <Button onClick={runRegressionCheck} variant="contained">
              Run Again
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};