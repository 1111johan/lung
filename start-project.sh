#!/bin/bash

# 一鍵啟動項目腳本

cd "$(dirname "$0")"

echo "🔍 檢查環境..."

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Node.js 未安裝！"
    echo ""
    echo "請先安裝 Node.js："
    echo "1. 訪問 https://nodejs.org/ 下載安裝（推薦）"
    echo "2. 或執行: brew install node"
    echo ""
    echo "詳細說明請查看: QUICK_START.md"
    echo ""
    read -p "按 Enter 鍵打開 Node.js 下載頁面..." 
    open "https://nodejs.org/" 2>/dev/null || echo "請手動訪問 https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"

# 安裝依賴
if [ ! -d "node_modules" ]; then
    echo "📦 正在安裝依賴..."
    npm install
fi

# 檢查端口
if lsof -ti:3000 &> /dev/null; then
    echo "⚠️  端口 3000 被佔用，正在清理..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 啟動服務器
echo ""
echo "🚀 正在啟動開發服務器..."
echo "📱 將在 http://localhost:3000 打開"
echo ""

npm run dev

