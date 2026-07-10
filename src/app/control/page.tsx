"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, Grid, Button, Chip,
  CircularProgress, IconButton, Collapse,
  Table, TableBody, TableRow, TableCell, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, LinearProgress, Tooltip,
  FormControl, InputLabel, Select, FormControlLabel, Checkbox,
  alpha, Slider,
} from '@mui/material';
import {
  Power as PowerIcon,
  PowerOff as PowerOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  NotificationsActive as NotifyIcon,
  CheckCircle as CheckCircleIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Close as CloseIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts';
import AppLayout from '@/components/AppLayout';
import RaiseFaultDialog from '@/components/RaiseFaultDialog';
import { SearchFilter, FilterOptions } from '@/components/SearchFilter';
import { DataExport } from '@/components/DataExport';
import { fetchDevices, fetchDeviceLive, turnOn, turnOff, createFault } from '@/lib/api';
import { Device, DeviceLive } from '@/lib/types';

const C = {
  navy: '#1e293b', green: '#10b981', red: '#ef4444',
  orange: '#f59e0b', grey: '#9ca3af', teal: '#1f6c7e', dark: '#0f172a',
  purple: '#8b5cf6', blue: '#06b6d4',
};

/* ─── Dimming constants ───────────────────────────────────── */
const MAX_POWER = 300;
const DIM_STEPS = 10;
const DIM_LEVELS = Array.from({ length: DIM_STEPS }, (_, i) =>
  Math.round((MAX_POWER * (i + 1)) / DIM_STEPS)
); // [30, 60, 90, 120, 150, 180, 210, 240, 270, 300]

/* ─── value sanitizers ────────────────────────────────────── */
function sv(v: number): number | null { return (v >= 50 && v <= 290)  ? v : null; }   // voltage
function si(v: number): number | null { return (v >= 0  && v <= 100)  ? v : null; }   // current
function spf(v: number): number | null{ return (v >= -1 && v <= 1)    ? v : null; }   // power factor
function sf(v: number): number | null { return (v >= 45 && v <= 65)   ? v : null; }   // frequency
function fmt(v: number | null, dp = 2): string { return v === null ? '—' : v.toFixed(dp); }
function phaseImbalance(r: number | null, y: number | null, b: number | null): number | null {
  if (r === null || y === null || b === null) return null;
  const avg = (r + y + b) / 3;
  if (avg === 0) return null;
  return (Math.max(Math.abs(r - avg), Math.abs(y - avg), Math.abs(b - avg)) / avg) * 100;
}

/* ─── helpers ─────────────────────────────────────────────── */
function statusColor(d: Device) {
  if (!d.is_online) return C.grey;
  if (d.status === 'ON')    return C.green;
  if (d.status === 'OFF')   return C.red;
  if (d.status === 'FAULT') return C.orange;
  return C.grey;
}
function statusLabel(d: Device) { return !d.is_online ? 'OFFLINE' : d.status; }

function Bool({ value, label }: { value: boolean; label: string }) {
  return (
    <Chip size="small" label={label} sx={{
      fontWeight: 600, fontSize: '0.65rem',
      bgcolor: value ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
      color: value ? C.green : C.red, mr: 0.5, mb: 0.5,
    }} />
  );
}

function MiniMetric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: alpha(color, 0.08), border: `1px solid ${alpha(color, 0.2)}` }}>
      <Typography variant="h6" fontWeight={800} sx={{ color, fontSize: '1.1rem', lineHeight: 1.2 }}>{value}</Typography>
      {unit && <Typography variant="caption" sx={{ color, fontSize: '0.65rem', fontWeight: 600 }}>{unit}</Typography>}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.68rem', mt: 0.25 }}>{label}</Typography>
    </Box>
  );
}

/* ─── table row helper ────────────────────────────────────── */
function TR({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell sx={{ py: 0.5, px: 1, fontWeight: 600, color: C.navy, fontSize: '0.73rem', width: '45%', borderColor: '#f0f4f8' }}>{label}</TableCell>
      <TableCell sx={{ py: 0.5, px: 1, fontSize: '0.73rem', borderColor: '#f0f4f8' }}>{value}</TableCell>
    </TableRow>
  );
}

/* ─── LiveDataDialog ──────────────────────────────────────── */
function LiveDataDialog({ open, device, onClose }: { open: boolean; device: Device; onClose: () => void }) {
  const [live, setLive]             = useState<DeviceLive | null>(null);
  const [loading, setLoading]       = useState(false);
  const [nextRefresh, setNextRefresh] = useState(30);
  const refreshRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLive = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchDeviceLive(device.device_id); setLive(data); setNextRefresh(30); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, [device.device_id]);

  useEffect(() => {
    if (open) {
      loadLive();
      refreshRef.current   = setInterval(loadLive, 30000);
      countdownRef.current = setInterval(() => setNextRefresh((v) => v <= 1 ? 30 : v - 1), 1000);
    } else {
      if (refreshRef.current)   clearInterval(refreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (refreshRef.current)   clearInterval(refreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [open]);

  const sc = statusColor(device);

  // Sanitize
  const vr = live ? sv(live.voltage_r) : null;
  const vy = live ? sv(live.voltage_y) : null;
  const vb = live ? sv(live.voltage_b) : null;
  const ir = live ? si(live.current_r) : null;
  const iy = live ? si(live.current_y) : null;
  const ib = live ? si(live.current_b) : null;
  const pf   = live ? spf(live.power_factor) : null;
  const freq = live ? sf(live.frequency) : null;

  const vData = [
    { phase: 'R', value: vr ?? 0, color: '#ef4444' },
    { phase: 'Y', value: vy ?? 0, color: '#f59e0b' },
    { phase: 'B', value: vb ?? 0, color: '#3b82f6' },
  ];
  const iData = [
    { phase: 'R', value: ir ?? 0, color: '#e91e63' },
    { phase: 'Y', value: iy ?? 0, color: '#ff9800' },
    { phase: 'B', value: ib ?? 0, color: '#6366f1' },
  ];

  const vImb = phaseImbalance(vr, vy, vb);
  const iImb = phaseImbalance(ir, iy, ib);

  const pfColor = pf === null ? C.grey : pf >= 0.9 ? C.green : pf >= 0.7 ? C.orange : C.red;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}>

      {/* ─ Dialog Header ─ */}
      <DialogTitle sx={{ pb: 1, bgcolor: alpha(C.teal, 0.04), borderBottom: `1px solid ${alpha(C.teal, 0.12)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: alpha(sc, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {device.is_online ? <WifiIcon sx={{ color: sc, fontSize: 22 }} /> : <WifiOffIcon sx={{ color: sc, fontSize: 22 }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800} color={C.dark}>{device.device_id}</Typography>
            <Typography variant="caption" color="text.secondary">
              {device.model || '—'} · FW {device.firmware_version || '—'}
            </Typography>
          </Box>
          <Chip size="small" label={statusLabel(device)}
            sx={{ bgcolor: alpha(sc, 0.15), color: sc, fontWeight: 700, fontSize: '0.7rem' }} />
          <IconButton size="small" onClick={onClose} sx={{ ml: 0.5, color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Refresh bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
          <TimerIcon sx={{ fontSize: 14, color: C.teal }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 90 }}>
            Refresh in <strong>{nextRefresh}s</strong>
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LinearProgress variant="determinate" value={((30 - nextRefresh) / 30) * 100}
              sx={{ height: 3, borderRadius: 2, bgcolor: alpha(C.teal, 0.12),
                '& .MuiLinearProgress-bar': { bgcolor: C.teal, borderRadius: 2 } }} />
          </Box>
          <Button size="small" onClick={loadLive} disabled={loading}
            startIcon={loading ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon sx={{ fontSize: 14 }} />}
            sx={{ fontSize: '0.72rem', fontWeight: 600, color: C.teal, borderRadius: 1.5, py: 0.3, px: 1.2,
              '&:hover': { bgcolor: alpha(C.teal, 0.08) } }}>
            {loading ? 'Loading…' : 'Now'}
          </Button>
        </Box>
      </DialogTitle>

      {/* ─ Dialog Content ─ */}
      <DialogContent sx={{ p: { xs: 2, md: 3 }, overflow: 'auto' }}>
        {loading && !live ? (
          <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
        ) : live ? (
          <Grid container spacing={3}>

            {/* Left: Telemetry table */}
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
                Live Telemetry
              </Typography>
              <Table size="small" sx={{ '& td': { borderBottom: `1px solid ${alpha('#000', 0.05)}` }, '& tbody tr:last-child td': { borderBottom: 'none' } }}>
                <TableBody>
                  <TR label="Voltage R / Y / B"     value={`${fmt(vr,1)} / ${fmt(vy,1)} / ${fmt(vb,1)} V`} />
                  <TR label="Current R / Y / B"     value={`${fmt(ir,2)} / ${fmt(iy,2)} / ${fmt(ib,2)} A`} />
                  <TR label="Power"                  value={`${live.power.toFixed(2)} kW`} />
                  <TR label="Energy"                 value={`${live.energy.toFixed(2)} kWh`} />
                  <TR label="Power Factor"           value={pf !== null ? pf.toFixed(3) : '— (invalid reading)'} />
                  <TR label="Frequency"              value={freq !== null ? `${freq.toFixed(1)} Hz` : '—'} />
                  <TR label="RSSI"                   value={`${live.rssi} dBm`} />
                  <TR label="Runtime (Curr / Total)" value={`${live.curr_runtime} / ${live.total_runtime} hrs`} />
                  {live.timer_slot !== undefined && <TR label="Timer Slot" value={String(live.timer_slot)} />}
                  {live.last_seen && <TR label="Last Seen" value={new Date(live.last_seen).toLocaleString()} />}
                </TableBody>
              </Table>

              {/* Phase imbalance */}
              {(vImb !== null || iImb !== null) && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                  <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: C.navy, fontSize: '0.68rem' }}>
                    Phase Imbalance
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                    {vImb !== null && (
                      <Chip size="small" label={`Voltage: ${vImb.toFixed(1)}%`}
                        sx={{ bgcolor: vImb > 5 ? alpha(C.red,0.12) : alpha(C.green,0.12),
                          color: vImb > 5 ? C.red : C.green, fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                    {iImb !== null && (
                      <Chip size="small" label={`Current: ${iImb.toFixed(1)}%`}
                        sx={{ bgcolor: iImb > 10 ? alpha(C.red,0.12) : alpha(C.green,0.12),
                          color: iImb > 10 ? C.red : C.green, fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', fontSize: '0.67rem' }}>
                      {(vImb ?? 0) > 5 || (iImb ?? 0) > 10 ? '⚠ Imbalance detected' : '✓ Balanced'}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Status flags */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: C.navy, fontSize: '0.68rem', display: 'block', mb: 0.75 }}>
                  Device Flags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {device.is_online && <Bool value={device.load_on}        label="Load ON" />}
                  <Bool value={device.mcb}             label="MCB" />
                  <Bool value={device.contactor}       label="Contactor" />
                  <Bool value={device.auto_mode}       label="Auto Mode" />
                  <Bool value={device.vphase_healthy}  label="V-Phase OK" />
                  <Bool value={device.iphase_healthy}  label="I-Phase OK" />
                </Box>
              </Box>
            </Grid>

            {/* Right: Charts + metric cards */}
            <Grid item xs={12} md={7}>

              {/* Voltage bar chart */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
                    Voltage Analysis
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Nominal: 220–240 V</Typography>
                </Box>
                <Box sx={{ height: 160 }}>
                  <ResponsiveContainer>
                    <BarChart data={vData} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                      <XAxis dataKey="phase" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} domain={[150, 280]} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)} V`, 'Voltage']} />
                      <ReferenceLine y={240} stroke="#94a3b8" strokeDasharray="5 3"
                        label={{ value: '240V', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                      <ReferenceLine y={220} stroke="#cbd5e1" strokeDasharray="5 3"
                        label={{ value: '220V', position: 'right', fontSize: 10, fill: '#cbd5e1' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {vData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>

              {/* Current bar chart */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
                  Current Analysis
                </Typography>
                <Box sx={{ height: 140 }}>
                  <ResponsiveContainer>
                    <BarChart data={iData} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                      <XAxis dataKey="phase" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(2)} A`, 'Current']} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {iData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>

              {/* Metric cards */}
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <MiniMetric label="Total Power" value={live.power.toFixed(2)} unit="kW" color={C.green} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniMetric label="Energy" value={live.energy.toFixed(2)} unit="kWh" color={C.purple} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniMetric label="Power Factor" value={pf !== null ? pf.toFixed(3) : '—'} unit="" color={pfColor} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniMetric label="Frequency" value={freq !== null ? `${freq.toFixed(1)}` : '—'} unit="Hz" color={C.teal} />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">No live data available for this device.</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: `1px solid ${alpha('#000', 0.06)}` }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── DeviceCard ──────────────────────────────────────────── */
function DeviceCard({ device, onRefreshAll }: { device: Device; onRefreshAll: () => void }) {
  const [cmdLoading, setCmdLoading] = useState<'on' | 'off' | null>(null);
  const [error, setError]           = useState('');
  const [faultOpen, setFaultOpen]   = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dimIndex, setDimIndex]     = useState(DIM_STEPS - 1); // default full power

  const currentPower = DIM_LEVELS[dimIndex];
  const dimPct       = Math.round((currentPower / MAX_POWER) * 100);
  // Visual glow intensity based on dimming (only when ON)
  const isOn  = device.status === 'ON';
  const glowOpacity = isOn ? 0.12 + (dimPct / 100) * 0.55 : 0.04;
  const bulbColor   = isOn
    ? dimPct >= 80 ? '#fef08a'
    : dimPct >= 50 ? '#fde68a'
    : '#fcd34d'
    : '#e5e7eb';

  const handlePower = async (action: 'on' | 'off') => {
    setCmdLoading(action); setError('');
    try {
      if (action === 'on') await turnOn(device.device_id); else await turnOff(device.device_id);
      setTimeout(() => { onRefreshAll(); setCmdLoading(null); }, 1500);
    } catch { setError('Command failed'); setCmdLoading(null); }
  };

  const sc    = statusColor(device);
  const label = statusLabel(device);

  return (
    <>
      <Card sx={{
        borderRadius: 2.5, overflow: 'hidden',
        border: '1.5px solid ' + alpha(sc, 0.25),
        boxShadow: device.status === 'FAULT' ? '0 8px 24px ' + alpha(C.orange, 0.15) : '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': { boxShadow: '0 12px 32px rgba(0,0,0,0.12)', transform: 'translateY(-2px)', borderColor: sc },
      }}>
        <Box sx={{ height: 3, bgcolor: sc }} />

        <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {/* Bulb glow avatar — brightness reflects dimming */}
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, mt: 0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(bulbColor, glowOpacity + 0.1),
            boxShadow: isOn ? `0 0 ${8 + dimPct / 5}px ${alpha(bulbColor, glowOpacity * 1.4)}` : 'none',
            transition: 'all 0.4s ease',
          }}>
            {device.is_online
              ? <WifiIcon sx={{ fontSize: 22, color: isOn ? bulbColor : sc, filter: isOn ? `drop-shadow(0 0 ${3 + dimPct/20}px ${bulbColor})` : 'none', transition: 'all 0.4s' }} />
              : <WifiOffIcon sx={{ fontSize: 22, color: sc }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} color={C.dark} noWrap sx={{ fontSize: '0.9rem' }}>{device.device_id}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.75rem' }}>{device.model || '—'} · FW {device.firmware_version || '—'}</Typography>
          </Box>
          <Chip size="small" label={label} sx={{ fontWeight: 700, fontSize: '0.65rem', height: 24, flexShrink: 0, bgcolor: alpha(sc, 0.15), color: sc }} />
        </Box>

        <Box sx={{ px: 2, pb: 0.5, display: 'flex', flexWrap: 'wrap' }}>
          {device.is_online && <Bool value={device.load_on} label="Load" />}
          <Bool value={device.mcb} label="MCB" />
          <Bool value={device.contactor} label="Contactor" />
          <Bool value={device.auto_mode} label="Auto" />
          <Bool value={device.vphase_healthy} label="V-Phase" />
          <Bool value={device.iphase_healthy} label="I-Phase" />
        </Box>

        <Box sx={{ px: 2.5, pb: 2, pt: 1, display: 'flex', gap: 1 }}>
          <Button fullWidth variant={isOn ? 'contained' : 'outlined'} size="small"
            disabled={!!cmdLoading || !device.is_online} onClick={() => handlePower('on')}
            sx={{
              fontWeight: 700, borderRadius: 1.5, py: 0.85, fontSize: '0.8rem',
              bgcolor: isOn ? C.green : 'transparent', borderColor: isOn ? C.green : alpha(C.green, 0.4), color: isOn ? '#fff' : C.green,
              '&:hover': { bgcolor: isOn ? '#059669' : alpha(C.green, 0.12), borderColor: C.green },
              '&:disabled': { opacity: 0.5 },
            }}
            startIcon={cmdLoading === 'on' ? <CircularProgress size={12} color="inherit" /> : <PowerIcon sx={{ fontSize: 16 }} />}>
            ON
          </Button>
          <Button fullWidth variant={!isOn && device.is_online ? 'contained' : 'outlined'} size="small"
            disabled={!!cmdLoading || !device.is_online} onClick={() => handlePower('off')}
            sx={{
              fontWeight: 700, borderRadius: 1.5, py: 0.85, fontSize: '0.8rem',
              bgcolor: !isOn && device.is_online ? C.red : 'transparent', borderColor: !isOn ? C.red : alpha(C.red, 0.4), color: !isOn && device.is_online ? '#fff' : C.red,
              '&:hover': { bgcolor: !isOn && device.is_online ? '#dc2626' : alpha(C.red, 0.12), borderColor: C.red },
              '&:disabled': { opacity: 0.5 },
            }}
            startIcon={cmdLoading === 'off' ? <CircularProgress size={12} color="inherit" /> : <PowerOffIcon sx={{ fontSize: 16 }} />}>
            OFF
          </Button>
          <Tooltip title="Raise Fault & Send Notifications">
            <Button variant="outlined" size="small" onClick={() => setFaultOpen(true)}
              sx={{ minWidth: 0, px: 1.2, py: 0.85, borderRadius: 1.5, borderColor: C.orange, color: C.orange, '&:hover': { bgcolor: alpha(C.orange, 0.12) } }}>
              <WarningIcon sx={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
          <Tooltip title="Live Analytics">
            <IconButton size="small" onClick={() => setDetailOpen(true)}
              sx={{ ml: 'auto', bgcolor: alpha(C.teal, 0.08), color: C.teal, borderRadius: 1.5, '&:hover': { bgcolor: alpha(C.teal, 0.18) } }}>
              <AnalyticsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {error && <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0.25, borderRadius: 2, fontSize: '0.75rem' }}>{error}</Alert>}

        {/* ─── Dimming Control ─── */}
        <Box sx={{ px: 2.5, pb: 2, pt: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.65rem', color: C.navy }}>
              Dimming
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: isOn ? bulbColor : '#e5e7eb',
                boxShadow: isOn ? `0 0 6px ${bulbColor}` : 'none',
                transition: 'all 0.3s',
              }} />
              <Typography variant="caption" fontWeight={700} sx={{ color: isOn ? C.orange : C.grey, fontSize: '0.75rem' }}>
                {isOn ? `${currentPower}W · ${dimPct}%` : 'OFF'}
              </Typography>
            </Box>
          </Box>
          <Slider
            size="small"
            value={dimIndex}
            min={0}
            max={DIM_STEPS - 1}
            step={1}
            disabled={!isOn}
            marks={DIM_LEVELS.map((val, i) => ({
              value: i,
              label: i === 0 || i === DIM_STEPS - 1 ? `${val}W` : '',
            }))}
            onChange={(_, val) => setDimIndex(val as number)}
            sx={{
              color: isOn ? C.teal : C.grey,
              '& .MuiSlider-thumb': {
                width: 14, height: 14,
                boxShadow: isOn ? `0 0 0 4px ${alpha(C.teal, 0.16)}` : 'none',
              },
              '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: C.grey },
              '& .MuiSlider-track': {
                background: isOn
                  ? `linear-gradient(to right, ${C.teal}, ${dimPct >= 80 ? '#f59e0b' : C.teal})`
                  : C.grey,
              },
              mb: 1,
            }}
          />
          {/* Visual brightness bar */}
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 2,
              width: `${isOn ? dimPct : 0}%`,
              background: isOn
                ? `linear-gradient(to right, ${alpha(C.teal, 0.8)}, ${alpha('#f59e0b', Math.min(dimPct / 100, 1))})`
                : 'transparent',
              transition: 'width 0.3s ease, background 0.3s ease',
            }} />
          </Box>
        </Box>
      </Card>

      <RaiseFaultDialog
        open={faultOpen}
        entityLabel={device.device_id}
        onClose={() => setFaultOpen(false)}
        onSubmit={async (data, notify) => {
          await createFault({ device_id: device.device_id, ...data }, notify);
        }}
      />
      <LiveDataDialog open={detailOpen} device={device} onClose={() => setDetailOpen(false)} />
    </>
  );
}

/* ─── ControlPage ─────────────────────────────────────────── */
export default function ControlPage() {
  const [devices, setDevices]         = useState<Device[]>([]);
  const [loading, setLoading]         = useState(true);
  const [bulkLoading, setBulkLoading] = useState<'on' | 'off' | null>(null);
  const [filter, setFilter]           = useState<'ALL' | 'ONLINE' | 'FAULT'>('ALL');
  const [searchFilters, setSearchFilters] = useState<FilterOptions>({ search: '', status: 'all', type: 'all' });

  const load = useCallback(async () => {
    try { const data = await fetchDevices(); setDevices(data); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [load]);

  const handleBulk = async (action: 'on' | 'off') => {
    setBulkLoading(action);
    const fn = action === 'on' ? turnOn : turnOff;
    await Promise.allSettled(devices.filter((d) => d.is_online).map((d) => fn(d.device_id)));
    setTimeout(() => { load(); setBulkLoading(null); }, 2000);
  };

  const onlineCount = devices.filter((d) => d.is_online).length;
  const onCount     = devices.filter((d) => d.status === 'ON').length;
  const faultCount  = devices.filter((d) => d.status === 'FAULT').length;

  const filtered = devices.filter((d) => {
    const passesBase   = filter === 'ONLINE' ? d.is_online : filter === 'FAULT' ? d.status === 'FAULT' : true;
    const q            = searchFilters.search.toLowerCase();
    const passesSearch = !q || d.device_id.toLowerCase().includes(q) || (d.model ?? '').toLowerCase().includes(q) || (d.firmware_version ?? '').toLowerCase().includes(q);
    const passesStatus =
      searchFilters.status === 'all' ||
      (searchFilters.status === 'online'  && d.is_online) ||
      (searchFilters.status === 'offline' && !d.is_online) ||
      (searchFilters.status === 'fault'   && d.status === 'FAULT');
    return passesBase && passesSearch && passesStatus;
  });

  return (
    <AppLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', maxWidth: '1600px', mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" fontWeight={800} color={C.dark}>Device Control</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {filtered.length} of {devices.length} devices — Refreshes every 15s
            </Typography>
          </Box>
          <DataExport data={{ devices: filtered, timestamp: new Date().toISOString() }} filename="devices" />
        </Box>

        {/* Search + Status chips + Bulk actions */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: 260 }}>
            <SearchFilter
              onFilterChange={setSearchFilters}
              placeholder="Search by device ID, model, or firmware..."
              availableTypes={[]}
            />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Chip label={`${devices.length} Total`} size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }} />
            <Chip label={`${onlineCount} Online`} size="small" clickable
              onClick={() => setFilter(filter === 'ONLINE' ? 'ALL' : 'ONLINE')}
              sx={{ fontWeight: 700, bgcolor: filter === 'ONLINE' ? C.green : alpha(C.green, 0.1), color: filter === 'ONLINE' ? '#fff' : C.green }} />
            <Chip label={`${onCount} ON`} size="small" sx={{ fontWeight: 700, bgcolor: alpha(C.green, 0.1), color: C.green }} />
            {faultCount > 0 && (
              <Chip label={`${faultCount} FAULT`} size="small" clickable
                onClick={() => setFilter(filter === 'FAULT' ? 'ALL' : 'FAULT')}
                sx={{ fontWeight: 700, bgcolor: filter === 'FAULT' ? C.red : alpha(C.red, 0.1), color: filter === 'FAULT' ? '#fff' : C.red }} />
            )}
            {filter !== 'ALL' && (
              <Chip label="Clear" size="small" variant="outlined" clickable onClick={() => setFilter('ALL')} sx={{ fontWeight: 700 }} />
            )}
            <Button variant="contained" size="small" disabled={!!bulkLoading} onClick={() => handleBulk('on')}
              startIcon={bulkLoading === 'on' ? <CircularProgress size={14} color="inherit" /> : <PowerIcon />}
              sx={{ bgcolor: C.green, fontWeight: 700, borderRadius: 2, textTransform: 'none', '&:hover': { bgcolor: '#059669' } }}>
              All ON
            </Button>
            <Button variant="contained" size="small" disabled={!!bulkLoading} onClick={() => handleBulk('off')}
              startIcon={bulkLoading === 'off' ? <CircularProgress size={14} color="inherit" /> : <PowerOffIcon />}
              sx={{ bgcolor: C.red, fontWeight: 700, borderRadius: 2, textTransform: 'none', '&:hover': { bgcolor: '#dc2626' } }}>
              All OFF
            </Button>
            <IconButton onClick={load} size="small" sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Device Grid */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">Loading devices…</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            {filter !== 'ALL' ? 'No devices match this filter.' : 'No devices found.'}
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {filtered.map((d) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={d.device_id}>
                <DeviceCard device={d} onRefreshAll={load} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </AppLayout>
  );
}
