import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function getSupabaseConfigError(url?: string, key?: string): string | null {
  if (!url || !key) return 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'VITE_SUPABASE_URL must use http/https';
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL';
  }
  return null;
}

export const supabaseConfigError = getSupabaseConfigError(rawSupabaseUrl, rawSupabaseAnonKey);

export const supabaseConfigStatus = {
  configured: !supabaseConfigError,
  reason: supabaseConfigError,
  url: rawSupabaseUrl ?? null,
} as const;

export const supabase =
  !supabaseConfigError && rawSupabaseUrl && rawSupabaseAnonKey
    ? createClient<Database>(rawSupabaseUrl, rawSupabaseAnonKey)
    : null;
