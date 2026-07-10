import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ccms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('ccms_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────

export async function login(username: string, password: string) {
  const res = await api.post('/api/auth/login', { username, password });
  const { access_token, role, username: user } = res.data;
  localStorage.setItem('ccms_token', access_token);
  localStorage.setItem('ccms_role', role);
  localStorage.setItem('ccms_user', user);
  return res.data;
}

export function logout() {
  localStorage.removeItem('ccms_token');
  localStorage.removeItem('ccms_role');
  localStorage.removeItem('ccms_user');
  window.location.href = '/login';
}

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('ccms_token') : null;
}

export function isAuthenticated() {
  return !!getToken();
}

// ── Devices ──────────────────────────────────────────────────────────────

export const fetchDevices = (params?: Record<string, string>) =>
  api.get('/api/devices/', { params }).then((r) => r.data);

export const fetchDeviceMap = () =>
  api.get('/api/devices/map').then((r) => r.data);

export const fetchDevice = (id: string) =>
  api.get(`/api/devices/${id}`).then((r) => r.data);

export const fetchDeviceLive = (id: string) =>
  api.get(`/api/devices/${id}/live`).then((r) => r.data);

export const fetchDeviceHistory = (id: string, params?: Record<string, string>) =>
  api.get(`/api/devices/${id}/history`, { params }).then((r) => r.data);

export const createDevice = (data: any) =>
  api.post('/api/devices/', data).then((r) => r.data);

export const updateDevice = (id: string, data: any) =>
  api.put(`/api/devices/${id}`, data).then((r) => r.data);

export const deleteDevice = (id: string) =>
  api.delete(`/api/devices/${id}`).then((r) => r.data);

// ── Control ──────────────────────────────────────────────────────────────

export const turnOn = (id: string) =>
  api.post(`/api/devices/${id}/on`).then((r) => r.data);

export const turnOff = (id: string) =>
  api.post(`/api/devices/${id}/off`).then((r) => r.data);

export const sendCommand = (id: string, cmd: string) =>
  api.post(`/api/devices/${id}/command`, { command: cmd }).then((r) => r.data);

// ── Schedule ─────────────────────────────────────────────────────────
export const fetchDeviceSchedule = (id: string) =>
  api.get(`/api/devices/${id}/schedule`).then((r) => r.data);

export const updateDeviceScheduleSlot = (id: string, slot: any) =>
  api.put(`/api/devices/${id}/schedule/${slot.slot_index}`, { slot }).then((r) => r.data);

// ── Dashboard ────────────────────────────────────────────────────────────

export const fetchDashboardStats = () =>
  api.get('/api/dashboard/stats').then((r) => r.data);

export const fetchPowerTrend = (hours = 24) =>
  api.get('/api/dashboard/analytics/power-trend', { params: { hours } }).then((r) => r.data);

export const fetchFaultBreakdown = (days = 30) =>
  api.get('/api/dashboard/analytics/fault-breakdown', { params: { days } }).then((r) => r.data);

export const fetchVoltageCurrent = (hours = 24) =>
  api.get('/api/dashboard/analytics/voltage-current', { params: { hours } }).then((r) => r.data);

export const fetchDevicePower = () =>
  api.get('/api/dashboard/analytics/device-power').then((r) => r.data);

// ── Faults ───────────────────────────────────────────────────────────────

export const fetchFaults = (params?: Record<string, string>) =>
  api.get('/api/faults/', { params }).then((r) => r.data);

export const resolveFault = (id: number) =>
  api.put(`/api/faults/${id}/resolve`).then((r) => r.data);

export const createFault = (data: { device_id: string; fault_type: string; severity: string; description?: string }, notify = false) =>
  api.post(`/api/faults/?notify=${notify}`, data).then((r) => r.data);

// ── Email Recipients ─────────────────────────────────────────────────────

export const fetchEmailRecipients = () =>
  api.get('/api/emails/').then((r) => r.data);

export const addEmailRecipient = (data: any) =>
  api.post('/api/emails/', data).then((r) => r.data);

export const updateEmailRecipient = (id: number, data: any) =>
  api.put(`/api/emails/${id}`, data).then((r) => r.data);

export const deleteEmailRecipient = (id: number) =>
  api.delete(`/api/emails/${id}`).then((r) => r.data);

export const testEmailRecipient = (id: number) =>
  api.post(`/api/emails/${id}/test`).then((r) => r.data);

export const testWhatsappRecipient = (id: number) =>
  api.post(`/api/emails/${id}/test-whatsapp`).then((r) => r.data);

export const testCallRecipient = (id: number) =>
  api.post(`/api/emails/${id}/test-call`).then((r) => r.data);

export const testNotification = () =>
  api.post('/api/emails/test-all').then((r) => r.data);

// ── LoRa Gateways ────────────────────────────────────────────────────────

export const fetchLoraGateways = () =>
  api.get('/api/lora/gateways').then((r) => r.data);

export const fetchLoraGateway = (id: number) =>
  api.get(`/api/lora/gateways/${id}`).then((r) => r.data);

export const updateLoraGateway = (id: number, data: {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
}) => api.put(`/api/lora/gateways/${id}`, data).then((r) => r.data);

export const fetchLoraGatewayMap = () =>
  api.get('/api/lora/gateways/map').then((r) => r.data);

export const createLoraGateway = (data: { gateway_imei: string; name?: string }) =>
  api.post('/api/lora/gateways', data).then((r) => r.data);

export const fetchGatewayNodes = (gatewayId: number) =>
  api.get(`/api/lora/gateways/${gatewayId}/nodes`).then((r) => r.data);

export const fetchGatewayCommands = (gatewayId: number, limit = 50) =>
  api.get(`/api/lora/gateways/${gatewayId}/commands`, { params: { limit } }).then((r) => r.data);

export const broadcastLoraCommand = (gatewayId: number, payload: Record<string, unknown>) =>
  api.post(`/api/lora/gateways/${gatewayId}/broadcast`, { payload }).then((r) => r.data);

// ── LoRa Nodes ───────────────────────────────────────────────────────────

export const fetchLoraNodes = (params?: { gateway_id?: number; is_online?: boolean }) =>
  api.get('/api/lora/nodes', { params }).then((r) => r.data);

export const fetchLoraNode = (id: number) =>
  api.get(`/api/lora/nodes/${id}`).then((r) => r.data);

export const updateLoraNode = (id: number, data: {
  name?: string;
  firmware_version?: string;
  latitude?: number | null;
  longitude?: number | null;
}) =>
  api.put(`/api/lora/nodes/${id}`, data).then((r) => r.data);

export const fetchLoraNodeMap = () =>
  api.get('/api/lora/nodes/map').then((r) => r.data);

export const fetchLoraNodeTelemetry = (
  id: number,
  params?: { start?: string; end?: string; limit?: number },
) => api.get(`/api/lora/nodes/${id}/telemetry`, { params }).then((r) => r.data);

// ── LoRa Node Commands ───────────────────────────────────────────────────

export const loraRelay = (id: number, relay: 1 | 2, state: 0 | 1) =>
  api.post(`/api/lora/nodes/${id}/relay`, { relay, state }).then((r) => r.data);

export const loraPwm = (id: number, value: number) =>
  api.post(`/api/lora/nodes/${id}/pwm`, { value }).then((r) => r.data);

export const loraDimming = (id: number, value: number) =>
  api.post(`/api/lora/nodes/${id}/dimming`, { value }).then((r) => r.data);

export const loraOn = (id: number) =>
  api.post(`/api/lora/nodes/${id}/on`).then((r) => r.data);

export const loraOff = (id: number) =>
  api.post(`/api/lora/nodes/${id}/off`).then((r) => r.data);

export const loraSchedule = (id: number, data: Record<string, unknown>) =>
  api.post(`/api/lora/nodes/${id}/schedule`, data).then((r) => r.data);

export const fetchLoraNodeSchedule = (id: number) =>
  api.get(`/api/lora/nodes/${id}/schedule`).then((r) => r.data);

export const fetchLoraNodeCommands = (id: number, limit = 50) =>
  api.get(`/api/lora/nodes/${id}/commands`, { params: { limit } }).then((r) => r.data);

export const gatewaySetMfm = (gatewayId: number, data?: { index?: number; mfm_id?: number; mfm_type?: number }) =>
  api.post(`/api/lora/gateways/${gatewayId}/set_mfm`, data ?? {}).then((r) => r.data);

export const loraConfig = (id: number, param: number, value: number, cmd = 'config') =>
  api.post(`/api/lora/nodes/${id}/config`, { param, value, cmd }).then((r) => r.data);

export const loraPing = (id: number) =>
  api.post(`/api/lora/nodes/${id}/ping`).then((r) => r.data);

export const loraReset = (id: number) =>
  api.post(`/api/lora/nodes/${id}/reset`).then((r) => r.data);

export const loraTimeSync = (id: number, epoch?: number) =>
  api.post(`/api/lora/nodes/${id}/timesync`, { epoch }).then((r) => r.data);

export const loraRequestTelemetry = (id: number) =>
  api.post(`/api/lora/nodes/${id}/telemetry_request`).then((r) => r.data);

// ── LoRa Dashboard Stats ─────────────────────────────────────────────────

export const fetchLoraDashboardStats = () =>
  api.get('/api/dashboard/lora-stats').then((r) => r.data);

// ── LoRa Faults ──────────────────────────────────────────────────────────

export const fetchLoraFaults = (params?: {
  lora_node_id?: number;
  fault_type?: string;
  resolved?: boolean;
}) => api.get('/api/lora/faults', { params }).then((r) => r.data);

export const createLoraFault = (
  data: { lora_node_id: number; fault_type: string; severity: string; description?: string },
  notify = false,
) => api.post('/api/lora/faults', data, { params: { notify } }).then((r) => r.data);

export const resolveLoraFault = (id: number) =>
  api.put(`/api/lora/faults/${id}/resolve`).then((r) => r.data);

// ── LoRa WebSocket helper ────────────────────────────────────────────────

export function createLoraWebSocket(onMessage: (event: MessageEvent) => void): WebSocket {
  const wsBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
    .replace(/^https?/, 'ws');
  const token = typeof window !== 'undefined' ? localStorage.getItem('ccms_token') : null;
  const url = `${wsBase}/api/lora/ws${token ? `?token=${token}` : ''}`;
  const ws = new WebSocket(url);
  ws.onmessage = onMessage;
  return ws;
}

// ── Admin Users ──────────────────────────────────────────────────────────

export const fetchUsers = () =>
  api.get('/api/auth/users').then((r) => r.data);

export const updateUser = (id: number, params: Record<string, string | boolean>) =>
  api.put(`/api/auth/users/${id}`, null, { params }).then((r) => r.data);

export const deleteUser = (id: number) =>
  api.delete(`/api/auth/users/${id}`).then((r) => r.data);
