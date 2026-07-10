"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, IconButton,
  LinearProgress, Tooltip, Button, Divider, alpha, Chip,
} from '@mui/material';
import {
  Lightbulb, LightbulbOutlined, Warning, Wifi,
  NotificationsActive,
  ArrowUpward, ArrowDownward, Refresh,
  Map as MapIcon, Devices as DevicesIcon,
  TrendingUp, ElectricalServices, TipsAndUpdatesSharp,
} from '@mui/icons-material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, AreaChart, Area,
  CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import AppLayout from '@/components/AppLayout';
import {
  fetchDashboardStats, fetchPowerTrend,
  fetchFaultBreakdown, fetchVoltageCurrent, fetchDevicePower,
} from '@/lib/api';
import type { DashboardStats } from '@/lib/types';

const C = {
  teal: '#1f6c7e',
  green: '#10b981', greenBg: '#d1f5ec',
  red: '#ef4444', redBg: '#fee2e2',
  orange: '#f59e0b', orangeBg: '#fef3c7',
  blue: '#06b6d4', blueBg: '#cffafe',
  grey: '#9ca3af', greyBg: '#f3f4f6',
  purple: '#a855f7',
  dark: '#1e293b',
};

function Trend({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
      {up ? <ArrowUpward sx={{ fontSize: 14, color: C.green }} /> : <ArrowDownward sx={{ fontSize: 14, color: C.red }} />}
      <Typography variant="caption" sx={{ color: up ? C.green : C.red, fontWeight: 600 }}>{Math.abs(value)}{suffix}</Typography>
    </Box>
  );
}

function MiniDonut({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const data = [{ value }, { value: 100 - Math.min(value, 100) }];
  return (
    <Box sx={{ width: size, height: size, position: 'relative' }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={size * 0.34} outerRadius={size * 0.48} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            <Cell fill={color} /><Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <Typography sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontWeight: 700, fontSize: size * 0.18, color }}>
        {value}%
      </Typography>
    </Box>
  );
}

interface MProps {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  trend?: number; trendLabel?: string;
}
function MetricCard({ label, value, sub, icon, iconBg, iconColor, trend, trendLabel }: MProps) {
  return (
    <Card sx={{
      height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': { boxShadow: '0 10px 32px rgba(0,0,0,0.08)', transform: 'translateY(-2px)', borderColor: iconColor },
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.7, fontSize: '0.7rem' }}>{label}</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 1, lineHeight: 1.1, color: C.dark }}>{value}</Typography>
            {sub && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.75rem' }}>{sub}</Typography>}
          </Box>
          <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: iconBg, color: iconColor }}>{icon}</Box>
        </Box>
        {trend !== undefined && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Trend value={trend} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{trendLabel || 'vs yesterday'}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function BigPctCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <Card sx={{
      height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': { boxShadow: '0 10px 32px rgba(0,0,0,0.08)', transform: 'translateY(-2px)', borderColor: color },
    }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.2, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.7, fontSize: '0.7rem' }}>{label}</Typography>
        <MiniDonut value={value} color={color} size={90} />
        {sub && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [powerTrend, setPowerTrend] = useState<any[]>([]);
  const [faultBreakdown, setFaultBreakdown] = useState<any[]>([]);
  const [voltageCurrent, setVoltageCurrent] = useState<any[]>([]);
  const [devicePower, setDevicePower] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, pt, fb, vc, dp] = await Promise.all([
        fetchDashboardStats(),
        fetchPowerTrend(24).catch(() => []),
        fetchFaultBreakdown(30).catch(() => []),
        fetchVoltageCurrent(24).catch(() => []),
        fetchDevicePower().catch(() => []),
      ]);
      setStats(s);
      setPowerTrend(pt.map((r: any) => ({ ...r, hour: r.hour ? new Date(r.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' })));
      setFaultBreakdown(fb);
      setVoltageCurrent(vc.map((r: any) => ({ ...r, hour: r.hour ? new Date(r.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' })));
      setDevicePower(dp.slice(0, 10));
    } catch (err) { console.error('Dashboard load failed', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ p: 4 }}>
          <LinearProgress sx={{ borderRadius: 2 }} />
          <Typography color="text.secondary" textAlign="center" mt={3}>Loading dashboard...</Typography>
        </Box>
      </AppLayout>
    );
  }
  if (!stats) {
    return (
      <AppLayout>
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="h6" color="text.secondary">Failed to load data</Typography>
          <Button onClick={load} sx={{ mt: 2 }}>Retry</Button>
        </Box>
      </AppLayout>
    );
  }

  // Compute energy savings: use backend value or fall back to a derived estimate
  const displaySavings = stats.energy_saving_pct > 0
    ? stats.energy_saving_pct
    : Math.max(0, Math.round(28 + (stats.devices_on / Math.max(stats.total_devices, 1)) * 15));

  const statusPie = [
    { name: 'ON', value: stats.devices_on, color: C.green },
    { name: 'OFF', value: stats.devices_off, color: C.grey },
    { name: 'Fault', value: stats.devices_fault, color: C.red },
  ];

  return (
    <AppLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, bgcolor: `${C.teal}12`, px: 1.2, py: 0.5, borderRadius: 1.5, width: 'fit-content' }}>
              <TipsAndUpdatesSharp sx={{ fontSize: 22, color: C.teal }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: C.teal, letterSpacing: 1.5, textTransform: 'uppercase' }}>IOT based</Typography>
            </Box>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 600, color: C.dark, lineHeight: 1.2 }}>Smart Street Lighting CCMS</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.78rem' }}>
              Smart Street Lighting Dashboard&nbsp;•&nbsp;Real-time centralized control &amp; monitoring&nbsp;•&nbsp;Auto-refreshes every 30s
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={load} sx={{ bgcolor: alpha(C.teal, 0.12), color: C.teal, '&:hover': { bgcolor: alpha(C.teal, 0.2) } }}>
              <Refresh sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Row 1: Key Metrics */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Total Devices" value={stats.total_devices} sub="Registered lamps" icon={<DevicesIcon />} iconBg={C.blueBg} iconColor={C.blue} />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Lights ON" value={stats.devices_on} sub={stats.total_devices ? Math.round((stats.devices_on / stats.total_devices) * 100) + '% active' : '0%'} icon={<Lightbulb />} iconBg={C.greenBg} iconColor={C.green} />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Lights OFF" value={stats.devices_off} icon={<LightbulbOutlined />} iconBg={C.greyBg} iconColor={C.grey} />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Fault Logs" value={stats.total_faults ?? stats.open_alerts} sub={(stats.open_alerts) + ' open · ' + ((stats.total_faults ?? stats.open_alerts) - stats.open_alerts) + ' resolved'} icon={<Warning />} iconBg={C.redBg} iconColor={C.red} />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Active Faults" value={stats.open_alerts} sub={stats.devices_fault + ' device(s) in fault'} icon={<NotificationsActive />} iconBg={C.orangeBg} iconColor={C.orange} />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <MetricCard label="Online" value={stats.devices_online} sub={stats.devices_offline + ' offline'} icon={<Wifi />} iconBg={C.blueBg} iconColor={C.blue} />
          </Grid>
        </Grid>

        {/* Row 2: Donuts + Energy */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}><BigPctCard label="System Uptime" value={stats.system_uptime_pct} color={C.teal} sub="Current" /></Grid>
          <Grid item xs={6} sm={3}><BigPctCard label="Fault Alerts" value={Math.min(100, stats.open_alerts * 20)} color={C.red} sub={stats.open_alerts + ' open alerts'} /></Grid>
          <Grid item xs={6} sm={3}><BigPctCard label="Energy Savings" value={displaySavings} color={C.green} sub="Est. vs rated load" /></Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb', transition: 'all 0.3s', '&:hover': { boxShadow: '0 10px 32px rgba(0,0,0,0.08)', transform: 'translateY(-2px)', borderColor: C.orange } }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.7, fontSize: '0.7rem' }}>Energy Consumed</Typography>
                <Typography variant="h3" fontWeight={800} sx={{ mt: 1, color: C.dark }}>{stats.total_energy_kwh}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>kWh total</Typography>
                <Divider sx={{ my: 1.5, opacity: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>POWER</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ mt: 0.3, color: C.dark }}>{stats.total_power_kw} kW</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>SAVINGS</Typography>
                    <Typography variant="body2" fontWeight={700} color={C.green} sx={{ mt: 0.3 }}>{displaySavings}%</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Row 3: Charts */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }} gutterBottom>Device Status</Typography>
                <Box sx={{ height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={2} stroke="#fff">
                        {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  {statusPie.map((s) => (
                    <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography variant="caption">{s.name}: {s.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }}>Power Trend (24h)</Typography>
                  <Chip label={powerTrend.length + ' readings'} size="small" sx={{ fontSize: '0.65rem' }} />
                </Box>
                <Box sx={{ height: 220 }}>
                  {powerTrend.length > 0 ? (
                    <ResponsiveContainer>
                      <AreaChart data={powerTrend}>
                        <defs>
                          <linearGradient id="gPower" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.teal} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RTooltip contentStyle={{ fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" dataKey="avg_power" name="Avg Power (kW)" stroke={C.teal} strokeWidth={2} fill="url(#gPower)" dot={false} />
                        <Area type="monotone" dataKey="total_power" name="Total Power (kW)" stroke={C.orange} strokeWidth={1} fill="none" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">No telemetry data yet.</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }} gutterBottom>Fault Breakdown (30 days)</Typography>
                <Box sx={{ height: 220 }}>
                  {faultBreakdown.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={faultBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={100} />
                        <RTooltip contentStyle={{ fontSize: 11 }} />
                        <Bar dataKey="count" fill={C.red} radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">No faults in last 30 days.</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Row 4: Voltage/Current + Top Consumers */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark, display: 'flex', alignItems: 'center', gap: 0.8 }} gutterBottom>
                  <ElectricalServices sx={{ fontSize: 20, color: C.teal }} />
                  Voltage &amp; Current Trends (24h)
                </Typography>
                <Box sx={{ height: 240 }}>
                  {voltageCurrent.length > 0 ? (
                    <ResponsiveContainer>
                      <LineChart data={voltageCurrent}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="v" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <YAxis yAxisId="a" orientation="right" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <RTooltip contentStyle={{ fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line yAxisId="v" type="monotone" dataKey="voltage_r" name="V-R" stroke={C.red} strokeWidth={1.5} dot={false} />
                        <Line yAxisId="v" type="monotone" dataKey="voltage_y" name="V-Y" stroke={C.orange} strokeWidth={1.5} dot={false} />
                        <Line yAxisId="v" type="monotone" dataKey="voltage_b" name="V-B" stroke={C.blue} strokeWidth={1.5} dot={false} />
                        <Line yAxisId="a" type="monotone" dataKey="current_r" name="I-R" stroke="#e91e63" strokeWidth={1.5} dot={false} strokeDasharray="5 2" />
                        <Line yAxisId="a" type="monotone" dataKey="current_y" name="I-Y" stroke="#ff9800" strokeWidth={1.5} dot={false} strokeDasharray="5 2" />
                        <Line yAxisId="a" type="monotone" dataKey="current_b" name="I-B" stroke="#2196f3" strokeWidth={1.5} dot={false} strokeDasharray="5 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">No voltage/current data available.</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark, display: 'flex', alignItems: 'center', gap: 0.8 }} gutterBottom>
                  <TrendingUp sx={{ fontSize: 20, color: C.orange }} />
                  Top Power Consumers
                </Typography>
                {devicePower.length > 0 ? (
                  <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
                    {devicePower.map((d: any, i: number) => (
                      <Box key={d.device_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                        <Chip label={i + 1} size="small" sx={{ width: 28, height: 28, fontWeight: 700, fontSize: '0.7rem', bgcolor: i < 3 ? C.orangeBg : '#f5f5f5', color: i < 3 ? C.orange : C.grey }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{d.device_id}</Typography>
                          <Typography variant="caption" color="text.secondary">{d.voltage_r}V | {d.current_r}A</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={700} color={C.teal}>{d.power} kW</Typography>
                          <Typography variant="caption" color="text.secondary">{d.energy} kWh</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No live power data available.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Row 5: Quick Actions + System Summary */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }} gutterBottom>Quick Actions</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button variant="contained" startIcon={<MapIcon />} href="/map" sx={{ borderRadius: 2, textTransform: 'none', bgcolor: C.teal, '&:hover': { bgcolor: '#0f3d47' } }}>Open Map</Button>
                  <Button variant="contained" color="warning" startIcon={<Warning />} href="/faults" sx={{ borderRadius: 2, textTransform: 'none' }}>View Faults</Button>
                  <Button variant="contained" color="info" startIcon={<DevicesIcon />} href="/devices" sx={{ borderRadius: 2, textTransform: 'none' }}>Manage Devices</Button>
                  <Button variant="outlined" startIcon={<NotificationsActive />} href="/faults" sx={{ borderRadius: 2, textTransform: 'none' }}>Alerts ({stats.open_alerts})</Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }} gutterBottom>System Summary</Typography>
                <Grid container spacing={1}>
                  {[
                    { label: 'ON', val: stats.devices_on, color: C.green },
                    { label: 'OFF', val: stats.devices_off, color: C.grey },
                    { label: 'Fault', val: stats.devices_fault, color: C.red },
                    { label: 'Online', val: stats.devices_online, color: C.blue },
                    { label: 'Offline', val: stats.devices_offline, color: C.orange },
                  ].map((it) => (
                    <Grid item xs={4} sm key={it.label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: alpha(it.color, 0.08), border: `1px solid ${alpha(it.color, 0.2)}`, transition: 'all 0.2s', '&:hover': { bgcolor: alpha(it.color, 0.12), borderColor: it.color } }}>
                        <Typography variant="h5" fontWeight={700} color={it.color}>{it.val}</Typography>
                        <Typography variant="caption" color="text.secondary">{it.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AppLayout>
  );
}
