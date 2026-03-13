import AMapLoader from '@amap/amap-jsapi-loader';

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface AmapPoiRaw {
  id?: string;
  name?: string;
  address?: string;
  location?: string;
  distance?: string;
  tel?: string;
  type?: string;
}

interface AmapAroundResponse {
  status?: string;
  info?: string;
  infocode?: string;
  pois?: AmapPoiRaw[];
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface AmapJsLngLatLike {
  lng?: number;
  lat?: number;
  getLng?: () => number;
  getLat?: () => number;
}

interface AmapJsPoiRaw {
  id?: string;
  name?: string;
  address?: string;
  location?: string | AmapJsLngLatLike;
  distance?: string | number;
  tel?: string;
  type?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
}

interface AmapJsPlaceSearchResult {
  poiList?: {
    pois?: AmapJsPoiRaw[];
  };
}

interface AmapJsPlaceSearchInstance {
  searchNearBy(
    keyword: string,
    center: [number, number],
    radius: number,
    callback: (status: string, result: AmapJsPlaceSearchResult) => void
  ): void;
}

interface AmapJsNamespace {
  PlaceSearch: new (options: { pageSize: number; pageIndex: number; extensions: 'base' }) => AmapJsPlaceSearchInstance;
}

type BrowserWindowWithAmapSecurity = Window & {
  _AMapSecurityConfig?: { securityJsCode: string };
};

export interface NearbyHospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeter: number;
  tel: string;
  type: string;
}

const HARDCODED_AMAP_WEB_KEY = 'd377beaff86ae953e4aeffdb0a9c63a9';
const HARDCODED_AMAP_JS_KEY = 'ded55c3e6af8b520b669f4bf64d1f7fe';
const HARDCODED_AMAP_SECURITY_JS_CODE = 'e2f8871b759cdc88f924a2d1bd0ae6aa';

const AMAP_WEB_KEY = (import.meta.env.VITE_AMAP_WEB_KEY?.trim() || HARDCODED_AMAP_WEB_KEY).trim();
const AMAP_JS_KEY = (import.meta.env.VITE_AMAP_JS_KEY?.trim() || HARDCODED_AMAP_JS_KEY).trim();
const AMAP_SECURITY_JS_CODE = (
  import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() || HARDCODED_AMAP_SECURITY_JS_CODE
).trim();
const AMAP_AROUND_API = 'https://restapi.amap.com/v3/place/around';
const OSM_OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export function getAmapRuntimeConfig() {
  return {
    webKey: AMAP_WEB_KEY,
    jsKey: AMAP_JS_KEY,
    securityJsCode: AMAP_SECURITY_JS_CODE,
  };
}

export function getAmapConfigStatus() {
  if (!AMAP_WEB_KEY && !AMAP_JS_KEY) {
    return {
      configured: false,
      reason: 'MISSING_AMAP_KEYS',
    } as const;
  }

  return {
    configured: true,
    reason: null,
  } as const;
}

export function getAmapMapConfigStatus() {
  if (!AMAP_JS_KEY) {
    return {
      configured: false,
      reason: 'MISSING_AMAP_JS_KEY',
    } as const;
  }

  return {
    configured: true,
    reason: null,
  } as const;
}

function parseLocation(location: string | undefined) {
  if (!location) return null;
  const [lngText, latText] = location.split(',');
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function resolveJsPoiLocation(location: string | AmapJsLngLatLike | undefined) {
  if (!location) return null;
  if (typeof location === 'string') {
    return parseLocation(location);
  }
  const rawLng = typeof location.getLng === 'function' ? location.getLng() : location.lng;
  const rawLat = typeof location.getLat === 'function' ? location.getLat() : location.lat;
  const lng = Number(rawLng);
  const lat = Number(rawLat);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function haversineDistanceMeter(from: GeoPoint, to: GeoPoint) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function extractAddressFromJsPoi(raw: AmapJsPoiRaw) {
  const direct = raw.address?.trim();
  if (direct) return direct;
  const composed = [raw.pname, raw.cityname, raw.adname, raw.address].filter(Boolean).join('');
  return composed || 'Unknown Address';
}

function mapPoi(raw: AmapPoiRaw): NearbyHospital | null {
  const point = parseLocation(raw.location);
  if (!point) return null;

  return {
    id: raw.id || `${raw.name || 'hospital'}-${point.lng}-${point.lat}`,
    name: raw.name || 'Unknown Hospital',
    address: raw.address || 'Unknown Address',
    lat: point.lat,
    lng: point.lng,
    distanceMeter: Number(raw.distance || 0) || 0,
    tel: raw.tel || '',
    type: raw.type || '',
  };
}

function mapJsPoi(raw: AmapJsPoiRaw, center: GeoPoint): NearbyHospital | null {
  const point = resolveJsPoiLocation(raw.location);
  if (!point) return null;
  const parsedDistance = Number(raw.distance);

  return {
    id: raw.id || `${raw.name || 'hospital'}-${point.lng}-${point.lat}`,
    name: raw.name || 'Unknown Hospital',
    address: extractAddressFromJsPoi(raw),
    lat: point.lat,
    lng: point.lng,
    distanceMeter: Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : haversineDistanceMeter(center, point),
    tel: raw.tel || '',
    type: raw.type || '',
  };
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(String(error || 'UNKNOWN_ERROR'));
}

function shouldFallbackToJsApi(error: Error) {
  const message = error.message.toUpperCase();
  if (message.includes('MISSING_AMAP_WEB_KEY')) return true;
  if (message.includes('FAILED TO FETCH')) return true;
  if (message.includes('TIMEOUT')) return true;
  if (message.includes('NETWORK')) return true;
  if (message.includes('UND_ERR_CONNECT_TIMEOUT')) return true;
  if (message.includes('AMAP_HTTP_')) {
    const code = Number(message.replace('AMAP_HTTP_', ''));
    if (!Number.isFinite(code)) return true;
    return code >= 500;
  }
  return false;
}

function shouldFallbackToRestApi(error: Error) {
  const message = error.message.toUpperCase();
  if (message.includes('MISSING_AMAP_JS_KEY')) return true;
  if (message.includes('AMAP_JS_')) return true;
  if (message.includes('FAILED TO FETCH')) return true;
  if (message.includes('TIMEOUT')) return true;
  if (message.includes('NETWORK')) return true;
  return false;
}

function shouldFallbackToOverpass(error: Error) {
  const message = error.message.toUpperCase();
  if (message.includes('10001') || message.includes('INVALID_USER_KEY')) return false;
  if (message.includes('MISSING_AMAP_WEB_KEY') || message.includes('MISSING_AMAP_JS_KEY') || message.includes('MISSING_AMAP_KEYS'))
    return false;
  if (message.includes('FAILED TO FETCH')) return true;
  if (message.includes('TIMEOUT')) return true;
  if (message.includes('NETWORK')) return true;
  if (message.includes('ERR_CONNECTION_CLOSED')) return true;
  if (message.includes('AMAP_HTTP_')) return true;
  if (message.includes('AMAP_JS_')) return true;
  return false;
}

function parseOverpassPoint(element: OverpassElement) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function buildOverpassAddress(tags: Record<string, string> | undefined) {
  if (!tags) return 'Unknown Address';
  const parts = [
    tags['addr:full'],
    tags['addr:province'],
    tags['addr:city'],
    tags['addr:district'],
    tags['addr:street'],
    tags['addr:housenumber'],
  ]
    .filter(Boolean)
    .map((item) => item.trim());
  if (parts.length > 0) return Array.from(new Set(parts)).join('');
  return tags['addr:full'] || tags['addr:street'] || tags['addr:city'] || tags['name:en'] || 'Unknown Address';
}

function mapOverpassHospital(element: OverpassElement, center: GeoPoint): NearbyHospital | null {
  const point = parseOverpassPoint(element);
  if (!point) return null;
  const tags = element.tags || {};
  const name = tags.name || tags['name:en'] || 'Hospital';
  const idPart = element.id ? String(element.id) : `${point.lng}-${point.lat}`;
  const typePart = element.type || 'node';
  const tel = tags.phone || tags['contact:phone'] || '';
  const type = tags.healthcare || tags.amenity || 'hospital';

  return {
    id: `osm-${typePart}-${idPart}`,
    name,
    address: buildOverpassAddress(tags),
    lat: point.lat,
    lng: point.lng,
    distanceMeter: haversineDistanceMeter(center, point),
    tel,
    type,
  };
}

async function fetchNearbyHospitalsByRest(
  point: GeoPoint,
  options?: { radiusMeter?: number; pageSize?: number }
): Promise<NearbyHospital[]> {
  if (!AMAP_WEB_KEY) {
    throw new Error('MISSING_AMAP_WEB_KEY');
  }

  const radiusMeter = Math.min(Math.max(options?.radiusMeter || 5000, 1000), 50000);
  const pageSize = Math.min(Math.max(options?.pageSize || 10, 1), 25);

  const params = new URLSearchParams({
    key: AMAP_WEB_KEY,
    location: `${point.lng},${point.lat}`,
    keywords: '医院',
    types: '090100',
    radius: `${radiusMeter}`,
    offset: `${pageSize}`,
    page: '1',
    extensions: 'base',
  });

  const resp = await fetch(`${AMAP_AROUND_API}?${params.toString()}`);
  if (!resp.ok) {
    throw new Error(`AMAP_HTTP_${resp.status}`);
  }

  const data = (await resp.json()) as AmapAroundResponse;
  if (data.status !== '1') {
    const infoCode = data.infocode || 'UNKNOWN';
    const info = data.info || 'AMAP_ERROR';
    throw new Error(`AMAP_${infoCode}:${info}`);
  }

  return (data.pois || [])
    .map(mapPoi)
    .filter((item): item is NearbyHospital => Boolean(item))
    .sort((a, b) => a.distanceMeter - b.distanceMeter);
}

async function fetchNearbyHospitalsByJsApi(
  point: GeoPoint,
  options?: { radiusMeter?: number; pageSize?: number }
): Promise<NearbyHospital[]> {
  if (!AMAP_JS_KEY) {
    throw new Error('MISSING_AMAP_JS_KEY');
  }
  if (typeof window === 'undefined') {
    throw new Error('AMAP_JS_BROWSER_ONLY');
  }

  if (AMAP_SECURITY_JS_CODE) {
    (window as BrowserWindowWithAmapSecurity)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_JS_CODE };
  }

  const pageSize = Math.min(Math.max(options?.pageSize || 10, 1), 25);
  const radiusMeter = Math.min(Math.max(options?.radiusMeter || 5000, 1000), 50000);

  const amapRaw = await AMapLoader.load({
    key: AMAP_JS_KEY,
    version: '2.0',
    plugins: ['AMap.PlaceSearch'],
  });

  const AMap = amapRaw as unknown as AmapJsNamespace;
  const placeSearch = new AMap.PlaceSearch({
    pageSize,
    pageIndex: 1,
    extensions: 'base',
  });

  return new Promise<NearbyHospital[]>((resolve, reject) => {
    placeSearch.searchNearBy('医院', [point.lng, point.lat], radiusMeter, (status, result) => {
      if (status !== 'complete') {
        reject(new Error(`AMAP_JS_${status || 'ERROR'}`));
        return;
      }
      const hospitals = (result.poiList?.pois || [])
        .map((item) => mapJsPoi(item, point))
        .filter((item): item is NearbyHospital => Boolean(item))
        .sort((a, b) => a.distanceMeter - b.distanceMeter);
      resolve(hospitals);
    });
  });
}

async function fetchNearbyHospitalsByOverpass(
  point: GeoPoint,
  options?: { radiusMeter?: number; pageSize?: number }
): Promise<NearbyHospital[]> {
  const radiusMeter = Math.min(Math.max(options?.radiusMeter || 5000, 1000), 50000);
  const pageSize = Math.min(Math.max(options?.pageSize || 10, 1), 25);

  const query = [
    '[out:json][timeout:15];',
    '(',
    `  node["amenity"="hospital"](around:${radiusMeter},${point.lat},${point.lng});`,
    `  way["amenity"="hospital"](around:${radiusMeter},${point.lat},${point.lng});`,
    `  relation["amenity"="hospital"](around:${radiusMeter},${point.lat},${point.lng});`,
    ');',
    'out center tags qt;',
  ].join('\n');

  const body = new URLSearchParams({ data: query });
  const resp = await fetch(OSM_OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
  });

  if (!resp.ok) {
    throw new Error(`OVERPASS_HTTP_${resp.status}`);
  }

  const data = (await resp.json()) as OverpassResponse;
  const hospitals = (data.elements || [])
    .map((item) => mapOverpassHospital(item, point))
    .filter((item): item is NearbyHospital => Boolean(item))
    .sort((a, b) => a.distanceMeter - b.distanceMeter);

  const uniqueByNameAndAddress = new Map<string, NearbyHospital>();
  hospitals.forEach((item) => {
    const dedupKey = `${item.name}::${item.address}`;
    if (!uniqueByNameAndAddress.has(dedupKey)) {
      uniqueByNameAndAddress.set(dedupKey, item);
    }
  });

  return Array.from(uniqueByNameAndAddress.values()).slice(0, pageSize);
}

export async function fetchNearbyHospitals(
  point: GeoPoint,
  options?: { radiusMeter?: number; pageSize?: number }
): Promise<NearbyHospital[]> {
  let amapError: Error | null = null;

  const fetchWithAmap = async () => {
    if (!AMAP_WEB_KEY && !AMAP_JS_KEY) {
      throw new Error('MISSING_AMAP_KEYS');
    }

    const canUseJsApi = Boolean(AMAP_JS_KEY) && typeof window !== 'undefined';
    const canUseRestApi = Boolean(AMAP_WEB_KEY);

    if (canUseJsApi) {
      let jsError: Error | null = null;
      try {
        return await fetchNearbyHospitalsByJsApi(point, options);
      } catch (error) {
        jsError = normalizeError(error);
        if (!canUseRestApi || !shouldFallbackToRestApi(jsError)) {
          throw jsError;
        }
      }

      try {
        return await fetchNearbyHospitalsByRest(point, options);
      } catch (restError) {
        const normalizedRestError = normalizeError(restError);
        throw jsError || normalizedRestError;
      }
    }

    let restError: Error | null = null;

    try {
      return await fetchNearbyHospitalsByRest(point, options);
    } catch (error) {
      const normalized = normalizeError(error);
      restError = normalized;
      if (!shouldFallbackToJsApi(normalized)) {
        throw normalized;
      }
    }

    try {
      return await fetchNearbyHospitalsByJsApi(point, options);
    } catch (jsError) {
      const normalizedJsError = normalizeError(jsError);
      throw restError || normalizedJsError;
    }
  };

  if (!AMAP_WEB_KEY && !AMAP_JS_KEY) {
    throw new Error('MISSING_AMAP_KEYS');
  }

  try {
    return await fetchWithAmap();
  } catch (error) {
    amapError = normalizeError(error);
  }

  if (!amapError || !shouldFallbackToOverpass(amapError)) {
    throw amapError || new Error('UNKNOWN_AMAP_ERROR');
  }

  try {
    return await fetchNearbyHospitalsByOverpass(point, options);
  } catch {
    throw amapError;
  }
}

export function buildAmapNavigationUrl(h: NearbyHospital) {
  const encodedName = encodeURIComponent(h.name);
  return `https://uri.amap.com/navigation?to=${h.lng},${h.lat},${encodedName}&mode=car&policy=1&src=tb-agent`;
}
