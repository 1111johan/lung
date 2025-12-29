# GXMU TB-Agent - 肺结核筛查系统

广西医科大学肺结核 AI 筛查工作站系统。

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **后端**: Supabase (PostgreSQL + 实时数据库)

## 项目结构

```
project/
├── src/
│   ├── components/          # React 组件
│   │   ├── Header.tsx       # 顶部导航栏
│   │   ├── PatientQueue.tsx # 患者队列（左侧）
│   │   ├── ImageViewer.tsx  # 影像查看器（中间）
│   │   └── AIAnalysisPanel.tsx # AI 分析面板（右侧）
│   ├── lib/
│   │   ├── supabase.ts      # Supabase 客户端配置
│   │   ├── database.types.ts # 数据库类型定义
│   │   ├── theme.ts         # 主题配置和样式系统
│   │   ├── constants.ts     # 应用常量配置
│   │   └── utils.ts         # 工具函数库
│   ├── App.tsx              # 主应用组件
│   ├── main.tsx             # 应用入口
│   ├── index.css            # 全局样式
│   └── vite-env.d.ts        # Vite 环境类型定义
├── supabase/
│   └── migrations/          # 数据库迁移文件
├── seed-data.sql            # 种子数据
├── tailwind.config.js       # Tailwind CSS 配置
├── postcss.config.js        # PostCSS 配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 构建配置
├── .eslintrc.cjs            # ESLint 配置
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 Supabase 配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 运行数据库迁移

在 Supabase Dashboard 中执行 `supabase/migrations/20251229073045_create_tb_screening_system.sql`

### 4. 导入种子数据（可选）

在 Supabase SQL Editor 中执行 `seed-data.sql`

### 5. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

## 功能特性

- ✅ 患者队列管理
- ✅ DICOM 影像查看器（模拟）
- ✅ AI 分析结果展示
- ✅ 风险等级评估
- ✅ 诊断报告生成
- ✅ 实时数据同步（Supabase）
- ✅ 完整的主题配置系统（所有样式本地化）
- ✅ TypeScript 类型安全
- ✅ 响应式设计

## 数据库架构

系统包含以下主要数据表：

- `patients` - 患者信息
- `medical_images` - 医学影像记录
- `ai_analyses` - AI 分析结果
- `screening_reports` - 筛查报告

详细架构请参考迁移文件。

## 开发

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 设计系统

项目采用统一的设计系统，所有样式配置都在本地管理：

### 主题配置 (`src/lib/theme.ts`)
- 风险等级颜色配置
- UI 组件样式配置
- 状态颜色配置
- 工具函数

### Tailwind 配置 (`tailwind.config.js`)
- 完整的颜色系统
- 自定义间距和字体
- 动画和阴影配置

### 常量配置 (`src/lib/constants.ts`)
- 应用信息
- AI 模型配置
- 影像类型配置
- 默认值配置

所有样式都可以通过修改配置文件进行调整，无需在组件中硬编码。

## 许可证

内部使用 - 广西医科大学

