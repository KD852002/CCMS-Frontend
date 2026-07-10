'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, Button, IconButton, Tooltip, alpha, TextField, InputAdornment,
} from '@mui/material';
import { Refresh, Search, CheckCircle } from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { fetchFaults, resolveFault } from '@/lib/api';
import type { FaultLog } from '@/lib/types';

const C = { green: '#22c55e', red: '#ef4444', orange: '#f59e0b', teal: '#0d7377', grey: '#6b7280' };

export default function FaultsPage() {
  const [faults, setFaults] = useState<FaultLog[]>([]);
  const [search, setSearch] = useState('');

  const load = () => fetchFaults().then(setFaults).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleResolve = async (id: number) => {
    await resolveFault(id);
    load();
  };

  const filtered = faults.filter((f) =>
    f.device_id.toLowerCase().includes(search.toLowerCase()) ||
    f.fault_type.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: faults.length,
    open: faults.filter((f) => !f.resolved).length,
    resolved: faults.filter((f) => f.resolved).length,
  };

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Fault Logs</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
              <Chip label={`Total: ${counts.total}`} size="small" sx={{ bgcolor: alpha(C.teal, 0.1), color: C.teal }} />
              <Chip label={`Open: ${counts.open}`} size="small" sx={{ bgcolor: alpha(C.red, 0.1), color: C.red }} />
              <Chip label={`Resolved: ${counts.resolved}`} size="small" sx={{ bgcolor: alpha(C.green, 0.1), color: C.green }} />
            </Box>
          </Box>
          <Tooltip title="Refresh"><IconButton onClick={load} sx={{ bgcolor: alpha(C.teal, 0.1) }}><Refresh /></IconButton></Tooltip>
        </Box>

        <TextField
          fullWidth placeholder="Search by device ID or fault type…" value={search}
          onChange={(e) => setSearch(e.target.value)} size="small" sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment> }}
        />

        <Card sx={{ borderRadius: 3 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['ID', 'Device', 'Fault Type', 'Description', 'Severity', 'Status', 'Time', 'Action'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, bgcolor: '#f8fafc', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell>{f.id}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{f.device_id}</TableCell>
                    <TableCell><Chip label={f.fault_type} size="small" sx={{ bgcolor: alpha(C.red, 0.12), color: C.red, fontWeight: 600 }} /></TableCell>
                    <TableCell>{f.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={f.severity}
                        size="small"
                        sx={{
                          bgcolor: f.severity === 'CRITICAL' ? alpha(C.red, 0.12) : f.severity === 'WARNING' ? alpha(C.orange, 0.12) : alpha(C.grey, 0.12),
                          color: f.severity === 'CRITICAL' ? C.red : f.severity === 'WARNING' ? C.orange : C.grey,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={f.resolved ? 'Resolved' : 'Open'}
                        size="small"
                        sx={{
                          bgcolor: f.resolved ? alpha(C.green, 0.12) : alpha(C.orange, 0.12),
                          color: f.resolved ? C.green : C.orange,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{new Date(f.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      {!f.resolved && (
                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                          onClick={() => handleResolve(f.id)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No fault logs found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
    </AppLayout>
  );
}
