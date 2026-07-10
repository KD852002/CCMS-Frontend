'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  Typography,
  Tooltip,
  alpha,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Divider,
} from '@mui/material';
import { Lightbulb, BarChart as BarChartIcon } from '@mui/icons-material';
import { MapPin, Wifi, WifiOff, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { LiveDataDialog } from '@/components/LiveDataDialog';

/* ── Dimming constants ──────────────────────────────────────── */
const MAX_POWER  = 300;
const DIM_STEPS  = 10;
const DIM_LEVELS = Array.from({ length: DIM_STEPS }, (_, i) =>
  Math.round((MAX_POWER * (i + 1)) / DIM_STEPS)
);

interface Device {
  device_id: string;
  location: { lat: number; lng: number };
  status: 'ON' | 'OFF' | 'FAULT';
  is_online: boolean;
  model?: string;
  firmware_version?: string;
  last_seen?: string | null;
}

interface MapInteractiveProps {
  devices: Device[];
  mapHeight?: number;
  onDeviceSelect?: (device: Device) => void;
}

export const MapInteractive: React.FC<MapInteractiveProps> = ({
  devices = [],
  mapHeight = 500,
  onDeviceSelect,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  // Dimming state: per-device index into DIM_LEVELS
  const [dimMap, setDimMap] = useState<Record<string, number>>({});
  // Full live data dialog
  const [showLiveDialog, setShowLiveDialog] = useState(false);

  const bounds = useMemo(() => {
    if (!devices.length) return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
    const lats = devices.map(d => d.location.lat);
    const lngs = devices.map(d => d.location.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [devices]);

  const getStatusColor = (device: Device) => {
    if (!device.is_online) return '#9ca3af';
    if (device.status === 'FAULT') return '#ef4444';
    if (device.status === 'ON') return '#10b981';
    return '#6b7280';
  };

  const getStatusIcon = (device: Device) => {
    if (!device.is_online) return WifiOff;
    if (device.status === 'FAULT') return AlertCircle;
    if (device.status === 'ON') return CheckCircle;
    return XCircle;
  };

  const getMarkerPosition = (device: Device) => {
    const { minLat, maxLat, minLng, maxLng } = bounds;
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    const x = ((device.location.lng - minLng) / lngRange) * 100;
    const y = ((maxLat - device.location.lat) / latRange) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
  };

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device);
    setShowLiveDialog(false);
    onDeviceSelect?.(device);
  };

  return (
    <Box>
      <Card sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative',
        height: mapHeight,
        backgroundColor: '#f0f9ff',
      }}>
        {/* Grid Background */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(226, 232, 240, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226, 232, 240, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }} />

        {/* Map Title */}
        <Box sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          backgroundColor: alpha('#ffffff', 0.9),
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          borderRadius: 1.5,
          border: '1px solid #e5e7eb',
        }}>
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', color: '#1f6c7e' }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />
            {devices.length} Devices
          </Typography>
        </Box>

        {/* Device Markers */}
        {devices.map(device => {
          const { x, y } = getMarkerPosition(device);
          const color = getStatusColor(device);
          const StatusIcon = getStatusIcon(device);
          const isHovered = hoveredDevice === device.device_id;
          const isSelected = selectedDevice?.device_id === device.device_id;

          return (
            <Tooltip
              key={device.device_id}
              title={`${device.device_id} - ${device.status}${!device.is_online ? ' (Offline)' : ''}`}
              placement="top"
            >
              <Box
                onClick={() => handleDeviceClick(device)}
                onMouseEnter={() => setHoveredDevice(device.device_id)}
                onMouseLeave={() => setHoveredDevice(null)}
                sx={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 30 : isHovered ? 20 : 10,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* Outer Ring */}
                <Box sx={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: '50%',
                  border: `2px solid ${alpha(color, isHovered || isSelected ? 1 : 0.4)}`,
                  transition: 'all 0.3s',
                }} />

                {/* Marker Circle */}
                <Box sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isHovered || isSelected ? `0 0 0 8px ${alpha(color, 0.2)}` : 'none',
                  transition: 'all 0.3s',
                  transform: isHovered || isSelected ? 'scale(1.2)' : 'scale(1)',
                }}>
                  <StatusIcon size={14} color="white" strokeWidth={2.5} />
                </Box>

                {/* Hover Info Card */}
                {isHovered && (
                  <Box sx={{
                    position: 'absolute',
                    top: -110,
                    left: -80,
                    backgroundColor: alpha('#ffffff', 0.95),
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${color}`,
                    borderRadius: 1.5,
                    p: 1.5,
                    width: 160,
                    zIndex: 50,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      {device.device_id}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', fontSize: '0.7rem', mt: 0.5 }}>
                      Status: {device.status}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', fontSize: '0.7rem' }}>
                      {device.is_online ? 'Online' : 'Offline'}
                    </Typography>
                    {device.model && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', fontSize: '0.7rem', mt: 0.5 }}>
                        {device.model}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Tooltip>
          );
        })}

        {/* Empty State */}
        {!devices.length && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Typography color="text.secondary">No devices to display</Typography>
          </Box>
        )}
      </Card>

      {/* Device Details Dialog */}
      <Dialog
        open={!!selectedDevice}
        onClose={() => { setSelectedDevice(null); setShowLiveDialog(false); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {selectedDevice && (() => {
          const color  = getStatusColor(selectedDevice);
          const dimIdx = dimMap[selectedDevice.device_id] ?? (DIM_STEPS - 1);
          const dimPct = Math.round(((dimIdx + 1) / DIM_STEPS) * 100);
          const currentW = DIM_LEVELS[dimIdx];
          const isOn = selectedDevice.status === 'ON' && selectedDevice.is_online;
          const bulbColor = isOn
            ? dimPct >= 80 ? '#fef08a' : dimPct >= 50 ? '#fde68a' : '#fcd34d'
            : '#e5e7eb';

          return (
            <>
              <DialogTitle sx={{
                fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 1.5,
                bgcolor: alpha(color, 0.06),
                borderBottom: `1px solid ${alpha(color, 0.15)}`,
                pb: 1.5,
              }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                  bgcolor: alpha(bulbColor, isOn ? 0.3 : 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isOn ? `0 0 12px ${alpha(bulbColor, 0.6)}` : 'none',
                  transition: 'all 0.4s',
                }}>
                  <Lightbulb sx={{ fontSize: 20, color: isOn ? bulbColor : '#9ca3af' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                    {selectedDevice.device_id}
                  </Typography>
                  {selectedDevice.model && (
                    <Typography variant="caption" color="text.secondary">{selectedDevice.model}</Typography>
                  )}
                </Box>
                <Chip
                  label={selectedDevice.is_online ? selectedDevice.status : 'OFFLINE'}
                  size="small"
                  sx={{ bgcolor: alpha(color, 0.15), color, fontWeight: 700, fontSize: '0.7rem' }}
                />
              </DialogTitle>

              <DialogContent sx={{ pt: 2.5, pb: 1 }}>
                {/* Basic info */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Connection</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color: selectedDevice.is_online ? '#10b981' : '#ef4444' }}>
                      {selectedDevice.is_online ? 'Online' : 'Offline'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Location</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedDevice.location.lat.toFixed(4)}, {selectedDevice.location.lng.toFixed(4)}
                    </Typography>
                  </Box>
                  {selectedDevice.firmware_version && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Firmware</Typography>
                      <Typography variant="caption">{selectedDevice.firmware_version}</Typography>
                    </Box>
                  )}
                  {selectedDevice.last_seen && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Last Seen</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(selectedDevice.last_seen).toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Dimming Control */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, color: '#1f6c7e' }}>
                      Dimming Control
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: isOn ? `hsl(${190 - dimPct}, ${60 + dimPct / 2}%, ${40 + dimPct / 4}%)` : '#9ca3af',
                        boxShadow: isOn ? `0 0 ${dimPct / 12}px hsl(${190 - dimPct}, 80%, 60%)` : 'none',
                      }} />
                      <Typography variant="caption" fontWeight={700} sx={{ color: isOn ? '#1f6c7e' : '#9ca3af', minWidth: 70 }}>
                        {currentW}W · {dimPct}%
                      </Typography>
                    </Box>
                  </Box>
                  <Slider
                    size="small"
                    value={dimIdx}
                    min={0}
                    max={DIM_STEPS - 1}
                    step={1}
                    disabled={!isOn}
                    marks={DIM_LEVELS.map((val, i) => ({
                      value: i,
                      label: i === 0 || i === DIM_STEPS - 1 ? `${val}W` : '',
                    }))}
                    onChange={(_, val) =>
                      setDimMap((prev) => ({ ...prev, [selectedDevice.device_id]: val as number }))
                    }
                    sx={{
                      color: isOn ? '#1f6c7e' : '#9ca3af',
                      '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: '#9ca3af' },
                      '& .MuiSlider-thumb': {
                        width: 14, height: 14,
                        boxShadow: isOn ? '0 0 0 4px rgba(31,108,126,0.16)' : 'none',
                      },
                      '& .MuiSlider-track': {
                        background: isOn
                          ? `linear-gradient(to right, #1f6c7e, ${dimPct >= 80 ? '#f59e0b' : '#1f6c7e'})`
                          : '#9ca3af',
                      },
                      mb: 1,
                    }}
                  />
                  {/* Brightness bar */}
                  <Box sx={{
                    height: 6, borderRadius: 3, overflow: 'hidden',
                    background: `linear-gradient(to right,
                      hsl(190,60%,30%) 0%,
                      hsl(160,70%,45%) 50%,
                      hsl(45,95%,60%) 100%)`,
                    opacity: isOn ? 1 : 0.2,
                    transition: 'opacity 0.4s',
                    position: 'relative',
                  }}>
                    <Box sx={{
                      position: 'absolute', top: 0, right: 0, bottom: 0,
                      width: `${100 - dimPct}%`,
                      bgcolor: alpha('#ffffff', 0.6),
                      transition: 'width 0.3s ease',
                    }} />
                  </Box>
                </Box>


              </DialogContent>

              <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<BarChartIcon sx={{ fontSize: 15 }} />}
                  onClick={() => setShowLiveDialog(true)}
                  sx={{
                    borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
                    borderColor: '#1f6c7e', color: '#1f6c7e', '&:hover': { bgcolor: alpha('#1f6c7e', 0.08) },
                  }}
                >
                  Live Data
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  onClick={() => { setSelectedDevice(null); setShowLiveDialog(false); }}
                  sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
                >
                  Close
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
      {/* Full live telemetry dialog */}
      {selectedDevice && (
        <LiveDataDialog
          open={showLiveDialog}
          device={selectedDevice}
          onClose={() => setShowLiveDialog(false)}
        />
      )}
    </Box>
  );
};
