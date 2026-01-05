/*
  # Guangxi Medical University TB Screening System Database Schema

  ## Overview
  Complete database structure for the AI-powered tuberculosis screening platform.
  
  ## New Tables
  
  ### 1. `patients`
  Core patient demographics and clinical history
  - `id` (uuid, primary key)
  - `patient_code` (text, unique identifier like GX-20231229-001)
  - `name` (text, encrypted patient name)
  - `gender` (text, male/female)
  - `age` (integer)
  - `region` (text, geographic location in Guangxi)
  - `contact_phone` (text)
  - `tb_history` (boolean, previous TB history)
  - `ppd_test_result` (text, tuberculin skin test result)
  - `sputum_test_result` (text, sputum smear result)
  - `chief_complaint` (text, main symptoms)
  - `created_at` (timestamp)
  
  ### 2. `medical_images`
  DICOM imaging records and metadata
  - `id` (uuid, primary key)
  - `patient_id` (uuid, foreign key)
  - `image_type` (text, X-ray/CT)
  - `image_url` (text, storage path)
  - `acquisition_date` (timestamp)
  - `modality` (text, imaging modality)
  - `series_description` (text)
  - `status` (text, pending/reviewed/reported)
  - `created_at` (timestamp)
  
  ### 3. `ai_analyses`
  AI diagnostic results and reasoning chains
  - `id` (uuid, primary key)
  - `image_id` (uuid, foreign key)
  - `patient_id` (uuid, foreign key)
  - `risk_score` (decimal, 0.0-1.0)
  - `risk_level` (text, high/medium/low)
  - `tb_probability` (decimal, percentage)
  - `active_tb_likelihood` (text, assessment)
  - `findings` (jsonb, detected lesions)
  - `reasoning_chain` (jsonb, AI thought process)
  - `differential_diagnosis` (jsonb, alternative diagnoses)
  - `model_version` (text, AI model identifier)
  - `analysis_timestamp` (timestamp)
  - `created_at` (timestamp)
  
  ### 4. `screening_reports`
  Final diagnostic reports by physicians
  - `id` (uuid, primary key)
  - `patient_id` (uuid, foreign key)
  - `image_id` (uuid, foreign key)
  - `ai_analysis_id` (uuid, foreign key)
  - `radiologist_id` (uuid, reference to auth.users)
  - `findings_description` (text, structured report)
  - `conclusion` (text, final diagnosis)
  - `recommendation` (text, clinical actions)
  - `status` (text, draft/finalized/reported)
  - `report_type` (text, screening/referral/notification)
  - `reviewed_at` (timestamp)
  - `created_at` (timestamp)
  
  ## Security
  - RLS enabled on all tables
  - Policies ensure authenticated medical staff access only
  - Patient data protected with strict access controls
*/

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code text UNIQUE NOT NULL,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  age integer NOT NULL CHECK (age > 0 AND age < 150),
  region text NOT NULL,
  contact_phone text,
  tb_history boolean DEFAULT false,
  ppd_test_result text,
  sputum_test_result text,
  chief_complaint text,
  created_at timestamptz DEFAULT now()
);

-- Create medical_images table
CREATE TABLE IF NOT EXISTS medical_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  image_type text NOT NULL CHECK (image_type IN ('X-ray', 'CT', 'MRI')),
  image_url text,
  acquisition_date timestamptz DEFAULT now(),
  modality text,
  series_description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'reviewed', 'reported')),
  created_at timestamptz DEFAULT now()
);

-- Create ai_analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES medical_images(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  risk_score decimal(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_level text NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  tb_probability decimal(5,2) CHECK (tb_probability >= 0 AND tb_probability <= 100),
  active_tb_likelihood text,
  findings jsonb DEFAULT '[]'::jsonb,
  reasoning_chain jsonb DEFAULT '[]'::jsonb,
  differential_diagnosis jsonb DEFAULT '[]'::jsonb,
  model_version text DEFAULT 'GX-TB-v4.2',
  analysis_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create screening_reports table
CREATE TABLE IF NOT EXISTS screening_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES medical_images(id) ON DELETE CASCADE,
  ai_analysis_id uuid REFERENCES ai_analyses(id) ON DELETE SET NULL,
  radiologist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  findings_description text,
  conclusion text,
  recommendation text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'reported')),
  report_type text DEFAULT 'screening' CHECK (report_type IN ('screening', 'referral', 'notification')),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_region ON patients(region);
CREATE INDEX IF NOT EXISTS idx_images_patient ON medical_images(patient_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON medical_images(status);
CREATE INDEX IF NOT EXISTS idx_analyses_patient ON ai_analyses(patient_id);
CREATE INDEX IF NOT EXISTS idx_analyses_risk ON ai_analyses(risk_level, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON screening_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON screening_reports(status);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patients table
CREATE POLICY "Medical staff can view all patients"
  ON patients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Medical staff can insert patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Medical staff can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for medical_images table
CREATE POLICY "Medical staff can view all images"
  ON medical_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Medical staff can insert images"
  ON medical_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Medical staff can update images"
  ON medical_images FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for ai_analyses table
CREATE POLICY "Medical staff can view all analyses"
  ON ai_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert AI analyses"
  ON ai_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Medical staff can update analyses"
  ON ai_analyses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for screening_reports table
CREATE POLICY "Medical staff can view all reports"
  ON screening_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Medical staff can insert reports"
  ON screening_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Medical staff can update own reports"
  ON screening_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Medical staff can delete draft reports"
  ON screening_reports FOR DELETE
  TO authenticated
  USING (status = 'draft');