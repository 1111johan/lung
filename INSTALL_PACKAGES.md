# 📦 安裝項目依賴指南

## 前置要求

在安裝項目依賴之前，需要先安裝 **Node.js** 和 **npm**。

## 快速安裝

### 方法 1: 使用自動安裝腳本（推薦）

```bash
cd /Users/xuai/Desktop/cursor—file/lung/project
./install-dependencies.sh
```

腳本會自動：
- 檢查 Node.js 和 npm 是否已安裝
- 顯示需要安裝的依賴列表
- 自動安裝所有依賴

### 方法 2: 手動安裝

如果已安裝 Node.js，直接執行：

```bash
cd /Users/xuai/Desktop/cursor—file/lung/project
npm install
```

## 安裝 Node.js（如果未安裝）

### 選項 A: 官方安裝包（最簡單）

1. 訪問 https://nodejs.org/
2. 下載 **LTS 版本**（推薦）
3. 雙擊 `.pkg` 文件安裝
4. 按照安裝向導完成

### 選項 B: 使用 Homebrew

```bash
# 如果未安裝 Homebrew，先安裝
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安裝 Node.js
brew install node
```

### 驗證安裝

安裝完成後，在終端執行：

```bash
node --version
npm --version
```

應該顯示版本號，例如：
```
v20.10.0
10.2.3
```

## 項目依賴說明

### 生產依賴（Production Dependencies）

| 包名 | 版本 | 用途 |
|------|------|------|
| `@supabase/supabase-js` | ^2.39.0 | Supabase 客戶端 SDK |
| `lucide-react` | ^0.303.0 | 圖標庫 |
| `react` | ^18.2.0 | React 框架 |
| `react-dom` | ^18.2.0 | React DOM 渲染 |

### 開發依賴（Dev Dependencies）

| 包名 | 用途 |
|------|------|
| `typescript` | TypeScript 編譯器 |
| `vite` | 構建工具和開發服務器 |
| `@vitejs/plugin-react` | Vite React 插件 |
| `tailwindcss` | CSS 框架 |
| `autoprefixer` | CSS 後處理器 |
| `postcss` | CSS 轉換工具 |
| `eslint` | 代碼檢查工具 |
| `@typescript-eslint/*` | TypeScript ESLint 插件 |

## 安裝過程

安裝過程會：
1. 下載所有依賴包
2. 解析依賴關係
3. 安裝到 `node_modules/` 文件夾
4. 生成 `package-lock.json` 鎖定版本

**預計時間**: 2-5 分鐘（取決於網絡速度）

## 常見問題

### 1. 安裝速度慢

使用國內鏡像加速：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 2. 權限錯誤

```bash
# 修復 npm 權限（不推薦使用 sudo）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### 3. 清除緩存重新安裝

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 4. 端口被佔用

如果 3000 端口被佔用，修改 `vite.config.ts`：

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // 更改端口
  }
});
```

## 安裝完成後

1. **配置環境變數**：
   ```bash
   cp .env.example .env
   # 編輯 .env 文件填入 Supabase 配置
   ```

2. **啟動開發服務器**：
   ```bash
   npm run dev
   ```

3. **構建生產版本**：
   ```bash
   npm run build
   ```

## 檢查安裝狀態

```bash
# 檢查依賴是否安裝
ls node_modules

# 檢查特定包
npm list react
npm list @supabase/supabase-js

# 檢查過時的包
npm outdated
```

## 更新依賴

```bash
# 檢查可更新的包
npm outdated

# 更新所有依賴到最新版本（謹慎使用）
npm update

# 更新特定包
npm update react
```

