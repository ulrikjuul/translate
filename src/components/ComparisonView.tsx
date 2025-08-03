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
import type { ComparisonResult } from '../types/xliff';

type Order = 'asc' | 'desc';
type OrderBy = 'id' | 'status' | 'source' | 'file1Target' | 'file2Target' | 'file3Target' | 'file4Target';

export const ComparisonView: React.FC = () => {
  const { comparisonResults, selectVersion, file1, file2, file3, file4, file1Raw, file2Raw, file3Raw, file4Raw } = useComparisonStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'different' | 'file1Only' | 'file2Only' | 'file3Only' | 'file4Only'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('id');
  const [includeFileInfo, setIncludeFileInfo] = useState(false);
  const [searchInRaw, setSearchInRaw] = useState(false);
  
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

    switch (orderBy) {
      case 'status':
        aValue = a.file1Only ? 'file1Only' : a.file2Only ? 'file2Only' : a.isDifferent ? 'different' : 'same';
        bValue = b.file1Only ? 'file1Only' : b.file2Only ? 'file2Only' : b.isDifferent ? 'different' : 'same';
        break;
      default:
        aValue = a[orderBy] || '';
        bValue = b[orderBy] || '';
    }

    if (bValue < aValue) {
      return -1;
    }
    if (bValue > aValue) {
      return 1;
    }
    return 0;
  };

  const filteredResults = comparisonResults.filter(result => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    // If no search term, show all
    if (!searchLower) return true;
    
    let matchesSearch = false;
    
    // Standard search in parsed fields
    matchesSearch = 
      (result.id || '').toLowerCase().includes(searchLower) ||
      (result.source || '').toLowerCase().includes(searchLower) ||
      (result.file1Target || '').toLowerCase().includes(searchLower) ||
      (result.file2Target || '').toLowerCase().includes(searchLower) ||
      (result.file3Target || '').toLowerCase().includes(searchLower) ||
      (result.file4Target || '').toLowerCase().includes(searchLower);
    
    // Also search in file metadata if enabled
    if (includeFileInfo && !matchesSearch) {
      const file1Match = file1 && (
        (file1.original || '').toLowerCase().includes(searchLower) ||
        file1.sourceLanguage.toLowerCase().includes(searchLower) ||
        file1.targetLanguage.toLowerCase().includes(searchLower)
      );
      const file2Match = file2 && (
        (file2.original || '').toLowerCase().includes(searchLower) ||
        file2.sourceLanguage.toLowerCase().includes(searchLower) ||
        file2.targetLanguage.toLowerCase().includes(searchLower)
      );
      const file3Match = file3 && (
        (file3.original || '').toLowerCase().includes(searchLower) ||
        file3.sourceLanguage.toLowerCase().includes(searchLower) ||
        file3.targetLanguage.toLowerCase().includes(searchLower)
      );
      const file4Match = file4 && (
        (file4.original || '').toLowerCase().includes(searchLower) ||
        file4.sourceLanguage.toLowerCase().includes(searchLower) ||
        file4.targetLanguage.toLowerCase().includes(searchLower)
      );
      matchesSearch = !!(file1Match || file2Match || file3Match || file4Match);
    }
    
    // If searching in raw XML content, show ALL translations when search term is found anywhere
    if (searchInRaw && !matchesSearch) {
      // When this option is checked, show ALL translations if the search term
      // appears ANYWHERE in ANY of the raw XLIFF files
      // This is useful for finding all translations when searching for XML attributes,
      // states, or other metadata that might not be in the parsed fields
      
      const rawContainsSearch = 
        (file1Raw && file1Raw.toLowerCase().includes(searchLower)) ||
        (file2Raw && file2Raw.toLowerCase().includes(searchLower)) ||
        (file3Raw && file3Raw.toLowerCase().includes(searchLower)) ||
        (file4Raw && file4Raw.toLowerCase().includes(searchLower));
      
      if (rawContainsSearch) {
        // The search term exists somewhere in the raw files
        // Show all translations since we can't easily determine which specific
        // trans-units contain the term in their XML structure
        matchesSearch = true;
      }
    }
    
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'different' && result.isDifferent && result.inFiles.length > 1) ||
      (filterType === 'file1Only' && result.file1Only) ||
      (filterType === 'file2Only' && result.file2Only) ||
      (filterType === 'file3Only' && result.file3Only) ||
      (filterType === 'file4Only' && result.file4Only);
    
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
    console.log('Searching for:', trimmedSearch);
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
    const getFileLabel = (fileNum: 1 | 2 | 3 | 4) => {
      const fileData = fileNum === 1 ? file1 : fileNum === 2 ? file2 : fileNum === 3 ? file3 : file4;
      return fileData?.fileIdentifier || `File ${fileNum}`;
    };
    
    if (result.file1Only) return <Chip label={`${getFileLabel(1)} Only`} color="info" size="small" />;
    if (result.file2Only) return <Chip label={`${getFileLabel(2)} Only`} color="warning" size="small" />;
    if (result.file3Only) return <Chip label={`${getFileLabel(3)} Only`} color="secondary" size="small" />;
    if (result.file4Only) return <Chip label={`${getFileLabel(4)} Only`} color="default" size="small" />;
    if (result.inFiles.length === 2 && !result.isDifferent) {
      const filesText = result.inFiles.join(' & ');
      return <Chip label={`Same in ${filesText}`} color="success" size="small" />;
    }
    if (result.isDifferent) return <Chip label="Different" color="error" size="small" />;
    return <Chip label="Same in all" color="success" size="small" />;
  };
  
  if (comparisonResults.length === 0) return null;
  
  // Calculate statistics
  const stats = {
    totalUnique: comparisonResults.length,
    identical: comparisonResults.filter(r => !r.isDifferent && r.inFiles.length > 1).length,
    different: comparisonResults.filter(r => r.isDifferent).length,
    file1Only: comparisonResults.filter(r => r.file1Only).length,
    file2Only: comparisonResults.filter(r => r.file2Only).length,
    file3Only: comparisonResults.filter(r => r.file3Only).length,
    file4Only: comparisonResults.filter(r => r.file4Only).length,
  };
  
  return (
    <Box>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="h5">
              Translation Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {comparisonResults.length} unique source strings compared
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
        {(file1 || file2 || file3 || file4) && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              {file1 && (
                <Chip
                  label={`${file1.fileIdentifier || 'File 1'}: ${file1.original || 'Unnamed'} (${file1.sourceLanguage} → ${file1.targetLanguage}) - ${file1.transUnits.length} strings`}
                  variant="filled"
                  color="info"
                  size="small"
                />
              )}
              {file2 && (
                <Chip
                  label={`${file2.fileIdentifier || 'File 2'}: ${file2.original || 'Unnamed'} (${file2.sourceLanguage} → ${file2.targetLanguage}) - ${file2.transUnits.length} strings`}
                  variant="filled"
                  color="warning"
                  size="small"
                />
              )}
              {file3 && (
                <Chip
                  label={`${file3.fileIdentifier || 'File 3'}: ${file3.original || 'Unnamed'} (${file3.sourceLanguage} → ${file3.targetLanguage}) - ${file3.transUnits.length} strings`}
                  variant="filled"
                  color="secondary"
                  size="small"
                />
              )}
              {file4 && (
                <Chip
                  label={`${file4.fileIdentifier || 'File 4'}: ${file4.original || 'Unnamed'} (${file4.sourceLanguage} → ${file4.targetLanguage}) - ${file4.transUnits.length} strings`}
                  variant="filled"
                  color="default"
                  size="small"
                />
              )}
            </Stack>
            <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Comparison Statistics
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Typography variant="body2">
                  <strong>Total unique strings:</strong> {stats.totalUnique}
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
                {stats.file1Only > 0 && (
                  <Typography variant="body2" color="info.main">
                    <strong>{file1?.fileIdentifier || 'File 1'} only:</strong> {stats.file1Only}
                  </Typography>
                )}
                {stats.file2Only > 0 && (
                  <Typography variant="body2" color="warning.main">
                    <strong>{file2?.fileIdentifier || 'File 2'} only:</strong> {stats.file2Only}
                  </Typography>
                )}
                {stats.file3Only > 0 && (
                  <Typography variant="body2" color="secondary.main">
                    <strong>{file3?.fileIdentifier || 'File 3'} only:</strong> {stats.file3Only}
                  </Typography>
                )}
                {stats.file4Only > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>{file4?.fileIdentifier || 'File 4'} only:</strong> {stats.file4Only}
                  </Typography>
                )}
              </Stack>
            </Paper>
          </>
        )}
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
              <MenuItem value="file1Only">{file1?.fileIdentifier || 'File 1'} Only</MenuItem>
              <MenuItem value="file2Only">{file2?.fileIdentifier || 'File 2'} Only</MenuItem>
              {file3 && <MenuItem value="file3Only">{file3.fileIdentifier || 'File 3'} Only</MenuItem>}
              {file4 && <MenuItem value="file4Only">{file4.fileIdentifier || 'File 4'} Only</MenuItem>}
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
        <Table>
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
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'source'}
                  direction={orderBy === 'source' ? order : 'asc'}
                  onClick={() => handleRequestSort('source')}
                >
                  Source
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'file1Target'}
                  direction={orderBy === 'file1Target' ? order : 'asc'}
                  onClick={() => handleRequestSort('file1Target')}
                >
                  {file1?.fileIdentifier || 'File 1'} Translation
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'file2Target'}
                  direction={orderBy === 'file2Target' ? order : 'asc'}
                  onClick={() => handleRequestSort('file2Target')}
                >
                  {file2?.fileIdentifier || 'File 2'} Translation
                </TableSortLabel>
              </TableCell>
              {file3 && (
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'file3Target'}
                    direction={orderBy === 'file3Target' ? order : 'asc'}
                    onClick={() => handleRequestSort('file3Target')}
                  >
                    {file3?.fileIdentifier || 'File 3'} Translation
                  </TableSortLabel>
                </TableCell>
              )}
              {file4 && (
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'file4Target'}
                    direction={orderBy === 'file4Target' ? order : 'asc'}
                    onClick={() => handleRequestSort('file4Target')}
                  >
                    {file4?.fileIdentifier || 'File 4'} Translation
                  </TableSortLabel>
                </TableCell>
              )}
              <TableCell align="center">Select Version</TableCell>
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
                  <TableCell>
                    <Box sx={{ 
                      backgroundColor: result.selectedVersion === 'file1' ? 'action.selected' : 'transparent',
                      p: 1,
                      borderRadius: 1
                    }}>
                      {result.file1Target || '-'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ 
                      backgroundColor: result.selectedVersion === 'file2' ? 'action.selected' : 'transparent',
                      p: 1,
                      borderRadius: 1
                    }}>
                      {result.file2Target || '-'}
                    </Box>
                  </TableCell>
                  {file3 && (
                    <TableCell>
                      <Box sx={{ 
                        backgroundColor: result.selectedVersion === 'file3' ? 'action.selected' : 'transparent',
                        p: 1,
                        borderRadius: 1
                      }}>
                        {result.file3Target || '-'}
                      </Box>
                    </TableCell>
                  )}
                  {file4 && (
                    <TableCell>
                      <Box sx={{ 
                        backgroundColor: result.selectedVersion === 'file4' ? 'action.selected' : 'transparent',
                        p: 1,
                        borderRadius: 1
                      }}>
                        {result.file4Target || '-'}
                      </Box>
                    </TableCell>
                  )}
                  <TableCell align="center">
                    {(result.file1Target || result.file2Target || result.file3Target || result.file4Target) && (
                      <RadioGroup
                        row
                        value={result.selectedVersion || ''}
                        onChange={(e) => selectVersion(result.id, e.target.value as 'file1' | 'file2' | 'file3' | 'file4')}
                      >
                        {result.file1Target && (
                          <FormControlLabel
                            value="file1"
                            control={<Radio size="small" />}
                            label="1"
                          />
                        )}
                        {result.file2Target && (
                          <FormControlLabel
                            value="file2"
                            control={<Radio size="small" />}
                            label="2"
                          />
                        )}
                        {result.file3Target && (
                          <FormControlLabel
                            value="file3"
                            control={<Radio size="small" />}
                            label="3"
                          />
                        )}
                        {result.file4Target && (
                          <FormControlLabel
                            value="file4"
                            control={<Radio size="small" />}
                            label="4"
                          />
                        )}
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