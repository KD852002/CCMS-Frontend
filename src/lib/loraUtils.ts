/** Mirror backend _safe_bool for relay / boolean telemetry fields. */
export function normalizeRelayState(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

export function relayLabel(v: unknown): 'ON' | 'OFF' {
  return normalizeRelayState(v) ? 'ON' : 'OFF';
}

const IDLE_CURRENT_A = 0.05;
const IDLE_POWER_W = 5;

/**
 * A relay we believe is ON that suddenly gets reported OFF while the node is
 * still drawing real power can't be right — an open relay can't pass current
 * to the load — so that reading is discarded (this has been observed to
 * persist indefinitely, i.e. it's a bad backend reading, not lag).
 *
 * Deliberately does NOT promote an unrelated relay from off to on just
 * because *some* current is flowing: with only one shared current/power
 * sensor per node, that current may be fully explained by the other relay,
 * so an untouched relay's own "OFF" report is trusted as-is.
 */
export function correctRelayState(reported: boolean, wasOn: boolean, current: number, power: number): boolean {
  if (reported) return true;
  if (wasOn && (current > IDLE_CURRENT_A || power > IDLE_POWER_W)) return true;
  return false;
}

/**
 * An offline node can't have an actively energized relay — force relay
 * display to OFF whenever the node isn't reporting as online, regardless of
 * whatever value (real or optimistic) is cached from before it went offline.
 */
export function relayIfOnline(relay: boolean, isOnline: boolean): boolean {
  return isOnline && relay;
}

/**
 * UI relay labels are intentionally swapped relative to the backend/MQTT relay
 * numbering: "Relay 1" in the UI drives/reflects the backend's raw relay 2,
 * and "Relay 2" in the UI drives/reflects the backend's raw relay 1.
 * The backend/API/MQTT contract itself is untouched — only this mapping layer changed.
 */
export function swapRelay(relay: 1 | 2): 1 | 2 {
  return relay === 1 ? 2 : 1;
}

/** Reads the raw relay_1/relay_2 field that backs a given UI relay label. */
export function relayStateFor(
  node: { relay_1: boolean; relay_2: boolean },
  uiRelay: 1 | 2,
): boolean {
  return uiRelay === 1 ? node.relay_2 : node.relay_1;
}

/** Swaps a relay_mask bitfield (bit0=relay 1, bit1=relay 2) to match the UI relay swap. */
export function swapRelayMask(mask: number): number {
  return ((mask & 1) << 1) | ((mask & 2) >> 1);
}

/** Place node markers in a ring around a gateway when they have no fixed coordinates. */
export function scatterAroundGateway(
  gwLat: number,
  gwLng: number,
  index: number,
  total: number,
  radiusDeg = 0.004,
): [number, number] {
  if (total <= 1) return [gwLat + radiusDeg * 0.3, gwLng];
  const angle = (2 * Math.PI * index) / total;
  return [gwLat + radiusDeg * Math.cos(angle), gwLng + radiusDeg * Math.sin(angle)];
}

export function nodeMapPosition(
  node: { latitude?: number | null; longitude?: number | null },
  gwLat: number,
  gwLng: number,
  index: number,
  total: number,
): [number, number] {
  if (node.latitude != null && node.longitude != null) {
    return [node.latitude, node.longitude];
  }
  return scatterAroundGateway(gwLat, gwLng, index, total);
}
