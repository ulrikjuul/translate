import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { 
  CheckCircle, 
  Error, 
  Warning, 
  Info, 
  ContentCopy,
  Download,
  Assessment,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import { generateXliff, parseXliff } from '../utils/xliffParser';
import type { FileName } from '../types/xliff';

interface MissingUnit {
  id: string;
  source: string;
  target: string;
  reason: 'not-in-comparison' | 'empty-target' | 'no-match';
}

interface ReportData {
  timestamp: string;
  latestStats: {
    totalUnits: number;
    nonEmptyUnits: number;
    emptyUnits: number;
    sourceLanguage: string;
    targetLanguage: string;
    fileName: string;
  };
  mergedStats: {
    totalUnits: number;
    sourceLanguage: string;
    targetLanguage: string;
  };
  changes: {
    fileName: FileName;
    fileIdentifier: string;
    count: number;
    percentage: number;
  }[];
  regressionChecks: {
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: string;
  }[];
  exportInfo: {
    skippedEmpty: number;
    selectedVersions: number;
    defaultVersions: number;
    latestUnitsInComparison: number;
    latestUnitsNotInComparison: number;
  };
  missingUnits: MissingUnit[];
}

interface ExportReportProps {
  open: boolean;
  onClose: () => void;
  exportedContent: string;
}

export const ExportReport: React.FC<ExportReportProps> = ({ open, onClose, exportedContent }) => {
  const { files, comparisonResults, getMergedFile } = useComparisonStore();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMissingUnits, setShowMissingUnits] = useState(false);

  useEffect(() => {
    if (open && exportedContent) {
      generateReport();
    }
  }, [open, exportedContent]);

  const generateReport = async () => {
    setLoading(true);
    
    try {
      // Find LATEST file
      const latestEntry = Object.entries(files).find(([_, file]) => 
        file?.fileIdentifier === 'LATEST'
      );
      
      if (!latestEntry) {
        setReportData(null);
        setLoading(false);
        return;
      }

      const [latestFileName, latestFile] = latestEntry;
      const mergedFile = getMergedFile();
      
      if (!latestFile || !mergedFile) {
        setReportData(null);
        setLoading(false);
        return;
      }

      // Parse exported content
      const exportedParsed = parseXliff(exportedContent);

      // Calculate statistics
      const latestStats = {
        totalUnits: latestFile.transUnits.length,
        nonEmptyUnits: latestFile.transUnits.filter(u => u.target && u.target.trim() !== '').length,
        emptyUnits: latestFile.transUnits.filter(u => !u.target || u.target.trim() === '').length,
        sourceLanguage: latestFile.sourceLanguage,
        targetLanguage: latestFile.targetLanguage,
        fileName: latestFile.original || 'LATEST'
      };

      const mergedStats = {
        totalUnits: exportedParsed.transUnits.length,
        sourceLanguage: exportedParsed.sourceLanguage,
        targetLanguage: exportedParsed.targetLanguage
      };

      // Calculate changes by source file
      const changesByFile = new Map<FileName, number>();
      const fileIdentifiers = new Map<FileName, string>();
      
      comparisonResults.forEach(result => {
        if (result.selectedVersion && result.selectedVersion !== latestFileName) {
          changesByFile.set(
            result.selectedVersion,
            (changesByFile.get(result.selectedVersion) || 0) + 1
          );
        }
      });

      // Get file identifiers
      Object.entries(files).forEach(([fileName, file]) => {
        if (file) {
          fileIdentifiers.set(fileName as FileName, file.fileIdentifier || fileName);
        }
      });

      const changes = Array.from(changesByFile.entries()).map(([fileName, count]) => ({
        fileName,
        fileIdentifier: fileIdentifiers.get(fileName) || fileName,
        count,
        percentage: Math.round((count / mergedStats.totalUnits) * 100)
      })).sort((a, b) => b.count - a.count);

      // Run regression checks
      const regressionChecks: ReportData['regressionChecks'] = [];

      // Check 1: Language consistency
      if (latestStats.sourceLanguage === mergedStats.sourceLanguage) {
        regressionChecks.push({
          status: 'pass',
          message: 'Source language preserved',
          details: latestStats.sourceLanguage
        });
      } else {
        regressionChecks.push({
          status: 'fail',
          message: 'Source language mismatch',
          details: `Expected: ${latestStats.sourceLanguage}, Got: ${mergedStats.sourceLanguage}`
        });
      }

      if (latestStats.targetLanguage === mergedStats.targetLanguage) {
        regressionChecks.push({
          status: 'pass',
          message: 'Target language preserved',
          details: latestStats.targetLanguage
        });
      } else {
        regressionChecks.push({
          status: 'fail',
          message: 'Target language mismatch',
          details: `Expected: ${latestStats.targetLanguage}, Got: ${mergedStats.targetLanguage}`
        });
      }

      // Check 2: Unit count
      const difference = latestStats.nonEmptyUnits - mergedStats.totalUnits;
      
      if (mergedStats.totalUnits === latestStats.nonEmptyUnits) {
        regressionChecks.push({
          status: 'pass',
          message: 'All non-empty trans-units exported',
          details: `${mergedStats.totalUnits} units (${latestStats.emptyUnits} empty skipped)`
        });
      } else if (mergedStats.totalUnits < latestStats.nonEmptyUnits) {
        // This can happen if some units couldn't be matched or were excluded
        regressionChecks.push({
          status: 'warning',
          message: `${difference} trans-units missing from export`,
          details: `LATEST has ${latestStats.nonEmptyUnits} non-empty, exported ${mergedStats.totalUnits}. This may occur if source strings couldn't be matched across files.`
        });
      } else {
        regressionChecks.push({
          status: 'fail',
          message: 'More trans-units than expected',
          details: `Expected max: ${latestStats.nonEmptyUnits}, Got: ${mergedStats.totalUnits}`
        });
      }

      // Check 3: Order preservation (sample check)
      let orderPreserved = true;
      const sampleSize = Math.min(10, exportedParsed.transUnits.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const exportedUnit = exportedParsed.transUnits[i];
        const latestUnit = latestFile.transUnits.find(u => 
          u.id === exportedUnit.id && u.source === exportedUnit.source
        );
        
        if (!latestUnit) {
          orderPreserved = false;
          break;
        }
      }

      regressionChecks.push({
        status: orderPreserved ? 'pass' : 'fail',
        message: orderPreserved ? 'Trans-unit order preserved' : 'Trans-unit order changed',
        details: `Checked first ${sampleSize} units`
      });

      // Check 4: XML validity
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(exportedContent, 'text/xml');
        const parserError = doc.querySelector('parsererror');
        
        if (parserError) {
          regressionChecks.push({
            status: 'fail',
            message: 'Invalid XML structure',
            details: 'XML parsing error detected'
          });
        } else {
          regressionChecks.push({
            status: 'pass',
            message: 'Valid XML structure'
          });
        }
      } catch (error) {
        regressionChecks.push({
          status: 'fail',
          message: 'XML validation failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Calculate detailed export info
      const selectedCount = comparisonResults.filter(r => r.selectedVersion).length;
      
      // Check how many LATEST units were in comparison
      const latestUnitsInComparison = comparisonResults.filter(r => 
        r.inFiles.includes(latestFileName as FileName)
      ).length;
      
      // Find missing units
      const missingUnits: MissingUnit[] = [];
      const exportedIds = new Set(exportedParsed.transUnits.map(u => u.id));
      const exportedSources = new Set(exportedParsed.transUnits.map(u => u.source));
      
      // Check each LATEST unit to see if it's missing
      latestFile.transUnits.forEach(unit => {
        if (!exportedIds.has(unit.id) && !exportedSources.has(unit.source)) {
          let reason: MissingUnit['reason'] = 'no-match';
          
          if (!unit.target || unit.target.trim() === '') {
            reason = 'empty-target';
          } else {
            // Check if it was in comparison
            const inComparison = comparisonResults.some(r => 
              r.source === (unit.sourceText || unit.source) ||
              r.id === unit.id
            );
            if (!inComparison) {
              reason = 'not-in-comparison';
            }
          }
          
          missingUnits.push({
            id: unit.id,
            source: unit.source.substring(0, 100) + (unit.source.length > 100 ? '...' : ''),
            target: unit.target.substring(0, 100) + (unit.target.length > 100 ? '...' : ''),
            reason
          });
        }
      });
      
      const exportInfo = {
        skippedEmpty: latestStats.emptyUnits,
        selectedVersions: selectedCount,
        defaultVersions: comparisonResults.filter(r => 
          !r.selectedVersion && r.inFiles.length > 0
        ).length,
        latestUnitsInComparison,
        latestUnitsNotInComparison: latestStats.totalUnits - latestUnitsInComparison
      };

      setReportData({
        timestamp: new Date().toISOString(),
        latestStats,
        mergedStats,
        changes,
        regressionChecks,
        exportInfo,
        missingUnits
      });
    } catch (error) {
      console.error('Error generating report:', error);
      setReportData(null);
    }
    
    setLoading(false);
  };

  const copyReport = () => {
    if (!reportData) return;
    
    const reportText = `XLIFF Export Report
Generated: ${new Date(reportData.timestamp).toLocaleString()}

LATEST FILE STATISTICS:
- File: ${reportData.latestStats.fileName}
- Total trans-units: ${reportData.latestStats.totalUnits}
- Non-empty trans-units: ${reportData.latestStats.nonEmptyUnits}
- Empty trans-units: ${reportData.latestStats.emptyUnits}
- Languages: ${reportData.latestStats.sourceLanguage} → ${reportData.latestStats.targetLanguage}

EXPORTED FILE STATISTICS:
- Total trans-units: ${reportData.mergedStats.totalUnits}
- Languages: ${reportData.mergedStats.sourceLanguage} → ${reportData.mergedStats.targetLanguage}

CHANGES BY SOURCE:
${reportData.changes.map(c => 
  `- ${c.fileIdentifier}: ${c.count} units (${c.percentage}%)`
).join('\n')}

REGRESSION CHECKS:
${reportData.regressionChecks.map(check => 
  `[${check.status.toUpperCase()}] ${check.message}${check.details ? `\n  Details: ${check.details}` : ''}`
).join('\n')}

EXPORT SUMMARY:
- Skipped empty targets: ${reportData.exportInfo.skippedEmpty}
- User selections: ${reportData.exportInfo.selectedVersions}
- Default selections: ${reportData.exportInfo.defaultVersions}

MISSING TRANS-UNITS: ${reportData.missingUnits.length}
${reportData.missingUnits.length > 0 ? `
- Empty targets (skipped): ${reportData.missingUnits.filter(u => u.reason === 'empty-target').length}
- Not found in other files: ${reportData.missingUnits.filter(u => u.reason === 'not-in-comparison').length}
- Could not match source: ${reportData.missingUnits.filter(u => u.reason === 'no-match').length}
` : ''}
`;

    navigator.clipboard.writeText(reportText);
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass': return <CheckCircle color="success" />;
      case 'fail': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass': return 'success';
      case 'fail': return 'error';
      case 'warning': return 'warning';
    }
  };

  if (!reportData && !loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Export Report</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            No LATEST file found. Cannot generate comparison report.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Assessment />
            <Typography variant="h6">Export Report</Typography>
          </Stack>
          {reportData && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Copy report to clipboard">
                <IconButton onClick={copyReport} size="small">
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ py: 4 }}>
            <LinearProgress />
            <Typography align="center" sx={{ mt: 2 }}>Generating report...</Typography>
          </Box>
        ) : reportData ? (
          <Stack spacing={3}>
            {/* Summary Stats */}
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Export Summary
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Chip 
                  icon={<CheckCircle />}
                  label={`${reportData.mergedStats.totalUnits} trans-units exported`}
                  color="success"
                />
                <Chip 
                  icon={<Info />}
                  label={`${reportData.exportInfo.skippedEmpty} empty skipped`}
                  color="info"
                />
                <Chip 
                  label={`${reportData.exportInfo.selectedVersions} user selections`}
                  color="primary"
                />
                <Chip 
                  label={`${reportData.exportInfo.defaultVersions} defaults used`}
                  variant="outlined"
                />
              </Stack>
            </Box>

            <Divider />

            {/* File Comparison */}
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                File Comparison
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Attribute</TableCell>
                      <TableCell>LATEST</TableCell>
                      <TableCell>Exported</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Source Language</TableCell>
                      <TableCell>{reportData.latestStats.sourceLanguage}</TableCell>
                      <TableCell>{reportData.mergedStats.sourceLanguage}</TableCell>
                      <TableCell>
                        {reportData.latestStats.sourceLanguage === reportData.mergedStats.sourceLanguage ? 
                          <CheckCircle color="success" fontSize="small" /> : 
                          <Error color="error" fontSize="small" />
                        }
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Target Language</TableCell>
                      <TableCell>{reportData.latestStats.targetLanguage}</TableCell>
                      <TableCell>{reportData.mergedStats.targetLanguage}</TableCell>
                      <TableCell>
                        {reportData.latestStats.targetLanguage === reportData.mergedStats.targetLanguage ? 
                          <CheckCircle color="success" fontSize="small" /> : 
                          <Error color="error" fontSize="small" />
                        }
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Trans-units</TableCell>
                      <TableCell>{reportData.latestStats.totalUnits}</TableCell>
                      <TableCell rowSpan={3} sx={{ verticalAlign: 'middle' }}>
                        {reportData.mergedStats.totalUnits}
                      </TableCell>
                      <TableCell rowSpan={3} sx={{ verticalAlign: 'middle' }}>
                        <Tooltip title="See breakdown below">
                          <Info color="info" fontSize="small" />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>- With translations</TableCell>
                      <TableCell>{reportData.latestStats.nonEmptyUnits}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>- Empty (skipped)</TableCell>
                      <TableCell>{reportData.latestStats.emptyUnits}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              {reportData.latestStats.nonEmptyUnits !== reportData.mergedStats.totalUnits && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Why the difference?</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    LATEST has {reportData.latestStats.nonEmptyUnits} trans-units with translations, 
                    but only {reportData.mergedStats.totalUnits} were exported.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Comparison analysis:</strong>
                  </Typography>
                  <Box component="ul" sx={{ mt: 0.5, mb: 0 }}>
                    <li>{reportData.exportInfo.latestUnitsInComparison} LATEST units were compared with other files</li>
                    <li>{reportData.exportInfo.latestUnitsNotInComparison} LATEST units were NOT in the comparison (only exist in LATEST)</li>
                    <li>{reportData.latestStats.emptyUnits} units had empty targets and were skipped</li>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Possible reasons:</strong>
                  </Typography>
                  <Box component="ul" sx={{ mt: 0.5, mb: 0 }}>
                    <li>Source strings may differ slightly between files (XML tags, whitespace)</li>
                    <li>Some trans-units only exist in LATEST and weren't loaded in other files</li>
                    <li>The comparison uses plain text matching which may miss units with different XML structure</li>
                  </Box>
                </Alert>
              )}
              
              {/* Missing Units Section */}
              {reportData.missingUnits.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    startIcon={showMissingUnits ? <ExpandLess /> : <ExpandMore />}
                    onClick={() => setShowMissingUnits(!showMissingUnits)}
                    size="small"
                    variant="outlined"
                  >
                    View {reportData.missingUnits.length} Missing Trans-units
                  </Button>
                  
                  <Collapse in={showMissingUnits}>
                    <Box sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Trans-units from LATEST that were not included in the export:
                      </Typography>
                      
                      {/* Group by reason */}
                      {['empty-target', 'not-in-comparison', 'no-match'].map(reasonType => {
                        const unitsWithReason = reportData.missingUnits.filter(u => u.reason === reasonType);
                        if (unitsWithReason.length === 0) return null;
                        
                        const reasonLabel = {
                          'empty-target': 'Empty Target (Intentionally Skipped)',
                          'not-in-comparison': 'Not Found in Other Files',
                          'no-match': 'Could Not Match Source'
                        }[reasonType];
                        
                        const reasonColor = {
                          'empty-target': 'info',
                          'not-in-comparison': 'warning',
                          'no-match': 'error'
                        }[reasonType] as 'info' | 'warning' | 'error';
                        
                        return (
                          <Box key={reasonType} sx={{ mb: 2 }}>
                            <Chip 
                              label={`${reasonLabel}: ${unitsWithReason.length} units`}
                              color={reasonColor}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <List dense>
                              {unitsWithReason.slice(0, 10).map((unit, index) => (
                                <ListItem key={index} sx={{ pl: 2 }}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="caption" component="span">
                                        <strong>ID:</strong> {unit.id}
                                      </Typography>
                                    }
                                    secondary={
                                      <>
                                        <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                                          <strong>Source:</strong> {unit.source}
                                        </Typography>
                                        {unit.target && (
                                          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                                            <strong>Target:</strong> {unit.target}
                                          </Typography>
                                        )}
                                      </>
                                    }
                                  />
                                </ListItem>
                              ))}
                              {unitsWithReason.length > 10 && (
                                <ListItem sx={{ pl: 2 }}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="caption" color="text.secondary">
                                        ... and {unitsWithReason.length - 10} more
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              )}
                            </List>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Box>

            {/* Changes by Source */}
            {reportData.changes.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Translation Sources
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Files that contributed translations different from LATEST:
                  </Typography>
                  <Stack spacing={1}>
                    {reportData.changes.map(change => (
                      <Box key={change.fileName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={change.fileIdentifier}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Typography variant="body2">
                          {change.count} translations ({change.percentage}%)
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </>
            )}

            <Divider />

            {/* Regression Checks */}
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Regression Checks
              </Typography>
              <Stack spacing={1}>
                {reportData.regressionChecks.map((check, index) => (
                  <Alert
                    key={index}
                    severity={getStatusColor(check.status)}
                    icon={getStatusIcon(check.status)}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      {check.message}
                    </Typography>
                    {check.details && (
                      <Typography variant="caption" sx={{ mt: 0.5 }}>
                        {check.details}
                      </Typography>
                    )}
                  </Alert>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* Timestamp */}
            <Typography variant="caption" color="text.secondary" align="center">
              Report generated: {new Date(reportData.timestamp).toLocaleString()}
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};