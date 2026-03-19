export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          patient_code: string;
          name: string;
          gender: 'male' | 'female';
          age: number;
          region: string;
          contact_phone: string | null;
          tb_history: boolean;
          ppd_test_result: string | null;
          sputum_test_result: string | null;
          chief_complaint: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_code: string;
          name: string;
          gender: 'male' | 'female';
          age: number;
          region: string;
          contact_phone?: string | null;
          tb_history: boolean;
          ppd_test_result?: string | null;
          sputum_test_result?: string | null;
          chief_complaint?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
        Relationships: [];
      };
      medical_images: {
        Row: {
          id: string;
          patient_id: string;
          image_type: 'X-ray' | 'CT' | 'MRI';
          image_url: string | null;
          acquisition_date: string;
          modality: string | null;
          series_description: string | null;
          status: 'pending' | 'reviewing' | 'reviewed' | 'reported';
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          image_type: 'X-ray' | 'CT' | 'MRI';
          image_url?: string | null;
          acquisition_date: string;
          modality?: string | null;
          series_description?: string | null;
          status?: 'pending' | 'reviewing' | 'reviewed' | 'reported';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['medical_images']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'medical_images_patient_id_fkey';
            columns: ['patient_id'];
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          }
        ];
      };
      ai_analyses: {
        Row: {
          id: string;
          image_id: string;
          patient_id: string;
          risk_score: number;
          risk_level: 'high' | 'medium' | 'low';
          tb_probability: number;
          active_tb_likelihood: string | null;
          findings: Json[];
          reasoning_chain: Json[];
          differential_diagnosis: Json[];
          model_version: string;
          analysis_timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          image_id: string;
          patient_id: string;
          risk_score: number;
          risk_level: 'high' | 'medium' | 'low';
          tb_probability: number;
          active_tb_likelihood?: string | null;
          findings?: Json[];
          reasoning_chain?: Json[];
          differential_diagnosis?: Json[];
          model_version: string;
          analysis_timestamp: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_analyses']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'ai_analyses_image_id_fkey';
            columns: ['image_id'];
            referencedRelation: 'medical_images';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_analyses_patient_id_fkey';
            columns: ['patient_id'];
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          }
        ];
      };
      screening_reports: {
        Row: {
          id: string;
          patient_id: string;
          image_id: string;
          ai_analysis_id: string | null;
          radiologist_id: string | null;
          findings_description: string | null;
          conclusion: string | null;
          recommendation: string | null;
          status: 'draft' | 'finalized' | 'reported';
          report_type: 'screening' | 'referral' | 'notification';
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          image_id: string;
          ai_analysis_id?: string | null;
          radiologist_id?: string | null;
          findings_description?: string | null;
          conclusion?: string | null;
          recommendation?: string | null;
          status?: 'draft' | 'finalized' | 'reported';
          report_type: 'screening' | 'referral' | 'notification';
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['screening_reports']['Insert']>;
        Relationships: [
          { foreignKeyName: 'screening_reports_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'patients'; referencedColumns: ['id']; },
          { foreignKeyName: 'screening_reports_image_id_fkey'; columns: ['image_id']; referencedRelation: 'medical_images'; referencedColumns: ['id']; },
          { foreignKeyName: 'screening_reports_ai_analysis_id_fkey'; columns: ['ai_analysis_id']; referencedRelation: 'ai_analyses'; referencedColumns: ['id']; }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Patient = Database['public']['Tables']['patients']['Row'];
export type MedicalImage = Database['public']['Tables']['medical_images']['Row'];
export type AIAnalysis = Database['public']['Tables']['ai_analyses']['Row'];
export type ScreeningReport = Database['public']['Tables']['screening_reports']['Row'];

export interface PatientWithAnalysis extends Patient {
  medical_images?: (MedicalImage & { ai_analyses?: AIAnalysis[] })[];
  risk_score?: number;
  risk_level?: 'high' | 'medium' | 'low';
}
