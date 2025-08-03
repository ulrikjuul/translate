import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Paper
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';

interface XmlDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  xmlContent: string;
  id?: string;
  source?: string;
  target?: string;
}

export const XmlDialog: React.FC<XmlDialogProps> = ({
  open,
  onClose,
  title,
  xmlContent,
  id,
  source,
  target
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
  };

  // Format XML for display (basic indentation)
  const formatXml = (xml: string): string => {
    try {
      // Basic formatting - add newlines and indentation
      let formatted = xml
        .replace(/></g, '>\n<')
        .replace(/(<[^/>]+>)([^<]+)(<\/[^>]+>)/g, '$1\n  $2\n$3');
      
      // Add indentation
      const lines = formatted.split('\n');
      let indent = 0;
      const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('</')) {
          indent = Math.max(0, indent - 1);
        }
        const indented = '  '.repeat(indent) + trimmed;
        if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
          if (!trimmed.includes('</')) {
            indent++;
          }
        }
        return indented;
      });
      
      return formattedLines.join('\n');
    } catch {
      return xml;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          {id && (
            <Typography variant="caption" color="text.secondary">
              ID: {id}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {source && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary">Source:</Typography>
            <Typography variant="body2">{source}</Typography>
          </Box>
        )}
        {target && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary">Target:</Typography>
            <Typography variant="body2">{target}</Typography>
          </Box>
        )}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Full XML:</Typography>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowX: 'auto',
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          <code>{formatXml(xmlContent)}</code>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<ContentCopy />}
          onClick={handleCopy}
          size="small"
        >
          Copy XML
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};