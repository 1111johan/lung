/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 灰度色板 - 深色主题
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          850: '#1a1a1a', // 自定义深灰色
          900: '#0f0f0f', // 自定义最深灰色
        },
        // 主题色 - Teal (青绿色)
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // 风险等级颜色
        risk: {
          high: {
            bg: '#7f1d1d',      // bg-red-900
            text: '#fca5a5',    // text-red-300
            border: '#ef4444',  // border-red-500
            badge: '#991b1b',   // bg-red-900
            badgeText: '#fca5a5', // text-red-300
            progress: '#ef4444', // bg-red-500
            progressText: '#f87171', // text-red-400
          },
          medium: {
            bg: '#78350f',      // bg-yellow-900
            text: '#fde047',    // text-yellow-300
            border: '#eab308',  // border-yellow-500
            badge: '#713f12',   // bg-yellow-900
            badgeText: '#fde047', // text-yellow-300
            progress: '#eab308', // bg-yellow-500
            progressText: '#facc15', // text-yellow-400
          },
          low: {
            bg: '#14532d',      // bg-green-900
            text: '#86efac',    // text-green-300
            border: '#22c55e',  // border-green-500
            badge: '#166534',   // bg-green-900
            badgeText: '#86efac', // text-green-300
            progress: '#22c55e', // bg-green-500
            progressText: '#4ade80', // text-green-400
          },
        },
        // AI 分析相关颜色
        ai: {
          blue: {
            bg: 'rgba(30, 58, 138, 0.2)',    // bg-blue-900/20
            border: 'rgba(30, 64, 175, 0.5)', // border-blue-800/50
            accent: '#3b82f6',               // bg-blue-500
            text: '#60a5fa',                // text-blue-400
            pulse: '#3b82f6',               // bg-blue-500
          },
        },
        // 警告/提示颜色
        warning: {
          orange: {
            bg: 'rgba(154, 52, 18, 0.2)',    // bg-orange-900/20
            border: 'rgba(154, 52, 18, 0.5)', // border-orange-800/50
            text: '#fdba74',                 // text-orange-300
          },
        },
      },
      // 字体配置
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      // 间距配置
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // 阴影配置
      boxShadow: {
        'teal-glow': '0 10px 15px -3px rgba(20, 184, 166, 0.3), 0 4px 6px -2px rgba(20, 184, 166, 0.2)',
      },
      // 动画配置
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      // 背景图片配置
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

