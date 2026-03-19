# 安裝 Node.js 指南

## 問題診斷
- ❌ Node.js 未安裝
- ❌ 依賴未安裝
- ✅ .env 文件存在
- ✅ 端口 3000 可用

## 解決方案

### 方法 1：使用官方安裝包（最簡單）

1. 訪問 https://nodejs.org/
2. 下載 LTS 版本（推薦）
3. 雙擊安裝包並按照提示安裝
4. 安裝完成後，重新打開終端執行：
   ```bash
   cd /Users/xuai/Desktop/cursor—file/lung/project
   npm install
   npm run dev
   ```

### 方法 2：使用 Homebrew（如果已安裝）

```bash
brew install node
```

### 方法 3：使用 nvm（Node Version Manager）

```bash
# 安裝 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新載入終端或執行
source ~/.zshrc

# 安裝 Node.js
nvm install --lts
nvm use --lts
```

## 驗證安裝

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

## 安裝完成後啟動項目

```bash
cd /Users/xuai/Desktop/cursor—file/lung/project
npm install
npm run dev
```

