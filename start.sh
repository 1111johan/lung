#!/bin/bash

# GXMU TB-Agent 啟動腳本

echo "🚀 正在啟動 GXMU TB-Agent..."

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未找到 Node.js"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 錯誤: 未找到 npm"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"

# 進入項目目錄
cd "$(dirname "$0")"

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

# 檢查環境變數文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件"
    if [ -f ".env.example" ]; then
        echo "📝 正在創建 .env 文件..."
        cp .env.example .env
        echo "⚠️  請編輯 .env 文件並填入 Supabase 配置"
    fi
fi

# 啟動開發服務器
echo "🌐 正在啟動開發服務器..."
npm run dev

