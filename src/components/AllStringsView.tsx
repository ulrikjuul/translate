import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  TextField,
  Typography,
  TablePagination,
  Stack,
  Chip,
  Button,
  InputAdornment,
  IconButton,
  TableSortLabel,
  FormControlLabel,
  Checkbox,
  Tooltip
} from '@mui/material';
import { Search, Clear, Visibility } from '@mui/icons-material';
import { useComparisonStore } from '../store/useComparisonStore';
import type { AllStringsResult } from '../store/useComparisonStore';
import type { FileName } from '../types/xliff';
import { XmlDialog } from './XmlDialog';

type Order = 'asc' | 'desc';
type OrderBy = 'id' | 'source' | 'target' | 'fromFile';

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

export const AllStringsView: React.FC = () => {
  const store = useComparisonStore();
  const { getAllStrings, files, rawFiles } = store;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<OrderBy>('id');
  const [searchInRaw, setSearchInRaw] = useState(false);
  const [selectedXml, setSelectedXml] = useState<AllStringsResult | null>(null);
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  
  const allStrings = getAllStrings();
  
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
  ): ((a: AllStringsResult, b: AllStringsResult) => number) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };
  
  const descendingComparator = (
    a: AllStringsResult,
    b: AllStringsResult,
    orderBy: OrderBy,
  ) => {
    const aValue = a[orderBy] || '';
    const bValue = b[orderBy] || '';
    
    if (bValue < aValue) {
      return -1;
    }
    if (bValue > aValue) {
      return 1;
    }
    return 0;
  };
  
  const filteredStrings = allStrings.filter(item => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) return true;
    
    // Standard search in parsed fields
    let matchesSearch = 
      (item.id || '').toLowerCase().includes(searchLower) ||
      (item.source || '').toLowerCase().includes(searchLower) ||
      (item.target || '').toLowerCase().includes(searchLower) ||
      (item.note || '').toLowerCase().includes(searchLower) ||
      (item.state || '').toLowerCase().includes(searchLower);
    
    // If searching in raw XML content, show all if term is found
    if (searchInRaw && !matchesSearch) {
      const rawContainsSearch = loadedFiles.some(fileName => {
        const raw = rawFiles[fileName];
        return raw && raw.toLowerCase().includes(searchLower);
      });
      
      if (rawContainsSearch) {
        matchesSearch = true;
      }
    }
    
    return matchesSearch;
  });
  
  const sortedStrings = [...filteredStrings].sort(getComparator(order, orderBy));
  
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
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleShowXml = (item: AllStringsResult) => {
    setSelectedXml(item);
    setXmlDialogOpen(true);
  };
  
  const handleCloseXml = () => {
    setXmlDialogOpen(false);
    setSelectedXml(null);
  };
  
  const getFileChip = (fromFile: FileName) => {
    const file = files[fromFile];
    const label = file?.fileIdentifier || fromFile;
    return <Chip label={label} color={FILE_COLORS[fromFile] as any} size="small" />;
  };
  
  // Calculate file counts
  const fileCounts = loadedFiles.reduce((acc, fileName) => {
    const file = files[fileName];
    acc[fileName] = file?.transUnits.length || 0;
    return acc;
  }, {} as Record<FileName, number>);
  
  const totalStrings = Object.values(fileCounts).reduce((sum, count) => sum + count, 0);
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Stack spacing={{ xs: 1, sm: 2 }} sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="h5">
              All Strings View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Viewing all {totalStrings.toLocaleString()} strings from {loadedFiles.length} files (including duplicates)
            </Typography>
          </Stack>
          {searchTerm && (
            <Stack spacing={1} alignItems="flex-end">
              <Chip 
                label={`Searching for: "${searchTerm}"`}
                onDelete={handleClearSearch}
                color="primary"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                Showing {sortedStrings.length.toLocaleString()} of {allStrings.length.toLocaleString()} strings
              </Typography>
            </Stack>
          )}
        </Stack>
        
        <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            {loadedFiles.map(fileName => {
              const file = files[fileName];
              const count = fileCounts[fileName];
              if (!file || count === 0) return null;
              
              return (
                <Typography key={fileName} variant="body2" color={`${FILE_COLORS[fileName]}.main`}>
                  <strong>{file.fileIdentifier || fileName}:</strong> {count.toLocaleString()} strings
                </Typography>
              );
            })}
          </Stack>
        </Paper>
      </Stack>
      
      <Stack spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search in all strings"
            placeholder="Search in ID, source, target, notes..."
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
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={searchInRaw}
              onChange={(e) => setSearchInRaw(e.target.checked)}
              size="small"
            />
          }
          label="Search in full XLIFF file content (shows all strings if term found anywhere in XML)"
        />
      </Stack>
      
      <TableContainer component={Paper} sx={{ 
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'auto'
      }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
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
                  active={orderBy === 'source'}
                  direction={orderBy === 'source' ? order : 'asc'}
                  onClick={() => handleRequestSort('source')}
                >
                  Source
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'target'}
                  direction={orderBy === 'target' ? order : 'asc'}
                  onClick={() => handleRequestSort('target')}
                >
                  Target
                </TableSortLabel>
              </TableCell>
              <TableCell>State</TableCell>
              <TableCell>Note</TableCell>
              <TableCell align="center">XML</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedStrings
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((item, index) => (
                <TableRow 
                  key={`${item.fromFile}-${item.id}-${index}`}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleShowXml(item)}
                >
                  <TableCell>{getFileChip(item.fromFile)}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{item.id}</TableCell>
                  <TableCell sx={{ 
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    maxWidth: { xs: '200px', sm: '300px', md: '400px' }
                  }}>
                    {item.source}
                  </TableCell>
                  <TableCell sx={{ 
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    maxWidth: { xs: '200px', sm: '300px', md: '400px' }
                  }}>
                    {item.target}
                  </TableCell>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{item.state || '-'}</TableCell>
                  <TableCell sx={{ 
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    maxWidth: { xs: '150px', sm: '200px', md: '250px' }
                  }}>
                    {item.note || '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View full XML">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowXml(item);
                        }}
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={sortedStrings.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
      
      {selectedXml && (
        <XmlDialog
          open={xmlDialogOpen}
          onClose={handleCloseXml}
          title={`Translation Unit from ${selectedXml.fileName || 'File'}`}
          xmlContent={selectedXml.rawXml || '<trans-unit>No XML data available</trans-unit>'}
          id={selectedXml.id}
          source={selectedXml.source}
          target={selectedXml.target}
        />
      )}
    </Box>
  );
};