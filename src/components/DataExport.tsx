'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Menu, 
  MenuItem, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  FormControlLabel,
  Checkbox,
  alpha,
} from '@mui/material';
import { Download, FileJson, FileText } from 'lucide-react';

interface ExportData {
  devices?: any[];
  metrics?: any[];
  timestamp: string;
}

interface DataExportProps {
  data: ExportData;
  filename?: string;
}

export const DataExport: React.FC<DataExportProps> = ({ 
  data, 
  filename = 'export' 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'text'>('json');
  const [exportOptions, setExportOptions] = useState({
    includeDevices: true,
    includeMetrics: true,
    includeSummary: true,
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDialogOpen = (format: 'json' | 'csv' | 'text') => {
    setExportFormat(format);
    setDialogOpen(true);
    handleClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const downloadFile = (blob: Blob, fname: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportAsJSON = () => {
    const exportData: any = { exportedAt: new Date().toISOString(), ...data };
    if (!exportOptions.includeDevices) delete exportData.devices;
    if (!exportOptions.includeMetrics) delete exportData.metrics;
    if (exportOptions.includeSummary) {
      exportData.summary = {
        totalDevices: data.devices?.length || 0,
        exportFormat: 'JSON',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadFile(blob, `${filename}_${Date.now()}.json`);
    handleDialogClose();
  };

  const exportAsCSV = () => {
    let csvContent = '';
    if (exportOptions.includeDevices && data.devices && data.devices.length > 0) {
      csvContent += 'Device Data\n';
      const headers = Object.keys(data.devices[0]);
      csvContent += headers.join(',') + '\n';
      data.devices.forEach(device => {
        const values = headers.map(header => {
          const value = device[header];
          return typeof value === 'string' ? `"${value}"` : value ?? '';
        });
        csvContent += values.join(',') + '\n';
      });
      csvContent += '\n';
    }
    if (exportOptions.includeSummary) {
      csvContent += 'Summary\n';
      csvContent += `Total Devices,${data.devices?.length || 0}\n`;
      csvContent += `Exported At,${new Date().toISOString()}\n`;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `${filename}_${Date.now()}.csv`);
    handleDialogClose();
  };

  const exportAsText = () => {
    let textContent = 'DEVICE REPORT\n';
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `${'='.repeat(50)}\n\n`;
    if (exportOptions.includeDevices && data.devices) {
      textContent += 'DEVICES\n';
      textContent += `${'-'.repeat(50)}\n`;
      data.devices.forEach((device, idx) => {
        textContent += `Device ${idx + 1}: ${device.device_id}\n`;
        textContent += `  Status: ${device.status}\n`;
        textContent += `  Model: ${device.model || '—'}\n`;
        textContent += `  Online: ${device.is_online ? 'Yes' : 'No'}\n`;
        if (device.firmware_version) textContent += `  Firmware: ${device.firmware_version}\n`;
        textContent += '\n';
      });
    }
    if (exportOptions.includeSummary) {
      textContent += `${'-'.repeat(50)}\n`;
      textContent += `Total Devices: ${data.devices?.length || 0}\n`;
      textContent += `Report Generated: ${new Date().toISOString()}\n`;
    }
    const blob = new Blob([textContent], { type: 'text/plain' });
    downloadFile(blob, `${filename}_${Date.now()}.txt`);
    handleDialogClose();
  };

  const handleExport = () => {
    if (exportFormat === 'json') exportAsJSON();
    else if (exportFormat === 'csv') exportAsCSV();
    else exportAsText();
  };

  return (
    <>
      <Button
        startIcon={<Download size={18} />}
        onClick={handleClick}
        sx={{
          fontWeight: 600,
          borderRadius: 1.5,
          textTransform: 'none',
          color: '#1f6c7e',
          border: `1.5px solid ${alpha('#1f6c7e', 0.3)}`,
          '&:hover': {
            backgroundColor: alpha('#1f6c7e', 0.08),
            borderColor: '#1f6c7e',
          },
        }}
      >
        Export
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{ sx: { borderRadius: 1.5, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }}
      >
        <MenuItem onClick={() => handleDialogOpen('json')} sx={{ gap: 1, fontWeight: 500 }}>
          <FileJson size={18} color="#1f6c7e" />
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => handleDialogOpen('csv')} sx={{ gap: 1, fontWeight: 500 }}>
          <FileText size={18} color="#10b981" />
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => handleDialogOpen('text')} sx={{ gap: 1, fontWeight: 500 }}>
          <FileText size={18} color="#f59e0b" />
          Export as Text
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Export Options</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControlLabel
              control={<Checkbox checked={exportOptions.includeDevices} onChange={(e) => setExportOptions(prev => ({ ...prev, includeDevices: e.target.checked }))} />}
              label="Include Device Data"
            />
            <FormControlLabel
              control={<Checkbox checked={exportOptions.includeMetrics} onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetrics: e.target.checked }))} />}
              label="Include Performance Metrics"
            />
            <FormControlLabel
              control={<Checkbox checked={exportOptions.includeSummary} onChange={(e) => setExportOptions(prev => ({ ...prev, includeSummary: e.target.checked }))} />}
              label="Include Summary Report"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: 1.5 }}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            sx={{ borderRadius: 1.5, backgroundColor: '#1f6c7e', '&:hover': { backgroundColor: '#0f3d47' } }}
          >
            Export {exportFormat.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
