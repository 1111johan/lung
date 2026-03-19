import { supabase, supabaseConfigStatus } from './supabase';
import type { Database, PatientWithAnalysis } from './database.types';

type PatientInsert = Database['public']['Tables']['patients']['Insert'];

type PatientWithRelations = PatientWithAnalysis;
type SupabaseClient = NonNullable<typeof supabase>;
type QueryError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function formatPostgrestError(error: {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}) {
  const parts = [error.message];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return parts.join(' | ');
}

function getSupabaseClientOrThrow() {
  if (!supabase) {
    const reason = supabaseConfigStatus.reason || 'Supabase not configured';
    throw new Error(reason);
  }
  return supabase;
}

function isAuthOrRlsError(error: QueryError) {
  const text = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  return (
    error.code === '42501' ||
    text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('not authenticated') ||
    text.includes('jwt')
  );
}

let anonymousAuthAttempted = false;

async function ensureAuthenticatedSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) return `auth.getSession failed: ${error.message}`;
  if (data.session) return null;

  const authApi = client.auth as unknown as {
    signInAnonymously?: () => Promise<{ error: { message: string } | null }>;
  };

  if (!authApi.signInAnonymously) {
    return 'auth.signInAnonymously not supported by current client';
  }

  const { error: signInError } = await authApi.signInAnonymously();
  if (signInError) return `auth.signInAnonymously failed: ${signInError.message}`;
  return null;
}

async function runQueryWithAuthRetry<T>(
  client: SupabaseClient,
  query: () => Promise<{ data: T; error: QueryError | null }>
) {
  let result = await query();
  if (!result.error || !isAuthOrRlsError(result.error) || anonymousAuthAttempted) {
    return result;
  }

  anonymousAuthAttempted = true;
  const authError = await ensureAuthenticatedSession(client);
  if (authError) {
    return {
      ...result,
      error: {
        ...result.error,
        message: `${result.error.message} | ${authError}`,
      },
    };
  }

  result = await query();
  return result;
}

function attachRiskFromAnalysis(patient: PatientWithRelations): PatientWithRelations {
  const firstImage = patient.medical_images?.[0];
  const firstAnalysis = firstImage?.ai_analyses?.[0];
  const riskLevel = firstAnalysis?.risk_level ?? patient.risk_level ?? 'low';
  return {
    ...patient,
    risk_score: firstAnalysis?.risk_score ?? patient.risk_score ?? 0,
    risk_level: riskLevel,
  };
}

export async function fetchPatientsWithAnalysis(): Promise<PatientWithRelations[]> {
  const client = getSupabaseClientOrThrow();
  const { data, error } = await runQueryWithAuthRetry(client, async () => {
    const response = await client
      .from('patients')
      .select('*, medical_images:medical_images(*, ai_analyses:ai_analyses(*))')
      .order('created_at', { ascending: false });
    return { data: response.data, error: response.error };
  });

  if (error) throw new Error(formatPostgrestError(error));
  const typed = (data || []) as PatientWithRelations[];
  return typed.map(attachRiskFromAnalysis);
}

export async function createPatientProfile(payload: PatientInsert): Promise<PatientWithRelations> {
  const client = getSupabaseClientOrThrow();
  const { data, error } = await runQueryWithAuthRetry(client, async () => {
    const response = await client
      .from('patients')
      .insert(payload)
      .select('*, medical_images:medical_images(*, ai_analyses:ai_analyses(*))')
      .single();
    return { data: response.data, error: response.error };
  });

  if (error) throw new Error(formatPostgrestError(error));
  return attachRiskFromAnalysis(data as PatientWithRelations);
}

export async function checkSupabaseConnection() {
  if (!supabase) {
    return {
      ok: false,
      reason: supabaseConfigStatus.reason || 'Supabase not configured',
    } as const;
  }

  const client = getSupabaseClientOrThrow();
  const { error } = await runQueryWithAuthRetry(client, async () => {
    const response = await client
      .from('patients')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    return { data: response.data, error: response.error };
  });

  if (error) {
    return {
      ok: false,
      reason: formatPostgrestError(error),
    } as const;
  }

  return { ok: true } as const;
}
