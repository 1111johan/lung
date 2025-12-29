# 临床 CDSS Agent 功能规格（TB 场景）

面向 GXMU 肺结核 Web-PACS + AI 工作站的 Clinical CDSS Agent。目标：融合影像发现与临床/检验/流行病学信息，输出“风险分层 + 鉴别诊断矩阵 + 下一步处置任务”，且全程可审计、可追溯。

## 1. 角色与边界
- Agent 角色：提供风险提示、鉴别建议、处置任务建议，不直接下最终诊断；医生确认后才生效。
- 责任分层：Triage（队列优先级）、CDSS（鉴别与建议）、Reporting（可编辑报告句）。高危默认需二次确认或 MDT。

## 2. 输入（最小字段集）
- 患者与流调：patient_id、年龄/性别、密接史、地区（广西/疫区）、职业。
- 影像证据：study_uid、series_uid、findings[]（id、type、location、slice_range、mask_uri、measurements、confidence、model_version、threshold、timestamp）。
- 临床症状：咳嗽>2w、咳血、低热、盗汗、体重下降等布尔/等级。
- 既往史：既往 TB、免疫低下、慢病（糖尿病等）。
- 检验：PPD、IGRA、痰涂片/培养、GM、炎症指标（CRP、PCT）、HIV 状态（如有）。
- 体征/生命体征：体温、心率、SpO2。
- 用药/禁忌：妊娠、儿童、肝功能异常、当前用药（用于交互作用提醒）。
- 上下文包：context_pack_id（供溯源），数据源与时间戳。
- UI 状态：盲评/显影模式，医生身份与权限。

## 3. 输出（结构化）
- 风险分层：tier(high/suspect/low)、score(0-1)、top_drivers[来源：影像/症状/检验/流调]，每个 driver 回链 finding_id 或检验字段。
- 鉴别诊断矩阵：items[] = {dx, score, pro_evidence[], con_evidence[], next_tests[], risk_note}；证据用 id 或字段指针。
- 下一步任务清单（可执行）：tasks[] = {type(lab/imaging/referral/followup/consult), title, due_at/offset, payload(表单模板), rationale(关联证据 ids), required_fields, status(draft/issued/accepted/rejected)}。
- 报告草稿片段：所见/印象/建议句子，trace_links 映射到 evidence/finding。
- 安全提示：禁忌/高风险场景（妊娠、肝功能异常、免疫低下）提醒。
- 审计建议：需要二次确认/MDT 的标记。

## 4. API 契约（示例）

### POST /cdss/infer
请求：
```json
{
  "patient_id": "P123",
  "study_uid": "1.2.3",
  "series_uid": "1.2.3.4",
  "context_pack_id": "ctx-001",
  "findings": [...],
  "clinical": {
    "symptoms": {"cough_gt_2w": true, "hemoptysis": false, "fever": 37.8},
    "history": {"tb": true, "dm": false, "immune_low": false},
    "labs": {"ppd": "strong_positive", "igra": "positive", "sputum_smear": "pending"},
    "epi": {"contact": true, "region": "guangxi"}
  },
  "user": {"id": "reader_A", "role": "radiologist"}
}
```
响应（核心字段）：
```json
{
  "risk": {"tier": "high", "score": 0.86, "drivers": [
    {"source": "finding", "ref": "finding-001", "reason": "cavity_RUL_12mm"},
    {"source": "lab", "ref": "igra", "reason": "positive"},
    {"source": "epi", "ref": "contact", "reason": "close_contact"}
  ]},
  "differentials": [
    {"dx": "TB", "score": 0.82, "pro_evidence": ["finding-001", "symptom_cough_gt_2w", "lab_igra_pos"], "con_evidence": [], "next_tests": ["sputum_culture"], "risk_note": "high_cost_miss"},
    {"dx": "fungal", "score": 0.34, "pro_evidence": ["immune_low"], "con_evidence": ["lab_igra_pos"], "next_tests": ["GM_test"]}
  ],
  "tasks": [
    {"id": "task-001", "type": "lab", "title": "补做痰涂片", "due_offset_days": 0, "payload": {"form": "sputum_smear"}, "rationale": ["differential:TB"], "required_fields": ["collection_time"], "status": "draft"}
  ],
  "report_snippets": {
    "findings": ["右上肺见空洞样低密度影，最大径约12mm。"],
    "impression": ["结核性病灶倾向，建议结合痰检。"],
    "recommendation": ["请完成痰涂片与培养。"],
    "trace_links": {"finding-001": ["findings[0]", "impression[0]"]}
  },
  "flags": {"need_double_check": true, "need_mdt": false},
  "audit_stub": {"model": "cdss-tb-1.0", "timestamp": "2024-12-28T09:00:00Z"}
}
```

### PATCH /cdss/tasks/{id}
- 用途：采纳/修改/拒绝任务。写入 audit。

### POST /cdss/audit
- 记录医生操作：接受/修改/驳回风险/任务/句子；附理由与时间戳。

## 5. UI 落点（右侧栏）
- 顶部风险仪表盘：显示 tier/score，列出 Top-3 驱动因素（可点击跳转到 ROI/检验）。
- 鉴别矩阵：表格式，每行一个候选 dx，展示支持/反证/推荐检查，点击展开证据卡。
- 建议清单：每条有按钮 `采纳`（生成任务/表单）、`修改`（弹出表单）、`拒绝`（可选拒绝理由）。状态同步到任务队列。
- 审计提示：高危需二次确认；被修改的句子/任务显示修改人和时间。

## 6. 规则与校验
- 阈值策略：高危默认 score >= 0.75 或含高危证据（空洞+IGRA阳性+密接）。
- 数据校验：必填字段缺失则不出最终 tier，提示“缺失字段”并指向表单；检验状态 pending 时给出占位与提醒。
- 用药/禁忌：如妊娠/肝功能异常，输出路径级提示，不给具体处方。

## 7. 审计与追溯
- 记录：输入版本（context_pack_id、model_version）、阈值、生成时间；每次医生操作（采纳/修改/驳回/提交）+ user_id + timestamp + diff。
- 回链：所有句子/任务/结论必须能回溯到 evidence id（影像/检验/症状字段）。
- 高危结论提交前必须有确认事件（可配置强制二次签名或 MDT）。

## 8. 失败兜底
- 数据不足：输出占位状态 + 缺失字段列表 + 建议补录任务。
- 推理失败：提示“CDSS暂不可用”，不阻塞阅片，写入 audit（reason/stack 摘要）。
- 任务下发失败：重试 + 告警（Ops Agent）并提示用户手工操作路径。

## 9. 性能与监控
- 延迟目标：CDSS 推理 < 2s（常规）；超时降级为“简化风险分层 + 最小建议”。
- 监控指标：成功率、平均/95 延迟、输出完整度（字段缺失率）、高危命中率；分设备/分院区维度。

## 10. 落地依赖
- 与影像侧：findings/masks 来自 Model Orchestrator；证据卡需可定位 ROI。
- 与临床数据源：EMR/RIS/LIS 接口（FHIR/HL7 或院内 API），保证时间戳与来源字段。
- 回写：任务与报告修改写 audit；高危标记支持队列升权；可选将关键结论写入 DICOM SR/GSPS 以便多系统查看。
