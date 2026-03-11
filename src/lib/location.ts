import type { GeoPoint } from './amap';

export type BrowserLocateErrorCode =
  | 'GEOLOCATION_INSECURE_CONTEXT'
  | 'GEOLOCATION_DENIED'
  | 'GEOLOCATION_UNAVAILABLE'
  | 'GEOLOCATION_TIMEOUT'
  | 'GEOLOCATION_UNKNOWN';

export class BrowserLocateError extends Error {
  code: BrowserLocateErrorCode;

  constructor(code: BrowserLocateErrorCode) {
    super(code);
    this.code = code;
  }
}

function requestPosition(options: PositionOptions) {
  return new Promise<GeoPoint>((resolve, reject) => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      reject(new BrowserLocateError('GEOLOCATION_INSECURE_CONTEXT'));
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new BrowserLocateError('GEOLOCATION_UNAVAILABLE'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === 1) {
          reject(new BrowserLocateError('GEOLOCATION_DENIED'));
          return;
        }
        if (error.code === 2) {
          reject(new BrowserLocateError('GEOLOCATION_UNAVAILABLE'));
          return;
        }
        if (error.code === 3) {
          reject(new BrowserLocateError('GEOLOCATION_TIMEOUT'));
          return;
        }
        reject(new BrowserLocateError('GEOLOCATION_UNKNOWN'));
      },
      options
    );
  });
}

export async function getCurrentPositionWithBrowserFallback() {
  try {
    return await requestPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!message.includes('GEOLOCATION_TIMEOUT') && !message.includes('GEOLOCATION_UNAVAILABLE')) {
      throw error;
    }
  }

  return requestPosition({ enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
}
