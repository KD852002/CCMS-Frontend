'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Card, Typography, IconButton, Tooltip, Button,
} from '@mui/material';
import {
  Refresh, Router as RouterIcon, Memory as MemoryIcon,
  ElectricalServices, Map as MapIcon,
} from '@mui/icons-material';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import {
  fetchLoraDashboardStats, fetchLoraGatewayMap, loraPwm, loraRelay,
  createLoraWebSocket,
} from '@/lib/api';
import type { LoraDashboardStats, LoraGatewayMapItem, LoraGatewayMapNode, LoraWsEvent } from '@/lib/types';
import { normalizeRelayState, correctRelayState, relayIfOnline } from '@/lib/loraUtils';
import { PageHeader, StatGrid, LORA_COLORS as C } from '../shared';

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false });

export default function LoraDashboardPage() {
  const [stats, setStats] = useState<LoraDashboardStats | null>(null);
  const [gateways, setGateways] = useState<LoraGatewayMapItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, gws] = await Promise.all([
        fetchLoraDashboardStats(),
        fetchLoraGatewayMap(),
      ]);
      setStats(s);
      // An offline node can't have an energized relay regardless of whatever
      // stale value is cached from before it went offline.
      setGateways(gws.map((gw: LoraGatewayMapItem) => ({
        ...gw,
        nodes: gw.nodes.map((n: LoraGatewayMapNode) => ({
          ...n,
          relay_1: relayIfOnline(n.relay_1, n.is_online),
          relay_2: relayIfOnline(n.relay_2, n.is_online),
        })),
      })));
    } catch {
      /* silent */
    }
  }, []);

  // Websocket push can silently miss a node's offline transition (dropped
  // connection, or the backend simply not emitting node_offline), so poll
  // the REST endpoint as a fallback instead of relying on live events alone.
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  // Applies a local state patch to a node by primary key — used both for
  // optimistic updates on button click and for live websocket sync.
  const applyNodeById = useCallback((nodePk: number, updater: (n: LoraGatewayMapNode) => LoraGatewayMapNode) => {
    setGateways((prev) => prev.map((gw) => ({
      ...gw,
      nodes: gw.nodes.map((n) => (n.id === nodePk ? updater(n) : n)),
    })));
  }, []);

  // Live relay/online status sync — keeps the map + popups matching actual
  // device state without waiting for a manual refresh or a self-issued command.
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const applyNodeUpdate = (
      d: Record<string, unknown>,
      updater: (n: LoraGatewayMapNode) => LoraGatewayMapNode,
    ) => {
      setGateways((prev) => prev.map((gw) => ({
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
              // A relay we already believed was ON that flips to OFF while
              // real power is still flowing is wrong; don't promote a relay
              // we didn't already believe was on just from shared load. An
              // offline node can't have an energized relay either way.
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
    wsRef.current = ws;
    return () => { ws.close(); };
  }, []);

  // stats.active_relays is a one-time REST snapshot that never updates after
  // load — derive the live count from `gateways` instead, since that's kept
  // current by the websocket sync and by optimistic relay/load button clicks.
  const activeRelays = gateways.reduce(
    (acc, gw) => acc + gw.nodes.reduce((s, n) => s + (n.relay_1 ? 1 : 0) + (n.relay_2 ? 1 : 0), 0),
    0,
  );

  const center: [number, number] = gateways.length
    ? [gateways[0].latitude, gateways[0].longitude]
    : [18.4693, 73.7884];

  return (
    <AppLayout>
      <Box>
        <PageHeader
          title="LoRa Dashboard"
          subtitle="Click a gateway on the map to scatter and control nodes"
          actions={(
            <>
              <Button component={Link} href="/map" variant="outlined" startIcon={<MapIcon />} size="small">
                Full GIS Map
              </Button>
              <Tooltip title="Refresh">
                <IconButton onClick={load}><Refresh /></IconButton>
              </Tooltip>
            </>
          )}
        />

        <StatGrid
          minWidth={180}
          items={[
            { label: 'Gateways', value: stats?.total_gateways ?? '—', sub: `${stats?.online_gateways ?? 0} online`, icon: <RouterIcon />, color: C.teal },
            { label: 'Nodes Online', value: stats?.online_nodes ?? '—', sub: `${stats?.offline_nodes ?? 0} offline`, icon: <MemoryIcon />, color: C.green },
            { label: 'Active Relays', value: stats ? activeRelays : '—', icon: <ElectricalServices />, color: C.orange },
            { label: "Today's Energy", value: stats ? `${stats.todays_energy_kwh} kWh` : '—', icon: <ElectricalServices />, color: C.purple },
          ]}
        />

        <Card sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={700}>Gateway Map</Typography>
            <Typography variant="caption" color="text.secondary">{gateways.length} gateways</Typography>
          </Box>
          <Box sx={{ height: 400 }}>
            <LeafletMap
              devices={[]}
              loraGateways={gateways}
              center={center}
              onOn={() => {}}
              onOff={() => {}}
              onLoraOn={async (id) => {
                // The backend's single /on endpoint only actually drives raw
                // relay 1, so LOAD ON is composed from two explicit relay
                // commands to make both physical relays switch together.
                applyNodeById(id, (n) => ({ ...n, relay_1: true, relay_2: true }));
                await Promise.all([loraRelay(id, 1, 1), loraRelay(id, 2, 1)]);
              }}
              onLoraOff={async (id) => {
                applyNodeById(id, (n) => ({ ...n, relay_1: false, relay_2: false }));
                await Promise.all([loraRelay(id, 1, 0), loraRelay(id, 2, 0)]);
              }}
              onLoraPwm={async (id, v) => {
                applyNodeById(id, (n) => ({ ...n, pwm_percent: v }));
                await loraPwm(id, v);
              }}
              onLoraRelay={async (id, r, s) => {
                applyNodeById(id, (n) => (r === 1 ? { ...n, relay_1: !!s } : { ...n, relay_2: !!s }));
                await loraRelay(id, r, s);
              }}
            />
          </Box>
        </Card>
      </Box>
    </AppLayout>
  );
}
