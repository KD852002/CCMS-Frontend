'use client';

import { useState } from 'react';
import { Box, Typography, Button, Slider, CircularProgress } from '@mui/material';
import { Power, PowerOff } from '@mui/icons-material';
import type { LoraGatewayMapNode } from '@/lib/types';
import { swapRelay, relayStateFor } from '@/lib/loraUtils';

const C = { green: '#22c55e', red: '#ef4444', purple: '#8b5cf6', teal: '#0d7377' };

interface Props {
  node: LoraGatewayMapNode;
  onOn: (nodePk: number) => Promise<void>;
  onOff: (nodePk: number) => Promise<void>;
  onPwm: (nodePk: number, value: number) => Promise<void>;
  onRelay: (nodePk: number, relay: 1 | 2, state: 0 | 1) => Promise<void>;
}

export default function LoraNodeMapPopup({ node, onOn, onOff, onPwm, onRelay }: Props) {
  const [pwm, setPwm] = useState(node.pwm_percent ?? 0);
  const [busy, setBusy] = useState('');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      alert('Command failed — check MQTT connection');
    } finally {
      setBusy('');
    }
  };

  const r1 = relayStateFor(node, 1);
  const r2 = relayStateFor(node, 2);

  return (
    <Box sx={{ minWidth: 240, fontFamily: 'inherit' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pb: 1, borderBottom: '1px solid #e5e7eb' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.85rem' }}>
          {node.name || `Node #${node.node_id}`}
        </Typography>
        <Typography variant="caption" sx={{ ml: 'auto', color: node.is_online ? C.green : C.red, fontWeight: 700 }}>
          {node.is_online ? 'Online' : 'Offline'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        <Typography variant="caption" sx={{ bgcolor: r1 ? '#dcfce7' : '#fee2e2', color: r1 ? C.green : C.red, px: 1, borderRadius: 1, fontWeight: 700 }}>
          R1 {r1 ? 'ON' : 'OFF'}
        </Typography>
        <Typography variant="caption" sx={{ bgcolor: r2 ? '#dcfce7' : '#fee2e2', color: r2 ? C.green : C.red, px: 1, borderRadius: 1, fontWeight: 700 }}>
          R2 {r2 ? 'ON' : 'OFF'}
        </Typography>
        <Typography variant="caption" sx={{ bgcolor: '#f3e8ff', color: C.purple, px: 1, borderRadius: 1, fontWeight: 700 }}>
          PWM {node.pwm_percent}%
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button size="small" variant="contained" color="success" startIcon={busy === 'on' ? <CircularProgress size={12} color="inherit" /> : <Power />}
          disabled={!!busy} onClick={() => run('on', () => onOn(node.id))}
          sx={{ flex: 1, textTransform: 'none', fontSize: 11, py: 0.5, minHeight: 0 }}>
          LOAD ON
        </Button>
        <Button size="small" variant="outlined" color="error" startIcon={busy === 'off' ? <CircularProgress size={12} color="inherit" /> : <PowerOff />}
          disabled={!!busy} onClick={() => run('off', () => onOff(node.id))}
          sx={{ flex: 1, textTransform: 'none', fontSize: 11, py: 0.5, minHeight: 0 }}>
          LOAD OFF
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        <Button size="small" variant="outlined" disabled={!!busy}
          onClick={() => run('r1', () => onRelay(node.id, swapRelay(1), r1 ? 0 : 1))}
          sx={{ flex: 1, textTransform: 'none', fontSize: 10, py: 0.3, minHeight: 0 }}>
          R1 {r1 ? 'OFF' : 'ON'}
        </Button>
        <Button size="small" variant="outlined" disabled={!!busy}
          onClick={() => run('r2', () => onRelay(node.id, swapRelay(2), r2 ? 0 : 1))}
          sx={{ flex: 1, textTransform: 'none', fontSize: 10, py: 0.3, minHeight: 0 }}>
          R2 {r2 ? 'OFF' : 'ON'}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={600}>Dimming</Typography>
      <Slider size="small" value={pwm} onChange={(_, v) => setPwm(v as number)} min={0} max={100} sx={{ color: C.teal, my: 0.5 }} />
      <Button size="small" variant="contained" fullWidth disabled={!!busy}
        onClick={() => run('pwm', () => onPwm(node.id, pwm))}
        sx={{ bgcolor: C.teal, '&:hover': { bgcolor: '#0a5f63' }, textTransform: 'none', fontSize: 11, py: 0.5, minHeight: 0 }}>
        {busy === 'pwm' ? <CircularProgress size={14} color="inherit" /> : `Apply PWM ${pwm}%`}
      </Button>
    </Box>
  );
}
