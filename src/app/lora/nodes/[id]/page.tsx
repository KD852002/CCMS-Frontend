'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Tab, Tabs, IconButton,
  Button, Tooltip, CircularProgress, Alert, Divider, Slider, Switch,
  FormControlLabel, TextField, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  Wifi as PingIcon,
  RestartAlt as ResetIcon,
  AccessTime as TimeSyncIcon,
  DownloadForOffline as TelemetryReqIcon,
  Memory as MemoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, LineChart, Line,
} from 'recharts';
import AppLayout from '@/components/AppLayout';
import RaiseFaultDialog from '@/components/RaiseFaultDialog';
import {
  fetchLoraNode, fetchLoraNodeTelemetry, fetchLoraNodeSchedule, fetchLoraNodeCommands,
  loraRelay, loraPwm, loraDimming, loraSchedule, loraConfig,
  loraPing, loraReset, loraTimeSync, loraRequestTelemetry,
  createLoraWebSocket, updateLoraNode, createLoraFault,
} from '@/lib/api';
import type { LoraNode, LoraTelemetry, LoraWsEvent, LoraCommand, LoraNodeSchedule } from '@/lib/types';
import { normalizeRelayState, swapRelay, relayStateFor, swapRelayMask, correctRelayState, relayIfOnline } from '@/lib/loraUtils';

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  teal: '#0d7377',
  green: '#10b981',
  red: '#ef4444',
  orange: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function RelayToggle({
  label, relay, active, nodeId, onOptimistic,
}: {
  label: string; relay: 1 | 2; active: boolean; nodeId: number;
  onOptimistic: (relay: 1 | 2, state: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const toggle = async () => {
    const nextState = !active;
    onOptimistic(relay, nextState);
    setLoading(true);
    try {
      // No forced reload here — the websocket ack/telemetry stream reconciles
      // relay_1/relay_2 once the device actually applies the change, which
      // over LoRa can take far longer than a short fixed delay would assume.
      await loraRelay(nodeId, relay, nextState ? 1 : 0);
    } catch {
      onOptimistic(relay, active);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card sx={{ borderRadius: 2, border: `2px solid ${active ? C.green : '#e5e7eb'}`, p: 2, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Box sx={{ my: 1.5 }}>
        <Chip
          label={active ? 'ON' : 'OFF'}
          sx={{
            bgcolor: active ? '#dcfce7' : '#fee2e2',
            color: active ? C.green : C.red,
            fontWeight: 700, fontSize: 18, px: 2, py: 3, borderRadius: 2,
          }}
        />
      </Box>
      <Button
        variant="contained" size="small" fullWidth
        disabled={loading}
        onClick={toggle}
        sx={{
          bgcolor: active ? C.red : C.green,
          '&:hover': { bgcolor: active ? '#dc2626' : '#059669' },
        }}
      >
        {loading ? <CircularProgress size={16} color="inherit" /> : (active ? 'Turn OFF' : 'Turn ON')}
      </Button>
    </Card>
  );
}

// ── Tab panels ─────────────────────────────────────────────────────────────
interface TabPanelProps { children: React.ReactNode; value: number; index: number; }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ══════════════════════════════════════════════════════════════════════════
//  Main page
// ══════════════════════════════════════════════════════════════════════════
export default function LoraNodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const nodeId = parseInt(id, 10);

  const [node, setNode] = useState<LoraNode | null>(null);
  const [telemetry, setTelemetry] = useState<LoraTelemetry[]>([]);
  const [commands, setCommands] = useState<LoraCommand[]>([]);
  const [schedule, setSchedule] = useState<LoraNodeSchedule | null>(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cmdResult, setCmdResult] = useState('');
  const [cmdError, setCmdError] = useState('');

  // PWM slider
  const [pwmValue, setPwmValue] = useState(0);
  const [pwmSaving, setPwmSaving] = useState(false);
  const [useDimmingCmd, setUseDimmingCmd] = useState(false);

  // Schedule dialog
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedSlot, setSchedSlot] = useState(0);
  const [schedStartH, setSchedStartH] = useState(18);
  const [schedStartM, setSchedStartM] = useState(30);
  const [schedStopH, setSchedStopH] = useState(6);
  const [schedStopM, setSchedStopM] = useState(0);
  const [schedPwm, setSchedPwm] = useState(100);
  const [schedRelayMask, setSchedRelayMask] = useState(3);

  // Config dialog
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgParam, setCfgParam] = useState(1);
  const [cfgValue, setCfgValue] = useState('');
  const [cfgCmd, setCfgCmd] = useState<'config' | 'config_update'>('config');

  // Live telemetry via WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  // Location
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locSaving, setLocSaving] = useState(false);

  // Fault dialog
  const [faultOpen, setFaultOpen] = useState(false);

  // After we set a relay ourselves, the device's telemetry can keep reporting
  // a stale cached reading for a short window before it catches up — during
  // that window a contradicting telemetry value is ignored in favor of what
  // we just set, instead of flickering the display.
  const RELAY_GRACE_MS = 18000;
  const relayGraceUntil = useRef<Partial<Record<1 | 2, number>>>({});

  const applyRelayUpdate = useCallback((relay: 1 | 2, state: boolean) => {
    relayGraceUntil.current[relay] = Date.now() + RELAY_GRACE_MS;
    setNode((prev) => {
      if (!prev) return prev;
      return relay === 1 ? { ...prev, relay_1: state } : { ...prev, relay_2: state };
    });
  }, []);

  // ── Data load ────────────────────────────────────────────────────────────
  const loadNode = useCallback(async () => {
    try {
      const n = await fetchLoraNode(nodeId);
      // A REST read can be just as stale/wrong as a telemetry frame — don't
      // let it clobber a relay we just set ourselves (grace window), and
      // don't accept an "OFF" that contradicts real power still flowing.
      setNode((prev) => {
        if (!prev) return n;
        const now = Date.now();
        const inGrace1 = (relayGraceUntil.current[1] ?? 0) > now;
        const inGrace2 = (relayGraceUntil.current[2] ?? 0) > now;
        // An offline node can't have an energized relay regardless of
        // whatever value (real or optimistic) is cached from before it
        // went offline.
        return {
          ...n,
          relay_1: relayIfOnline(inGrace1 ? prev.relay_1 : correctRelayState(n.relay_1, prev.relay_1, n.current, n.power), n.is_online),
          relay_2: relayIfOnline(inGrace2 ? prev.relay_2 : correctRelayState(n.relay_2, prev.relay_2, n.current, n.power), n.is_online),
        };
      });
      setPwmValue(n.pwm_percent);
      setLatitude(n.latitude != null ? String(n.latitude) : '');
      setLongitude(n.longitude != null ? String(n.longitude) : '');
    } catch {
      setError('Failed to load node');
    }
  }, [nodeId]);

  const loadTelemetry = useCallback(async () => {
    try {
      const rows: LoraTelemetry[] = await fetchLoraNodeTelemetry(nodeId, { limit: 100 });
      setTelemetry(rows.reverse());
    } catch { /* non-fatal */ }
  }, [nodeId]);

  const loadCommands = useCallback(async () => {
    try {
      setCommands(await fetchLoraNodeCommands(nodeId, 30));
    } catch { /* non-fatal */ }
  }, [nodeId]);

  const loadSchedule = useCallback(async () => {
    try {
      setSchedule(await fetchLoraNodeSchedule(nodeId));
    } catch { /* non-fatal */ }
  }, [nodeId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadNode(), loadTelemetry(), loadCommands(), loadSchedule()]);
      setLoading(false);
    })();
  }, [loadNode, loadTelemetry, loadCommands, loadSchedule]);

  // Websocket push can silently miss the node's offline transition (dropped
  // connection, or the backend simply not emitting node_offline), so poll
  // the REST endpoint as a fallback instead of relying on live events alone.
  useEffect(() => {
    const iv = setInterval(loadNode, 30000);
    return () => clearInterval(iv);
  }, [loadNode]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = createLoraWebSocket((evt) => {
      try {
        const msg: LoraWsEvent = JSON.parse(evt.data);
        const d = msg.data as Record<string, unknown>;

        const matchesNode =
          d.node_pk === nodeId ||
          (node && d.lora_address === node.node_id && d.gateway_imei === node.gateway_imei);

        if (msg.type === 'telemetry' && matchesNode) {
          // Some uplinks omit unchanged fields to save LoRa airtime — treat a
          // missing relay_1/relay_2 as "unchanged" rather than defaulting it
          // to OFF. For a short window right after we set a relay ourselves,
          // also ignore a contradicting value (stale cached reading catching
          // up). And regardless of timing: a relay reported OFF while the
          // node is still drawing real power is simply wrong — an open relay
          // can't pass current to the load — so that reading is discarded too.
          const now = Date.now();
          const current = Number(d.current ?? 0);
          const power = Number(d.power ?? 0);
          const isOnline = d.is_online !== undefined ? normalizeRelayState(d.is_online) : (node?.is_online ?? true);
          const relay1Known = d.relay_1 !== undefined && (relayGraceUntil.current[1] ?? 0) <= now;
          const relay2Known = d.relay_2 !== undefined && (relayGraceUntil.current[2] ?? 0) <= now;
          const relay1 = relay1Known ? correctRelayState(normalizeRelayState(d.relay_1), node?.relay_1 ?? false, current, power) : (node?.relay_1 ?? false);
          const relay2 = relay2Known ? correctRelayState(normalizeRelayState(d.relay_2), node?.relay_2 ?? false, current, power) : (node?.relay_2 ?? false);
          const row: LoraTelemetry = {
            id: Date.now(),
            node_id: nodeId,
            timestamp: String(d.timestamp ?? new Date().toISOString()),
            voltage: Number(d.voltage ?? 0),
            current,
            power,
            energy: Number(d.energy ?? 0),
            relay_1: relay1,
            relay_2: relay2,
            tilt_raw: Number(d.tilt_raw ?? 0),
            volt_fault: normalizeRelayState(d.volt_fault),
            curr_fault: normalizeRelayState(d.curr_fault),
            temperature: Number(d.temperature ?? 0),
            pwm_percent: Number(d.pwm_percent ?? 0),
          };
          setTelemetry((prev) => [...prev.slice(-99), row]);
          setNode((prev) => prev ? {
            ...prev,
            voltage: row.voltage, current: row.current, power: row.power,
            energy: row.energy,
            // An offline node can't have an energized relay either way.
            relay_1: relayIfOnline(relay1Known ? relay1 : prev.relay_1, isOnline),
            relay_2: relayIfOnline(relay2Known ? relay2 : prev.relay_2, isOnline),
            temperature: row.temperature, pwm_percent: row.pwm_percent,
            is_online: isOnline, last_seen: row.timestamp,
          } : prev);
          setPwmValue(row.pwm_percent);
        }
        if ((msg.type === 'ack' || msg.type === 'command_status') && d.cmd_id) {
          setCmdResult(`ACK: ${d.cmd_id} → ${d.status}`);
          if (matchesNode && d.relay_1 !== undefined) {
            applyRelayUpdate(1, normalizeRelayState(d.relay_1));
          }
          if (matchesNode && d.relay_2 !== undefined) {
            applyRelayUpdate(2, normalizeRelayState(d.relay_2));
          }
          loadCommands();
        }
      } catch { /* ignore parse errors */ }
    });
    ws.onopen = () => setLiveConnected(true);
    ws.onclose = () => setLiveConnected(false);
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [nodeId, node?.node_id, node?.gateway_imei, loadCommands, applyRelayUpdate]);

  const handleSaveLocation = async () => {
    setLocSaving(true);
    try {
      const lat = latitude.trim() ? parseFloat(latitude) : null;
      const lng = longitude.trim() ? parseFloat(longitude) : null;
      const updated = await updateLoraNode(nodeId, { latitude: lat, longitude: lng });
      setNode(updated);
      setCmdResult('Location saved');
    } catch {
      setCmdError('Failed to save location');
    } finally {
      setLocSaving(false);
    }
  };

  // ── Command helpers ────────────────────────────────────────────────────────
  // `reload` re-fetches the node shortly after the command is sent. LoRa
  // uplinks can take far longer than that to reach the device, so relay
  // commands (which already update optimistically and get reconciled by the
  // websocket ack/telemetry stream) skip it to avoid clobbering the optimistic
  // state with a stale pre-command read.
  const cmd = useCallback(async (fn: () => Promise<unknown>, label: string, reload = true) => {
    setCmdError('');
    setCmdResult('');
    try {
      // Don't surface the backend's own `detail` text for relay commands —
      // it reports the raw/un-swapped relay number (e.g. "Relay 2 → ON" for
      // a click on the UI's "Relay 1"), which contradicts the label we just
      // showed the user. Our own label is already UI-numbering-correct.
      const r = await fn() as { cmd_id?: string };
      setCmdResult(`${label}: sent (${r?.cmd_id || ''})`);
      if (reload) setTimeout(() => loadNode(), 1500);
    } catch {
      setCmdError(`${label} failed — check MQTT connection`);
    }
  }, [loadNode]);

  // LOAD ON/OFF must drive both physical relays, but the backend's single
  // /on //off endpoint only actually toggles raw relay 1. Compose it from two
  // explicit relay commands instead so both relays really switch together.
  const loadOnOff = useCallback(async (state: boolean) => {
    applyRelayUpdate(1, state);
    applyRelayUpdate(2, state);
    setCmdError('');
    setCmdResult('');
    try {
      await Promise.all([
        loraRelay(nodeId, 1, state ? 1 : 0),
        loraRelay(nodeId, 2, state ? 1 : 0),
      ]);
      setCmdResult(`Node ${state ? 'ON' : 'OFF'}: sent`);
    } catch {
      applyRelayUpdate(1, !state);
      applyRelayUpdate(2, !state);
      setCmdError(`Node ${state ? 'ON' : 'OFF'} failed — check MQTT connection`);
    }
  }, [nodeId, applyRelayUpdate]);

  const handlePwmApply = () => {
    setPwmSaving(true);
    const fn = useDimmingCmd ? loraDimming(nodeId, pwmValue) : loraPwm(nodeId, pwmValue);
    fn.then(() => {
      setCmdResult(`${useDimmingCmd ? 'Dimming' : 'PWM'} set to ${pwmValue}%`);
      setPwmSaving(false);
    }).catch(() => {
      setCmdError('Dimming/PWM command failed');
      setPwmSaving(false);
    });
  };

  const handleScheduleSend = async () => {
    await cmd(() => loraSchedule(nodeId, {
      slot: schedSlot, enabled: 1, days_mask: 127,
      start_h: schedStartH, start_m: schedStartM,
      stop_h: schedStopH, stop_m: schedStopM,
      relay_mask: swapRelayMask(schedRelayMask), pwm: schedPwm,
    }), 'Schedule');
    setSchedOpen(false);
    loadSchedule();
  };

  const handleScheduleDisable = async () => {
    await cmd(() => loraSchedule(nodeId, {
      slot: schedSlot, enabled: 0, days_mask: 127,
      start_h: 0, start_m: 0, stop_h: 0, stop_m: 0,
      relay_mask: 0, pwm: 0,
    }), 'Disable Schedule');
    loadSchedule();
  };

  const handleConfigSend = async () => {
    const v = parseInt(cfgValue, 10);
    if (isNaN(v)) { setCmdError('Invalid value'); return; }
    await cmd(() => loraConfig(nodeId, cfgParam, v, cfgCmd), 'Config');
    setCfgOpen(false);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = telemetry.slice(-60).map((t) => ({
    time: fmtTime(t.timestamp),
    voltage: Number(t.voltage.toFixed(2)),
    current: Number(t.current.toFixed(3)),
    power: Number(t.power.toFixed(1)),
    energy: Number(t.energy.toFixed(3)),
    temperature: Number(t.temperature.toFixed(1)),
    pwm: t.pwm_percent,
  }));

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress sx={{ color: C.teal }} />
        </Box>
      </AppLayout>
    );
  }

  if (!node) {
    return (
      <AppLayout>
        <Alert severity="error">Node not found</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <IconButton onClick={() => router.push('/lora/nodes')} size="small"><BackIcon /></IconButton>
          <MemoryIcon sx={{ color: C.teal, fontSize: 28 }} />
          <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={700}>{node.name || `Node #${node.node_id}`}</Typography>
              <Chip
                size="small"
                icon={<CircleIcon sx={{ fontSize: '10px !important' }} />}
                label={node.is_online ? 'Online' : 'Offline'}
                sx={{
                  bgcolor: node.is_online ? '#dcfce7' : '#fee2e2',
                  color: node.is_online ? C.green : C.red,
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: node.is_online ? C.green : C.red },
                }}
              />
              {liveConnected && (
                <Chip size="small" label="Live" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600, fontSize: 11 }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              LoRa address: {node.node_id}
              {node.gateway_imei && ` · Gateway: ${node.gateway_imei}`}
              {node.last_seen && ` · Last seen: ${new Date(node.last_seen).toLocaleString()}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Refresh"><IconButton onClick={() => Promise.all([loadNode(), loadTelemetry(), loadCommands(), loadSchedule()])}><RefreshIcon /></IconButton></Tooltip>
            <Button variant="outlined" color="warning" startIcon={<WarningIcon />} onClick={() => setFaultOpen(true)}>
              Raise Fault
            </Button>
          </Box>
        </Box>

        {/* ── Command feedback ────────────────────────────────────────── */}
        {cmdResult && <Alert severity="success" onClose={() => setCmdResult('')} sx={{ mb: 1.5 }}>{cmdResult}</Alert>}
        {cmdError && <Alert severity="error" onClose={() => setCmdError('')} sx={{ mb: 1.5 }}>{cmdError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        {/* ── Live metric cards ────────────────────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5, mb: 2 }}>
          {[
            { label: 'Voltage', value: `${node.voltage.toFixed(1)} V`, color: C.teal },
            { label: 'Current', value: `${node.current.toFixed(3)} A`, color: C.blue },
            { label: 'Power', value: `${node.power.toFixed(1)} W`, color: C.orange },
            { label: 'Energy', value: `${node.energy.toFixed(3)} kWh`, color: C.purple },
            { label: 'Temperature', value: `${node.temperature.toFixed(1)} °C`, color: C.pink },
            { label: 'PWM', value: `${node.pwm_percent}%`, color: '#0ea5e9' },
          ].map((m) => (
            <Card key={m.label} sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
              <Box sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: m.color, lineHeight: 1.3 }}>{m.value}</Typography>
              </Box>
            </Card>
          ))}
        </Box>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
            sx={{
              borderBottom: '1px solid #e5e7eb', px: 2,
              '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', minHeight: 48 },
              '& .Mui-selected': { color: C.teal },
              '& .MuiTabs-indicator': { bgcolor: C.teal },
            }}>
            <Tab label="Overview" />
            <Tab label="Telemetry Charts" />
            <Tab label="Commands" />
            <Tab label="Schedule" />
            <Tab label="Configuration" />
          </Tabs>

          {/* ── Overview ──────────────────────────────────────────────── */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ p: 2 }}>
              {/* Master load ON/OFF */}
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Button variant="contained" size="large"
                  sx={{ flex: 1, bgcolor: C.green, '&:hover': { bgcolor: '#059669' }, py: 1.5, fontWeight: 700 }}
                  onClick={() => loadOnOff(true)}>
                  LOAD ON
                </Button>
                <Button variant="contained" size="large"
                  sx={{ flex: 1, bgcolor: C.red, '&:hover': { bgcolor: '#dc2626' }, py: 1.5, fontWeight: 700 }}
                  onClick={() => loadOnOff(false)}>
                  LOAD OFF
                </Button>
              </Box>

              <Grid container spacing={2}>
                {/* Relay controls */}
                <Grid item xs={12} md={5}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Relay Control</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <RelayToggle label="Relay 1" relay={swapRelay(1)} active={relayStateFor(node, 1)} nodeId={nodeId}
                      onOptimistic={applyRelayUpdate} />
                    <RelayToggle label="Relay 2" relay={swapRelay(2)} active={relayStateFor(node, 2)} nodeId={nodeId}
                      onOptimistic={applyRelayUpdate} />
                  </Box>
                </Grid>

                {/* PWM control */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>PWM / Dimming</Typography>
                  <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Brightness</Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: C.teal }}>{pwmValue}%</Typography>
                    </Box>
                    <Slider
                      value={pwmValue}
                      onChange={(_, v) => setPwmValue(v as number)}
                      min={0} max={100} step={1}
                      marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]}
                      sx={{ color: C.teal, mt: 2 }}
                    />
                    <FormControlLabel
                      control={<Switch size="small" checked={useDimmingCmd} onChange={(e) => setUseDimmingCmd(e.target.checked)} />}
                      label={<Typography variant="caption">Use dimming command (vs pwm)</Typography>}
                      sx={{ mt: 1 }}
                    />
                    <Button variant="contained" fullWidth size="small" sx={{ mt: 1, bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}
                      onClick={handlePwmApply} disabled={pwmSaving}>
                      {pwmSaving ? <CircularProgress size={16} color="inherit" /> : `Apply ${useDimmingCmd ? 'Dimming' : 'PWM'}`}
                    </Button>
                  </Card>
                </Grid>

                {/* Quick actions */}
                {/* <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Quick Actions</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { label: 'Ping', icon: <PingIcon />, fn: () => cmd(() => loraPing(nodeId), 'Ping'), color: C.blue },
                      { label: 'Request Telemetry', icon: <TelemetryReqIcon />, fn: () => cmd(() => loraRequestTelemetry(nodeId), 'Telemetry Request'), color: C.teal },
                      { label: 'Time Sync', icon: <TimeSyncIcon />, fn: () => cmd(() => loraTimeSync(nodeId), 'Time Sync'), color: C.orange },
                      { label: 'Reset Node', icon: <ResetIcon />, fn: () => cmd(() => loraReset(nodeId), 'Reset'), color: C.red },
                    ].map((a) => (
                      <Button key={a.label} variant="outlined" size="small" startIcon={a.icon}
                        onClick={a.fn}
                        sx={{ borderColor: a.color, color: a.color, justifyContent: 'flex-start', '&:hover': { bgcolor: `${a.color}10` } }}>
                        {a.label}
                      </Button>
                    ))}
                  </Box>
                </Grid> */}

                {/* Location */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Location (GIS Map)</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <TextField size="small" label="Latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} sx={{ minWidth: 160 }} />
                    <TextField size="small" label="Longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} sx={{ minWidth: 160 }} />
                    <Button variant="contained" size="small" onClick={handleSaveLocation} disabled={locSaving}
                      sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>
                      {locSaving ? <CircularProgress size={16} color="inherit" /> : 'Save Location'}
                    </Button>
                  </Box>
                </Grid>

                {/* Node info */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Node Info</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }}>
                    {[
                      { label: 'Node ID', value: node.node_id },
                      { label: 'Firmware', value: node.firmware_version || '—' },
                      { label: 'Volt Fault', value: telemetry[telemetry.length - 1]?.volt_fault ? 'YES' : 'NO' },
                      { label: 'Curr Fault', value: telemetry[telemetry.length - 1]?.curr_fault ? 'YES' : 'NO' },
                      { label: 'Tilt Raw', value: telemetry[telemetry.length - 1]?.tilt_raw ?? '—' },
                      { label: 'Energy', value: `${node.energy.toFixed(3)} kWh` },
                    ].map(({ label, value }) => (
                      <Box key={label} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{String(value)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* ── Telemetry Charts ──────────────────────────────────────── */}
          <TabPanel value={tab} index={1}>
            <Box sx={{ p: 2 }}>
              {chartData.length < 2 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography color="text.secondary">No telemetry data yet — send a telemetry request to populate</Typography>
                  <Button sx={{ mt: 2, color: C.teal }} onClick={() => cmd(() => loraRequestTelemetry(nodeId), 'Telemetry Request')}>
                    Request Telemetry Now
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Voltage + Current */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Voltage & Current</Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="voltage" stroke={C.teal} dot={false} strokeWidth={2} name="Voltage (V)" />
                        <Line yAxisId="right" type="monotone" dataKey="current" stroke={C.blue} dot={false} strokeWidth={2} name="Current (A)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Power */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Power (W)</Typography>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Area type="monotone" dataKey="power" stroke={C.orange} fill="#fef3c7" strokeWidth={2} name="Power (W)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Temperature */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Temperature (°C)</Typography>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Area type="monotone" dataKey="temperature" stroke={C.pink} fill="#fce7f3" strokeWidth={2} name="Temperature (°C)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Energy + PWM */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Energy (kWh) & PWM (%)</Typography>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <RTooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="energy" stroke={C.purple} dot={false} strokeWidth={2} name="Energy (kWh)" />
                        <Line yAxisId="right" type="monotone" dataKey="pwm" stroke="#0ea5e9" dot={false} strokeWidth={2} name="PWM (%)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* ── Commands ──────────────────────────────────────────────── */}
          <TabPanel value={tab} index={2}>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Manual Commands</Typography>
              <Grid container spacing={2}>
                {/* Relay block */}
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', p: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">RELAY CONTROL</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {([1, 2] as (1 | 2)[]).map((r) => (
                        <Box key={r} sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="contained" fullWidth
                            sx={{ bgcolor: C.green, '&:hover': { bgcolor: '#059669' } }}
                            onClick={() => {
                              applyRelayUpdate(swapRelay(r), true);
                              cmd(() => loraRelay(nodeId, swapRelay(r), 1), `Relay ${r} ON`, false);
                            }}>
                            Relay {r} ON
                          </Button>
                          <Button size="small" variant="contained" fullWidth
                            sx={{ bgcolor: C.red, '&:hover': { bgcolor: '#dc2626' } }}
                            onClick={() => {
                              applyRelayUpdate(swapRelay(r), false);
                              cmd(() => loraRelay(nodeId, swapRelay(r), 0), `Relay ${r} OFF`, false);
                            }}>
                            Relay {r} OFF
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                </Grid>

                {/* PWM block */}
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', p: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">PWM / DIMMING</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 60 }}>Value: {pwmValue}%</Typography>
                      <Slider value={pwmValue} onChange={(_, v) => setPwmValue(v as number)} min={0} max={100} sx={{ color: C.teal, flex: 1 }} />
                    </Box>
                    <Button size="small" variant="contained" fullWidth onClick={handlePwmApply} disabled={pwmSaving}
                      sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>
                      {pwmSaving ? <CircularProgress size={16} color="inherit" /> : 'Apply PWM'}
                    </Button>
                  </Card>
                </Grid>

                {/* Utility block */}
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ borderRadius: 2, border: '1px solid #e5e7eb', p: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">UTILITY</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button size="small" variant="outlined" startIcon={<PingIcon />}
                        sx={{ borderColor: C.blue, color: C.blue }}
                        onClick={() => cmd(() => loraPing(nodeId), 'Ping')}>Ping</Button>
                      <Button size="small" variant="outlined" startIcon={<TelemetryReqIcon />}
                        sx={{ borderColor: C.teal, color: C.teal }}
                        onClick={() => cmd(() => loraRequestTelemetry(nodeId), 'Telemetry Request')}>Request Telemetry</Button>
                      <Button size="small" variant="outlined" startIcon={<TimeSyncIcon />}
                        sx={{ borderColor: C.orange, color: C.orange }}
                        onClick={() => cmd(() => loraTimeSync(nodeId), 'Time Sync')}>Time Sync</Button>
                      <Button size="small" variant="outlined" startIcon={<ResetIcon />}
                        sx={{ borderColor: C.red, color: C.red }}
                        onClick={() => cmd(() => loraReset(nodeId), 'Reset')}>Reset Node</Button>
                    </Box>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Command History</Typography>
              <TableContainer component={Card} sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Time', 'Command', 'cmd_id', 'Status'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commands.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 2 }}>No commands yet</TableCell></TableRow>
                    ) : commands.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{c.command}</TableCell>
                        <TableCell sx={{ fontSize: 10, fontFamily: 'monospace' }}>{c.cmd_id}</TableCell>
                        <TableCell>
                          <Chip size="small" label={c.status}
                            sx={{
                              bgcolor: c.status === 'ACK' ? '#dcfce7' : c.status === 'NACK' ? '#fee2e2' : '#fef3c7',
                              color: c.status === 'ACK' ? C.green : c.status === 'NACK' ? C.red : C.orange,
                              fontWeight: 600, fontSize: 11,
                            }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>

          {/* ── Schedule ──────────────────────────────────────────────── */}
          <TabPanel value={tab} index={3}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>Schedule Slots</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" color="error" onClick={handleScheduleDisable}>Disable Slot</Button>
                  <Button variant="contained" size="small" onClick={() => setSchedOpen(true)}
                    sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>
                    Edit / Add Slot
                  </Button>
                </Box>
              </Box>
              <TableContainer component={Card} sx={{ borderRadius: 2, border: '1px solid #e5e7eb', mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Slot', 'Enabled', 'Start', 'Stop', 'Relays', 'PWM %'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(schedule?.slots?.length ?? 0) === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>No schedules configured</TableCell></TableRow>
                    ) : schedule!.slots.map((s) => (
                      <TableRow key={s.slot} hover onClick={() => { setSchedSlot(s.slot); setSchedStartH(s.start_h); setSchedStartM(s.start_m); setSchedStopH(s.stop_h); setSchedStopM(s.stop_m); setSchedPwm(s.pwm); setSchedRelayMask(swapRelayMask(s.relay_mask)); setSchedOpen(true); }} sx={{ cursor: 'pointer' }}>
                        <TableCell>{s.slot}</TableCell>
                        <TableCell>{s.enabled ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{String(s.start_h).padStart(2, '0')}:{String(s.start_m).padStart(2, '0')}</TableCell>
                        <TableCell>{String(s.stop_h).padStart(2, '0')}:{String(s.stop_m).padStart(2, '0')}</TableCell>
                        <TableCell>{s.relay_mask === 3 ? 'Both' : s.relay_mask === 2 ? 'R1' : s.relay_mask === 1 ? 'R2' : '—'}</TableCell>
                        <TableCell>{s.pwm}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Per broker spec: slot 0–7, days_mask 127 = all days, relay_mask 3 = both relays.
                Example: 18:30–06:00 daily with PWM 80%.
              </Alert>
            </Box>
          </TabPanel>

          {/* ── Configuration ──────────────────────────────────────────── */}
          <TabPanel value={tab} index={4}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>Protection & Calibration</Typography>
                <Button variant="contained" size="small" onClick={() => setCfgOpen(true)}
                  sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>
                  Send Config
                </Button>
              </Box>
              <TableContainer component={Card} sx={{ borderRadius: 2, border: '1px solid #e5e7eb' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Param', 'Meaning', 'Units / Scale', 'Example'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { param: 1, name: 'Over-voltage threshold', unit: 'V × 100', ex: '26000 = 260.00 V' },
                      { param: 2, name: 'Under-voltage threshold', unit: 'V × 100', ex: '18000 = 180.00 V' },
                      { param: 3, name: 'Over-current threshold', unit: 'A × 1000', ex: '2000 = 2.000 A' },
                      { param: 16, name: 'Voltage calibration', unit: 'V × 100', ex: '23045 = 230.45 V' },
                      { param: 17, name: 'Current calibration', unit: 'A × 1000', ex: '512 = 0.512 A' },
                    ].map((r) => (
                      <TableRow key={r.param} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{r.param}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{r.name}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{r.unit}</TableCell>
                        <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{r.ex}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>
        </Card>

        {/* ── Schedule Dialog ──────────────────────────────────────────── */}
        <Dialog open={schedOpen} onClose={() => setSchedOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight={700}>Schedule Slot</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
              <TextField label="Slot (0–7)" type="number" value={schedSlot} onChange={(e) => setSchedSlot(parseInt(e.target.value))} inputProps={{ min: 0, max: 7 }} />
              <TextField label="PWM %" type="number" value={schedPwm} onChange={(e) => setSchedPwm(parseInt(e.target.value))} inputProps={{ min: 0, max: 100 }} />
              <TextField label="Start Hour" type="number" value={schedStartH} onChange={(e) => setSchedStartH(parseInt(e.target.value))} inputProps={{ min: 0, max: 23 }} />
              <TextField label="Start Minute" type="number" value={schedStartM} onChange={(e) => setSchedStartM(parseInt(e.target.value))} inputProps={{ min: 0, max: 59 }} />
              <TextField label="Stop Hour" type="number" value={schedStopH} onChange={(e) => setSchedStopH(parseInt(e.target.value))} inputProps={{ min: 0, max: 23 }} />
              <TextField label="Stop Minute" type="number" value={schedStopM} onChange={(e) => setSchedStopM(parseInt(e.target.value))} inputProps={{ min: 0, max: 59 }} />
              <FormControl fullWidth>
                <InputLabel>Relay Mask</InputLabel>
                <Select label="Relay Mask" value={schedRelayMask} onChange={(e) => setSchedRelayMask(e.target.value as number)}>
                  <MenuItem value={1}>Relay 1 only</MenuItem>
                  <MenuItem value={2}>Relay 2 only</MenuItem>
                  <MenuItem value={3}>Both Relays</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setSchedOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleScheduleSend} sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>Send</Button>
          </DialogActions>
        </Dialog>

        {/* ── Config Dialog ─────────────────────────────────────────────── */}
        <Dialog open={cfgOpen} onClose={() => setCfgOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Send Config / Calibration</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Command Type</InputLabel>
                <Select label="Command Type" value={cfgCmd} onChange={(e) => setCfgCmd(e.target.value as 'config' | 'config_update')}>
                  <MenuItem value="config">config (protection)</MenuItem>
                  <MenuItem value="config_update">config_update (calibration)</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Parameter</InputLabel>
                <Select label="Parameter" value={cfgParam} onChange={(e) => setCfgParam(e.target.value as number)}>
                  <MenuItem value={1}>1 — Over-voltage (V×100)</MenuItem>
                  <MenuItem value={2}>2 — Under-voltage (V×100)</MenuItem>
                  <MenuItem value={3}>3 — Over-current (A×1000)</MenuItem>
                  <MenuItem value={16}>16 — Voltage calibration (V×100)</MenuItem>
                  <MenuItem value={17}>17 — Current calibration (A×1000)</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Value (raw integer)" value={cfgValue} onChange={(e) => setCfgValue(e.target.value)}
                helperText="See config table for scale factors" />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCfgOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleConfigSend} sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' } }}>Send</Button>
          </DialogActions>
        </Dialog>
      </Box>

      <RaiseFaultDialog
        open={faultOpen}
        entityLabel={node.name || `Node #${node.node_id}`}
        onClose={() => setFaultOpen(false)}
        onSubmit={async (data, notify) => {
          await createLoraFault({ lora_node_id: nodeId, ...data }, notify);
        }}
      />
    </AppLayout>
  );
}





















