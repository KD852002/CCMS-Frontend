'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';

import AppLayout from '@/components/AppLayout';
import { fetchDevices, fetchDeviceSchedule, updateDeviceScheduleSlot } from '@/lib/api';
import type { Device, DeviceScheduleOut, ScheduleSlot } from '@/lib/types';

const MODE_LABELS: Record<number, string> = {
  0: 'RTC',
  1: 'RunTimer',
  2: 'Cyclic',
};

function makeDefaultSlot(slot_index: number): ScheduleSlot {
  return {
    slot_index,
    enable: 0,
    mode: 0,
    on_time: '06:00',
    off_time: '06:45',
    run_time: 0,
    on_sec: 0,
    off_sec: 0,
    weekday: 127, // every day
  };
}

function padSlots(incoming: ScheduleSlot[] | undefined | null): ScheduleSlot[] {
  const byIndex = new Map<number, ScheduleSlot>();
  (incoming || []).forEach((s) => byIndex.set(Number(s.slot_index), s));
  return Array.from({ length: 10 }, (_, i) => {
    const base = byIndex.get(i);
    return {
      ...makeDefaultSlot(i),
      ...(base || {}),
      slot_index: i,
      enable: typeof base?.enable === 'number' ? base.enable : makeDefaultSlot(i).enable,
      mode: typeof base?.mode === 'number' ? base.mode : makeDefaultSlot(i).mode,
      run_time: typeof base?.run_time === 'number' ? base.run_time : makeDefaultSlot(i).run_time,
      on_sec: typeof base?.on_sec === 'number' ? base.on_sec : makeDefaultSlot(i).on_sec,
      off_sec: typeof base?.off_sec === 'number' ? base.off_sec : makeDefaultSlot(i).off_sec,
      weekday: typeof base?.weekday === 'number' ? base.weekday : makeDefaultSlot(i).weekday,
      on_time: typeof base?.on_time === 'string' ? base.on_time : makeDefaultSlot(i).on_time,
      off_time: typeof base?.off_time === 'string' ? base.off_time : makeDefaultSlot(i).off_time,
    };
  });
}

export default function SchedulePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => padSlots([]));

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    setError(null);
    try {
      const data = await fetchDevices();
      setDevices(data);
      setDeviceId((prev) => prev || (data[0]?.device_id ?? ''));
    } catch {
      setError('Failed to load devices');
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!deviceId) return;
    setLoadingSchedule(true);
    setError(null);
    try {
      const res = (await fetchDeviceSchedule(deviceId)) as DeviceScheduleOut;
      setSlots(padSlots(res?.slots));
    } catch {
      setError('Failed to load schedule');
    } finally {
      setLoadingSchedule(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const onUpdateSlot = useCallback(
    async (slotIndex: number) => {
      if (!deviceId) return;
      const slot = slots.find((s) => s.slot_index === slotIndex);
      if (!slot) return;
      setSavingSlot(slotIndex);
      setError(null);
      try {
        // Backend expects { slot: { ...fields... , slot_index } }
        await updateDeviceScheduleSlot(deviceId, slot);
        await loadSchedule();
      } catch {
        setError(`Failed to save slot ${slotIndex}`);
      } finally {
        setSavingSlot(null);
      }
    },
    [deviceId, slots, loadSchedule],
  );

  const sortedSlots = useMemo(() => [...slots].sort((a, b) => a.slot_index - b.slot_index), [slots]);

  return (
    <AppLayout>
      <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', maxWidth: '1600px', mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" fontWeight={800} color="text.primary">
              Schedule Manager
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Configure all 10 scheduler slots.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {loadingSchedule ? (
              <CircularProgress size={22} />
            ) : (
              <Button variant="outlined" onClick={loadSchedule} disabled={!deviceId}>
                Refresh
              </Button>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loadingDevices ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Loading devices…
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Select value={deviceId} onChange={(e) => setDeviceId(String(e.target.value))} displayEmpty fullWidth>
                {devices.map((d) => (
                  <MenuItem key={d.device_id} value={d.device_id}>
                    {d.device_id} {d.model ? `• ${d.model}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Grid container spacing={2}>
              {sortedSlots.map((s) => (
                <Grid item xs={12} md={6} lg={4} key={s.slot_index}>
                  <Card sx={{ borderRadius: 3, border: '1px solid #e5e7eb' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                          Slot {s.slot_index}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={savingSlot === s.slot_index}
                          onClick={() => onUpdateSlot(s.slot_index)}
                        >
                          {savingSlot === s.slot_index ? 'Saving…' : 'Save'}
                        </Button>
                      </Box>

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={s.enable === 1}
                            onChange={(e) =>
                              setSlots((prev) =>
                                prev.map((x) => (x.slot_index === s.slot_index ? { ...x, enable: e.target.checked ? 1 : 0 } : x)),
                              )
                            }
                          />
                        }
                        label="Enabled"
                        sx={{ mb: 1 }}
                      />

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mb: 1.2 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Mode
                          </Typography>
                          <Select
                            size="small"
                            fullWidth
                            value={s.mode}
                            onChange={(e) =>
                              setSlots((prev) =>
                                prev.map((x) => (x.slot_index === s.slot_index ? { ...x, mode: Number(e.target.value) } : x)),
                              )
                            }
                          >
                            <MenuItem value={0}>0 - RTC</MenuItem>
                            <MenuItem value={1}>1 - RunTimer</MenuItem>
                            <MenuItem value={2}>2 - Cyclic</MenuItem>
                          </Select>
                        </Box>

                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Weekday Mask
                          </Typography>
                          <TextField
                            size="small"
                            type="number"
                            value={s.weekday}
                            onChange={(e) =>
                              setSlots((prev) =>
                                prev.map((x) => (x.slot_index === s.slot_index ? { ...x, weekday: Number(e.target.value) } : x)),
                              )
                            }
                            fullWidth
                          />
                        </Box>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mb: 1.2 }}>
                        <TextField
                          size="small"
                          type="time"
                          label="On time"
                          value={s.on_time}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.slot_index === s.slot_index ? { ...x, on_time: e.target.value } : x)),
                            )
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          size="small"
                          type="time"
                          label="Off time"
                          value={s.off_time}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.slot_index === s.slot_index ? { ...x, off_time: e.target.value } : x)),
                            )
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.2, mb: 0.5 }}>
                        <TextField
                          size="small"
                          type="number"
                          label="run_time (min)"
                          value={s.run_time}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.slot_index === s.slot_index ? { ...x, run_time: Number(e.target.value) } : x)),
                            )
                          }
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="on_sec"
                          value={s.on_sec}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.slot_index === s.slot_index ? { ...x, on_sec: Number(e.target.value) } : x)),
                            )
                          }
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="off_sec"
                          value={s.off_sec}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.slot_index === s.slot_index ? { ...x, off_sec: Number(e.target.value) } : x)),
                            )
                          }
                        />
                      </Box>

                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.8 }}>
                        Mode: {MODE_LABELS[s.mode] ?? 'Unknown'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Box>
    </AppLayout>
  );
}

