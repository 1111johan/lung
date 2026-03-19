import { useMemo, useState } from 'react';
import { Building2, Crosshair, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { buildAmapNavigationUrl, fetchNearbyHospitals, getAmapConfigStatus, type NearbyHospital } from '../lib/amap';
import { useI18n, type AppLocale } from '../lib/i18n';
import { saveNearbyHospitalsPayload } from '../lib/nearbyHospitalsState';
import { getCurrentPositionWithBrowserFallback } from '../lib/location';
import { uiStyles } from '../lib/theme';

type LocaleText = {
  title: string;
  subtitle: string;
  locateBtn: string;
  loading: string;
  noData: string;
  coordinate: string;
  distance: string;
  address: string;
  phone: string;
  navigate: string;
  nearbyCount: string;
  geolocationDenied: string;
  geolocationInsecureContext: string;
  geolocationUnavailable: string;
  geolocationTimeout: string;
  geolocationUnknown: string;
  missingKey: string;
  invalidKey: string;
  networkError: string;
  genericError: string;
  locating: string;
  noPhone: string;
  mapMode: string;
};

const TEXTS: Record<AppLocale, LocaleText> = {
  zh: {
    title: '附近医院推荐',
    subtitle: '根据当前位置推送附近医院（高德地图）',
    locateBtn: '定位并查询',
    loading: '正在定位并查询附近医院...',
    noData: '当前位置附近暂无可展示医院',
    coordinate: '当前坐标',
    distance: '距离',
    address: '地址',
    phone: '电话',
    navigate: '导航',
    nearbyCount: '附近医院',
    geolocationDenied: '定位权限被拒绝，请允许浏览器获取位置信息。',
    geolocationInsecureContext: '当前页面不是安全上下文，请通过 HTTPS 或 localhost 访问。',
    geolocationUnavailable: '无法获取定位信息，请检查设备定位服务。',
    geolocationTimeout: '定位超时，请重试。',
    geolocationUnknown: '定位失败，请稍后重试。',
    missingKey: '未配置高德 API key（请设置 VITE_AMAP_WEB_KEY 或 VITE_AMAP_JS_KEY）。',
    invalidKey: '高德 API key 无效（INVALID_USER_KEY），请检查 key 与服务权限。',
    networkError: '访问高德服务失败，请检查网络或代理设置。',
    genericError: '查询失败，请稍后重试。',
    locating: '定位中',
    noPhone: '暂无',
    mapMode: '地图模式',
  },
  en: {
    title: 'Nearby Hospitals',
    subtitle: 'Recommend nearby hospitals from your current location (Amap)',
    locateBtn: 'Locate & Search',
    loading: 'Locating and searching nearby hospitals...',
    noData: 'No hospitals found near current location',
    coordinate: 'Coordinate',
    distance: 'Distance',
    address: 'Address',
    phone: 'Phone',
    navigate: 'Navigate',
    nearbyCount: 'Nearby hospitals',
    geolocationDenied: 'Location permission denied. Please allow browser location access.',
    geolocationInsecureContext: 'This page is not in a secure context. Use HTTPS or localhost.',
    geolocationUnavailable: 'Unable to obtain location. Please check device location services.',
    geolocationTimeout: 'Location request timed out. Please retry.',
    geolocationUnknown: 'Location failed. Please retry later.',
    missingKey: 'Missing Amap API key (set VITE_AMAP_WEB_KEY or VITE_AMAP_JS_KEY).',
    invalidKey: 'Invalid Amap API key (INVALID_USER_KEY). Check key and permissions in Amap console.',
    networkError: 'Failed to reach Amap service. Check network/proxy settings.',
    genericError: 'Query failed. Please retry later.',
    locating: 'Locating',
    noPhone: 'N/A',
    mapMode: 'Map view',
  },
  th: {
    title: 'โรงพยาบาลใกล้คุณ',
    subtitle: 'แนะนำโรงพยาบาลใกล้ตำแหน่งปัจจุบัน (Amap)',
    locateBtn: 'ค้นหาจากตำแหน่ง',
    loading: 'กำลังระบุตำแหน่งและค้นหาโรงพยาบาลใกล้เคียง...',
    noData: 'ไม่พบโรงพยาบาลใกล้ตำแหน่งปัจจุบัน',
    coordinate: 'พิกัด',
    distance: 'ระยะทาง',
    address: 'ที่อยู่',
    phone: 'โทรศัพท์',
    navigate: 'นำทาง',
    nearbyCount: 'โรงพยาบาลใกล้เคียง',
    geolocationDenied: 'ไม่ได้รับสิทธิ์ตำแหน่ง โปรดอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์',
    geolocationInsecureContext: 'หน้านี้ไม่ใช่บริบทที่ปลอดภัย โปรดใช้ HTTPS หรือ localhost',
    geolocationUnavailable: 'ไม่สามารถรับตำแหน่งได้ โปรดตรวจสอบบริการตำแหน่งของอุปกรณ์',
    geolocationTimeout: 'การระบุตำแหน่งหมดเวลา โปรดลองใหม่',
    geolocationUnknown: 'ระบุตำแหน่งไม่สำเร็จ โปรดลองใหม่ภายหลัง',
    missingKey: 'ยังไม่ได้ตั้งค่า Amap API key (ตั้งค่า VITE_AMAP_WEB_KEY หรือ VITE_AMAP_JS_KEY).',
    invalidKey: 'Amap API key ไม่ถูกต้อง (INVALID_USER_KEY) โปรดตรวจสอบ key และสิทธิ์ในคอนโซล Amap',
    networkError: 'เชื่อมต่อบริการ Amap ไม่สำเร็จ โปรดตรวจสอบเครือข่ายหรือพร็อกซี',
    genericError: 'ค้นหาไม่สำเร็จ โปรดลองใหม่ภายหลัง',
    locating: 'กำลังระบุตำแหน่ง',
    noPhone: 'ไม่มี',
    mapMode: 'มุมมองแผนที่',
  },
  id: {
    title: 'Rumah Sakit Terdekat',
    subtitle: 'Rekomendasi rumah sakit berdasarkan lokasi saat ini (Amap)',
    locateBtn: 'Lokasi & Cari',
    loading: 'Sedang menentukan lokasi dan mencari rumah sakit terdekat...',
    noData: 'Tidak ada rumah sakit yang ditemukan di sekitar lokasi saat ini',
    coordinate: 'Koordinat',
    distance: 'Jarak',
    address: 'Alamat',
    phone: 'Telepon',
    navigate: 'Navigasi',
    nearbyCount: 'Rumah sakit terdekat',
    geolocationDenied: 'Izin lokasi ditolak. Izinkan akses lokasi di browser.',
    geolocationInsecureContext: 'Halaman ini bukan konteks aman. Gunakan HTTPS atau localhost.',
    geolocationUnavailable: 'Tidak dapat memperoleh lokasi. Periksa layanan lokasi perangkat.',
    geolocationTimeout: 'Permintaan lokasi habis waktu. Coba lagi.',
    geolocationUnknown: 'Lokasi gagal. Coba lagi nanti.',
    missingKey: 'Amap API key belum dikonfigurasi (atur VITE_AMAP_WEB_KEY atau VITE_AMAP_JS_KEY).',
    invalidKey: 'Amap API key tidak valid (INVALID_USER_KEY). Cek key dan izin di console Amap.',
    networkError: 'Gagal mengakses layanan Amap. Cek jaringan/proxy.',
    genericError: 'Pencarian gagal. Coba lagi nanti.',
    locating: 'Mencari lokasi',
    noPhone: 'Tidak ada',
    mapMode: 'Mode peta',
  },
  ms: {
    title: 'Hospital Berdekatan',
    subtitle: 'Cadangan hospital berdasarkan lokasi semasa (Amap)',
    locateBtn: 'Lokasi & Cari',
    loading: 'Sedang mendapatkan lokasi dan mencari hospital berdekatan...',
    noData: 'Tiada hospital ditemui berhampiran lokasi semasa',
    coordinate: 'Koordinat',
    distance: 'Jarak',
    address: 'Alamat',
    phone: 'Telefon',
    navigate: 'Navigasi',
    nearbyCount: 'Hospital berdekatan',
    geolocationDenied: 'Kebenaran lokasi ditolak. Sila benarkan akses lokasi pada pelayar.',
    geolocationInsecureContext: 'Halaman ini bukan konteks selamat. Gunakan HTTPS atau localhost.',
    geolocationUnavailable: 'Tidak dapat mendapatkan lokasi. Sila semak servis lokasi peranti.',
    geolocationTimeout: 'Permintaan lokasi tamat masa. Cuba lagi.',
    geolocationUnknown: 'Lokasi gagal. Cuba lagi kemudian.',
    missingKey: 'Amap API key belum dikonfigurasi (tetapkan VITE_AMAP_WEB_KEY atau VITE_AMAP_JS_KEY).',
    invalidKey: 'Amap API key tidak sah (INVALID_USER_KEY). Semak key dan kebenaran dalam konsol Amap.',
    networkError: 'Gagal mencapai servis Amap. Semak rangkaian/proksi.',
    genericError: 'Carian gagal. Cuba lagi kemudian.',
    locating: 'Mengesan lokasi',
    noPhone: 'Tiada',
    mapMode: 'Mod peta',
  },
};

function formatDistance(meter: number) {
  if (meter <= 0) return '--';
  if (meter < 1000) return `${Math.round(meter)}m`;
  return `${(meter / 1000).toFixed(1)}km`;
}

function inferErrorMessage(error: unknown, text: LocaleText) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (message.includes('MISSING_AMAP_WEB_KEY') || message.includes('MISSING_AMAP_JS_KEY') || message.includes('MISSING_AMAP_KEYS'))
    return text.missingKey;
  if (message.includes('GEOLOCATION_INSECURE_CONTEXT')) return text.geolocationInsecureContext;
  if (message.includes('GEOLOCATION_DENIED')) return text.geolocationDenied;
  if (message.includes('GEOLOCATION_UNAVAILABLE')) return text.geolocationUnavailable;
  if (message.includes('GEOLOCATION_TIMEOUT')) return text.geolocationTimeout;
  if (message.includes('GEOLOCATION_UNKNOWN')) return text.geolocationUnknown;
  if (message.includes('10001') || message.includes('INVALID_USER_KEY')) return text.invalidKey;
  if (message.includes('AMAP_HTTP_')) return text.networkError;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return text.networkError;

  return text.genericError;
}

export function NearbyHospitalsCard({ onOpenMap }: { onOpenMap?: () => void }) {
  const { locale } = useI18n();
  const text = useMemo(() => TEXTS[locale], [locale]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const configStatus = getAmapConfigStatus();

  const openMap = () => {
    if (hospitals.length === 0) return;
    saveNearbyHospitalsPayload({
      point: coords,
      hospitals,
      source: 'dashboard',
      updatedAt: new Date().toISOString(),
    });
    if (onOpenMap) {
      onOpenMap();
      return;
    }
    window.location.assign('/nearby-hospitals/map');
  };

  const locateAndSearch = () => {
    setError('');
    if (!configStatus.configured) {
      setHospitals([]);
      setCoords(null);
      setError(text.missingKey);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const point = await getCurrentPositionWithBrowserFallback();
        setCoords(point);

        const nearby = await fetchNearbyHospitals(point, { radiusMeter: 8000, pageSize: 8 });
        setHospitals(nearby);
        saveNearbyHospitalsPayload({
          point,
          hospitals: nearby,
          source: 'dashboard',
          updatedAt: new Date().toISOString(),
        });
        if (nearby.length === 0) {
          setError(text.noData);
        }
      } catch (err) {
        setHospitals([]);
        setError(inferErrorMessage(err, text));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="aurora-card glass-card-hover p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-200 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-400" />
            {text.title}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{text.subtitle}</div>
        </div>
        <button
          className={uiStyles.button.primary + ' text-xs flex items-center gap-1'}
          onClick={locateAndSearch}
          disabled={loading}
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          {loading ? text.locating : text.locateBtn}
        </button>
      </div>

      {coords && (
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {text.coordinate}: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </div>
      )}

      {loading && <div className="text-xs text-gray-500">{text.loading}</div>}
      {!loading && error && <div className="text-xs text-amber-300">{error}</div>}

      {!loading && hospitals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-400">
              {text.nearbyCount}: {hospitals.length}
            </div>
            <button
              type="button"
              className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-[11px] text-gray-300 hover:bg-[rgb(var(--bg))]"
              onClick={openMap}
            >
              {text.mapMode}
            </button>
          </div>
          {hospitals.map((h) => (
            <div
              key={h.id}
              className="rounded border border-gray-700 bg-[rgb(var(--bg))] px-2 py-2 text-xs text-gray-200 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-gray-100 truncate">{h.name}</div>
                <div className="text-teal-300 whitespace-nowrap">
                  {text.distance}: {formatDistance(h.distanceMeter)}
                </div>
              </div>
              <div className="text-gray-400">{text.address}: {h.address}</div>
              <div className="text-gray-400">{text.phone}: {h.tel || text.noPhone}</div>
              <a
                href={buildAmapNavigationUrl(h)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-teal-300 hover:text-teal-200"
              >
                <Navigation className="h-3.5 w-3.5" />
                {text.navigate}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
