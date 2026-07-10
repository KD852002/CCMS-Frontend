'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, Button, IconButton, Tooltip, alpha, TextField, InputAdornment,
} from '@mui/material';
import { Refresh, Search, CheckCircle } from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { fetchLoraFaults, resolveLoraFault } from '@/lib/api';
import type { LoraFault } from '@/lib/types';
import { LORA_COLORS as C, PageHeader } from '../shared';

export default function LoraFaultsPage() {
  const [faults, setFaults] = useState<LoraFault[]>([]);
  const [search, setSearch] = useState('');

  const load = () => fetchLoraFaults().then(setFaults).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleResolve = async (id: number) => {
    await resolveLoraFault(id);
    load();
  };

  const filtered = faults.filter((f) => {
    const q = search.toLowerCase();
    return (
      String(f.node_address ?? '').includes(q) ||
      (f.node_name || '').toLowerCase().includes(q) ||
      (f.gateway_imei || '').toLowerCase().includes(q) ||
      f.fault_type.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: faults.length,
    open: faults.filter((f) => !f.resolved).length,
    resolved: faults.filter((f) => f.resolved).length,
  };

  return (
    <AppLayout>
      <Box>
        <PageHeader
          title="LoRa Fault Logs"
          subtitle={(
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip label={`Total: ${counts.total}`} size="small" sx={{ bgcolor: alpha(C.teal, 0.1), color: C.teal }} />
              <Chip label={`Open: ${counts.open}`} size="small" sx={{ bgcolor: alpha(C.red, 0.1), color: C.red }} />
              <Chip label={`Resolved: ${counts.resolved}`} size="small" sx={{ bgcolor: alpha(C.green, 0.1), color: C.green }} />
            </Box>
          )}
          actions={<Tooltip title="Refresh"><IconButton onClick={load} sx={{ bgcolor: alpha(C.teal, 0.1) }}><Refresh /></IconButton></Tooltip>}
        />

        <TextField
          fullWidth placeholder="Search by node, gateway, or fault type…" value={search}
          onChange={(e) => setSearch(e.target.value)} size="small" sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment> }}
        />

        <Card sx={{ borderRadius: 3 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['ID', 'Node', 'Gateway', 'Fault Type', 'Description', 'Severity', 'Status', 'Time', 'Action'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, bgcolor: '#f8fafc', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id} hover>
                    <TableCell>{f.id}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{f.node_name || `Node #${f.node_address}`}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{f.gateway_imei || '—'}</TableCell>
                    <TableCell><Chip label={f.fault_type} size="small" sx={{ bgcolor: alpha(C.red, 0.12), color: C.red, fontWeight: 600 }} /></TableCell>
                    <TableCell>{f.description || '-'}</TableCell>
                    <TableCell>
                      <Chip label={f.severity} size="small"
                        sx={{
                          bgcolor: f.severity === 'CRITICAL' ? alpha(C.red, 0.15) : alpha(C.orange, 0.12),
                          color: f.severity === 'CRITICAL' ? C.red : C.orange,
                          fontWeight: 600,
                        }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={f.resolved ? 'Resolved' : 'Open'} size="small"
                        sx={{ bgcolor: f.resolved ? alpha(C.green, 0.12) : alpha(C.red, 0.1), color: f.resolved ? C.green : C.red, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{new Date(f.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      {!f.resolved && (
                        <Button size="small" startIcon={<CheckCircle />} onClick={() => handleResolve(f.id)}
                          sx={{ color: C.green, textTransform: 'none', fontWeight: 600 }}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No LoRa faults found
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
