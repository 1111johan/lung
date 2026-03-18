import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Crosshair, RefreshCw } from 'lucide-react';
import {
  buildAmapNavigationUrl,
  fetchNearbyHospitals,
  getAmapConfigStatus,
  getAmapRuntimeConfig,
  loadAmapSdk,
  type GeoPoint,
  type NearbyHospital,
} from '../lib/amap';
import { getCurrentPositionWithBrowserFallback } from '../lib/location';
import { loadNearbyHospitalsPayload, saveNearbyHospitalsPayload } from '../lib/nearbyHospitalsState';
import { useI18n } from '../lib/i18n';

interface AMapMapLike {
  addControl(control: unknown): void;
  setFitView(overlays?: unknown[]): void;
  setCenter(position: unknown): void;
  destroy(): void;
}

interface AMapMarkerLike {
  on(event: 'click', handler: () => void): void;
  setMap(map: AMapMapLike | null): void;
}

interface AMapInfoWindowLike {
  setContent(content: string): void;
  open(map: AMapMapLike, position: unknown): void;
}

interface AMapGeolocationResultLike {
  position?: unknown;
}

interface AMapGeolocationLike {
  getCurrentPosition(callback: (status: string, result: AMapGeolocationResultLike) => void): void;
}

interface AMapNamespaceLike {
  Map: new (container: HTMLDivElement, options: { zoom: number; center: [number, number]; resizeEnable: boolean }) => AMapMapLike;
  ToolBar: new () => unknown;
  Scale: new () => unknown;
  Geolocation: new (options: Record<string, unknown>) => AMapGeolocationLike;
  InfoWindow: new (options: { offset: unknown }) => AMapInfoWindowLike;
  Pixel: new (x: number, y: number) => unknown;
  LngLat: new (lng: number, lat: number) => unknown;
  Marker: new (options: { position: unknown; title?: string; label?: { direction: string; content: string } }) => AMapMarkerLike;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDistance(distanceMeter: number) {
  if (distanceMeter < 1000) return `${Math.round(distanceMeter)}m`;
  return `${(distanceMeter / 1000).toFixed(1)}km`;
}

function maskSensitiveUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const key = parsed.searchParams.get('key');
    if (key) parsed.searchParams.set('key', '***');
    const jscode = parsed.searchParams.get('jscode');
    if (jscode) parsed.searchParams.set('jscode', '***');
    return parsed.toString();
  } catch {
    return rawUrl
      .replace(/([?&]key=)[^&]+/gi, '$1***')
      .replace(/([?&]jscode=)[^&]+/gi, '$1***');
  }
}

function parsePointLike(raw: unknown): GeoPoint | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const [lngText, latText] = raw.split(',');
    const lng = Number(lngText);
    const lat = Number(latText);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lng, lat };
  }

  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lng, lat };
  }

  if (typeof raw === 'object') {
    const candidate = raw as {
      lng?: number;
      lat?: number;
      getLng?: () => number;
      getLat?: () => number;
      longitude?: number;
      latitude?: number;
    };

    const lng = Number(
      typeof candidate.getLng === 'function'
        ? candidate.getLng()
        : candidate.lng ?? candidate.longitude
    );
    const lat = Number(
      typeof candidate.getLat === 'function'
        ? candidate.getLat()
        : candidate.lat ?? candidate.latitude
    );
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lng, lat };
  }

  return null;
}

export function NearbyHospitalsMapPage({ onBack }: { onBack: () => void }) {
  const { locale } = useI18n();

  const initialPayload = useMemo(() => loadNearbyHospitalsPayload(), []);
  const initialCenterRef = useRef<[number, number]>(
    initialPayload?.point
      ? [initialPayload.point.lng, initialPayload.point.lat]
      : initialPayload?.hospitals[0]
        ? [initialPayload.hospitals[0].lng, initialPayload.hospitals[0].lat]
        : [108.320004, 22.82402]
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapMapLike | null>(null);
  const markersRef = useRef<AMapMarkerLike[]>([]);
  const infoWindowRef = useRef<AMapInfoWindowLike | null>(null);
  const amapRef = useRef<AMapNamespaceLike | null>(null);

  const [mapError, setMapError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [lastAmapResourceErrorUrl, setLastAmapResourceErrorUrl] = useState('');
  const [hospitals, setHospitals] = useState<NearbyHospital[]>(() => initialPayload?.hospitals || []);
  const [currentPoint, setCurrentPoint] = useState<GeoPoint | null>(() => initialPayload?.point || null);

  const text = useMemo(() => {
    if (locale === 'zh') {
      return {
        title: '智慧地图',
        subtitle: '自动定位并标记附近医院，点击点位可导航',
        missingJsKey: '缺少地图 Key：请配置 VITE_AMAP_JS_KEY（Web端 JS API Key）。',
        mapLoadFailed: '地图加载失败。请检查 JS Key、安全密钥（securityJsCode）和域名白名单。',
        missingSecurityCode: '未配置 securityJsCode。若底图空白，请在高德控制台为该 JS Key 配置安全密钥并更新前端。',
        invalidAmapKey: '高德 Key 无效，请检查 Key 与服务权限。',
        domainWhitelistMismatch: '域名白名单不匹配，请在高德控制台把当前站点域名加入 JS Key 白名单。',
        securityCodeValidationFailed: 'securityJsCode 校验失败，请检查 JS Key 与安全密钥是否同一应用。',
        mapTileDomainBlocked: '地图瓦片加载被域名白名单拦截，请在高德控制台配置当前域名。',
        mapSecurityCodeValidationFailed: '地图安全密钥校验失败，请核对 securityJsCode。',
        mapInvalidJsKey: '地图 JS Key 无效，请检查 Key 类型与权限。',
        networkBlocked: '高德服务网络请求被阻断（restapi.amap.com）。请关闭/分流 VPN 或代理后重试。',
        queryFailed: '附近医院查询失败，请检查网络/代理或稍后重试。',
        locateBtn: '定位并刷新',
        locating: '定位中',
        back: '返回',
        current: '当前位置',
        navigate: '打开导航',
        address: '地址',
        phone: '电话',
        noPhone: '暂无电话',
        noHospitals: '当前范围内未检索到可展示医院，请重试或扩大范围。',
        noGeolocation: '当前设备/浏览器不支持定位。',
        insecureContext: '当前页面不是安全上下文，请通过 HTTPS 或 localhost 访问。',
        denied: '定位权限被拒绝，请在浏览器中允许定位权限。',
        timeout: '定位超时，请重试。',
        unavailable: '无法获取定位，请检查系统定位服务。',
        resourceLoadFailed: '检测到高德资源加载失败，请检查这条请求：',
        resourceLoadGuide: '请把该请求在 Network 中的状态码和 infocode 发给我定位。',
      };
    }
    return {
      ...(locale === 'th'
        ? {
            title: 'แผนที่อัจฉริยะ',
            subtitle: 'ระบุตำแหน่งและปักหมุดโรงพยาบาลใกล้เคียง คลิกหมุดเพื่อนำทาง',
            missingJsKey: 'ไม่มีคีย์แผนที่: โปรดตั้งค่า VITE_AMAP_JS_KEY (Web JS API key)',
            mapLoadFailed: 'โหลดแผนที่ไม่สำเร็จ โปรดตรวจสอบ JS key, securityJsCode และโดเมนไวท์ลิสต์',
            missingSecurityCode: 'ไม่พบ securityJsCode หากแผนที่พื้นหลังว่าง โปรดตั้งค่า security code ของ JS key นี้',
            invalidAmapKey: 'Amap key ไม่ถูกต้อง โปรดตรวจสอบสิทธิ์การใช้งาน',
            domainWhitelistMismatch: 'โดเมนไม่ตรงไวท์ลิสต์ โปรดเพิ่มโดเมนปัจจุบันในไวท์ลิสต์ของ JS key',
            securityCodeValidationFailed: 'ตรวจสอบ securityJsCode ไม่ผ่าน โปรดตรวจสอบว่า JS key และ security code มาจากแอปเดียวกัน',
            mapTileDomainBlocked: 'การโหลด tile ของแผนที่ถูกบล็อกโดยโดเมนไวท์ลิสต์ โปรดกำหนดโดเมนให้ถูกต้อง',
            mapSecurityCodeValidationFailed: 'ตรวจสอบ securityJsCode ของแผนที่ไม่ผ่าน',
            mapInvalidJsKey: 'JS key ของแผนที่ไม่ถูกต้อง โปรดตรวจสอบประเภทและสิทธิ์ของ key',
            networkBlocked: 'คำขอเครือข่ายไปยังบริการ Amap ถูกบล็อก (restapi.amap.com) โปรดปิดหรือแยกเส้นทาง VPN/พร็อกซีแล้วลองใหม่',
            queryFailed: 'ค้นหาโรงพยาบาลใกล้เคียงไม่สำเร็จ โปรดตรวจสอบเครือข่าย/พร็อกซีแล้วลองใหม่',
            locateBtn: 'ระบุตำแหน่งและรีเฟรช',
            locating: 'กำลังระบุตำแหน่ง',
            back: 'กลับ',
            current: 'ตำแหน่งปัจจุบัน',
            navigate: 'นำทาง',
            address: 'ที่อยู่',
            phone: 'โทรศัพท์',
            noPhone: 'ไม่มีข้อมูล',
            noHospitals: 'ไม่พบโรงพยาบาลในระยะปัจจุบัน โปรดลองใหม่หรือขยายระยะค้นหา',
            noGeolocation: 'อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
            insecureContext: 'หน้านี้ไม่ใช่ secure context โปรดเข้าผ่าน HTTPS หรือ localhost',
            denied: 'ถูกปฏิเสธสิทธิ์ตำแหน่ง โปรดอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์',
            timeout: 'ระบุตำแหน่งหมดเวลา โปรดลองอีกครั้ง',
            unavailable: 'ไม่สามารถรับตำแหน่งได้ โปรดตรวจสอบบริการระบุตำแหน่งของอุปกรณ์',
            resourceLoadFailed: 'ตรวจพบการโหลดทรัพยากร Amap ล้มเหลว โปรดตรวจสอบคำขอนี้:',
            resourceLoadGuide: 'โปรดส่งสถานะและ infocode ของคำขอนี้ใน Network มาให้ฉันวิเคราะห์',
          }
        : locale === 'id'
          ? {
              title: 'Peta Cerdas',
              subtitle: 'Lokasi otomatis dan tandai rumah sakit terdekat, klik marker untuk navigasi',
              missingJsKey: 'Kunci peta tidak ada: konfigurasi VITE_AMAP_JS_KEY (Web JS API key)',
              mapLoadFailed: 'Gagal memuat peta. Periksa JS key, securityJsCode, dan whitelist domain',
              missingSecurityCode: 'securityJsCode belum diatur. Jika peta dasar kosong, atur security code untuk JS key ini',
              invalidAmapKey: 'Amap key tidak valid. Periksa key dan izin layanan',
              domainWhitelistMismatch: 'Whitelist domain tidak cocok. Tambahkan domain situs saat ini ke whitelist JS key',
              securityCodeValidationFailed: 'Validasi securityJsCode gagal. Pastikan JS key dan security code dari aplikasi yang sama',
              mapTileDomainBlocked: 'Tile peta diblokir whitelist domain. Konfigurasikan domain saat ini di konsol Amap',
              mapSecurityCodeValidationFailed: 'Validasi securityJsCode peta gagal',
              mapInvalidJsKey: 'JS key peta tidak valid. Periksa tipe key dan izinnya',
              networkBlocked: 'Permintaan jaringan ke layanan Amap terblokir (restapi.amap.com). Nonaktifkan/atur split-tunnel VPN atau proxy lalu coba lagi',
              queryFailed: 'Gagal mengambil rumah sakit terdekat. Periksa jaringan/proxy lalu coba lagi',
              locateBtn: 'Lokasi & Muat Ulang',
              locating: 'Melacak lokasi',
              back: 'Kembali',
              current: 'Lokasi saat ini',
              navigate: 'Navigasi',
              address: 'Alamat',
              phone: 'Telepon',
              noPhone: 'Tidak tersedia',
              noHospitals: 'Tidak ada rumah sakit pada rentang saat ini. Coba lagi atau perluas radius',
              noGeolocation: 'Geolokasi tidak tersedia pada perangkat/peramban ini',
              insecureContext: 'Halaman ini bukan secure context. Gunakan HTTPS atau localhost',
              denied: 'Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser',
              timeout: 'Waktu geolokasi habis. Silakan coba lagi',
              unavailable: 'Tidak dapat memperoleh lokasi. Periksa layanan lokasi perangkat',
              resourceLoadFailed: 'Terdeteksi kegagalan memuat resource Amap. Periksa request ini:',
              resourceLoadGuide: 'Kirim status dan infocode request ini di Network agar bisa saya diagnosa',
            }
          : locale === 'ms'
            ? {
                title: 'Peta Pintar',
                subtitle: 'Lokasi automatik dan tandakan hospital berdekatan, klik penanda untuk navigasi',
                missingJsKey: 'Kunci peta tiada: sila tetapkan VITE_AMAP_JS_KEY (Web JS API key)',
                mapLoadFailed: 'Gagal memuatkan peta. Semak JS key, securityJsCode dan senarai putih domain',
                missingSecurityCode: 'securityJsCode belum ditetapkan. Jika peta asas kosong, tetapkan security code untuk JS key ini',
                invalidAmapKey: 'Amap key tidak sah. Sila semak key dan kebenaran perkhidmatan',
                domainWhitelistMismatch: 'Senarai putih domain tidak sepadan. Tambahkan domain semasa ke whitelist JS key',
                securityCodeValidationFailed: 'Pengesahan securityJsCode gagal. Pastikan JS key dan security code daripada aplikasi yang sama',
                mapTileDomainBlocked: 'Tile peta disekat oleh whitelist domain. Konfigurasikan domain semasa di konsol Amap',
                mapSecurityCodeValidationFailed: 'Pengesahan securityJsCode peta gagal',
                mapInvalidJsKey: 'JS key peta tidak sah. Semak jenis key dan kebenaran',
                networkBlocked: 'Permintaan rangkaian ke perkhidmatan Amap disekat (restapi.amap.com). Matikan/asingkan laluan VPN atau proksi dan cuba lagi',
                queryFailed: 'Gagal mendapatkan hospital berdekatan. Semak rangkaian/proksi dan cuba lagi',
                locateBtn: 'Lokasi & Segar Semula',
                locating: 'Mengesan lokasi',
                back: 'Kembali',
                current: 'Lokasi semasa',
                navigate: 'Navigasi',
                address: 'Alamat',
                phone: 'Telefon',
                noPhone: 'Tiada',
                noHospitals: 'Tiada hospital ditemui dalam julat semasa. Cuba lagi atau luaskan radius',
                noGeolocation: 'Geolokasi tidak tersedia pada peranti/pelayar ini',
                insecureContext: 'Halaman ini bukan konteks selamat. Gunakan HTTPS atau localhost',
                denied: 'Kebenaran lokasi ditolak. Benarkan akses lokasi dalam tetapan pelayar',
                timeout: 'Masa geolokasi tamat. Sila cuba lagi',
                unavailable: 'Tidak dapat mendapatkan lokasi. Semak perkhidmatan lokasi peranti',
                resourceLoadFailed: 'Kegagalan memuat resource Amap dikesan. Semak permintaan ini:',
                resourceLoadGuide: 'Hantar status dan infocode permintaan ini dalam Network untuk saya diagnos',
              }
            : {
                title: 'Smart Map',
                subtitle: 'Locate and mark nearby hospitals. Click markers for navigation',
                missingJsKey: 'Missing map key: configure VITE_AMAP_JS_KEY (Web JS API key).',
                mapLoadFailed: 'Map load failed. Verify JS key, securityJsCode, and domain whitelist.',
                missingSecurityCode: 'securityJsCode is missing. If base map is blank, configure JS security code for this key.',
                invalidAmapKey: 'Invalid Amap key. Please verify key permissions.',
                domainWhitelistMismatch: 'Domain whitelist mismatch. Add current site domain to JS key whitelist.',
                securityCodeValidationFailed: 'securityJsCode validation failed. Ensure JS key and security code are from the same app.',
                mapTileDomainBlocked: 'Map tiles blocked by domain whitelist. Configure current domain in Amap console.',
                mapSecurityCodeValidationFailed: 'Map security code validation failed. Please verify securityJsCode.',
                mapInvalidJsKey: 'Invalid JS key for map.',
                networkBlocked: 'Network requests to Amap service are blocked (restapi.amap.com). Disable or split-route VPN/proxy and retry.',
                queryFailed: 'Failed to fetch nearby hospitals. Check network/proxy and retry.',
                locateBtn: 'Locate & Refresh',
                locating: 'Locating',
                back: 'Back',
                current: 'Current location',
                navigate: 'Navigate',
                address: 'Address',
                phone: 'Phone',
                noPhone: 'N/A',
                noHospitals: 'No hospitals found in current range. Retry or expand radius.',
                noGeolocation: 'Geolocation is not available in this browser/device.',
                insecureContext: 'This page is not in a secure context. Use HTTPS or localhost.',
                denied: 'Location permission denied. Please allow location in browser settings.',
                timeout: 'Location timed out. Please retry.',
                unavailable: 'Unable to obtain location. Please check device location service.',
                resourceLoadFailed: 'Detected Amap resource load failure. Check this request:',
                resourceLoadGuide: 'Send this request status and infocode from Network for diagnosis.',
              }),
    };
  }, [locale]);

  const inferQueryError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || '');
      if (message.includes('GEOLOCATION_INSECURE_CONTEXT')) return text.insecureContext;
      if (message.includes('GEOLOCATION_DENIED')) return text.denied;
      if (message.includes('GEOLOCATION_TIMEOUT')) return text.timeout;
      if (message.includes('GEOLOCATION_UNAVAILABLE') || message.includes('GEOLOCATION_UNKNOWN')) return text.unavailable;
      if (message.includes('MISSING_AMAP_WEB_KEY') || message.includes('MISSING_AMAP_JS_KEY') || message.includes('MISSING_AMAP_KEYS')) {
        return text.missingJsKey;
      }
      if (message.includes('10001') || message.includes('INVALID_USER_KEY')) {
        return text.invalidAmapKey;
      }
      if (
        message.includes('10006') ||
        message.includes('INVALID_USER_DOMAIN') ||
        message.includes('USERKEY_PLAT_NOMATCH')
      ) {
        return text.domainWhitelistMismatch;
      }
      if (
        message.includes('INVALID_USER_SCODE') ||
        message.includes('SECURITY') ||
        message.includes('JS_CODE') ||
        message.includes('JSCODE')
      ) {
        return text.securityCodeValidationFailed;
      }
      if (
        message.includes('ERR_CONNECTION_CLOSED') ||
        message.includes('FAILED TO FETCH') ||
        message.includes('NETWORK') ||
        message.includes('SCHANNEL')
      ) {
        return text.networkBlocked;
      }
      return text.queryFailed;
    },
    [text]
  );

  const inferMapLoadError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || '');
      if (message.includes('MISSING_AMAP_JS_KEY')) return text.missingJsKey;
      if (
        message.includes('10006') ||
        message.includes('INVALID_USER_DOMAIN') ||
        message.includes('USERKEY_PLAT_NOMATCH')
      ) {
        return text.mapTileDomainBlocked;
      }
      if (
        message.includes('INVALID_USER_SCODE') ||
        message.includes('SECURITY') ||
        message.includes('JS_CODE') ||
        message.includes('JSCODE')
      ) {
        return text.mapSecurityCodeValidationFailed;
      }
      if (message.includes('10001') || message.includes('INVALID_USER_KEY')) {
        return text.mapInvalidJsKey;
      }
      if (
        message.includes('ERR_CONNECTION_CLOSED') ||
        message.includes('FAILED TO FETCH') ||
        message.includes('NETWORK') ||
        message.includes('SCHANNEL')
      ) {
        return text.networkBlocked;
      }
      return `${text.mapLoadFailed}${message ? ` (${message})` : ''}`;
    },
    [text]
  );

  const locateWithAmapGeolocation = useCallback(async (): Promise<GeoPoint> => {
    const AMap = amapRef.current;
    if (!AMap || typeof AMap.Geolocation !== 'function') {
      throw new Error('AMAP_GEOLOCATION_UNAVAILABLE');
    }

    return new Promise<GeoPoint>((resolve, reject) => {
      try {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          noGeoLocation: 0,
          // Force device geolocation only. VPN-based IP locate can return wrong city.
          noIpLocate: 3,
          useNative: false,
        });

        geolocation.getCurrentPosition((status, result) => {
          if (status !== 'complete') {
            reject(new Error(`AMAP_GEOLOCATION_${status || 'ERROR'}`));
            return;
          }

          const parsed = parsePointLike(result?.position);
          if (!parsed) {
            reject(new Error('AMAP_GEOLOCATION_EMPTY'));
            return;
          }

          resolve(parsed);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error || 'AMAP_GEOLOCATION_ERROR')));
      }
    });
  }, []);

  const locateAndQueryHospitals = useCallback(async () => {
    const config = getAmapConfigStatus();
    if (!config.configured) {
      setQueryError(text.missingJsKey);
      setHospitals([]);
      return;
    }

    setQuerying(true);
    setQueryError('');
    try {
      let point: GeoPoint;
      try {
        point = await getCurrentPositionWithBrowserFallback();
      } catch (browserError) {
        try {
          point = await locateWithAmapGeolocation();
        } catch {
          throw browserError;
        }
      }

      setCurrentPoint(point);

      const data = await fetchNearbyHospitals(point, { radiusMeter: 8000, pageSize: 12 });
      setHospitals(data);
      saveNearbyHospitalsPayload({
        point,
        hospitals: data,
        source: 'dashboard',
        updatedAt: new Date().toISOString(),
      });
      if (data.length === 0) {
        setQueryError(text.noHospitals);
      }
    } catch (error) {
      setQueryError(inferQueryError(error));
    } finally {
      setQuerying(false);
    }
  }, [inferQueryError, locateWithAmapGeolocation, text.missingJsKey, text.noHospitals]);

  useEffect(() => {
    const runtimeConfig = getAmapRuntimeConfig();
    const jsKey = runtimeConfig.jsKey;
    const securityJsCode = runtimeConfig.securityJsCode;
    if (!jsKey) {
      setMapError(text.missingJsKey);
      setLoaded(false);
      return;
    }
    if (!mapContainerRef.current) return;

    let cancelled = false;
    setMapError('');
    setLoaded(false);

    if (!securityJsCode) {
      setQueryError((prev) => prev || text.missingSecurityCode);
    }

    loadAmapSdk(['AMap.ToolBar', 'AMap.Scale', 'AMap.Geolocation'])
      .then((amapRaw) => {
        if (cancelled || !mapContainerRef.current) return;
        const AMap = amapRaw as unknown as AMapNamespaceLike;
        amapRef.current = AMap;

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 12,
          center: initialCenterRef.current,
          resizeEnable: true,
        });

        map.addControl(new AMap.ToolBar());
        map.addControl(new AMap.Scale());

        mapRef.current = map;
        infoWindowRef.current = new AMap.InfoWindow({
          offset: new AMap.Pixel(0, -24),
        });
        setLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(inferMapLoadError(error));
          setLoaded(false);
        }
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      try {
        mapRef.current?.destroy();
      } catch {
        // no-op
      }
      mapRef.current = null;
      infoWindowRef.current = null;
      amapRef.current = null;
    };
  }, [inferMapLoadError, text.missingJsKey, text.missingSecurityCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResourceError = (event: Event) => {
      const target = event.target as (HTMLImageElement | HTMLScriptElement | HTMLLinkElement | null);
      if (!target) return;

      const candidateUrl =
        (target instanceof HTMLImageElement || target instanceof HTMLScriptElement ? target.src : '') ||
        (target instanceof HTMLLinkElement ? target.href : '');
      if (!candidateUrl) return;

      const lowerUrl = candidateUrl.toLowerCase();
      const isAmapResource = lowerUrl.includes('autonavi.com') || lowerUrl.includes('amap.com');
      if (!isAmapResource) return;

      const masked = maskSensitiveUrl(candidateUrl);
      setLastAmapResourceErrorUrl(masked);
      setQueryError((prev) => prev || text.networkBlocked);
    };

    window.addEventListener('error', handleResourceError, true);
    return () => window.removeEventListener('error', handleResourceError, true);
  }, [text.networkBlocked]);

  useEffect(() => {
    if (!loaded) return;
    if (hospitals.length > 0 || currentPoint) return;
    locateAndQueryHospitals();
  }, [currentPoint, hospitals.length, loaded, locateAndQueryHospitals]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!loaded || !map || !AMap) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const markerList: AMapMarkerLike[] = [];

    if (currentPoint) {
      const currentPosition = new AMap.LngLat(currentPoint.lng, currentPoint.lat);
      const currentMarker = new AMap.Marker({
        position: currentPosition,
        title: text.current,
        label: {
          direction: 'top',
          content: `<div style="padding:2px 6px;border-radius:999px;background:#0ea5e9;color:#fff;font-size:11px;">ME</div>`,
        },
      });
      currentMarker.setMap(map);
      markerList.push(currentMarker);
      map.setCenter(currentPosition);
    }

    hospitals.forEach((hospital, index) => {
      const position = new AMap.LngLat(hospital.lng, hospital.lat);
      const marker = new AMap.Marker({
        position,
        title: hospital.name,
        label: {
          direction: 'top',
          content: `<div style="padding:2px 6px;border-radius:999px;background:#1677ff;color:#fff;font-size:11px;">${index + 1}</div>`,
        },
      });

      marker.on('click', () => {
        const nav = buildAmapNavigationUrl(hospital);
        const html = `
          <div style="font-size:13px;line-height:1.5;max-width:260px;">
            <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(hospital.name)}</div>
            <div style="margin-bottom:4px;color:#4b5563;">${text.address}: ${escapeHtml(hospital.address || '')}</div>
            <div style="margin-bottom:4px;color:#4b5563;">${text.phone}: ${escapeHtml(hospital.tel || text.noPhone)}</div>
            <div style="margin-bottom:8px;color:#4b5563;">${formatDistance(hospital.distanceMeter)}</div>
            <a href="${nav}" target="_blank" rel="noreferrer"
               style="display:inline-block;padding:6px 10px;background:#1677ff;color:#fff;border-radius:8px;text-decoration:none;">
              ${text.navigate}
            </a>
          </div>
        `;
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(html);
        infoWindowRef.current.open(map, position);
      });

      marker.setMap(map);
      markerList.push(marker);
    });

    markersRef.current = markerList;
    if (markerList.length > 0) {
      map.setFitView(markerList as unknown[]);
    }
  }, [currentPoint, hospitals, loaded, text]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between border-b border-gray-700 p-3">
        <div>
          <div className="text-sm text-gray-200">{text.title}</div>
          <div className="text-xs text-gray-500">{text.subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-xs text-gray-300 hover:bg-[rgb(var(--bg))]"
            onClick={locateAndQueryHospitals}
            disabled={querying}
          >
            {querying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            {querying ? text.locating : text.locateBtn}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-xs text-gray-300 hover:bg-[rgb(var(--bg))]"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {text.back}
          </button>
        </div>
      </div>

      {mapError ? (
        <div className="m-4 flex items-center gap-2 rounded border border-amber-700/60 bg-amber-900/20 p-3 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {mapError}
        </div>
      ) : null}

      {queryError ? (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {queryError}
        </div>
      ) : null}

      {lastAmapResourceErrorUrl ? (
        <div className="mx-4 mt-2 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <div>{text.resourceLoadFailed}</div>
              <div className="mt-1 break-all font-mono text-[11px] text-amber-100/95">{lastAmapResourceErrorUrl}</div>
              <div className="mt-1 text-amber-100/90">{text.resourceLoadGuide}</div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPoint ? (
        <div className="mx-4 mt-2 text-xs text-gray-400">
          {text.current}: {currentPoint.lat.toFixed(6)}, {currentPoint.lng.toFixed(6)}
        </div>
      ) : null}

      <div ref={mapContainerRef} className="h-full min-h-0 w-full flex-1" />

      {mapError && hospitals.length > 0 ? (
        <div className="m-4 mt-2 rounded border border-gray-700 bg-[rgb(var(--card))] p-3 text-xs text-gray-300">
          <div className="mb-2 text-gray-400">{text.mapLoadFailed}</div>
          <div className="space-y-2">
            {hospitals.slice(0, 6).map((hospital, index) => (
              <div key={hospital.id} className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2">
                <div className="font-medium text-gray-200">
                  {index + 1}. {hospital.name} ({formatDistance(hospital.distanceMeter)})
                </div>
                <div className="mt-1 text-gray-400">
                  {text.address}: {hospital.address || '-'}
                </div>
                <a
                  className="mt-1 inline-flex text-cyan-300 hover:text-cyan-200"
                  href={buildAmapNavigationUrl(hospital)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text.navigate}
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!mapError && loaded && hospitals.length === 0 && !querying ? (
        <div className="m-4 mt-2 rounded border border-gray-700 bg-[rgb(var(--card))] p-3 text-xs text-gray-300">
          {text.noHospitals}
        </div>
      ) : null}
    </div>
  );
}
