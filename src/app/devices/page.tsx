'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, IconButton, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Tooltip, Switch, alpha, InputAdornment,
  TablePagination, Snackbar, Alert,
} from '@mui/material';
import {
  Power, PowerOff, Delete, Add, Search, FilterList, Refresh,
  WifiOff,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { fetchDevices, createDevice, turnOn, turnOff, deleteDevice } from '@/lib/api';
import type { Device } from '@/lib/types';

const C = {
  green: '#22c55e', red: '#ef4444', orange: '#f59e0b',
  blue: '#3b82f6', grey: '#6b7280', teal: '#0d7377',
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    device_id: '', latitude: '', longitude: '',
  });
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    fetchDevices(params).then(setDevices).catch(console.error);
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // Paginate locally (server already returned filtered results)
  const paginatedDevices = devices.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleCreate = async () => {
    try {
      await createDevice({
        device_id: form.device_id,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      });
      setDialogOpen(false);
      setForm({ device_id: '', latitude: '', longitude: '' });
      load();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create device');
    }
  };

  const handleToggle = async (d: Device) => {
    try {
      if (d.status === 'ON') {
        await turnOff(d.device_id);
      } else {
        await turnOn(d.device_id);
      }
      load();
    } catch {
      alert('Failed: MQTT broker may not be connected');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Deactivate device ${id}?`)) {
      await deleteDevice(id);
      load();
    }
  };

  const statusChip = (s: string) => {
    if (s === 'ON') return <Chip label="ON" size="small" sx={{ bgcolor: alpha(C.green, 0.12), color: C.green, fontWeight: 600, minWidth: 52 }} />;
    if (s === 'FAULT') return <Chip label="FAULT" size="small" sx={{ bgcolor: alpha(C.red, 0.12), color: C.red, fontWeight: 600, minWidth: 52 }} />;
    return <Chip label="OFF" size="small" sx={{ bgcolor: alpha(C.grey, 0.12), color: C.grey, fontWeight: 600, minWidth: 52 }} />;
  };

  const commChip = (online: boolean) => (
    <Chip
      label={online ? 'ONLINE' : 'OFFLINE'}
      size="small"
      variant="outlined"
      sx={{
        borderColor: online ? C.blue : C.orange,
        color: online ? C.blue : C.orange,
        fontWeight: 500, fontSize: 11,
      }}
    />
  );

  const counts = {
    total: devices.length,
    on: devices.filter((d) => d.status === 'ON').length,
    fault: devices.filter((d) => d.status === 'FAULT').length,
    offline: devices.filter((d) => !d.is_online).length,
  };

  return (
    <AppLayout>
      <Box>
        {/* ── Header ──────────────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Devices</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
              <Chip label={`Total: ${counts.total}`} size="small" sx={{ bgcolor: alpha(C.teal, 0.1), color: C.teal }} />
              <Chip label={`ON: ${counts.on}`} size="small" sx={{ bgcolor: alpha(C.green, 0.1), color: C.green }} />
              <Chip label={`Faults: ${counts.fault}`} size="small" sx={{ bgcolor: alpha(C.red, 0.1), color: C.red }} />
              <Chip label={`Offline: ${counts.offline}`} size="small" sx={{ bgcolor: alpha(C.orange, 0.1), color: C.orange }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh"><IconButton onClick={load} sx={{ bgcolor: alpha(C.teal, 0.1) }}><Refresh /></IconButton></Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={{ borderRadius: 2 }}>
              Add Device
            </Button>
          </Box>
        </Box>

        {/* ── Search ──────────────────────────────────── */}
        <TextField
          fullWidth
          placeholder="Search by device ID…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          size="small"
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>,
          }}
        />

        {/* ── Table ───────────────────────────────────── */}
        <Card sx={{ borderRadius: 3 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['Device ID', 'Model', 'Firmware', 'Status', 'Online', 'Load', 'MCB', 'Door', 'Last Seen', 'ON/OFF', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, bgcolor: '#f8fafc', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedDevices.map((d) => (
                  <TableRow key={d.device_id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>{d.device_id}</TableCell>
                    <TableCell>{d.model || '-'}</TableCell>
                    <TableCell>{d.firmware_version || '-'}</TableCell>
                    <TableCell>{statusChip(d.status)}</TableCell>
                    <TableCell>{commChip(d.is_online)}</TableCell>
                    <TableCell>{d.load_on ? <Chip label="ON" size="small" color="success" /> : <Chip label="OFF" size="small" />}</TableCell>
                    <TableCell>{d.mcb ? <Chip label="OK" size="small" color="info" /> : <Chip label="TRIP" size="small" color="error" />}</TableCell>
                    <TableCell>{d.door ? <Chip label="OPEN" size="small" color="warning" /> : <Chip label="CLOSED" size="small" />}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{d.last_seen ? new Date(d.last_seen).toLocaleString() : '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={d.status === 'ON'}
                        onChange={() => handleToggle(d)}
                        size="small"
                        color="success"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {!d.is_online && (
                          <Tooltip title="Device offline">
                            <WifiOff fontSize="small" sx={{ color: C.orange }} />
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(d.device_id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedDevices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No devices found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={devices.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100, 250]}
          />
        </Card>

        {/* ── Add Device Dialog ───────────────────────── */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>Add New Device</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField fullWidth label="Device ID" value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} required /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Latitude" type="number" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Longitude" type="number" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate} sx={{ borderRadius: 2 }}>Create</Button>
          </DialogActions>
        </Dialog>
      </Box>
      {/* ── Snackbar ──────────────────────────────── */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </AppLayout>
  );
}
