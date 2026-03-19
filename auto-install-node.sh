#!/bin/bash

# 自動安裝 Node.js 並啟動項目

echo "🚀 GXMU TB-Agent 自動安裝腳本"
echo "================================"
echo ""

# 檢查是否已安裝 Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js 已安裝: $(node --version)"
    cd "$(dirname "$0")"
    if [ ! -d "node_modules" ]; then
        echo "📦 正在安裝依賴..."
        npm install
    fi
    echo "🌐 正在啟動開發服務器..."
    npm run dev
    exit 0
fi

echo "❌ 未檢測到 Node.js"
echo ""
echo "正在嘗試自動安裝..."

# 方法 1: 檢查並使用 Homebrew
if command -v brew &> /dev/null; then
    echo "📦 使用 Homebrew 安裝 Node.js..."
    brew install node
    if [ $? -eq 0 ]; then
        echo "✅ Node.js 安裝成功"
        cd "$(dirname "$0")"
        npm install
        npm run dev
        exit 0
    fi
fi

# 方法 2: 使用 nvm
echo "📦 嘗試使用 nvm 安裝..."
if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    cd "$(dirname "$0")"
    npm install
    npm run dev
    exit 0
else
    echo "正在安裝 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    cd "$(dirname "$0")"
    npm install
    npm run dev
    exit 0
fi

echo ""
echo "❌ 自動安裝失敗"
echo "請手動安裝 Node.js:"
echo "1. 訪問 https://nodejs.org/ 下載安裝"
echo "2. 或執行: brew install node (需要先安裝 Homebrew)"
echo ""
echo "安裝完成後，執行以下命令啟動項目："
echo "  cd $(dirname "$0")"
echo "  npm install"
echo "  npm run dev"

