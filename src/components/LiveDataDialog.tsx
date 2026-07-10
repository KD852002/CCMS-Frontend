'use client';

/**
 * LiveDataDialog — shared full telemetry dialog.
 * Used in both Control page and Map page.
 *
 * Requires only device_id, status, is_online, model, firmware_version,
 * load_on, mcb, contactor, auto_mode, vphase_healthy, iphase_healthy.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Button, Chip,
  CircularProgress, Table, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timer as TimerIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts';
import { IconButton } from '@mui/material';
import { fetchDeviceLive } from '@/lib/api';
import type { DeviceLive } from '@/lib/types';

const C = {
  navy: '#1e293b', green: '#10b981', red: '#ef4444',
  orange: '#f59e0b', grey: '#9ca3af', teal: '#1f6c7e',
  purple: '#8b5cf6', blue: '#06b6d4',
};

/* ── sanitizers ─────────────────────────────────────────── */
function sv(v: number): number | null { return (v >= 50 && v <= 290)  ? v : null; }
function si(v: number): number | null { return (v >= 0  && v <= 100)  ? v : null; }
function spf(v: number): number | null { return (v >= -1 && v <= 1)   ? v : null; }
function sf(v: number): number | null  { return (v >= 45 && v <= 65)  ? v : null; }
function fmt(v: number | null, dp = 2): string { return v === null ? '—' : v.toFixed(dp); }

function phaseImbalance(r: number | null, y: number | null, b: number | null): number | null {
  if (r === null || y === null || b === null) return null;
  const avg = (r + y + b) / 3;
  if (avg === 0) return null;
  return (Math.max(Math.abs(r - avg), Math.abs(y - avg), Math.abs(b - avg)) / avg) * 100;
}

function TR({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell sx={{ py: 0.5, px: 1, fontWeight: 600, color: C.navy, fontSize: '0.73rem', width: '45%', borderColor: '#f0f4f8' }}>{label}</TableCell>
      <TableCell sx={{ py: 0.5, px: 1, fontSize: '0.73rem', borderColor: '#f0f4f8' }}>{value}</TableCell>
    </TableRow>
  );
}

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

export interface LiveDialogDevice {
  device_id: string;
  status: string;
  is_online: boolean;
  model?: string | null;
  firmware_version?: string | null;
  load_on?: boolean;
  mcb?: boolean;
  contactor?: boolean;
  auto_mode?: boolean;
  vphase_healthy?: boolean;
  iphase_healthy?: boolean;
}

interface Props {
  open: boolean;
  device: LiveDialogDevice;
  onClose: () => void;
}

export function LiveDataDialog({ open, device, onClose }: Props) {
  const [live, setLive]           = useState<DeviceLive | null>(null);
  const [loading, setLoading]     = useState(false);
  const [nextRefresh, setNextRefresh] = useState(30);
  const refreshRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sc = device.is_online
    ? device.status === 'ON' ? C.green
    : device.status === 'OFF' ? C.red
    : device.status === 'FAULT' ? C.orange
    : C.grey
    : C.grey;

  const statusLabel = !device.is_online ? 'OFFLINE' : device.status;

  const loadLive = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDeviceLive(device.device_id);
      setLive(data);
      setNextRefresh(30);
    } catch { /* silent */ }
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
  }, [open, loadLive]);

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

      {/* Header */}
      <DialogTitle sx={{ pb: 1, bgcolor: alpha(C.teal, 0.04), borderBottom: `1px solid ${alpha(C.teal, 0.12)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: alpha(sc, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {device.is_online
              ? <WifiIcon sx={{ color: sc, fontSize: 22 }} />
              : <WifiOffIcon sx={{ color: sc, fontSize: 22 }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800} color={C.navy}>{device.device_id}</Typography>
            <Typography variant="caption" color="text.secondary">
              {device.model || '—'} · FW {device.firmware_version || '—'}
            </Typography>
          </Box>
          <Chip size="small" label={statusLabel}
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

      {/* Content */}
      <DialogContent sx={{ p: { xs: 2, md: 3 }, overflow: 'auto' }}>
        {loading && !live ? (
          <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
        ) : live ? (
          <Grid container spacing={3}>

            {/* Left: table + flags */}
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

              {/* Device flags */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: C.navy, fontSize: '0.68rem', display: 'block', mb: 0.75 }}>
                  Device Flags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {device.is_online && <Bool value={device.load_on ?? false}       label="Load ON" />}
                  <Bool value={device.mcb ?? false}            label="MCB" />
                  <Bool value={device.contactor ?? false}      label="Contactor" />
                  <Bool value={device.auto_mode ?? false}      label="Auto Mode" />
                  <Bool value={device.vphase_healthy ?? true}  label="V-Phase OK" />
                  <Bool value={device.iphase_healthy ?? true}  label="I-Phase OK" />
                </Box>
              </Box>
            </Grid>

            {/* Right: charts + metric cards */}
            <Grid item xs={12} md={7}>

              {/* Voltage chart */}
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

              {/* Current chart */}
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
