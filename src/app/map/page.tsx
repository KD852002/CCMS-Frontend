'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, TextField,
  IconButton, Tooltip, alpha, ToggleButton, ToggleButtonGroup, Grid,
  InputAdornment, CircularProgress,
} from '@mui/material';
import { Refresh, FilterList, Lightbulb, Warning, WifiOff, Search, MyLocation } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { MapInteractive } from '@/components/MapInteractive';
import { DataExport } from '@/components/DataExport';
import { fetchDeviceMap, fetchLoraGatewayMap, turnOn, turnOff, loraPwm, loraRelay, createLoraWebSocket } from '@/lib/api';
import type { DeviceMapItem, LoraGatewayMapItem, LoraGatewayMapNode, LoraWsEvent } from '@/lib/types';
import { useCcmsProduct } from '@/contexts/CcmsProductContext';
import { normalizeRelayState, correctRelayState, relayIfOnline } from '@/lib/loraUtils';

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false });

const C = {
  teal: '#1f6c7e', green: '#10b981', red: '#ef4444',
  orange: '#f59e0b', blue: '#06b6d4', grey: '#9ca3af', dark: '#1e293b',
};

type StatusFilter = 'ALL' | 'ON' | 'OFF' | 'FAULT' | 'OFFLINE';
type ProductFilter = 'ALL' | 'ORBI' | 'LORA';

async function geocodeArea(query: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'CCMS-App/1.0' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch { /* silent */ }
  return null;
}

export default function MapPage() {
  const { product } = useCcmsProduct();
  const [devices, setDevices]         = useState<DeviceMapItem[]>([]);
  const [loraGateways, setLoraGateways] = useState<LoraGatewayMapItem[]>([]);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [productFilter, setProductFilter] = useState<ProductFilter>('ALL');
  const [areaSearch, setAreaSearch]   = useState('');
  const [areaLoading, setAreaLoading] = useState(false);
  const [flyTo, setFlyTo]             = useState<[number, number] | undefined>(undefined);
  const flyToRef = useRef<[number, number] | undefined>(undefined);

  useEffect(() => {
    setProductFilter(product === 'lora' ? 'LORA' : product === 'orbi' ? 'ORBI' : 'ALL');
  }, [product]);

  const load = useCallback(() => {
    Promise.all([
      fetchDeviceMap().then(setDevices).catch(console.error),
      // An offline node can't have an energized relay regardless of whatever
      // stale value is cached from before it went offline.
      fetchLoraGatewayMap().then((gws: LoraGatewayMapItem[]) => setLoraGateways(gws.map((gw) => ({
        ...gw,
        nodes: gw.nodes.map((n) => ({
          ...n,
          relay_1: relayIfOnline(n.relay_1, n.is_online),
          relay_2: relayIfOnline(n.relay_2, n.is_online),
        })),
      })))).catch(console.error),
    ]);
  }, []);

  // Websocket push can silently miss a node's offline transition (dropped
  // connection, or the backend simply not emitting node_offline), so poll
  // the REST endpoint as a fallback instead of relying on live events alone.
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  // Applies a local state patch to a LoRa node by primary key — used both for
  // optimistic updates on button click and for live websocket sync, so the
  // map/popups don't wait on a manual refresh (or a racy reload right after
  // a self-issued command) to reflect the real device state.
  const applyLoraNodeById = useCallback((nodePk: number, updater: (n: LoraGatewayMapNode) => LoraGatewayMapNode) => {
    setLoraGateways((prev) => prev.map((gw) => ({
      ...gw,
      nodes: gw.nodes.map((n) => (n.id === nodePk ? updater(n) : n)),
    })));
  }, []);

  useEffect(() => {
    const applyNodeUpdate = (
      d: Record<string, unknown>,
      updater: (n: LoraGatewayMapNode) => LoraGatewayMapNode,
    ) => {
      setLoraGateways((prev) => prev.map((gw) => ({
        ...gw,
        nodes: gw.nodes.map((n) => {
          const matches = d.node_pk === n.id
            || (d.lora_address === n.node_id && d.gateway_imei === gw.gateway_imei);
          return matches ? updater(n) : n;
        }),
      })));
    };

    const ws = createLoraWebSocket((evt) => {
      try {
        const msg: LoraWsEvent = JSON.parse(evt.data);
        const d = msg.data as Record<string, unknown>;

        if (msg.type === 'telemetry') {
          applyNodeUpdate(d, (n) => {
            const current = d.current !== undefined ? Number(d.current) : (n.current ?? 0);
            const power = d.power !== undefined ? Number(d.power) : (n.power ?? 0);
            const isOnline = d.is_online !== undefined ? normalizeRelayState(d.is_online) : n.is_online;
            const relay1 = d.relay_1 !== undefined ? normalizeRelayState(d.relay_1) : n.relay_1;
            const relay2 = d.relay_2 !== undefined ? normalizeRelayState(d.relay_2) : n.relay_2;
            return {
              ...n,
              // An offline node can't have an energized relay either way.
              relay_1: relayIfOnline(correctRelayState(relay1, n.relay_1, current, power), isOnline),
              relay_2: relayIfOnline(correctRelayState(relay2, n.relay_2, current, power), isOnline),
              current, power,
              pwm_percent: d.pwm_percent !== undefined ? Number(d.pwm_percent) : n.pwm_percent,
              is_online: isOnline,
            };
          });
        } else if ((msg.type === 'ack' || msg.type === 'command_status')
          && (d.relay_1 !== undefined || d.relay_2 !== undefined)) {
          applyNodeUpdate(d, (n) => ({
            ...n,
            relay_1: relayIfOnline(correctRelayState(d.relay_1 !== undefined ? normalizeRelayState(d.relay_1) : n.relay_1, n.relay_1, n.current ?? 0, n.power ?? 0), n.is_online),
            relay_2: relayIfOnline(correctRelayState(d.relay_2 !== undefined ? normalizeRelayState(d.relay_2) : n.relay_2, n.relay_2, n.current ?? 0, n.power ?? 0), n.is_online),
          }));
        } else if (msg.type === 'node_online' || msg.type === 'node_offline') {
          applyNodeUpdate(d, (n) => ({
            ...n,
            is_online: msg.type === 'node_online',
            relay_1: msg.type === 'node_online' && n.relay_1,
            relay_2: msg.type === 'node_online' && n.relay_2,
          }));
        }
      } catch { /* ignore parse errors */ }
    });
    return () => { ws.close(); };
  }, []);

  /* When status filter changes, fly to first device in that group */
  useEffect(() => {
    if (statusFilter === 'ALL') return;
    const match = devices.find((d) =>
      (statusFilter === 'ON'      && d.status === 'ON') ||
      (statusFilter === 'OFF'     && d.status === 'OFF') ||
      (statusFilter === 'FAULT'   && d.status === 'FAULT') ||
      (statusFilter === 'OFFLINE' && !d.is_online)
    );
    if (match?.latitude && match?.longitude) {
      const next: [number, number] = [match.latitude, match.longitude];
      // toggle ref to force re-trigger even if same coords
      flyToRef.current = next;
      setFlyTo([...next]);
    }
  }, [statusFilter, devices]);

  const handleAreaSearch = async () => {
    if (!areaSearch.trim()) return;
    setAreaLoading(true);
    const coords = await geocodeArea(areaSearch);
    setAreaLoading(false);
    if (coords) {
      flyToRef.current = coords;
      setFlyTo([...coords]);
    }
  };

  const filteredDevices = useMemo(() => {
    if (productFilter === 'LORA') return [];
    let list = devices;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((d) => d.device_id.toLowerCase().includes(s));
    }
    if (statusFilter === 'ON')      list = list.filter((d) => d.status === 'ON');
    if (statusFilter === 'OFF')     list = list.filter((d) => d.status === 'OFF');
    if (statusFilter === 'FAULT')   list = list.filter((d) => d.status === 'FAULT');
    if (statusFilter === 'OFFLINE') list = list.filter((d) => !d.is_online);
    return list;
  }, [devices, search, statusFilter, productFilter]);

  const filteredGateways = useMemo(() => {
    if (productFilter === 'ORBI') return [];
    let list = loraGateways;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((g) =>
        (g.name || '').toLowerCase().includes(s) ||
        g.gateway_imei.toLowerCase().includes(s),
      );
    }
    if (statusFilter === 'OFFLINE') list = list.filter((g) => !g.is_online);
    return list;
  }, [loraGateways, search, statusFilter, productFilter]);

  const loraNodeCount = useMemo(
    () => filteredGateways.reduce((sum, g) => sum + g.node_count, 0),
    [filteredGateways],
  );

  const validOrbi = filteredDevices.filter((d) => d.latitude && d.longitude);
  const validGw = filteredGateways.filter((g) => g.latitude != null && g.longitude != null);
  const allValid = [
    ...validOrbi.map((d) => ({ lat: d.latitude!, lng: d.longitude! })),
    ...validGw.map((g) => ({ lat: g.latitude, lng: g.longitude })),
  ];
  const center: [number, number] = allValid.length
    ? [allValid[0].lat, allValid[0].lng]
    : [10.9, 78.1];

  const counts = useMemo(() => ({
    total:   filteredDevices.length + filteredGateways.length,
    on:      filteredDevices.filter((d) => d.status === 'ON').length,
    off:     filteredDevices.filter((d) => d.status === 'OFF').length,
    fault:   filteredDevices.filter((d) => d.status === 'FAULT').length,
    offline: filteredDevices.filter((d) => !d.is_online).length + filteredGateways.filter((g) => !g.is_online).length,
    orbi: filteredDevices.length,
    lora: filteredGateways.length,
    loraNodes: loraNodeCount,
  }), [filteredDevices, filteredGateways, loraNodeCount]);

  const handleOn  = async (id: string) => { try { await turnOn(id);  load(); } catch { alert('MQTT not connected'); } };
  const handleOff = async (id: string) => { try { await turnOff(id); load(); } catch { alert('MQTT not connected'); } };

  // The backend's single /on //off endpoint only actually drives raw relay 1,
  // so LOAD ON/OFF is composed from two explicit relay commands to make both
  // physical relays switch together — and updates optimistically instead of
  // forcing an immediate reload, which used to race a stale REST read against
  // the device's much slower LoRa round trip.
  const handleLoraOn = async (nodePk: number) => {
    applyLoraNodeById(nodePk, (n) => ({ ...n, relay_1: true, relay_2: true }));
    await Promise.all([loraRelay(nodePk, 1, 1), loraRelay(nodePk, 2, 1)]);
  };
  const handleLoraOff = async (nodePk: number) => {
    applyLoraNodeById(nodePk, (n) => ({ ...n, relay_1: false, relay_2: false }));
    await Promise.all([loraRelay(nodePk, 1, 0), loraRelay(nodePk, 2, 0)]);
  };
  const handleLoraPwm = async (nodePk: number, value: number) => {
    applyLoraNodeById(nodePk, (n) => ({ ...n, pwm_percent: value }));
    await loraPwm(nodePk, value);
  };
  const handleLoraRelay = async (nodePk: number, relay: 1 | 2, state: 0 | 1) => {
    applyLoraNodeById(nodePk, (n) => (relay === 1 ? { ...n, relay_1: !!state } : { ...n, relay_2: !!state }));
    await loraRelay(nodePk, relay, state);
  };

  return (
    <AppLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: C.dark }}>GIS Map</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {counts.orbi} Orbi · {counts.lora} LoRa gateways ({counts.loraNodes} nodes) — click a gateway to scatter nodes
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <DataExport
              data={{ devices: filteredDevices, timestamp: new Date().toISOString() }}
              filename="map-devices"
            />
            <Tooltip title="Refresh">
              <IconButton onClick={load} sx={{ bgcolor: alpha(C.teal, 0.12), color: C.teal, '&:hover': { bgcolor: alpha(C.teal, 0.2) } }}>
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3, borderRadius: 2.5, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Grid container spacing={1.5} alignItems="center">

              {/* Device ID search */}
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth size="small" placeholder="Search device ID…"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <FilterList sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>

              {/* Area / location search */}
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth size="small" placeholder="Search area / city…"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAreaSearch()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MyLocation sx={{ fontSize: 18, color: C.teal }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleAreaSearch} disabled={areaLoading} sx={{ p: 0.5 }}>
                          {areaLoading ? <CircularProgress size={14} /> : <Search sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Product filter */}
              <Grid item xs={12} sm={6} md={3}>
                <ToggleButtonGroup
                  value={productFilter} exclusive
                  onChange={(_, v) => v && setProductFilter(v)}
                  size="small"
                  sx={{ '& .MuiToggleButton-root': { px: 1.5, textTransform: 'none', fontSize: 13 } }}
                >
                  <ToggleButton value="ALL">All</ToggleButton>
                  {/* <ToggleButton value="ORBI">Orbi CCMS</ToggleButton> */}
                  <ToggleButton value="LORA" sx={{ color: '#8b5cf6' }}>Orbi CCMS</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {/* Status filter — clicking flies map to first matching device */}
              <Grid item xs={12} sm={6} md={4}>
                <ToggleButtonGroup
                  value={statusFilter} exclusive
                  onChange={(_, v) => v && setStatusFilter(v)}
                  size="small"
                  sx={{ '& .MuiToggleButton-root': { px: 1.5, textTransform: 'none', fontSize: 13 } }}
                >
                  <ToggleButton value="ALL">All ({counts.total})</ToggleButton>
                  <ToggleButton value="ON" sx={{ color: C.green }}><Lightbulb sx={{ fontSize: 16, mr: 0.5 }} />{counts.on}</ToggleButton>
                  <ToggleButton value="OFF">OFF {counts.off}</ToggleButton>
                  <ToggleButton value="FAULT" sx={{ color: C.red }}><Warning sx={{ fontSize: 16, mr: 0.5 }} />{counts.fault}</ToggleButton>
                  <ToggleButton value="OFFLINE" sx={{ color: C.orange }}><WifiOff sx={{ fontSize: 16, mr: 0.5 }} />{counts.offline}</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              <Grid item xs={12} md={2}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Chip sx={{ bgcolor: C.green,  color: '#fff' }} label="ON"      size="small" />
                  <Chip sx={{ bgcolor: C.grey,   color: '#fff' }} label="OFF"     size="small" />
                  <Chip sx={{ bgcolor: C.red,    color: '#fff' }} label="Fault"   size="small" />
                  <Chip sx={{ bgcolor: '#8b5cf6', color: '#fff' }} label="Orbi" size="small" />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Leaflet Map */}
        <Box sx={{ mb: 3 }}>
          <Card sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Box sx={{ height: 'calc(100vh - 340px)', minHeight: 450 }}>
              <LeafletMap
                devices={filteredDevices}
                loraGateways={filteredGateways}
                center={center}
                onOn={handleOn}
                onOff={handleOff}
                flyTo={flyTo}
                onLoraOn={handleLoraOn}
                onLoraOff={handleLoraOff}
                onLoraPwm={handleLoraPwm}
                onLoraRelay={handleLoraRelay}
              />
            </Box>
          </Card>
        </Box>

        {/* Grid View */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.dark }}>Device Locations Grid View</Typography>
            {/* Dimming + analytics summary bar */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {[10, 25, 50, 75, 100].map((pct) => (
                <Tooltip key={pct} title={`${pct}% brightness`}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.2, py: 0.4, borderRadius: 1.5,
                    bgcolor: alpha(C.teal, pct / 100 * 0.25 + 0.05),
                    border: `1px solid ${alpha(C.teal, pct / 100 * 0.4)}`,
                    cursor: 'default',
                  }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: `hsl(${190 - pct}, ${60 + pct / 2}%, ${40 + pct / 4}%)`,
                      boxShadow: `0 0 ${pct / 12}px hsl(${190 - pct}, 80%, 60%)`,
                    }} />
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem', color: C.teal }}>{pct}%</Typography>
                  </Box>
                </Tooltip>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>Dimming levels</Typography>
            </Box>
          </Box>
          <MapInteractive
            devices={filteredDevices.map((d) => ({
              device_id: d.device_id,
              location: { lat: d.latitude || 0, lng: d.longitude || 0 },
              status: d.status as 'ON' | 'OFF' | 'FAULT',
              is_online: d.is_online,
              model: d.model ?? undefined,
              firmware_version: d.firmware_version ?? undefined,
              last_seen: d.last_seen ?? undefined,
            }))}
            onDeviceSelect={(device) => console.log('Selected:', device)}
            mapHeight={400}
          />
        </Box>

        {/* Stats row */}
        <Grid container spacing={2} sx={{ mt: 2.5 }}>
          {[
            { label: 'Total Visible', val: counts.total, color: C.teal },
            { label: 'Orbi', val: counts.orbi, color: C.blue },
            { label: 'LoRa GW', val: counts.lora, color: '#8b5cf6' },
            { label: 'LoRa Nodes', val: counts.loraNodes, color: C.orange },
            { label: 'Fault', val: counts.fault, color: C.red },
          ].map((s) => (
            <Grid item xs key={s.label}>
              <Box sx={{
                textAlign: 'center', p: 2, borderRadius: 2,
                bgcolor: alpha(s.color, 0.08), border: `1.5px solid ${alpha(s.color, 0.2)}`,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: alpha(s.color, 0.12), borderColor: s.color },
              }}>
                <Typography variant="h6" fontWeight={800} color={s.color}>{s.val}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{s.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </AppLayout>
  );
}
