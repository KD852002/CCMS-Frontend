'use client';

import React from 'react';
import { Box, Card, CardContent, Grid, Typography, LinearProgress, alpha } from '@mui/material';
import { ElectricalServices } from '@mui/icons-material';
import { Zap, Activity, Gauge } from 'lucide-react';

interface MetricData {
  voltage_r: number;
  voltage_y: number;
  voltage_b: number;
  current_r: number;
  current_y: number;
  current_b: number;
  power: number;
  energy: number;
  power_factor: number;
  frequency: number;
}

interface RealTimeMetricsProps {
  data: MetricData | null;
  loading: boolean;
}

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({ data, loading }) => {
  if (!data) return null;

  const MetricCard = ({
    label,
    value,
    unit,
    icon: Icon,
    color,
    progress,
  }: {
    label: string;
    value: number | string;
    unit: string;
    icon: React.ComponentType<any>;
    color: string;
    progress?: number;
  }) => (
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{
        height: '100%',
        borderRadius: 2.5,
        border: `1.5px solid ${alpha(color, 0.3)}`,
        transition: 'all 0.3s',
        '&:hover': { boxShadow: `0 8px 24px ${alpha(color, 0.15)}`, borderColor: color },
      }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280' }}>
              {label}
            </Typography>
            <Icon size={18} color={color} />
          </Box>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="h5" fontWeight={800} sx={{ color }}>
              {typeof value === 'number' ? value.toFixed(2) : value}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>{unit}</Typography>
          </Box>
          {progress !== undefined && (
            <LinearProgress
              variant="determinate"
              value={Math.min(progress, 100)}
              sx={{
                height: 3,
                borderRadius: 2,
                backgroundColor: alpha(color, 0.12),
                '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 2 },
              }}
            />
          )}
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, fontSize: '1rem' }}>
        Real-Time Telemetry
      </Typography>
      <Grid container spacing={2}>
        <MetricCard label="Voltage (R Phase)" value={data.voltage_r} unit="V" icon={ElectricalServices} color="#1f6c7e" progress={(data.voltage_r / 250) * 100} />
        <MetricCard label="Voltage (Y Phase)" value={data.voltage_y} unit="V" icon={ElectricalServices} color="#06b6d4" progress={(data.voltage_y / 250) * 100} />
        <MetricCard label="Voltage (B Phase)" value={data.voltage_b} unit="V" icon={ElectricalServices} color="#3b82f6" progress={(data.voltage_b / 250) * 100} />
        <MetricCard label="Current (R Phase)" value={data.current_r} unit="A" icon={Zap} color="#f59e0b" progress={Math.min((data.current_r / 10) * 100, 100)} />
        <MetricCard label="Current (Y Phase)" value={data.current_y} unit="A" icon={Zap} color="#f97316" progress={Math.min((data.current_y / 10) * 100, 100)} />
        <MetricCard label="Current (B Phase)" value={data.current_b} unit="A" icon={Zap} color="#ef4444" progress={Math.min((data.current_b / 10) * 100, 100)} />
        <MetricCard label="Total Power" value={data.power} unit="kW" icon={Activity} color="#10b981" />
        <MetricCard label="Energy Consumed" value={data.energy} unit="kWh" icon={Gauge} color="#8b5cf6" />
        <MetricCard label="Power Factor" value={data.power_factor} unit="" icon={Activity} color="#14b8a6" progress={data.power_factor * 100} />
        <MetricCard label="Frequency" value={data.frequency} unit="Hz" icon={Gauge} color="#1f6c7e" progress={(data.frequency / 60) * 100} />
      </Grid>
    </Box>
  );
};
