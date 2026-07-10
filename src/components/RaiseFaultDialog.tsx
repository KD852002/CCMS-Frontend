'use client';

import { useEffect, useState } from 'react';
import {
  Alert, alpha, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, Grid,
  InputLabel, MenuItem, Select, TextField, Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  NotificationsActive as NotifyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { fetchEmailRecipients } from '@/lib/api';

const C = { navy: '#1e293b', orange: '#f59e0b' };

export const FAULT_TYPES = [
  'LOW_VOLTAGE', 'HIGH_VOLTAGE', 'LOAD_FAILURE', 'PROTECTION_FAULT', 'OVER_CURRENT', 'COMMUNICATION_LOSS',
];
export const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];

interface Recipient {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

interface RaiseFaultDialogProps {
  open: boolean;
  entityLabel: string;
  onClose: () => void;
  onSubmit: (data: { fault_type: string; severity: string; description?: string }, notify: boolean) => Promise<void>;
}

export default function RaiseFaultDialog({ open, entityLabel, onClose, onSubmit }: RaiseFaultDialogProps) {
  const [faultType, setFaultType] = useState('LOAD_FAILURE');
  const [severity, setSeverity] = useState('WARNING');
  const [description, setDescription] = useState('');
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetchEmailRecipients()
        .then((data: unknown) => setRecipients(
          Array.isArray(data) ? data.filter((r: Recipient) => r.is_active) : [],
        ))
        .catch(() => {});
    }
  }, [open]);

  const handleClose = () => {
    setDescription('');
    setError('');
    setSelectedId('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(
        { fault_type: faultType, severity, description: description || undefined },
        notify,
      );
      setSuccess(true);
      setTimeout(handleClose, 1500);
    } catch {
      setError('Failed to raise fault.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.navy, display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha(C.orange, 0.06) }}>
        <WarningIcon sx={{ color: C.orange }} /> Raise Fault
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, mt: 0.3 }}>· {entityLabel}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {success && <Alert severity="success" icon={<CheckCircleIcon />}>Fault raised! {notify ? 'Notifications sent.' : ''}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {notify && (
          <Alert severity="info" icon={<NotifyIcon />} sx={{ borderRadius: 2, mt: 0.5 }}>
            <strong>Automated notifications</strong> — WhatsApp + Voice Call + Email will be sent to all recipients.
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Fault Type" value={faultType} onChange={(e) => setFaultType(e.target.value)} size="small">
              {FAULT_TYPES.map((ft) => <MenuItem key={ft} value={ft}>{ft.replace(/_/g, ' ')}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} size="small">
              {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} size="small" multiline rows={2} placeholder="Describe the fault…" />
          </Grid>
        </Grid>
        <Divider />
        <Box>
          <Typography variant="caption" fontWeight={600} color={C.navy} sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notification</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Notify Recipient (preview)</InputLabel>
            <Select value={selectedId} label="Notify Recipient (preview)" onChange={(e) => setSelectedId(e.target.value as number | '')}>
              <MenuItem value=""><em>All active recipients</em></MenuItem>
              {recipients.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name} — {r.phone || 'no phone'} — {r.email}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} size="small" />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <NotifyIcon sx={{ fontSize: 16, color: C.orange }} />
                <Typography variant="body2">Send Email, WhatsApp &amp; Voice Call to all recipients</Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || success}
          sx={{ bgcolor: C.orange, '&:hover': { bgcolor: '#BF360C' }, fontWeight: 700, borderRadius: 2 }}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <WarningIcon />}>
          {loading ? 'Raising…' : 'Raise Fault'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
