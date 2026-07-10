export interface Device {
  device_id: string;
  zone_id: number | null;
  model: string | null;
  firmware_version: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'ON' | 'OFF' | 'FAULT' | 'UNKNOWN';
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
  // Hardware status
  load_on: boolean;
  door: boolean;
  bypass: boolean;
  mcb: boolean;
  contactor: boolean;
  auto_mode: boolean;
  manual_ovrd: boolean;
  vphase_healthy: boolean;
  iphase_healthy: boolean;
}

export interface DeviceMapItem {
  device_id: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_online: boolean;
  model: string | null;
  firmware_version: string | null;
  last_seen: string | null;
}

export interface DeviceLive {
  device_id: string;
  status: string;
  is_online: boolean;
  model: string | null;
  firmware_version: string | null;
  voltage_r: number;
  voltage_y: number;
  voltage_b: number;
  current_r: number;
  current_y: number;
  current_b: number;
  power: number;
  power_factor: number;
  energy: number;
  frequency: number;
  rssi: number;
  imb_voltage_ry: number;
  imb_voltage_rb: number;
  imb_voltage_br: number;
  imb_current_ry: number;
  imb_current_yb: number;
  imb_current_br: number;
  curr_runtime: number;
  total_runtime: number;
  timer_slot: number;
  timer: number;
  last_event: string | null;
  load_on: boolean;
  door: boolean;
  bypass: boolean;
  mcb: boolean;
  contactor: boolean;
  auto_mode: boolean;
  manual_ovrd: boolean;
  vphase_healthy: boolean;
  iphase_healthy: boolean;
  last_seen: string | null;
}

export interface DashboardStats {
  total_devices: number;
  devices_on: number;
  devices_off: number;
  devices_fault: number;
  devices_online: number;
  devices_offline: number;
  total_power_kw: number;
  total_energy_kwh: number;
  lamp_failure_pct: number;
  system_uptime_pct: number;
  open_alerts: number;
  total_faults: number;
  energy_saving_pct: number;
}

export interface FaultLog {
  id: number;
  device_id: string;
  fault_type: string;
  description: string | null;
  severity: string;
  timestamp: string;
  resolved: boolean;
  resolved_at: string | null;
}

export interface Telemetry {
  id: number;
  device_id: string;
  timestamp: string;
  voltage_r: number;
  voltage_y: number;
  voltage_b: number;
  current_r: number;
  current_y: number;
  current_b: number;
  power: number;
  power_factor: number;
  energy: number;
  frequency: number;
  rssi: number;
  imb_voltage_ry: number;
  imb_voltage_rb: number;
  imb_voltage_br: number;
  imb_current_ry: number;
  imb_current_yb: number;
  imb_current_br: number;
  curr_runtime: number;
  total_runtime: number;
  timer_slot: number;
  timer: number;
  last_event: string | null;
}

export interface EmailRecipient {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  notify_faults: boolean;
  notify_reports: boolean;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

// ── LoRa ────────────────────────────────────────────────────────────

export interface LoraGateway {
  id: number;
  gateway_imei: string;
  name: string | null;
  status: string;
  is_online: boolean;
  last_seen: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  node_count: number;
}

export interface LoraGatewayMapNode {
  id: number;
  gateway_id: number;
  node_id: number;
  name: string | null;
  is_online: boolean;
  relay_1: boolean;
  relay_2: boolean;
  current?: number;
  power?: number;
  pwm_percent: number;
  latitude: number | null;
  longitude: number | null;
}

export interface LoraGatewayMapItem {
  id: number;
  gateway_imei: string;
  name: string | null;
  latitude: number;
  longitude: number;
  is_online: boolean;
  node_count: number;
  nodes: LoraGatewayMapNode[];
}

export interface LoraNode {
  id: number;
  gateway_id: number;
  gateway_imei?: string | null;
  node_id: number;
  name: string | null;
  is_online: boolean;
  last_seen: string | null;
  firmware_version: string | null;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  relay_1: boolean;
  relay_2: boolean;
  temperature: number;
  pwm_percent: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface LoraNodeMapItem {
  id: number;
  gateway_id?: number;
  node_id: number;
  name: string | null;
  gateway_imei?: string | null;
  latitude: number;
  longitude: number;
  is_online: boolean;
  relay_1: boolean;
  relay_2: boolean;
  pwm_percent?: number;
}

export interface LoraFault {
  id: number;
  lora_node_id: number;
  node_name: string | null;
  node_address: number | null;
  gateway_imei: string | null;
  fault_type: string;
  description: string | null;
  severity: string;
  timestamp: string;
  resolved: boolean;
  resolved_at: string | null;
}

export interface LoraTelemetry {
  id: number;
  node_id: number;
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  relay_1: boolean;
  relay_2: boolean;
  tilt_raw: number;
  volt_fault: boolean;
  curr_fault: boolean;
  temperature: number;
  pwm_percent: number;
}

export interface LoraCommand {
  id: number;
  gateway_id: number;
  node_id: number | null;
  cmd_id: string;
  command: string;
  payload: string;
  status: string;
  ack_payload: string | null;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
}

export interface LoraDashboardStats {
  total_gateways: number;
  online_gateways: number;
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  active_relays: number;
  todays_energy_kwh: number;
}

export interface LoraCommandResult {
  detail: string;
  cmd_id: string;
  status: string;
}

// WebSocket event shapes
export interface LoraWsEvent {
  type: 'telemetry' | 'ack' | 'command_sent' | 'command_status' | 'node_online' | 'node_offline';
  data: Record<string, unknown>;
}

export interface LoraScheduleSlot {
  slot: number;
  enabled: number;
  days_mask: number;
  start_h: number;
  start_m: number;
  stop_h: number;
  stop_m: number;
  relay_mask: number;
  pwm: number;
}

export interface LoraNodeSchedule {
  node_id: number;
  slots: LoraScheduleSlot[];
  updated_at?: string | null;
}

// ── Scheduling ──────────────────────────────────────────────────────
export interface ScheduleSlot {
  slot_index: number;
  enable: number; // firmware expects 0/1
  mode: number; // 0=RTC, 1=RunTimer, 2=Cyclic
  on_time: string; // HH:MM
  off_time: string; // HH:MM
  run_time: number; // minutes
  on_sec: number;
  off_sec: number;
  weekday: number; // bitmask 0..127
  // Allow server to return extra computed fields (cron metadata etc.)
  [key: string]: any;
}

export interface DeviceScheduleOut {
  device_id: string;
  slots: ScheduleSlot[];
  updated_at?: string | null;
}
