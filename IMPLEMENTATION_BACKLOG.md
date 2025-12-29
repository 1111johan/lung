# 实施任务清单（多智能体全功能落地）

按阶段给出可执行 backlog，便于分工与排期。

## Phase 1（CDSS 核心上线）
- 后端：实现 `/preprocess/run`、`/ai/infer`、`/context/fetch`、`/cdss/infer`（参见 `CDSS_SPEC.md`），返回结构化 risk/differentials/tasks/trace_links。
- 前端：右侧栏风险仪表盘 + 鉴别矩阵 + 建议清单（任务化按钮）；证据卡跳转 ROI。
- 审计：落库 audit_meta（输入版本、模型版本、阈值、生成时间、用户操作）。
- 阈值配置：高危规则（score>=0.75 或含高危证据） + 双签/MDT 标记。

## Phase 2（任务流 + 转诊/随访闭环）
- Pathway Agent：`/pathway/plan` 输出可执行清单；前端采纳/修改/拒绝流程。
- 任务流：`/tasks` CRUD + 状态机（draft→issued→accepted→completed/rejected/failed）；任务派发到角色。
- 转诊/上报：`/referral/submit` 表单必填校验，生成 PDF + JSON，写审计。
- 随访：`/followup/plan` 生成节点，`/followup/track` 记录到检/未到检/检验回传，队列 Tab 支持待随访/逾期。
- 队列状态：左侧支持待筛查/待补检/待随访/逾期排序。

## Phase 3（MDT、教学、科研）
- MDT Agent：`/mdt/session` 创建/邀请/评论/投票，结论回写报告附录；前端会诊包卡片。
- 教学：典型病例库列表、盲评任务、评分对比专家+AI 证据。
- 科研：队列构建查询（条件+自然语言），脱敏导出、数据字典、标签一致性报告。

## Phase 4（Ops、Security、区域化）
- Ops & Model Monitor：`/ops/metrics` 上报，仪表盘显示成功率/延迟/漂移；告警规则。
- Security & Compliance：敏感字段访问/导出审计，越权/注入检测提示。
- 区域化上报：对接卫健委/疾控接口，支持多院区设备维度。

## 通用需求
- 性能：推理 <5s，CDSS <2s，任务/表单 <500ms；超时降级并提示。
- 兜底：推理/上下文/任务失败时提示“系统降级”，写审计；允许手动补录。
- 配置：阈值、双签策略、必填字段、随访节奏可配置。
- 日志：全链路 trace_id；错误栈摘要存储；高危提交需确认事件。
