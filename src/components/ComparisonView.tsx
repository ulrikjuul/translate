import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
  Box,
  TextField,
  Typography,
  TablePagination,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableSortLabel,
  Button,
  IconButton,
  InputAdornment,
  Checkbox,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge
} from '@mui/material';
import { Search, Clear, Warning, CompareArrows, ViewColumn, Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import type { ComparisonResult, FileName } from '../types/xliff';

type Order = 'asc' | 'desc';
type OrderBy = 'id' | 'status' | 'source' | FileName;

const FILE_COLORS = {
  file1: 'info',
  file2: 'warning',
  file3: 'secondary',
  file4: 'success',
  file5: 'error',
  file6: 'primary',
  file7: 'info',
  file8: 'warning',
  file9: 'secondary',
  file10: 'success',
  file11: 'error',
  file12: 'primary',
  file13: 'info',
  file14: 'warning',
  file15: 'secondary'
} as const;

interface SelectedCell {
  resultId: string;
  fileName: FileName;
  content: string;
}

function getDifferences(text1: string, text2: string): { text: string; isDifferent: boolean; isAdded?: boolean; isRemoved?: boolean }[] {
  // Simple word-based diff
  const words1 = text1.split(/(\s+)/); // Split on whitespace but keep the whitespace
  const words2 = text2.split(/(\s+)/);
  const result: { text: string; isDifferent: boolean; isAdded?: boolean; isRemoved?: boolean }[] = [];
  
  let i = 0, j = 0;
  
  while (i < words1.length || j < words2.length) {
    if (i >= words1.length) {
      // Rest of text2 is added
      result.push({ text: words2.slice(j).join(''), isDifferent: true, isAdded: true });
      break;
    } else if (j >= words2.length) {
      // Rest of text1 is removed
      result.push({ text: words1.slice(i).join(''), isDifferent: true, isRemoved: true });
      break;
    } else if (words1[i] === words2[j]) {
      // Same word
      result.push({ text: words1[i], isDifferent: false });
      i++;
      j++;
    } else {
      // Different - try to find next matching word
      let nextMatch1 = -1;
      let nextMatch2 = -1;
      
      // Look for next match
      for (let k = j + 1; k < words2.length && k < j + 10; k++) {
        if (words1[i] === words2[k]) {
          nextMatch2 = k;
          break;
        }
      }
      
      for (let k = i + 1; k < words1.length && k < i + 10; k++) {
        if (words1[k] === words2[j]) {
          nextMatch1 = k;
          break;
        }
      }
      
      if (nextMatch2 !== -1 && (nextMatch1 === -1 || nextMatch2 - j < nextMatch1 - i)) {
        // Text added in text2
        result.push({ text: words2.slice(j, nextMatch2).join(''), isDifferent: true, isAdded: true });
        j = nextMatch2;
      } else if (nextMatch1 !== -1) {
        // Text removed from text1
        result.push({ text: words1.slice(i, nextMatch1).join(''), isDifferent: true, isRemoved: true });
        i = nextMatch1;
      } else {
        // Both different, show as changed
        result.push({ text: words1[i], isDifferent: true, isRemoved: true });
        result.push({ text: words2[j], isDifferent: true, isAdded: true });
        i++;
        j++;
      }
    }
  }
  
  return result;
}

export const ComparisonView: React.FC = () => {
  const store = useComparisonStore();
  const { comparisonResults, selectVersion, files, rawFiles, suspiciousFiles, toggleSuspicious } = store;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'different' | 'not-identical' | 'latest-matches-suspicious-change' | FileName>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('id');
  const [includeFileInfo, setIncludeFileInfo] = useState(false);
  const [searchInRaw, setSearchInRaw] = useState(false);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<FileName>>(new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  
  // Function to detect translation change patterns
  const getTranslationPattern = (result: ComparisonResult, fileIndex: number): 'changed' | 'consistent-after-change' | 'reverted' | null => {
    if (!result.isDifferent || result.inFiles.length <= 1) return null;
    
    const currentFileName = loadedFiles[fileIndex] as FileName;
    const currentTarget = result[`${currentFileName}Target` as keyof ComparisonResult] as string | undefined;
    
    if (!currentTarget) return null;
    
    // Check if this is where a change was introduced
    if (fileIndex > 0) {
      const prevFileName = loadedFiles[fileIndex - 1] as FileName;
      const prevTarget = result[`${prevFileName}Target` as keyof ComparisonResult] as string | undefined;
      
      if (prevTarget && prevTarget !== currentTarget) {
        // This is where the change happened
        // Now check if all subsequent files have the same new translation
        let isConsistent = true;
        for (let i = fileIndex + 1; i < loadedFiles.length; i++) {
          const nextFileName = loadedFiles[i] as FileName;
          const nextTarget = result[`${nextFileName}Target` as keyof ComparisonResult] as string | undefined;
          if (nextTarget && nextTarget !== currentTarget) {
            isConsistent = false;
            break;
          }
        }
        return isConsistent ? 'changed' : 'reverted';
      }
      
      // Check if this continues a consistent change from an earlier file
      for (let i = fileIndex - 1; i >= 0; i--) {
        const checkFileName = loadedFiles[i] as FileName;
        const checkTarget = result[`${checkFileName}Target` as keyof ComparisonResult] as string | undefined;
        
        if (i > 0) {
          const beforeCheckFileName = loadedFiles[i - 1] as FileName;
          const beforeCheckTarget = result[`${beforeCheckFileName}Target` as keyof ComparisonResult] as string | undefined;
          
          if (checkTarget && beforeCheckTarget && checkTarget !== beforeCheckTarget && checkTarget === currentTarget) {
            // Found where the change started, and current matches it
            return 'consistent-after-change';
          }
        }
      }
    }
    
    return null;
  };
  
  // Get loaded files
  const loadedFiles = Object.entries(files)
    .filter(([_, file]) => file !== null)
    .map(([key]) => key as FileName);
  
  // Get visible files (not hidden)
  const visibleFiles = loadedFiles.filter(fileName => !hiddenColumns.has(fileName));
  
  // Calculate column widths based on visible columns
  const calculateColumnWidth = () => {
    const fixedWidth = 60 + 100 + 150; // ID + Status + Select
    const availableWidth = `calc((100% - ${fixedWidth}px) / ${visibleFiles.length + 1})`;
    return availableWidth;
  };
  
  const toggleColumn = (fileName: FileName) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(fileName)) {
      newHidden.delete(fileName);
    } else {
      newHidden.add(fileName);
    }
    setHiddenColumns(newHidden);
  };
  
  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const getComparator = (
    order: Order,
    orderBy: OrderBy,
  ): ((a: ComparisonResult, b: ComparisonResult) => number) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const descendingComparator = (
    a: ComparisonResult,
    b: ComparisonResult,
    orderBy: OrderBy,
  ) => {
    let aValue: any;
    let bValue: any;

    if (orderBy === 'status') {
      // Sort by number of files first, then by difference status
      const aFileCount = a.inFiles.length;
      const bFileCount = b.inFiles.length;
      if (aFileCount !== bFileCount) return bFileCount - aFileCount;
      
      aValue = a.isDifferent ? 'different' : 'same';
      bValue = b.isDifferent ? 'different' : 'same';
    } else if (orderBy.startsWith('file')) {
      const targetKey = `${orderBy}Target` as keyof ComparisonResult;
      aValue = a[targetKey] || '';
      bValue = b[targetKey] || '';
    } else {
      aValue = a[orderBy as keyof ComparisonResult] || '';
      bValue = b[orderBy as keyof ComparisonResult] || '';
    }

    if (bValue < aValue) return -1;
    if (bValue > aValue) return 1;
    return 0;
  };

  const filteredResults = comparisonResults.filter(result => {
    // First apply filter type
    let matchesFilter = 
      filterType === 'all' ||
      (filterType === 'different' && result.isDifferent && result.inFiles.length > 1) ||
      (filterType === 'not-identical' && (result.isDifferent || result.inFiles.length === 1)) ||
      (filterType.startsWith('file') && result[`${filterType}Only` as keyof ComparisonResult]);
    
    // Special filter for LATEST matching changes made in suspicious files
    if (filterType === 'latest-matches-suspicious-change') {
      // Find the LATEST file
      const latestFile = loadedFiles.find(fileName => {
        const file = files[fileName];
        return file?.fileIdentifier === 'LATEST';
      });
      
      if (latestFile) {
        const latestTarget = result[`${latestFile}Target` as keyof ComparisonResult] as string | undefined;
        
        // Check if LATEST matches a change that was introduced in a suspicious file
        matchesFilter = false;
        for (const suspiciousFileName of suspiciousFiles) {
          const suspiciousTarget = result[`${suspiciousFileName}Target` as keyof ComparisonResult] as string | undefined;
          
          // Skip if suspicious file doesn't have this string or LATEST doesn't match it
          if (!suspiciousTarget || latestTarget !== suspiciousTarget) continue;
          
          const suspiciousIndex = loadedFiles.indexOf(suspiciousFileName);
          
          // Check if the suspicious file introduced a change
          let introducedChange = false;
          
          if (suspiciousIndex > 0) {
            // Check if different from previous file
            const prevFileName = loadedFiles[suspiciousIndex - 1];
            const prevTarget = result[`${prevFileName}Target` as keyof ComparisonResult] as string | undefined;
            
            if (prevTarget && prevTarget !== suspiciousTarget) {
              introducedChange = true;
            }
          } else if (suspiciousIndex === 0) {
            // First file - check if it's different from the next file
            if (loadedFiles.length > 1) {
              const nextFileName = loadedFiles[1];
              const nextTarget = result[`${nextFileName}Target` as keyof ComparisonResult] as string | undefined;
              
              if (nextTarget && nextTarget !== suspiciousTarget) {
                introducedChange = true;
              }
            }
          }
          
          // Also check if this is truly a change by looking at earlier versions
          // to avoid false positives where suspicious just continues an existing translation
          if (!introducedChange && suspiciousIndex > 0) {
            // Look back to see if there was ever a different translation
            for (let i = suspiciousIndex - 1; i >= 0; i--) {
              const earlierFileName = loadedFiles[i];
              const earlierTarget = result[`${earlierFileName}Target` as keyof ComparisonResult] as string | undefined;
              
              if (earlierTarget && earlierTarget !== suspiciousTarget) {
                // Found a different earlier translation, but suspicious didn't change from immediate predecessor
                // This means suspicious just continued an existing translation, not introduced a change
                break;
              }
            }
          }
          
          if (introducedChange) {
            matchesFilter = true;
            break;
          }
        }
      } else {
        matchesFilter = false;
      }
    }
    
    if (!matchesFilter) return false;
    
    // Then apply search if there's a search term
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    
    let matchesSearch = false;
    
    // Standard search in parsed fields
    matchesSearch = 
      (result.id || '').toLowerCase().includes(searchLower) ||
      (result.source || '').toLowerCase().includes(searchLower);
    
    // Search in all file targets
    for (let i = 1; i <= 10; i++) {
      const targetKey = `file${i}Target` as keyof ComparisonResult;
      const target = result[targetKey] as string | undefined;
      if (target && target.toLowerCase().includes(searchLower)) {
        matchesSearch = true;
        break;
      }
    }
    
    // Search in file metadata if enabled
    if (includeFileInfo && !matchesSearch) {
      for (const fileName of loadedFiles) {
        const file = files[fileName];
        if (file && (
          (file.original || '').toLowerCase().includes(searchLower) ||
          file.sourceLanguage.toLowerCase().includes(searchLower) ||
          file.targetLanguage.toLowerCase().includes(searchLower)
        )) {
          matchesSearch = true;
          break;
        }
      }
    }
    
    // Search in raw XML content
    if (searchInRaw && !matchesSearch) {
      for (const fileName of loadedFiles) {
        const raw = rawFiles[fileName];
        if (raw && raw.toLowerCase().includes(searchLower)) {
          matchesSearch = true;
          break;
        }
      }
    }
    
    return matchesSearch;
  });

  const sortedResults = [...filteredResults].sort(getComparator(order, orderBy));
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    setPage(0);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setPage(0);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };
  
  const getStatusChip = (result: ComparisonResult) => {
    if (result.inFiles.length === 1) {
      const onlyFile = result.inFiles[0];
      const file = files[onlyFile];
      const label = `${file?.fileIdentifier || onlyFile} Only`;
      return <Chip label={label} color={FILE_COLORS[onlyFile] as any} size="small" />;
    }
    
    if (result.isDifferent) {
      return <Chip label={`Different (${result.inFiles.length} files)`} color="error" size="small" />;
    }
    
    return <Chip label={`Same (${result.inFiles.length} files)`} color="success" size="small" />;
  };
  
  if (comparisonResults.length === 0) return null;
  
  // Calculate statistics
  const stats = {
    totalUnique: comparisonResults.length,
    identical: comparisonResults.filter(r => !r.isDifferent && r.inFiles.length > 1).length,
    different: comparisonResults.filter(r => r.isDifferent).length,
    fileOnlyCounts: {} as Record<FileName, number>,
    selectedCounts: {} as Record<FileName, number>
  };
  
  loadedFiles.forEach(fileName => {
    const onlyKey = `${fileName}Only` as keyof ComparisonResult;
    stats.fileOnlyCounts[fileName] = comparisonResults.filter(r => r[onlyKey]).length;
    stats.selectedCounts[fileName] = comparisonResults.filter(r => r.selectedVersion === fileName).length;
  });
  
  return (
    <Box>
      <Stack spacing={{ xs: 1, sm: 2 }} sx={{ mb: 2 }}>
        {selectedCells.length > 0 && (
          <Alert 
            severity="info" 
            icon={<CompareArrows />}
            action={
              <Button size="small" onClick={() => setSelectedCells([])}>
                Clear
              </Button>
            }
          >
            {selectedCells.length === 1 ? (
              <Typography variant="body2">
                <strong>Cell selected:</strong> {selectedCells[0].fileName} - Row ID: {selectedCells[0].resultId}
                <br />
                <em>Hold Option (Mac) or Alt (PC) and click another cell in the same row to compare</em>
              </Typography>
            ) : (
              <Typography variant="body2">
                <strong>Comparing:</strong> {selectedCells[0].fileName} vs {selectedCells[1].fileName}
                <br />
                <em>Green = added text, Red = removed text</em>
              </Typography>
            )}
          </Alert>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="h5">
              Translation Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {comparisonResults.length} unique source strings compared across {loadedFiles.length} files
            </Typography>
          </Stack>
          <Stack spacing={1} alignItems="flex-end">
            {searchTerm && (
              <Chip 
                label={`Searching for: "${searchTerm}"`}
                onDelete={handleClearSearch}
                color="primary"
                variant="outlined"
              />
            )}
            {searchTerm && (
              <Typography variant="body2" color="text.secondary">
                Showing {sortedResults.length} of {comparisonResults.length} strings
              </Typography>
            )}
          </Stack>
        </Stack>
        
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {loadedFiles.map(fileName => {
              const file = files[fileName];
              if (!file) return null;
              const isSuspicious = suspiciousFiles.has(fileName);
              return (
                <Tooltip key={fileName} title={isSuspicious ? "Marked as suspicious" : "Click to mark as suspicious"}>
                  <Chip
                    label={`${file.fileIdentifier || fileName}: ${file.transUnits.length} strings`}
                    variant={isSuspicious ? "outlined" : "filled"}
                    color={isSuspicious ? "warning" : FILE_COLORS[fileName] as any}
                    size="small"
                    icon={isSuspicious ? <Warning /> : undefined}
                    onClick={() => toggleSuspicious(fileName)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Click any file chip to mark it as 'Suspicious'
          </Typography>
        </Stack>
        
        <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Comparison Statistics
              </Typography>
              {Object.entries(stats.selectedCounts).some(([_, count]) => count > 0) && (
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="primary.main">
                    <strong>Selected versions:</strong>
                  </Typography>
                  {Object.entries(stats.selectedCounts)
                    .filter(([_, count]) => count > 0)
                    .map(([fileName, count]) => {
                      const file = files[fileName as FileName];
                      return (
                        <Chip
                          key={fileName}
                          label={`${file?.fileIdentifier || fileName}: ${count}`}
                          size="small"
                          color="primary"
                          icon={<CheckCircle />}
                        />
                      );
                    })}
                </Stack>
              )}
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Typography variant="body2">
                  <strong>Total unique:</strong> {stats.totalUnique}
                </Typography>
                {stats.identical > 0 && (
                  <Typography variant="body2" color="success.main">
                    <strong>Identical:</strong> {stats.identical}
                  </Typography>
                )}
                {stats.different > 0 && (
                  <Typography variant="body2" color="error.main">
                    <strong>Different:</strong> {stats.different}
                  </Typography>
                )}
                {Object.entries(stats.fileOnlyCounts).map(([fileName, count]) => {
                  if (count === 0) return null;
                  const file = files[fileName as FileName];
                  return (
                    <Typography key={fileName} variant="body2" color={`${FILE_COLORS[fileName as FileName]}.main`}>
                      <strong>{file?.fileIdentifier || fileName} only:</strong> {count}
                    </Typography>
                  );
                })}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Color Legend
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ 
                    width: 40, 
                    height: 20, 
                    bgcolor: 'success.light',
                    border: '2px solid',
                    borderColor: 'success.main',
                    borderRadius: 0.5
                  }} />
                  <Typography variant="caption">Change introduced (consistent after)</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ 
                    width: 40, 
                    height: 20, 
                    bgcolor: 'success.lighter',
                    border: '1px solid',
                    borderColor: 'success.light',
                    borderRadius: 0.5
                  }} />
                  <Typography variant="caption">Continues consistent change</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ 
                    width: 40, 
                    height: 20, 
                    bgcolor: 'warning.lighter',
                    border: '1px solid',
                    borderColor: 'warning.main',
                    borderRadius: 0.5
                  }} />
                  <Typography variant="caption">Change later reverted</Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Stack>
      
      <Stack spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="outlined"
            startIcon={<ViewColumn />}
            onClick={() => setColumnDialogOpen(true)}
            size="small"
          >
            Show/Hide Columns ({visibleFiles.length}/{loadedFiles.length})
          </Button>
          <TextField
            label="Search in translations"
            placeholder="Search in ID, source, or translations..."
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            sx={{ flex: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {searchTerm && (
                    <IconButton
                      onClick={handleClearSearch}
                      edge="end"
                      size="small"
                      title="Clear search"
                    >
                      <Clear />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            startIcon={<Search />}
            size="medium"
          >
            Search
          </Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filterType}
              label="Filter"
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setPage(0);
              }}
            >
              <MenuItem value="all">All Translations</MenuItem>
              <MenuItem value="different">Different Only</MenuItem>
              <MenuItem value="not-identical">Exclude Identical</MenuItem>
              <MenuItem value="latest-matches-suspicious-change">LATEST Matches Suspicious Change</MenuItem>
              {loadedFiles.map(fileName => {
                const file = files[fileName];
                return (
                  <MenuItem key={fileName} value={`${fileName}Only`}>
                    {file?.fileIdentifier || fileName} Only
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Stack>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeFileInfo}
                onChange={(e) => setIncludeFileInfo(e.target.checked)}
                size="small"
              />
            }
            label="Also search in file names and language codes"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={searchInRaw}
                onChange={(e) => setSearchInRaw(e.target.checked)}
                size="small"
              />
            }
            label="Search in full XLIFF file content (XML tags, attributes, etc.)"
          />
        </Stack>
      </Stack>
      
      <TableContainer component={Paper}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '60px' }}>
                <TableSortLabel
                  active={orderBy === 'id'}
                  direction={orderBy === 'id' ? order : 'asc'}
                  onClick={() => handleRequestSort('id')}
                >
                  ID
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: '100px' }}>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleRequestSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ 
                width: calculateColumnWidth()
              }}>
                <TableSortLabel
                  active={orderBy === 'source'}
                  direction={orderBy === 'source' ? order : 'asc'}
                  onClick={() => handleRequestSort('source')}
                >
                  Source
                </TableSortLabel>
              </TableCell>
              {visibleFiles.map(fileName => {
                const file = files[fileName];
                // Count how many strings are selected from this file
                const selectedCount = sortedResults.filter(r => r.selectedVersion === fileName).length;
                const hasSelections = selectedCount > 0;
                
                return (
                  <TableCell key={fileName} sx={{ 
                    width: calculateColumnWidth(),
                    position: 'relative'
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TableSortLabel
                        active={orderBy === fileName}
                        direction={orderBy === fileName ? order : 'asc'}
                        onClick={() => handleRequestSort(fileName)}
                      >
                        {file?.fileIdentifier || fileName}
                      </TableSortLabel>
                      {hasSelections && (
                        <Badge 
                          badgeContent={selectedCount} 
                          color="primary"
                          sx={{
                            '& .MuiBadge-badge': {
                              fontSize: '0.625rem',
                              height: '16px',
                              minWidth: '16px',
                              fontWeight: 'bold'
                            }
                          }}
                        >
                          <CheckCircle 
                            sx={{ 
                              fontSize: '1rem',
                              color: 'primary.main'
                            }}
                          />
                        </Badge>
                      )}
                    </Stack>
                  </TableCell>
                );
              })}
              <TableCell align="center" sx={{ 
                width: '150px',
                display: { xs: 'none', sm: 'table-cell' }
              }}>Select Version</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedResults
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((result) => {
                // Check if LATEST matches a change made in any suspicious file
                const latestFile = loadedFiles.find(fileName => {
                  const file = files[fileName];
                  return file?.fileIdentifier === 'LATEST';
                });
                
                let latestMatchesSuspiciousChange = false;
                if (latestFile) {
                  const latestTarget = result[`${latestFile}Target` as keyof ComparisonResult] as string | undefined;
                  for (const suspiciousFileName of suspiciousFiles) {
                    const suspiciousTarget = result[`${suspiciousFileName}Target` as keyof ComparisonResult] as string | undefined;
                    
                    // Skip if LATEST doesn't match this suspicious file
                    if (!suspiciousTarget || latestTarget !== suspiciousTarget) continue;
                    
                    const suspiciousIndex = loadedFiles.indexOf(suspiciousFileName);
                    
                    // Check if suspicious file introduced a change
                    if (suspiciousIndex > 0) {
                      const prevFileName = loadedFiles[suspiciousIndex - 1];
                      const prevTarget = result[`${prevFileName}Target` as keyof ComparisonResult] as string | undefined;
                      
                      // Check if suspicious file changed from previous
                      if (prevTarget && prevTarget !== suspiciousTarget) {
                        latestMatchesSuspiciousChange = true;
                        break;
                      }
                    } else if (suspiciousIndex === 0 && loadedFiles.length > 1) {
                      // First file - check if different from next
                      const nextFileName = loadedFiles[1];
                      const nextTarget = result[`${nextFileName}Target` as keyof ComparisonResult] as string | undefined;
                      
                      if (nextTarget && nextTarget !== suspiciousTarget) {
                        latestMatchesSuspiciousChange = true;
                        break;
                      }
                    }
                  }
                }
                
                return (
                <TableRow 
                  key={result.id}
                  sx={{
                    backgroundColor: latestMatchesSuspiciousChange ? 'warning.lighter' : 'inherit'
                  }}
                >
                  <TableCell sx={{ 
                    wordBreak: 'break-word',
                    fontSize: '0.6rem'
                  }}>
                    {result.id}
                  </TableCell>
                  <TableCell>{getStatusChip(result)}</TableCell>
                  <TableCell sx={{ 
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {result.source}
                  </TableCell>
                  {visibleFiles.map((fileName) => {
                    const fileIndex = loadedFiles.indexOf(fileName);
                    const targetKey = `${fileName}Target` as keyof ComparisonResult;
                    const target = result[targetKey] as string | undefined;
                    const pattern = getTranslationPattern(result, fileIndex);
                    
                    let bgColor = 'transparent';
                    let borderColor = 'transparent';
                    let borderWidth = 0;
                    
                    // Check if this is the selected version
                    const isSelectedVersion = result.selectedVersion === fileName;
                    
                    if (isSelectedVersion) {
                      bgColor = 'primary.light';
                      borderColor = 'primary.main';
                      borderWidth = 3;
                    } else if (pattern === 'changed') {
                      // Where the change was introduced and stays consistent
                      bgColor = 'success.light';
                      borderColor = 'success.main';
                      borderWidth = 2;
                    } else if (pattern === 'consistent-after-change') {
                      // Continues the consistent change
                      bgColor = 'success.lighter';
                      borderColor = 'success.light';
                      borderWidth = 1;
                    } else if (pattern === 'reverted') {
                      // Change that was later reverted
                      bgColor = 'warning.lighter';
                      borderColor = 'warning.main';
                      borderWidth = 1;
                    }
                    
                    // Check if this cell is selected
                    const isSelected = selectedCells.some(
                      cell => cell.resultId === result.id && cell.fileName === fileName
                    );
                    
                    // Check if comparing and show differences
                    const isComparing = selectedCells.length === 2 && 
                      selectedCells[0].resultId === selectedCells[1].resultId;
                    
                    // Only show diff if this cell is one of the selected cells being compared
                    const shouldShowDiff = isComparing && isSelected;
                    const otherCell = shouldShowDiff ? 
                      selectedCells.find(cell => cell.resultId === result.id && cell.fileName !== fileName) : null;
                    
                    const handleCellClick = (event: React.MouseEvent) => {
                      if (!target) return;
                      
                      const cellData: SelectedCell = {
                        resultId: result.id,
                        fileName,
                        content: target
                      };
                      
                      if ((event.altKey || event.metaKey) && selectedCells.length === 1) {
                        // Alt/Option-click: add second cell for comparison
                        if (selectedCells[0].resultId === result.id && selectedCells[0].fileName !== fileName) {
                          setSelectedCells([selectedCells[0], cellData]);
                        }
                      } else if (!event.altKey && !event.metaKey) {
                        // Regular click: select single cell or clear
                        if (isSelected) {
                          setSelectedCells([]);
                        } else {
                          setSelectedCells([cellData]);
                        }
                      }
                    };
                    
                    return (
                      <TableCell key={fileName}>
                        <Box 
                          onClick={handleCellClick}
                          sx={{ 
                            backgroundColor: isSelected ? 'info.light' : bgColor,
                            border: isSelected ? '2px solid' : borderWidth > 0 ? `${borderWidth}px solid` : 'none',
                            borderColor: isSelected ? 'info.main' : borderColor,
                            p: { xs: 0.5, sm: 0.75, md: 1 },
                            borderRadius: 1,
                            position: 'relative',
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            cursor: target ? 'pointer' : 'default',
                            opacity: result.selectedVersion && !isSelectedVersion && !isSelected ? 0.6 : 1,
                            '&:hover': target ? {
                              backgroundColor: isSelected ? 'info.light' : isSelectedVersion ? 'primary.light' : 'action.hover',
                              opacity: 1
                            } : {}
                          }}>
                          {shouldShowDiff && otherCell && target ? (
                            // Show differences between the two selected cells
                            getDifferences(otherCell.content, target).map((part, idx) => (
                              <span 
                                key={idx}
                                style={{
                                  backgroundColor: part.isAdded ? '#c8e6c9' : 
                                                  part.isRemoved ? '#ffcdd2' : 
                                                  'transparent',
                                  textDecoration: part.isRemoved ? 'line-through' : 'none',
                                  fontWeight: part.isDifferent ? 'bold' : 'normal',
                                  color: part.isRemoved ? '#d32f2f' : 
                                         part.isAdded ? '#388e3c' : 
                                         'inherit'
                                }}
                              >
                                {part.text}
                              </span>
                            ))
                          ) : (
                            target || '-'
                          )}
                          {isSelectedVersion && (
                            <Chip
                              label="SELECTED"
                              color="primary"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: -10,
                                right: -10,
                                fontSize: '0.625rem',
                                height: '20px',
                                fontWeight: 'bold',
                                zIndex: 1
                              }}
                            />
                          )}
                          {pattern === 'changed' && !isSelectedVersion && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: 'success.main'
                              }}
                              title="Change introduced here and consistent after"
                            />
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {result.inFiles.length > 0 && (() => {
                      const visibleOptions = result.inFiles.filter(fileName => !hiddenColumns.has(fileName));
                      if (visibleOptions.length === 0) return null;
                      
                      return (
                        <RadioGroup
                          value={result.selectedVersion || ''}
                          onChange={(e) => selectVersion(result.id, e.target.value as FileName)}
                          sx={{
                            display: 'flex',
                            flexDirection: visibleOptions.length > 3 ? 'column' : 'row',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            '& .MuiFormControlLabel-root': {
                              margin: 0,
                              minWidth: visibleOptions.length > 3 ? '80px' : 'auto'
                            }
                          }}
                        >
                        {result.inFiles
                          .filter(fileName => !hiddenColumns.has(fileName)) // Only show visible columns
                          .map(fileName => {
                            const targetKey = `${fileName}Target` as keyof ComparisonResult;
                            if (!result[targetKey]) return null;
                            
                            const file = files[fileName];
                            const label = file?.fileIdentifier || fileName.replace('file', '');
                            
                            return (
                              <FormControlLabel
                                key={fileName}
                                value={fileName}
                                control={<Radio size="small" />}
                                label={label}
                              />
                            );
                          })}
                        </RadioGroup>
                      );
                    })()}
                  </TableCell>
                </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={sortedResults.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
      
      {/* Column Visibility Dialog */}
      <Dialog open={columnDialogOpen} onClose={() => setColumnDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Show/Hide Columns</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Hide columns to give more space to the remaining ones. At least one column must remain visible.
          </Typography>
          <List>
            {loadedFiles.map(fileName => {
              const file = files[fileName];
              const isHidden = hiddenColumns.has(fileName);
              const canHide = visibleFiles.length > 1;
              
              return (
                <ListItem key={fileName} disablePadding>
                  <ListItemButton 
                    onClick={() => canHide || !isHidden ? toggleColumn(fileName) : null}
                    disabled={!canHide && !isHidden}
                  >
                    <ListItemIcon>
                      {isHidden ? <VisibilityOff /> : <Visibility />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={file?.fileIdentifier || fileName}
                      secondary={`${file?.transUnits.length || 0} strings`}
                    />
                    <Chip
                      label={isHidden ? 'Hidden' : 'Visible'}
                      color={isHidden ? 'default' : 'primary'}
                      size="small"
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHiddenColumns(new Set())}>Show All</Button>
          <Button onClick={() => setColumnDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};