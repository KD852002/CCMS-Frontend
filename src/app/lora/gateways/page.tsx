'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Card, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Chip, IconButton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Tooltip, CircularProgress, Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Router as RouterIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { fetchLoraGateways, createLoraGateway } from '@/lib/api';
import type { LoraGateway } from '@/lib/types';
import { PageHeader, StatGrid, StatusChip } from '../shared';

export default function LoraGatewaysPage() {
  const router = useRouter();
  const [gateways, setGateways] = useState<LoraGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newImei, setNewImei] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLoraGateways();
      setGateways(data);
    } catch {
      setError('Failed to load gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll as a fallback so a gateway/node coming back online (or dropping
  // offline) is reflected without the user needing to click Refresh.
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const handleAdd = async () => {
    if (!newImei.trim()) return;
    setSaving(true);
    try {
      await createLoraGateway({ gateway_imei: newImei.trim(), name: newName.trim() || undefined });
      setAddOpen(false);
      setNewImei('');
      setNewName('');
      await load();
    } catch {
      setError('Failed to register gateway');
    } finally {
      setSaving(false);
    }
  };

  const online = gateways.filter((g) => g.is_online).length;
  const totalNodes = gateways.reduce((s, g) => s + g.node_count, 0);

  return (
    <AppLayout>
      <Box>
        <PageHeader
          title="LoRa Gateways"
          subtitle={`${online} online / ${gateways.length} total · ${totalNodes} nodes managed`}
          actions={(
            <>
              <Tooltip title="Refresh">
                <IconButton onClick={load}><RefreshIcon /></IconButton>
              </Tooltip>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
                sx={{ bgcolor: '#0d7377', '&:hover': { bgcolor: '#0a5f63' } }}>
                Add Gateway
              </Button>
            </>
          )}
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <StatGrid
          minWidth={160}
          items={[
            { label: 'Total Gateways', value: gateways.length, color: '#0d7377' },
            { label: 'Online', value: online, color: '#10b981' },
            { label: 'Offline', value: gateways.length - online, color: '#ef4444' },
            { label: 'Total Nodes', value: totalNodes, color: '#6366f1' },
          ]}
        />

        {/* Table */}
        <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['Gateway IMEI', 'Name', 'Status', 'Nodes', 'Last Seen', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 13 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} sx={{ color: '#0d7377' }} />
                    </TableCell>
                  </TableRow>
                ) : gateways.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No gateways registered yet
                    </TableCell>
                  </TableRow>
                ) : gateways.map((gw) => (
                  <TableRow key={gw.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RouterIcon sx={{ fontSize: 18, color: '#0d7377' }} />
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{gw.gateway_imei}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{gw.name || '—'}</Typography>
                    </TableCell>
                    <TableCell><StatusChip online={gw.is_online} /></TableCell>
                    <TableCell>
                      <Chip label={gw.node_count} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {gw.last_seen ? new Date(gw.last_seen).toLocaleString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => router.push(`/lora/gateways/${gw.id}`)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Add Gateway Dialog */}
        <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Register LoRa Gateway</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              label="Gateway IMEI"
              value={newImei}
              onChange={(e) => setNewImei(e.target.value)}
              fullWidth
              required
              margin="dense"
              placeholder="e.g. 862000012345678"
              helperText="IMEI as it appears in the MQTT topic"
            />
            <TextField
              label="Display Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
              margin="dense"
              placeholder="e.g. Main Campus Gateway"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd} disabled={saving || !newImei.trim()}
              sx={{ bgcolor: '#0d7377', '&:hover': { bgcolor: '#0a5f63' } }}>
              {saving ? <CircularProgress size={18} color="inherit" /> : 'Register'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
