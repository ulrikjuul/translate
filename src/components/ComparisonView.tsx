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
  Checkbox
} from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
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
  file10: 'success'
} as const;

export const ComparisonView: React.FC = () => {
  const store = useComparisonStore();
  const { comparisonResults, selectVersion, files, rawFiles } = store;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'different' | FileName>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('id');
  const [includeFileInfo, setIncludeFileInfo] = useState(false);
  const [searchInRaw, setSearchInRaw] = useState(false);
  
  // Get loaded files
  const loadedFiles = Object.entries(files)
    .filter(([_, file]) => file !== null)
    .map(([key]) => key as FileName);
  
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
    
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'different' && result.isDifferent && result.inFiles.length > 1) ||
      (filterType.startsWith('file') && result[`${filterType}Only` as keyof ComparisonResult]);
    
    return matchesSearch && matchesFilter;
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
    fileOnlyCounts: {} as Record<FileName, number>
  };
  
  loadedFiles.forEach(fileName => {
    const onlyKey = `${fileName}Only` as keyof ComparisonResult;
    stats.fileOnlyCounts[fileName] = comparisonResults.filter(r => r[onlyKey]).length;
  });
  
  return (
    <Box>
      <Stack spacing={2} sx={{ mb: 2 }}>
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
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          {loadedFiles.map(fileName => {
            const file = files[fileName];
            if (!file) return null;
            return (
              <Chip
                key={fileName}
                label={`${file.fileIdentifier || fileName}: ${file.transUnits.length} strings`}
                variant="filled"
                color={FILE_COLORS[fileName] as any}
                size="small"
              />
            );
          })}
        </Stack>
        
        <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>
            Comparison Statistics
          </Typography>
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
        </Paper>
      </Stack>
      
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <MenuItem value="all">All Translations</MenuItem>
              <MenuItem value="different">Different Only</MenuItem>
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
      
      <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'id'}
                  direction={orderBy === 'id' ? order : 'asc'}
                  onClick={() => handleRequestSort('id')}
                >
                  ID
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleRequestSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 200 }}>
                <TableSortLabel
                  active={orderBy === 'source'}
                  direction={orderBy === 'source' ? order : 'asc'}
                  onClick={() => handleRequestSort('source')}
                >
                  Source
                </TableSortLabel>
              </TableCell>
              {loadedFiles.map(fileName => {
                const file = files[fileName];
                return (
                  <TableCell key={fileName} sx={{ minWidth: 200 }}>
                    <TableSortLabel
                      active={orderBy === fileName}
                      direction={orderBy === fileName ? order : 'asc'}
                      onClick={() => handleRequestSort(fileName)}
                    >
                      {file?.fileIdentifier || fileName}
                    </TableSortLabel>
                  </TableCell>
                );
              })}
              <TableCell align="center" sx={{ minWidth: 150 }}>Select Version</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedResults
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.id}</TableCell>
                  <TableCell>{getStatusChip(result)}</TableCell>
                  <TableCell>{result.source}</TableCell>
                  {loadedFiles.map(fileName => {
                    const targetKey = `${fileName}Target` as keyof ComparisonResult;
                    const target = result[targetKey] as string | undefined;
                    return (
                      <TableCell key={fileName}>
                        <Box sx={{ 
                          backgroundColor: result.selectedVersion === fileName ? 'action.selected' : 'transparent',
                          p: 1,
                          borderRadius: 1
                        }}>
                          {target || '-'}
                        </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell align="center">
                    {result.inFiles.length > 0 && (
                      <RadioGroup
                        row
                        value={result.selectedVersion || ''}
                        onChange={(e) => selectVersion(result.id, e.target.value as FileName)}
                      >
                        {result.inFiles.map(fileName => {
                          const targetKey = `${fileName}Target` as keyof ComparisonResult;
                          if (!result[targetKey]) return null;
                          
                          const file = files[fileName];
                          const label = file?.fileIdentifier?.[0] || fileName.replace('file', '');
                          
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
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
    </Box>
  );
};