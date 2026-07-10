'use client';

import { Box, Card, CardContent, Typography, Chip, alpha } from '@mui/material';
import { Circle as CircleIcon } from '@mui/icons-material';

/** Shared palette for the LoRa CCMS pages — keeps colors consistent without forcing every page onto one exact object shape. */
export const LORA_COLORS = {
  teal: '#0d7377',
  green: '#10b981',
  red: '#ef4444',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  grey: '#6b7280',
};

export function StatusChip({ online }: { online: boolean }) {
  return (
    <Chip
      size="small"
      icon={<CircleIcon sx={{ fontSize: '10px !important' }} />}
      label={online ? 'Online' : 'Offline'}
      sx={{
        bgcolor: online ? '#dcfce7' : '#fee2e2',
        color: online ? '#15803d' : '#dc2626',
        fontWeight: 600,
        fontSize: 11,
        '& .MuiChip-icon': { color: online ? '#15803d' : '#dc2626' },
      }}
    />
  );
}

/** Title + subtitle on the left, action buttons on the right — wraps onto its own row instead of overflowing on narrow screens. */
export function PageHeader({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
      alignItems: 'center', gap: 1.5, mb: 3,
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        {subtitle && (typeof subtitle === 'string'
          ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          : subtitle)}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}

export interface StatItem {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  icon?: React.ReactNode;
}

/** Responsive auto-fit grid of stat cards — collapses to fewer columns (down to 1) as the viewport narrows. */
export function StatGrid({ items, minWidth = 150 }: { items: StatItem[]; minWidth?: number }) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
      gap: 2, mb: 3,
    }}>
      {items.map((it) => (
        <Card key={it.label} sx={{ height: '100%', borderRadius: 2.5, border: '1px solid #e5e7eb' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {it.label}
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: it.color }}>{it.value}</Typography>
                {it.sub && <Typography variant="caption" color="text.secondary">{it.sub}</Typography>}
              </Box>
              {it.icon && (
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: alpha(it.color, 0.12), color: it.color,
                }}>
                  {it.icon}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
