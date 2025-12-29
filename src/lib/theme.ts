/**
 * 主题配置 - 统一管理所有设计令牌和样式常量
 * 所有颜色、间距、字体等设计元素都在此配置
 */

// 风险等级配置
export const riskLevels = {
  high: {
    label: '高危',
    color: {
      border: 'border-red-500',
      bg: 'bg-red-900/10',
      badge: 'bg-red-900',
      badgeText: 'text-red-300',
      progress: 'bg-red-500',
      progressText: 'text-red-400',
    },
  },
  medium: {
    label: '中危',
    color: {
      border: 'border-yellow-500',
      bg: 'bg-yellow-900/10',
      badge: 'bg-yellow-900',
      badgeText: 'text-yellow-300',
      progress: 'bg-yellow-500',
      progressText: 'text-yellow-400',
    },
  },
  low: {
    label: '低危',
    color: {
      border: 'border-green-500',
      bg: 'bg-green-900/10',
      badge: 'bg-green-900',
      badgeText: 'text-green-300',
      progress: 'bg-green-500',
      progressText: 'text-green-400',
    },
  },
} as const;

// 结核概率阈值配置
export const tbProbabilityThresholds = {
  high: 70,
  medium: 40,
} as const;

// 影像状态配置
export const imageStatus = {
  pending: {
    label: '待审',
    color: 'text-yellow-400',
  },
  reviewing: {
    label: '审阅中',
    color: 'text-yellow-400',
  },
  reviewed: {
    label: '已审阅',
    color: 'text-green-400',
  },
  reported: {
    label: '已报告',
    color: 'text-blue-400',
  },
} as const;

// 报告状态配置
export const reportStatus = {
  draft: {
    label: '草稿',
    color: 'text-gray-400',
  },
  finalized: {
    label: '已定稿',
    color: 'text-green-400',
  },
  reported: {
    label: '已上报',
    color: 'text-blue-400',
  },
} as const;

// 报告类型配置
export const reportTypes = {
  screening: {
    label: '筛查',
  },
  referral: {
    label: '转诊',
  },
  notification: {
    label: '通知',
  },
} as const;

// 活动性判断配置
export const activeTbLikelihood = {
  active: {
    keywords: ['活动', '活动期', '疑似活动期', '高度疑似活动期'],
    color: 'text-yellow-400',
  },
  stable: {
    keywords: ['稳定', '稳定期', '未见明显活动'],
    color: 'text-green-400',
  },
  unknown: {
    keywords: ['需进一步评估', '需临床评估', '需进一步检查'],
    color: 'text-gray-400',
  },
} as const;

// UI 组件样式配置
export const uiStyles = {
  // 按钮样式
  button: {
    primary: 'bg-teal-700 hover:bg-teal-600 text-white py-2.5 rounded text-sm font-medium shadow-lg shadow-teal-900/50 transition-all hover:shadow-teal-900/70',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded text-sm transition-colors',
    outline: 'text-teal-400 border border-teal-400/30 px-2 py-1 rounded hover:bg-teal-400/10 transition-colors',
  },
  // 输入框样式
  input: {
    default: 'bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors',
    textarea: 'bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-300 resize-none focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors font-mono',
  },
  // 卡片样式
  card: {
    default: 'bg-gray-800 border border-gray-700 rounded-lg p-4',
    info: 'bg-blue-900/20 border border-blue-800/50 p-3 rounded-lg',
    warning: 'bg-orange-900/20 border border-orange-800/50 p-3 rounded',
  },
  // 侧边栏样式
  sidebar: {
    default: 'border-r border-gray-700 bg-gray-850 flex flex-col',
    right: 'border-l border-gray-700 bg-gray-850 flex flex-col',
  },
  // 头部样式
  header: {
    default: 'h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between',
  },
} as const;

// 布局配置
export const layout = {
  headerHeight: 'h-14',
  sidebarWidth: 'w-80',
  mainPadding: 'p-4',
} as const;

// 动画配置
export const animations = {
  pulse: 'animate-pulse',
  fadeIn: 'animate-fade-in',
  slideIn: 'animate-slide-in',
} as const;

// 工具函数：根据风险等级获取样式
export function getRiskStyles(riskLevel: 'high' | 'medium' | 'low') {
  return riskLevels[riskLevel];
}

// 工具函数：根据结核概率获取风险等级
export function getRiskLevelFromProbability(probability: number): 'high' | 'medium' | 'low' {
  if (probability >= tbProbabilityThresholds.high) return 'high';
  if (probability >= tbProbabilityThresholds.medium) return 'medium';
  return 'low';
}

// 工具函数：根据活动性判断获取颜色
export function getActiveTbColor(likelihood: string | null): string {
  if (!likelihood) return activeTbLikelihood.unknown.color;
  
  for (const [, config] of Object.entries(activeTbLikelihood)) {
    if (config.keywords.some(keyword => likelihood.includes(keyword))) {
      return config.color;
    }
  }
  
  return activeTbLikelihood.unknown.color;
}

// 工具函数：获取影像状态样式
export function getImageStatusStyle(status: keyof typeof imageStatus) {
  return imageStatus[status];
}
