'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Chip, IconButton, Tooltip, CircularProgress, Alert,
  TextField, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Memory as MemoryIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { fetchLoraNodes, fetchLoraGateways, createLoraWebSocket, loraRelay, loraSchedule } from '@/lib/api';
import type { LoraNode, LoraGateway, LoraWsEvent } from '@/lib/types';
import { normalizeRelayState, relayLabel, correctRelayState, relayIfOnline, swapRelay, swapRelayMask } from '@/lib/loraUtils';
import { PageHeader, StatGrid, StatusChip } from '../shared';

interface BulkHistoryEntry {
  id: number;
  time: string;
  action: string;
  detail: string;
  nodeCount: number;
  result: 'Success' | 'Partial' | 'Failed';
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function LoraNodesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initGw = searchParams.get('gateway_id') ? parseInt(searchParams.get('gateway_id')!, 10) : undefined;

  const [nodes, setNodes] = useState<LoraNode[]>([]);
  const [gateways, setGateways] = useState<LoraGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [gwFilter, setGwFilter] = useState<number | ''>(initGw ?? '');

  // Bulk Relay 1 control (all nodes)
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkErr, setBulkErr] = useState('');
  const [bulkSchedOpen, setBulkSchedOpen] = useState(false);
  const [bulkSchedSlot, setBulkSchedSlot] = useState(0);
  const [bulkSchedStartH, setBulkSchedStartH] = useState(18);
  const [bulkSchedStartM, setBulkSchedStartM] = useState(30);
  const [bulkSchedStopH, setBulkSchedStopH] = useState(6);
  const [bulkSchedStopM, setBulkSchedStopM] = useState(0);
  const [bulkSchedPwm, setBulkSchedPwm] = useState(100);
  const [bulkHistory, setBulkHistory] = useState<BulkHistoryEntry[]>([]);

  // Keeps only the single latest action — a new Load On/Off or Schedule send
  // replaces this entry in place rather than growing a list.
  const logBulkAction = (action: string, detail: string, nodeCount: number, failed: number) => {
    const result: BulkHistoryEntry['result'] = failed === 0 ? 'Success' : failed === nodeCount ? 'Failed' : 'Partial';
    setBulkHistory([{ id: Date.now(), time: new Date().toISOString(), action, detail, nodeCount, result }]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nd, gws] = await Promise.all([
        fetchLoraNodes(gwFilter ? { gateway_id: gwFilter } : undefined),
        fetchLoraGateways(),
      ]);
      // No prior session state to corroborate against on a fresh load, so
      // trust the backend's relay values as-is here — the load-corroboration
      // correction below only kicks in for a relay we've already seen ON.
      // But an offline node can't have an energized relay regardless of
      // whatever stale value is cached from before it went offline.
      setNodes(nd.map((n: LoraNode) => ({
        ...n,
        relay_1: relayIfOnline(n.relay_1, n.is_online),
        relay_2: relayIfOnline(n.relay_2, n.is_online),
      })));
      setGateways(gws);
    } catch {
      setError('Failed to load nodes');
    } finally {
      setLoading(false);
    }
  }, [gwFilter]);

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
  // toggled from the node detail page or the dashboard map in the meantime.
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
              // real power is still flowing is wrong — but don't promote a
              // relay we didn't already believe was on just from shared load.
              // An offline node can't have an energized relay either way.
              relay_1: relayIfOnline(correctRelayState(relay1, n.relay_1, current, power), isOnline),
              relay_2: relayIfOnline(correctRelayState(relay2, n.relay_2, current, power), isOnline),
              voltage: d.voltage !== undefined ? Number(d.voltage) : n.voltage,
              current, power,
              temperature: d.temperature !== undefined ? Number(d.temperature) : n.temperature,
              pwm_percent: d.pwm_percent !== undefined ? Number(d.pwm_percent) : n.pwm_percent,
              is_online: isOnline,
              // Receiving a telemetry frame at all is proof of fresh contact
              // — don't leave last_seen stuck on the old value just because
              // this particular payload happens to omit its own timestamp.
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

  const filtered = nodes.filter((n) => {
    const q = search.toLowerCase();
    return (
      String(n.node_id).includes(q) ||
      (n.name || '').toLowerCase().includes(q)
    );
  });

  const online = nodes.filter((n) => n.is_online).length;
  // Count individually active relays, not nodes-with-any-relay-on — a node
  // with both Relay 1 and Relay 2 on should contribute 2, not 1.
  const activeRelays = nodes.reduce(
    (sum, n) => sum + (normalizeRelayState(n.relay_1) ? 1 : 0) + (normalizeRelayState(n.relay_2) ? 1 : 0),
    0,
  );

  // Load On/Off drives UI "Relay 1" (backend relay_2, per the swapped
  // numbering) on every node at once. Optimistic update matches the table's
  // display field; the websocket ack/telemetry stream reconciles the real
  // value once each device actually applies the command.
  const bulkLoadRelay1 = async (state: boolean) => {
    setBulkBusy(true);
    setBulkMsg('');
    setBulkErr('');
    setNodes((prev) => prev.map((n) => ({ ...n, relay_2: relayIfOnline(state, n.is_online) })));
    try {
      const results = await Promise.allSettled(
        nodes.map((n) => loraRelay(n.id, swapRelay(1), state ? 1 : 0))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        setBulkErr(`Relay 1 ${state ? 'ON' : 'OFF'} failed for ${failed} of ${nodes.length} node(s)`);
      } else {
        setBulkMsg(`Relay 1 ${state ? 'ON' : 'OFF'} sent to ${nodes.length} node(s)`);
      }
      logBulkAction(state ? 'Load On' : 'Load Off', `Relay 1 ${state ? 'ON' : 'OFF'}`, nodes.length, failed);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkScheduleSend = async () => {
    setBulkBusy(true);
    setBulkMsg('');
    setBulkErr('');
    try {
      const results = await Promise.allSettled(
        nodes.map((n) => loraSchedule(n.id, {
          slot: bulkSchedSlot, enabled: 1, days_mask: 127,
          start_h: bulkSchedStartH, start_m: bulkSchedStartM,
          stop_h: bulkSchedStopH, stop_m: bulkSchedStopM,
          relay_mask: swapRelayMask(1), pwm: bulkSchedPwm,
        }))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        setBulkErr(`Schedule failed for ${failed} of ${nodes.length} node(s)`);
      } else {
        setBulkMsg(`Relay 1 schedule sent to ${nodes.length} node(s)`);
      }
      logBulkAction(
        'Schedule',
        `Slot ${bulkSchedSlot} · ${pad2(bulkSchedStartH)}:${pad2(bulkSchedStartM)}–${pad2(bulkSchedStopH)}:${pad2(bulkSchedStopM)} · PWM ${bulkSchedPwm}%`,
        nodes.length,
        failed,
      );
      setBulkSchedOpen(false);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <AppLayout>
      <Box>
        <PageHeader
          title="LoRa Nodes"
          subtitle={`${online} online / ${nodes.length} total · ${activeRelays} active relays`}
          actions={<Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>}
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {bulkMsg && <Alert severity="success" onClose={() => setBulkMsg('')} sx={{ mb: 2 }}>{bulkMsg}</Alert>}
        {bulkErr && <Alert severity="error" onClose={() => setBulkErr('')} sx={{ mb: 2 }}>{bulkErr}</Alert>}

        <StatGrid
          items={[
            { label: 'Total Nodes', value: nodes.length, color: '#0d7377' },
            { label: 'Online', value: online, color: '#10b981' },
            { label: 'Offline', value: nodes.length - online, color: '#ef4444' },
            { label: 'Active Relays', value: activeRelays, color: '#f59e0b' },
            { label: 'Total Power', value: `${nodes.reduce((s, n) => s + n.power, 0).toFixed(0)} W`, color: '#6366f1' },
          ]}
        />

        {/* Bulk Relay 1 control */}
        <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', mb: 3, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Relay 1 — All Nodes
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained" size="large" disabled={bulkBusy || nodes.length === 0}
              sx={{ flex: 1, minWidth: 160, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, py: 1.5, fontWeight: 700 }}
              onClick={() => bulkLoadRelay1(true)}
            >
              {bulkBusy ? <CircularProgress size={20} color="inherit" /> : 'LOAD ON'}
            </Button>
            <Button
              variant="contained" size="large" disabled={bulkBusy || nodes.length === 0}
              sx={{ flex: 1, minWidth: 160, bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, py: 1.5, fontWeight: 700 }}
              onClick={() => bulkLoadRelay1(false)}
            >
              {bulkBusy ? <CircularProgress size={20} color="inherit" /> : 'LOAD OFF'}
            </Button>
            <Button
              variant="outlined" size="large" disabled={bulkBusy || nodes.length === 0}
              startIcon={<ScheduleIcon />}
              sx={{ flex: 1, minWidth: 160, borderColor: '#0d7377', color: '#0d7377', py: 1.5, fontWeight: 700, '&:hover': { bgcolor: '#0d737710' } }}
              onClick={() => setBulkSchedOpen(true)}
            >
              Schedule
            </Button>
          </Box>
        </Card>

        {/* Relay 1 action history — what was sent to all nodes and when */}
        {bulkHistory.length > 0 && (
          <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', mb: 3 }}>
            <Box sx={{ px: 2, pt: 2 }}>
              <Typography variant="subtitle2" fontWeight={700}>Relay 1 — Last Action</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['Time', 'Action', 'Details', 'Nodes', 'Result'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkHistory.map((h) => (
                    <TableRow key={h.id} hover>
                      <TableCell sx={{ fontSize: 12 }}>{new Date(h.time).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{h.action}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{h.detail}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{h.nodeCount}</TableCell>
                      <TableCell>
                        <Chip size="small" label={h.result} sx={{
                          bgcolor: h.result === 'Success' ? '#dcfce7' : h.result === 'Partial' ? '#fef3c7' : '#fee2e2',
                          color: h.result === 'Success' ? '#15803d' : h.result === 'Partial' ? '#b45309' : '#dc2626',
                          fontWeight: 600, fontSize: 11,
                        }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search by node ID or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ flex: '1 1 260px', minWidth: 220 }}
          />
          <FormControl size="small" sx={{ flex: '1 1 200px', minWidth: 180 }}>
            <InputLabel>Gateway Filter</InputLabel>
            <Select
              label="Gateway Filter"
              value={gwFilter}
              onChange={(e) => setGwFilter(e.target.value as number | '')}
            >
              <MenuItem value="">All Gateways</MenuItem>
              {gateways.map((gw) => (
                <MenuItem key={gw.id} value={gw.id}>{gw.name || gw.gateway_imei}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Table */}
        <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['Node', 'Name', 'Gateway', 'Status', 'Voltage', 'Current', 'Power', 'Temperature', 'Relay 1', 'Relay 2', 'PWM', 'Last Seen', ''].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} sx={{ color: '#0d7377' }} />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No nodes found
                    </TableCell>
                  </TableRow>
                ) : filtered.map((n) => {
                  const gw = gateways.find((g) => g.id === n.gateway_id);
                  return (
                    <TableRow key={n.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MemoryIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                          <Chip label={`#${n.node_id}`} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12 }} />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{n.name || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" sx={{ fontSize: 11 }}>
                          {gw?.name || gw?.gateway_imei || `GW ${n.gateway_id}`}
                        </Typography>
                      </TableCell>
                      <TableCell><StatusChip online={n.is_online} /></TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{n.voltage.toFixed(1)} V</TableCell>
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
                      <TableCell sx={{ fontSize: 12 }}>{n.pwm_percent}%</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                          {n.last_seen ? new Date(n.last_seen).toLocaleString() : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Node Details">
                          <IconButton size="small" onClick={() => router.push(`/lora/nodes/${n.id}`)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Bulk Relay 1 Schedule Dialog */}
        <Dialog open={bulkSchedOpen} onClose={() => setBulkSchedOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight={700}>Schedule Relay 1 — All Nodes</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Applies this schedule slot to Relay 1 on all {nodes.length} node(s), every day.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
              <TextField label="Slot (0–7)" type="number" value={bulkSchedSlot}
                onChange={(e) => setBulkSchedSlot(parseInt(e.target.value))} inputProps={{ min: 0, max: 7 }} />
              <TextField label="PWM %" type="number" value={bulkSchedPwm}
                onChange={(e) => setBulkSchedPwm(parseInt(e.target.value))} inputProps={{ min: 0, max: 100 }} />
              <TextField label="Start Hour" type="number" value={bulkSchedStartH}
                onChange={(e) => setBulkSchedStartH(parseInt(e.target.value))} inputProps={{ min: 0, max: 23 }} />
              <TextField label="Start Minute" type="number" value={bulkSchedStartM}
                onChange={(e) => setBulkSchedStartM(parseInt(e.target.value))} inputProps={{ min: 0, max: 59 }} />
              <TextField label="Stop Hour" type="number" value={bulkSchedStopH}
                onChange={(e) => setBulkSchedStopH(parseInt(e.target.value))} inputProps={{ min: 0, max: 23 }} />
              <TextField label="Stop Minute" type="number" value={bulkSchedStopM}
                onChange={(e) => setBulkSchedStopM(parseInt(e.target.value))} inputProps={{ min: 0, max: 59 }} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setBulkSchedOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={bulkScheduleSend} disabled={bulkBusy} sx={{ bgcolor: '#0d7377', '&:hover': { bgcolor: '#0a5f63' } }}>
              {bulkBusy ? <CircularProgress size={16} color="inherit" /> : 'Send to All Nodes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}

export default function LoraNodesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} sx={{ color: '#0d7377' }} />
          </Box>
        </AppLayout>
      }
    >
      <LoraNodesContent />
    </Suspense>
  );
}











