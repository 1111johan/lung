import { supabase } from './supabase';
import type { Database, PatientWithAnalysis } from './database.types';

type PatientInsert = Database['public']['Tables']['patients']['Insert'];

type PatientWithRelations = PatientWithAnalysis;

function attachRiskFromAnalysis(patient: PatientWithRelations): PatientWithRelations {
  const firstImage = patient.medical_images?.[0];
  const firstAnalysis = firstImage?.ai_analyses?.[0];
  return {
    ...patient,
    risk_score: firstAnalysis?.risk_score ?? patient.risk_score ?? 0,
    risk_level: (firstAnalysis?.risk_level as any) ?? patient.risk_level ?? 'low',
  };
}

export async function fetchPatientsWithAnalysis(): Promise<PatientWithRelations[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*, medical_images:medical_images(*, ai_analyses:ai_analyses(*))')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const typed = (data || []) as PatientWithRelations[];
  return typed.map(attachRiskFromAnalysis);
}

export async function createPatientProfile(payload: PatientInsert): Promise<PatientWithRelations> {
  const { data, error } = await supabase
    .from('patients')
    .insert(payload)
    .select('*, medical_images:medical_images(*, ai_analyses:ai_analyses(*))')
    .single();

  if (error) throw error;
  return attachRiskFromAnalysis(data as PatientWithRelations);
}
