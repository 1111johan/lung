# 本地啟動指南

## 前置要求

1. **安裝 Node.js** (版本 18 或更高)
   - 訪問 https://nodejs.org/ 下載安裝
   - 或使用 Homebrew: `brew install node`

2. **驗證安裝**
   ```bash
   node --version
   npm --version
   ```

## 啟動步驟

### 1. 進入項目目錄
```bash
cd /Users/xuai/Desktop/cursor—file/lung/project
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 配置環境變數

創建 `.env` 文件（如果還沒有）：
```bash
cp .env.example .env
```

編輯 `.env` 文件，填入你的 Supabase 配置：
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 啟動開發服務器
```bash
npm run dev
```

服務器將在 `http://localhost:3000` 啟動，瀏覽器會自動打開。

## 快速啟動腳本

你也可以使用以下一鍵啟動命令：

```bash
cd /Users/xuai/Desktop/cursor—file/lung/project && npm install && npm run dev
```

## 常見問題

### Node.js 未找到
- 確保已安裝 Node.js
- 檢查 PATH 環境變數
- 嘗試重新啟動終端

### 端口被佔用
- 修改 `vite.config.ts` 中的端口號
- 或使用 `npm run dev -- --port 3001`

### 依賴安裝失敗
- 清除緩存: `npm cache clean --force`
- 刪除 `node_modules` 和 `package-lock.json` 後重新安裝

## 其他命令

```bash
# 構建生產版本
npm run build

# 預覽生產構建
npm run preview

# 代碼檢查
npm run lint
```

