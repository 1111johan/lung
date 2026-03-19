import type { GeoPoint, NearbyHospital } from './amap';

export interface NearbyHospitalsMapPayload {
  point: GeoPoint | null;
  hospitals: NearbyHospital[];
  source?: 'qa' | 'dashboard';
  updatedAt: string;
}

const STORAGE_KEY = 'tb_nearby_hospitals_payload_v1';

let memoryPayload: NearbyHospitalsMapPayload | null = null;

export function saveNearbyHospitalsPayload(payload: NearbyHospitalsMapPayload) {
  memoryPayload = payload;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Keep memory fallback only when storage is unavailable.
  }
}

export function loadNearbyHospitalsPayload(): NearbyHospitalsMapPayload | null {
  if (memoryPayload) return memoryPayload;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NearbyHospitalsMapPayload;
    if (!Array.isArray(parsed.hospitals)) return null;
    memoryPayload = parsed;
    return parsed;
  } catch {
    return null;
  }
}
