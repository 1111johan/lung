-- Seed data for Guangxi Medical University TB Screening System
-- This creates realistic demonstration data for the screening workstation

-- Insert sample patients with varying risk profiles
INSERT INTO patients (patient_code, name, gender, age, region, contact_phone, tb_history, ppd_test_result, sputum_test_result, chief_complaint, created_at) VALUES
('GX-20231229-001', '张建山', 'male', 56, '百色市田阳区', '13877001234', true, '强阳性', '未检', '咳血2周', NOW() - INTERVAL '2 hours'),
('GX-20231229-002', '李秀英', 'female', 42, '南宁市青秀区', '13877002345', false, '阴性', '未检', '低热乏力', NOW() - INTERVAL '4 hours'),
('GX-20231229-003', '王大明', 'male', 38, '柳州市城中区', '13877003456', false, '弱阳性', '阴性', '咳嗽咳痰1月', NOW() - INTERVAL '6 hours'),
('GX-20231229-004', '陈小芳', 'female', 29, '桂林市象山区', '13877004567', false, '阴性', NULL, '体检发现异常', NOW() - INTERVAL '8 hours'),
('GX-20231229-005', '黄志强', 'male', 63, '玉林市玉州区', '13877005678', true, '阳性', '阳性', '持续发热1月', NOW() - INTERVAL '10 hours'),
('GX-20231229-006', '刘美华', 'female', 51, '梧州市万秀区', '13877006789', false, '阴性', NULL, '胸痛不适', NOW() - INTERVAL '12 hours'),
('GX-20231229-007', '赵国强', 'male', 45, '河池市金城江区', '13877007890', false, '弱阳性', '未检', '咳嗽2周', NOW() - INTERVAL '1 day'),
('GX-20231229-008', '周丽娟', 'female', 34, '贵港市港北区', '13877008901', false, '阴性', NULL, '健康体检', NOW() - INTERVAL '1 day');

-- Get patient IDs for reference
DO $$
DECLARE
  p1_id uuid; p2_id uuid; p3_id uuid; p4_id uuid;
  p5_id uuid; p6_id uuid; p7_id uuid; p8_id uuid;
  img1_id uuid; img2_id uuid; img3_id uuid; img4_id uuid;
  img5_id uuid; img6_id uuid; img7_id uuid; img8_id uuid;
BEGIN
  -- Get patient IDs
  SELECT id INTO p1_id FROM patients WHERE patient_code = 'GX-20231229-001';
  SELECT id INTO p2_id FROM patients WHERE patient_code = 'GX-20231229-002';
  SELECT id INTO p3_id FROM patients WHERE patient_code = 'GX-20231229-003';
  SELECT id INTO p4_id FROM patients WHERE patient_code = 'GX-20231229-004';
  SELECT id INTO p5_id FROM patients WHERE patient_code = 'GX-20231229-005';
  SELECT id INTO p6_id FROM patients WHERE patient_code = 'GX-20231229-006';
  SELECT id INTO p7_id FROM patients WHERE patient_code = 'GX-20231229-007';
  SELECT id INTO p8_id FROM patients WHERE patient_code = 'GX-20231229-008';

  -- Insert medical images
  INSERT INTO medical_images (id, patient_id, image_type, modality, series_description, status, acquisition_date)
  VALUES
    (gen_random_uuid(), p1_id, 'X-ray', 'DR', '胸部正位片', 'reviewing', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), p2_id, 'X-ray', 'DR', '胸部正位片', 'reviewing', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), p3_id, 'CT', 'CT', '胸部平扫', 'reviewing', NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), p4_id, 'X-ray', 'DR', '胸部正侧位', 'pending', NOW() - INTERVAL '8 hours'),
    (gen_random_uuid(), p5_id, 'CT', 'CT', '胸部增强扫描', 'reviewing', NOW() - INTERVAL '10 hours'),
    (gen_random_uuid(), p6_id, 'X-ray', 'DR', '胸部正位片', 'pending', NOW() - INTERVAL '12 hours'),
    (gen_random_uuid(), p7_id, 'X-ray', 'DR', '胸部正位片', 'pending', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), p8_id, 'X-ray', 'DR', '胸部正位片', 'pending', NOW() - INTERVAL '1 day');

  -- Get image IDs
  SELECT id INTO img1_id FROM medical_images WHERE patient_id = p1_id LIMIT 1;
  SELECT id INTO img2_id FROM medical_images WHERE patient_id = p2_id LIMIT 1;
  SELECT id INTO img3_id FROM medical_images WHERE patient_id = p3_id LIMIT 1;
  SELECT id INTO img4_id FROM medical_images WHERE patient_id = p4_id LIMIT 1;
  SELECT id INTO img5_id FROM medical_images WHERE patient_id = p5_id LIMIT 1;
  SELECT id INTO img6_id FROM medical_images WHERE patient_id = p6_id LIMIT 1;
  SELECT id INTO img7_id FROM medical_images WHERE patient_id = p7_id LIMIT 1;
  SELECT id INTO img8_id FROM medical_images WHERE patient_id = p8_id LIMIT 1;

  -- Insert AI analyses with detailed findings
  INSERT INTO ai_analyses (image_id, patient_id, risk_score, risk_level, tb_probability, active_tb_likelihood, findings, reasoning_chain, differential_diagnosis, analysis_timestamp)
  VALUES
    (
      img1_id, p1_id, 0.95, 'high', 92.0, '疑似活动期',
      '[{"type": "空洞", "location": "右上肺野", "x": 65, "y": 25, "width": 10, "height": 12, "size": "1.2cm", "confidence": 0.92}]'::jsonb,
      '[{"step": 1, "text": "扫描影像完成 (180ms)"}, {"step": 2, "text": "发现右上肺野薄壁空洞影像，最大直径1.2cm"}, {"step": 3, "text": "结合患者主诉「咳血2周」及既往结核史"}, {"step": 4, "text": "PPD强阳性支持结核诊断"}, {"step": 5, "text": "综合判断：继发性肺结核可能性大"}]'::jsonb,
      '[{"condition": "肺脓肿", "suggestion": "注意鉴别，建议痰培养"}, {"condition": "真菌感染", "suggestion": "可行GM试验排除"}]'::jsonb,
      NOW() - INTERVAL '2 hours'
    ),
    (
      img2_id, p2_id, 0.68, 'medium', 65.0, '疑似活动期',
      '[{"type": "浸润影", "location": "右上肺", "x": 60, "y": 30, "width": 15, "height": 18, "confidence": 0.68}]'::jsonb,
      '[{"step": 1, "text": "完成影像分析"}, {"step": 2, "text": "右上肺可见片状浸润影"}, {"step": 3, "text": "患者有低热乏力症状"}, {"step": 4, "text": "建议进一步检查明确诊断"}]'::jsonb,
      '[{"condition": "细菌性肺炎", "suggestion": "血常规+CRP"}, {"condition": "肺结核", "suggestion": "痰检+PPD"}]'::jsonb,
      NOW() - INTERVAL '4 hours'
    ),
    (
      img3_id, p3_id, 0.58, 'medium', 55.0, '需进一步评估',
      '[{"type": "结节", "location": "左下肺", "x": 35, "y": 55, "width": 8, "height": 8, "confidence": 0.58}]'::jsonb,
      '[{"step": 1, "text": "CT扫描分析完成"}, {"step": 2, "text": "左下肺发现小结节影"}, {"step": 3, "text": "边缘较清晰，密度均匀"}, {"step": 4, "text": "结合临床症状，建议随访"}]'::jsonb,
      '[{"condition": "陈旧性病灶", "suggestion": "对比既往片"}, {"condition": "炎性结节", "suggestion": "2周后复查"}]'::jsonb,
      NOW() - INTERVAL '6 hours'
    ),
    (
      img4_id, p4_id, 0.25, 'low', 18.0, '未见明显活动',
      '[]'::jsonb,
      '[{"step": 1, "text": "影像质量良好"}, {"step": 2, "text": "双肺纹理清晰"}, {"step": 3, "text": "未见明显实质性病变"}, {"step": 4, "text": "建议常规随访"}]'::jsonb,
      '[]'::jsonb,
      NOW() - INTERVAL '8 hours'
    ),
    (
      img5_id, p5_id, 0.89, 'high', 88.0, '高度疑似活动期',
      '[{"type": "干酪样坏死", "location": "双上肺", "x": 45, "y": 20, "width": 20, "height": 25, "confidence": 0.89}, {"type": "空洞", "location": "右上肺", "x": 65, "y": 22, "width": 8, "height": 10, "confidence": 0.85}]'::jsonb,
      '[{"step": 1, "text": "CT增强扫描分析完成"}, {"step": 2, "text": "双上肺多发斑片影伴空洞形成"}, {"step": 3, "text": "患者持续发热1月，痰检阳性"}, {"step": 4, "text": "强烈建议抗结核治疗"}]'::jsonb,
      '[{"condition": "播散性肺结核", "suggestion": "立即启动治疗"}, {"condition": "耐药结核", "suggestion": "药敏试验"}]'::jsonb,
      NOW() - INTERVAL '10 hours'
    ),
    (
      img6_id, p6_id, 0.42, 'medium', 38.0, '需临床评估',
      '[{"type": "胸腔积液", "location": "右侧胸腔", "x": 70, "y": 60, "width": 15, "height": 20, "confidence": 0.42}]'::jsonb,
      '[{"step": 1, "text": "检测到右侧胸腔积液"}, {"step": 2, "text": "肺野未见明显病灶"}, {"step": 3, "text": "建议胸水检查明确性质"}]'::jsonb,
      '[{"condition": "结核性胸膜炎", "suggestion": "胸水ADA检测"}, {"condition": "心源性积液", "suggestion": "心脏彩超"}]'::jsonb,
      NOW() - INTERVAL '12 hours'
    ),
    (
      img7_id, p7_id, 0.51, 'medium', 48.0, '需进一步检查',
      '[{"type": "肺纹理增粗", "location": "双肺", "confidence": 0.51}]'::jsonb,
      '[{"step": 1, "text": "双肺纹理增粗增多"}, {"step": 2, "text": "可能为慢性炎症改变"}, {"step": 3, "text": "建议完善相关检查"}]'::jsonb,
      '[{"condition": "慢性支气管炎", "suggestion": "肺功能检查"}, {"condition": "早期间质性病变", "suggestion": "HRCT复查"}]'::jsonb,
      NOW() - INTERVAL '1 day'
    ),
    (
      img8_id, p8_id, 0.15, 'low', 8.0, '未见异常',
      '[]'::jsonb,
      '[{"step": 1, "text": "体检筛查完成"}, {"step": 2, "text": "肺部未见明显异常"}, {"step": 3, "text": "心影大小正常"}, {"step": 4, "text": "建议1年后常规复查"}]'::jsonb,
      '[]'::jsonb,
      NOW() - INTERVAL '1 day'
    );
END $$;
