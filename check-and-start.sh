#!/bin/bash

# 檢查並啟動項目腳本

echo "🔍 正在檢查環境..."

# 檢查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安裝: $NODE_VERSION"
else
    echo "❌ Node.js 未安裝"
    echo ""
    echo "請選擇安裝方式："
    echo "1. 訪問 https://nodejs.org/ 下載安裝（推薦）"
    echo "2. 使用 Homebrew: brew install node"
    echo "3. 使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo ""
    echo "詳細說明請查看 INSTALL_NODE.md"
    exit 1
fi

# 檢查 npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm 已安裝: $NPM_VERSION"
else
    echo "❌ npm 未安裝"
    exit 1
fi

# 進入項目目錄
cd "$(dirname "$0")"
echo "📁 項目目錄: $(pwd)"

# 檢查依賴
if [ ! -d "node_modules" ]; then
    echo "📦 正在安裝依賴..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依賴安裝失敗"
        exit 1
    fi
    echo "✅ 依賴安裝完成"
else
    echo "✅ 依賴已存在"
fi

# 檢查環境變數
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件"
    if [ -f ".env.example" ]; then
        echo "📝 正在創建 .env 文件..."
        cp .env.example .env
        echo "⚠️  請編輯 .env 文件並填入 Supabase 配置"
    fi
else
    echo "✅ .env 文件存在"
fi

# 檢查端口
if lsof -ti:3000 &> /dev/null; then
    echo "⚠️  警告: 端口 3000 已被佔用"
    echo "正在嘗試終止佔用端口的進程..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 啟動開發服務器
echo ""
echo "🚀 正在啟動開發服務器..."
echo "📱 服務器將在 http://localhost:3000 啟動"
echo ""

npm run dev

