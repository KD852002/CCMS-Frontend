'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, IconButton, Button,
  Tooltip, CircularProgress, Alert, Divider, Paper, TextField,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Memory as MemoryIcon,
  Router as RouterIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import {
  fetchLoraGateway, fetchGatewayNodes, fetchGatewayCommands, gatewaySetMfm, updateLoraGateway,
  createLoraWebSocket,
} from '@/lib/api';
import type { LoraGateway, LoraNode, LoraCommand, LoraWsEvent } from '@/lib/types';
import { normalizeRelayState, relayLabel, correctRelayState, relayIfOnline } from '@/lib/loraUtils';
import { StatusChip } from '../../shared';

function CommandStatusChip({ status }: { status: string }) {
  const color = status === 'ACK' ? '#15803d' : status === 'NACK' ? '#dc2626' : '#b45309';
  const bg = status === 'ACK' ? '#dcfce7' : status === 'NACK' ? '#fee2e2' : '#fef3c7';
  return <Chip size="small" label={status} sx={{ bgcolor: bg, color, fontWeight: 600, fontSize: 11 }} />;
}

export default function GatewayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const gatewayId = parseInt(id, 10);

  const [gateway, setGateway] = useState<LoraGateway | null>(null);
  const [nodes, setNodes] = useState<LoraNode[]>([]);
  const [commands, setCommands] = useState<LoraCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latitude, setLatitude] = useState('18.4693');
  const [longitude, setLongitude] = useState('73.7884');
  const [locSaving, setLocSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gw, nd, cm] = await Promise.all([
        fetchLoraGateway(gatewayId),
        fetchGatewayNodes(gatewayId),
        fetchGatewayCommands(gatewayId, 20),
      ]);
      setGateway(gw);
      // An offline node can't have an energized relay regardless of whatever
      // stale value is cached from before it went offline.
      setNodes(nd.map((n: LoraNode) => ({
        ...n,
        relay_1: relayIfOnline(n.relay_1, n.is_online),
        relay_2: relayIfOnline(n.relay_2, n.is_online),
      })));
      setCommands(cm);
      setLatitude(gw.latitude != null ? String(gw.latitude) : '18.4693');
      setLongitude(gw.longitude != null ? String(gw.longitude) : '73.7884');
    } catch {
      setError('Failed to load gateway details');
    } finally {
      setLoading(false);
    }
  }, [gatewayId]);

  // Websocket push can silently miss a node's offline transition (dropped
  // connection, or the backend simply not emitting node_offline), so poll
  // the REST endpoint as a fallback instead of relying on live events alone.
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  // Live relay/online sync — without this the table only ever reflects
  // whatever was true at the last manual refresh, even though relays can be
  // toggled from the node detail page or the dashboard/GIS map meanwhile.
  useEffect(() => {
    const matches = (n: LoraNode, d: Record<string, unknown>) =>
      d.node_pk === n.id || (d.lora_address === n.node_id && d.gateway_imei === n.gateway_imei);

    const ws = createLoraWebSocket((evt) => {
      try {
        const msg: LoraWsEvent = JSON.parse(evt.data);
        const d = msg.data as Record<string, unknown>;

        if (msg.type === 'telemetry') {
          setNodes((prev) => prev.map((n) => {
            if (!matches(n, d)) return n;
            const current = d.current !== undefined ? Number(d.current) : n.current;
            const power = d.power !== undefined ? Number(d.power) : n.power;
            const isOnline = d.is_online !== undefined ? normalizeRelayState(d.is_online) : n.is_online;
            const relay1 = d.relay_1 !== undefined ? normalizeRelayState(d.relay_1) : n.relay_1;
            const relay2 = d.relay_2 !== undefined ? normalizeRelayState(d.relay_2) : n.relay_2;
            return {
              ...n,
              // A relay we already believed was ON that flips to OFF while
              // real power is still flowing is wrong; don't promote a relay
              // we didn't already believe was on just from shared load. An
              // offline node can't have an energized relay either way.
              relay_1: relayIfOnline(correctRelayState(relay1, n.relay_1, current, power), isOnline),
              relay_2: relayIfOnline(correctRelayState(relay2, n.relay_2, current, power), isOnline),
              voltage: d.voltage !== undefined ? Number(d.voltage) : n.voltage,
              current, power,
              temperature: d.temperature !== undefined ? Number(d.temperature) : n.temperature,
              pwm_percent: d.pwm_percent !== undefined ? Number(d.pwm_percent) : n.pwm_percent,
              is_online: isOnline,
              // Receiving a telemetry frame at all is proof of fresh contact.
              last_seen: typeof d.timestamp === 'string' ? d.timestamp : new Date().toISOString(),
            };
          }));
        } else if ((msg.type === 'ack' || msg.type === 'command_status')
          && (d.relay_1 !== undefined || d.relay_2 !== undefined)) {
          setNodes((prev) => prev.map((n) => (matches(n, d) ? {
            ...n,
            relay_1: relayIfOnline(correctRelayState(d.relay_1 !== undefined ? normalizeRelayState(d.relay_1) : n.relay_1, n.relay_1, n.current, n.power), n.is_online),
            relay_2: relayIfOnline(correctRelayState(d.relay_2 !== undefined ? normalizeRelayState(d.relay_2) : n.relay_2, n.relay_2, n.current, n.power), n.is_online),
          } : n)));
        } else if (msg.type === 'node_online' || msg.type === 'node_offline') {
          setNodes((prev) => prev.map((n) => (matches(n, d) ? {
            ...n,
            is_online: msg.type === 'node_online',
            relay_1: msg.type === 'node_online' && n.relay_1,
            relay_2: msg.type === 'node_online' && n.relay_2,
          } : n)));
        }
      } catch { /* ignore parse errors */ }
    });
    return () => ws.close();
  }, []);

  if (loading && !gateway) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress sx={{ color: '#0d7377' }} />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box>
        {/* Back + Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          <IconButton onClick={() => router.push('/lora/gateways')} size="small"><BackIcon /></IconButton>
          <RouterIcon sx={{ color: '#0d7377', fontSize: 28 }} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography variant="h5" fontWeight={700}>{gateway?.name || `Gateway ${id}`}</Typography>
            <Typography variant="body2" color="text.secondary" fontFamily="monospace">
              IMEI: {gateway?.gateway_imei}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
            <Button size="small" variant="outlined"
              onClick={async () => {
                try {
                  await gatewaySetMfm(gatewayId, { index: 0, mfm_id: 3, mfm_type: 50 });
                  await load();
                } catch { setError('Failed to send TDMA profile command'); }
              }}
              sx={{ borderColor: '#0d7377', color: '#0d7377' }}>
              Enable TDMA Profile
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* Gateway Info Card */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Gateway Details</Typography>
                <Divider sx={{ mb: 1.5 }} />
                {[
                  { label: 'IMEI', value: gateway?.gateway_imei },
                  { label: 'Name', value: gateway?.name || '—' },
                  { label: 'Status', value: <StatusChip online={!!gateway?.is_online} /> },
                  { label: 'Last Seen', value: gateway?.last_seen ? new Date(gateway.last_seen).toLocaleString() : 'Never' },
                  { label: 'Registered', value: gateway?.created_at ? new Date(gateway.created_at).toLocaleDateString() : '—' },
                  { label: 'Nodes', value: nodes.length },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    {typeof value === 'string' || typeof value === 'number'
                      ? <Typography variant="caption" fontWeight={600}>{value}</Typography>
                      : value}
                  </Box>
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary">GIS Location</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <TextField size="small" label="Latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} sx={{ flex: 1, minWidth: 100 }} />
                  <TextField size="small" label="Longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} sx={{ flex: 1, minWidth: 100 }} />
                </Box>
                <Button size="small" variant="contained" fullWidth sx={{ mt: 1, bgcolor: '#0d7377' }} disabled={locSaving}
                  onClick={async () => {
                    setLocSaving(true);
                    try {
                      await updateLoraGateway(gatewayId, {
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                      });
                      await load();
                    } catch { setError('Failed to save location'); }
                    finally { setLocSaving(false); }
                  }}>
                  {locSaving ? <CircularProgress size={16} color="inherit" /> : 'Save Location'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Nodes Summary */}
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Connected Nodes ({nodes.length})</Typography>
                  <Button size="small" variant="outlined" startIcon={<MemoryIcon />}
                    onClick={() => router.push(`/lora/nodes?gateway_id=${gatewayId}`)}
                    sx={{ borderColor: '#0d7377', color: '#0d7377' }}>
                    View All
                  </Button>
                </Box>
                <Divider sx={{ mb: 1 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {['Node ID', 'Name', 'Status', 'Voltage', 'Current', 'Power', 'Temp', 'Relay 1', 'Relay 2'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {nodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                            No nodes connected yet
                          </TableCell>
                        </TableRow>
                      ) : nodes.map((n) => (
                        <TableRow key={n.id} hover
                          onClick={() => router.push(`/lora/nodes/${n.id}`)}
                          sx={{ cursor: 'pointer' }}>
                          <TableCell>
                            <Chip label={`#${n.node_id}`} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12 }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{n.name || '—'}</TableCell>
                          <TableCell><StatusChip online={n.is_online} /></TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{n.voltage.toFixed(1)} V</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{n.current.toFixed(3)} A</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{n.power.toFixed(1)} W</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{n.temperature.toFixed(1)} °C</TableCell>
                          <TableCell>
                            <Chip size="small" label={relayLabel(n.relay_2)}
                              sx={{ bgcolor: normalizeRelayState(n.relay_2) ? '#dcfce7' : '#fee2e2', color: normalizeRelayState(n.relay_2) ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 11 }} />
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={relayLabel(n.relay_1)}
                              sx={{ bgcolor: normalizeRelayState(n.relay_1) ? '#dcfce7' : '#fee2e2', color: normalizeRelayState(n.relay_1) ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 11 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Commands */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <SendIcon sx={{ color: '#0d7377', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700}>Recent Commands (last 20)</Typography>
                </Box>
                <Divider sx={{ mb: 1 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {['Time', 'Node', 'Command', 'cmd_id', 'Status', 'ACK Payload'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {commands.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                            No commands sent yet
                          </TableCell>
                        </TableRow>
                      ) : commands.map((c) => (
                        <TableRow key={c.id} hover>
                          <TableCell sx={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            {c.node_id === 255
                              ? <Chip size="small" label="Broadcast" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: 10 }} />
                              : <Chip size="small" label={`#${c.node_id}`} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: 11 }} />}
                          </TableCell>
                          <TableCell><Typography variant="caption" fontFamily="monospace" fontWeight={600}>{c.command}</Typography></TableCell>
                          <TableCell><Typography variant="caption" fontFamily="monospace" sx={{ fontSize: 10 }}>{c.cmd_id}</Typography></TableCell>
                          <TableCell><CommandStatusChip status={c.status} /></TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.ack_payload || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AppLayout>
  );
}
