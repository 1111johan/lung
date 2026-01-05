# 🚀 快速啟動指南

## ⚠️ 當前問題

**錯誤**: `ERR_CONNECTION_REFUSED` - 無法連接到 localhost:3000

**原因**: Node.js 未安裝，開發服務器無法啟動

## ✅ 解決方案（3 步）

### 步驟 1: 安裝 Node.js

**選項 A - 官方安裝包（最簡單，推薦）:**
1. 訪問: https://nodejs.org/
2. 下載 LTS 版本（左側綠色按鈕）
3. 雙擊 `.pkg` 文件安裝
4. 按照安裝向導完成安裝

**選項 B - 使用終端安裝 Homebrew + Node.js:**
```bash
# 安裝 Homebrew（如果未安裝）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安裝 Node.js
brew install node
```

### 步驟 2: 驗證安裝

打開終端，執行：
```bash
node --version
npm --version
```

應該顯示版本號（例如 v20.10.0）

### 步驟 3: 啟動項目

在終端執行：
```bash
cd /Users/xuai/Desktop/cursor—file/lung/project
npm install
npm run dev
```

服務器將在 http://localhost:3000 啟動，瀏覽器會自動打開。

## 📝 一鍵啟動命令

安裝 Node.js 後，執行：
```bash
cd /Users/xuai/Desktop/cursor—file/lung/project && npm install && npm run dev
```

## 🔧 如果遇到問題

1. **端口被佔用**: 修改 `vite.config.ts` 中的端口號
2. **依賴安裝失敗**: 執行 `npm cache clean --force` 後重試
3. **權限問題**: 使用 `sudo`（不推薦）或修復 npm 權限

## 📞 需要幫助？

查看詳細文檔：
- `INSTALL_NODE.md` - Node.js 安裝詳細指南
- `README.md` - 項目完整文檔

