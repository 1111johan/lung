# GXMU TB 多智能体协作系统规格（Web-PACS + AI CDSS）

面向广西医科大学肺结核筛查工作站的全栈功能规格，覆盖多智能体能力、闭环流程、接口契约、状态机、UI 落点、审计合规、运营监控。

## 1. 智能体矩阵与职责
- Imaging Agent：病灶检测/分割、时间轴对比、盲评显影切换、证据卡回链。
- QA Agent：质控（体位/曝光/伪影）、漏标风险、所见/印象一致性、必填字段缺失、术语规范检查。
- Clinical CDSS Agent：风险分层 + 鉴别矩阵 + 下一步处置任务（见 `CDSS_SPEC.md` 细节）。
- Pathway Agent：院内路径/国家规范/地区策略 → 可执行清单（检查、复查、隔离/上报节点），需人工确认留痕。
- Referral & Reporting Agent：生成转诊单/上报表/通知书，对齐卫健委/疾控字段，提交前必填校验与审计。
- Follow-up Agent：随访计划（2w/1m/2m…），逾期/未回传提醒，任务派发（护士/公卫）。
- MDT Agent：会诊包（证据卡+病史+检验+时间轴），多人标注/评论/投票，结论回写报告附录。
- Research Agent：队列构建、脱敏导出、数据字典、标签一致性报告。
- Teaching Agent：典型病例库、盲评训练、评分反馈（对比专家+AI 证据）。
- Ops & Model Monitor Agent：性能/漂移/阴阳性比例/失败率/延迟监控，分院区/分设备告警。
- Security & Compliance Agent：敏感访问、导出审计、权限异常、提示词注入/越权防护。

## 2. 事件驱动主链路（简版）
1) 新检查进入队列（QIDO 发现）或医生点选 → 触发预处理/QC。
2) 影像获取（WADO）→ 预处理（重采样/窗宽窗位/肺野分割/QC 标签）。
3) 模型编排：多模型并行 → 聚合 findings+masks+measurements+model_version。
4) 证据卡生成：ROI/切片范围/截图（肺窗/纵隔窗）/mask URI/置信区间。
5) 上下文 Join：EMR/RIS/LIS（症状/检验/流调）汇总 context_pack。
6) CDSS：风险分层+鉴别矩阵+建议任务；输出报告草稿句子与 trace_links。
7) Pathway：基于高危/疑似生成“可执行清单”（隔离/补检/复查时间点）。
8) 任务流：医生采纳/修改/拒绝 → 写审计；任务派发到护士/公卫/技师。
9) 报告：医生确认 → 回写 DICOM SR/GSPS、RIS/FHIR；转诊/上报表单校验+提交。
10) 随访：Follow-up Agent 创建计划，追踪逾期/未回传；队列升权提醒。
11) 反馈闭环：医生修改点/最终诊断/随访结果进入弱监督标签；Ops 监控性能漂移。

## 3. 核心数据契约（补充 `CDSS_SPEC.md`）
### 通用元信息
```
audit_meta: { actor_id, role, timestamp, source_agent, model_version, threshold, context_pack_id }
evidence_ref: { type: finding|lab|symptom|epi|history, ref_id, slice_range?, mask_uri? }
```
### 任务对象（任务化建议、随访、转诊）
```
task {
  id, type: lab|imaging|referral|followup|consult|mdt,
  title, description,
  due_at | due_offset_days,
  payload: { form_id, fields: {key: value|null}, required_fields: [] },
  rationale: [evidence_ref],
  status: draft|issued|accepted|in_progress|completed|rejected|failed,
  assignee_role: nurse|radiologist|pulmonologist|public_health|technician,
  audit: [events]
}
```
### 队列与状态机
- 患者/检查队列状态：`待筛查 -> 待补检 -> 待随访 -> 随访中 -> 关闭`；逾期标记可叠加。
- 任务状态：`draft -> issued -> accepted -> completed / rejected / failed`。
- MDT：`created -> invited -> in_session -> concluded -> archived`。

## 4. API 契约（示例）
- `/preprocess/run`：入参 study/series；回 lung_mask、qc_tags、窗宽窗位建议。
- `/ai/infer`：影像推理，回 findings+masks+measurements（含 model_version/threshold）。
- `/evidence/build`：生成证据卡（截图/ROI/trace）。
- `/context/fetch`：汇总 EMR/RIS/LIS，返回 context_pack。
- `/cdss/infer`：见 `CDSS_SPEC.md`。
- `/pathway/plan`：入参 risk tier + context → 返回可执行清单（隔离/检查/复查节点）。
- `/tasks`：CRUD+状态流转（采纳/拒绝/完成），写审计。
- `/report/draft`：生成所见/印象/建议句子 + trace_links。
- `/report/submit`：写 DICOM SR/GSPS + RIS/FHIR + 上报接口；必填校验。
- `/referral/submit`：生成转诊/通知书 PDF + 结构化 JSON；校验缺失字段。
- `/followup/plan`：生成随访节点；`/followup/track` 记录到检/未到检/检验回传。
- `/mdt/session`：创建/邀请/记录评论与投票，产出结论回写报告附录。
- `/ops/metrics`：指标上报；`/ops/alert` 告警输出。
- `/security/audit`：审计日志落库；敏感操作告警。

## 5. UI 落点（三栏 + 任务/MDT）
- 左栏队列：`待筛查/待补检/待随访/逾期未到检`；可按风险 tier/逾期排序。
- 中栏影像：阅片、盲评/显影切换、ROI 跳转；支持时间轴对比。
- 右栏 Agent 区：
  - 风险仪表盘：tier/score + Top-3 驱动因素（可跳转 ROI/检验）。
  - 鉴别矩阵：候选 dx 行展开支持/反证/推荐检查。
  - 建议清单 → 任务按钮（采纳/修改/拒绝）状态同步。
  - 转诊/上报表单：校验缺失字段，提交写审计。
  - 随访计划：节点列表、逾期提醒。
  - MDT 卡片：会诊包、参会者、投票、结论。
  - 审计提示：高危需二次确认/MDT；修改显示修改人和时间。

## 6. 审计与合规
- 每个结论/句子/任务/提交都需 trace 到 evidence_ref + model_version + threshold + actor + timestamp。
- 高危（空洞+IGRA阳性+密接等）默认需双签或 MDT；规则可配置。
- 数据导出与敏感字段访问记录审计；异常权限/提示词注入告警。
- 上报/转诊表单缺必填即阻断提交，记录校验失败原因。

## 7. 运营与监控
- 指标：成功率、延迟、输出完整度、阴阳性比例、漂移检测、失败率、告警次数；按院区/设备/地区分层。
- 兜底：推理/上下文/任务下发失败时提示“系统降级”，并写 audit。
- SLA 建议：影像推理 < 5s，CDSS < 2s，任务落库/表单校验 < 500ms。

## 8. 安全
- 角色与最小权限：影像科、呼吸科、感染科、公卫、护士、技师、科研/教学、Ops。
- 对聊天/自动报告的越权防护：限制提示词、敏感字段脱敏、输出前审计。

## 9. 落地路线（扩展到全功能）
- Phase 1 已有：基础 UI + 证据卡概念 + CDSS 规格（需实现）。
- Phase 2：任务流+Pathway+转诊/上报表单+随访队列+审计落库。
- Phase 3：MDT、教学、科研队列、脱敏导出、标签一致性。
- Phase 4：区域化上报、Ops 漂移监控、Security 异常告警。

## 10. 对接与数据源
- 影像：DICOMweb QIDO/WADO/STOW；GSPS/SR 回写。
- 临床/检验：FHIR/HL7 或院内 API；确保来源与时间戳记录。
- 报告/上报：DICOM SR、RIS/FHIR、卫健委/疾控结构化接口。
