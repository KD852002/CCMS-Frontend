'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Box, Typography, Button, Chip } from '@mui/material';
import { Hub as HubIcon, Power, PowerOff } from '@mui/icons-material';
import type { DeviceMapItem, LoraGatewayMapItem, LoraGatewayMapNode } from '@/lib/types';
import { normalizeRelayState, nodeMapPosition } from '@/lib/loraUtils';
import LoraNodeMapPopup from '@/components/LoraNodeMapPopup';

function FlyController({ flyTo }: { flyTo?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 15, { duration: 1.2 });
  }, [flyTo, map]);
  return null;
}

const C = {
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f59e0b',
  blue: '#3b82f6',
  grey: '#9e9e9e',
  purple: '#8b5cf6',
  teal: '#0d7377',
};

function orbiMarkerColor(d: DeviceMapItem) {
  if (d.status === 'FAULT') return C.red;
  if (d.status === 'ON') return C.green;
  if (!d.is_online) return C.orange;
  return C.grey;
}

function loraNodeColor(n: LoraGatewayMapNode) {
  if (!n.is_online) return C.orange;
  if (normalizeRelayState(n.relay_1) || normalizeRelayState(n.relay_2)) return C.green;
  return C.purple;
}

function gatewayActiveRelays(gw: LoraGatewayMapItem) {
  return gw.nodes.reduce(
    (sum, n) => sum + (normalizeRelayState(n.relay_1) ? 1 : 0) + (normalizeRelayState(n.relay_2) ? 1 : 0),
    0,
  );
}

interface Props {
  devices: DeviceMapItem[];
  loraGateways?: LoraGatewayMapItem[];
  center: [number, number];
  onOn: (id: string) => void;
  onOff: (id: string) => void;
  flyTo?: [number, number];
  onLoraOn?: (nodePk: number) => Promise<void>;
  onLoraOff?: (nodePk: number) => Promise<void>;
  onLoraPwm?: (nodePk: number, value: number) => Promise<void>;
  onLoraRelay?: (nodePk: number, relay: 1 | 2, state: 0 | 1) => Promise<void>;
}

export default function LeafletMap({
  devices,
  loraGateways = [],
  center,
  onOn,
  onOff,
  flyTo,
  onLoraOn,
  onLoraOff,
  onLoraPwm,
  onLoraRelay,
}: Props) {
  const [expandedGatewayId, setExpandedGatewayId] = useState<number | null>(null);
  const [internalFlyTo, setInternalFlyTo] = useState<[number, number] | undefined>(flyTo);

  useEffect(() => {
    setInternalFlyTo(flyTo);
  }, [flyTo]);

  const validOrbi = devices.filter((d) => d.latitude && d.longitude);
  const validGateways = loraGateways.filter((g) => g.latitude != null && g.longitude != null);

  const expandedGateway = useMemo(
    () => validGateways.find((g) => g.id === expandedGatewayId) ?? null,
    [validGateways, expandedGatewayId],
  );

  const scatteredNodes = useMemo(() => {
    if (!expandedGateway) return [];
    const total = expandedGateway.nodes.length;
    return expandedGateway.nodes.map((node, index) => ({
      node,
      position: nodeMapPosition(node, expandedGateway.latitude, expandedGateway.longitude, index, total),
    }));
  }, [expandedGateway]);

  const handleGatewayClick = (gw: LoraGatewayMapItem) => {
    setExpandedGatewayId(gw.id);
    setInternalFlyTo([gw.latitude, gw.longitude]);
  };

  const noop = async () => {};

  return (
    <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
      <FlyController flyTo={internalFlyTo} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {validOrbi.map((d) => (
        <CircleMarker
          key={`orbi-${d.device_id}`}
          center={[d.latitude!, d.longitude!]}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: orbiMarkerColor(d), fillOpacity: 0.9 }}
        >
          <Popup minWidth={240}>
            <Box sx={{ minWidth: 230, fontFamily: 'inherit' }}>
              <Typography variant="subtitle2" fontWeight={800}>{d.device_id}</Typography>
              <Typography variant="caption" color="text.secondary">Orbi · {d.status}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.2 }}>
                <Button size="small" variant="contained" color="success" startIcon={<Power />} onClick={() => onOn(d.device_id)} sx={{ flex: 1, fontSize: 11 }}>ON</Button>
                <Button size="small" variant="outlined" color="error" startIcon={<PowerOff />} onClick={() => onOff(d.device_id)} sx={{ flex: 1, fontSize: 11 }}>OFF</Button>
              </Box>
            </Box>
          </Popup>
        </CircleMarker>
      ))}

      {validGateways.map((gw) => {
        const isExpanded = expandedGatewayId === gw.id;
        return (
          <CircleMarker
            key={`gw-${gw.id}`}
            center={[gw.latitude, gw.longitude]}
            radius={isExpanded ? 14 : 11}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor: gw.is_online ? C.teal : C.orange,
              fillOpacity: isExpanded ? 1 : 0.85,
            }}
            eventHandlers={{ click: () => handleGatewayClick(gw) }}
          >
            <Popup minWidth={260}>
              <Box sx={{ minWidth: 250, fontFamily: 'inherit' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <HubIcon sx={{ color: C.teal, fontSize: 20 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={800}>{gw.name || gw.gateway_imei}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{gw.gateway_imei}</Typography>
                  </Box>
                </Box>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                  {gw.latitude.toFixed(4)}, {gw.longitude.toFixed(4)}
                </Typography>
                <Chip size="small" label={`${gw.node_count} nodes`} sx={{ mr: 0.5, mb: 0.5, fontWeight: 600 }} />
                <Chip size="small" label={gw.is_online ? 'Online' : 'Offline'}
                  sx={{ mr: 0.5, mb: 0.5, bgcolor: gw.is_online ? '#dcfce7' : '#fee2e2', color: gw.is_online ? C.green : C.red, fontWeight: 600 }} />
                <Chip size="small" label={`${gatewayActiveRelays(gw)} active relays`}
                  sx={{ mb: 0.5, bgcolor: '#dbeafe', color: C.blue, fontWeight: 600 }} />
                <Button
                  fullWidth size="small" variant="contained" sx={{ mt: 1.5, bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' }, textTransform: 'none' }}
                  onClick={() => handleGatewayClick(gw)}
                >
                  {isExpanded ? `${gw.node_count} nodes shown on map` : 'Show nodes on map'}
                </Button>
                {isExpanded && (
                  <Button fullWidth size="small" variant="text" sx={{ mt: 0.5, textTransform: 'none', fontSize: 11 }}
                    onClick={() => setExpandedGatewayId(null)}>
                    Hide nodes
                  </Button>
                )}
              </Box>
            </Popup>
          </CircleMarker>
        );
      })}

      {scatteredNodes.map(({ node, position }) => (
        <CircleMarker
          key={`lora-node-${node.id}`}
          center={position}
          radius={7}
          pathOptions={{
            color: C.purple,
            weight: 2,
            fillColor: loraNodeColor(node),
            fillOpacity: 0.95,
          }}
        >
          <Popup minWidth={260} maxWidth={300}>
            <LoraNodeMapPopup
              node={node}
              onOn={onLoraOn ?? noop}
              onOff={onLoraOff ?? noop}
              onPwm={onLoraPwm ?? noop}
              onRelay={onLoraRelay ?? noop}
            />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
