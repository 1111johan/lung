/**
 * 应用常量配置
 * 所有业务相关的常量都在此定义
 */

// 应用信息
export const APP_CONFIG = {
  name: 'GXMU TB-Agent',
  fullName: '广西医科大学肺结核 AI 筛查工作站',
  version: '1.0.0',
  hospital: '广西医科大一附院',
  department: 'PACS',
} as const;

// AI 模型配置
export const AI_MODEL = {
  defaultVersion: 'GX-TB-v4.2',
  versions: ['GX-TB-v4.2', 'GX-TB-v4.1', 'GX-TB-v4.0'],
} as const;

// 影像类型配置
export const IMAGE_TYPES = {
  XRAY: 'X-ray',
  CT: 'CT',
  MRI: 'MRI',
} as const;

// 影像模态配置
export const IMAGE_MODALITIES = {
  DR: 'DR',
  CT: 'CT',
  MRI: 'MRI',
} as const;

// 默认窗口设置
export const DEFAULT_WINDOW_LEVEL = {
  width: 1500,
  level: -600,
} as const;

// 缩放配置
export const ZOOM_CONFIG = {
  min: 0.5,
  max: 3.0,
  step: 0.2,
  default: 1.0,
} as const;

// 患者信息显示配置
export const PATIENT_DISPLAY = {
  nameMaskPattern: (name: string) => {
    if (name.length <= 1) return name;
    return `${name.slice(0, 1)}*${name.slice(-1)}`;
  },
  idDisplayLength: 8,
} as const;

// 日期时间格式配置
export const DATE_FORMAT = {
  display: 'zh-CN',
  dateTime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  } as Intl.DateTimeFormatOptions,
} as const;

// 报告模板配置
export const REPORT_TEMPLATE = {
  default: `影像表现：
{findings}

初步诊断：
{diagnosis}

建议：
1. 完善痰涂片及培养检查
2. 结核抗体检测
3. 必要时行纤支镜检查`,
} as const;

// 页面标题配置
export const PAGE_TITLES = {
  home: '肺结核筛查系统',
  patient: '患者详情',
  report: '报告管理',
} as const;

