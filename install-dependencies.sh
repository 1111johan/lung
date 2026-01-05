#!/bin/bash

# 自動安裝項目依賴腳本

echo "📦 GXMU TB-Agent 依賴安裝腳本"
echo "================================"
echo ""

cd "$(dirname "$0")"

# 檢查 Node.js
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo "✅ Node.js 已安裝: $NODE_VERSION"
        return 0
    elif [ -f /usr/local/bin/node ]; then
        NODE_VERSION=$(/usr/local/bin/node --version)
        echo "✅ Node.js 已安裝: $NODE_VERSION (在 /usr/local/bin)"
        export PATH="/usr/local/bin:$PATH"
        return 0
    elif [ -f /opt/homebrew/bin/node ]; then
        NODE_VERSION=$(/opt/homebrew/bin/node --version)
        echo "✅ Node.js 已安裝: $NODE_VERSION (在 /opt/homebrew/bin)"
        export PATH="/opt/homebrew/bin:$PATH"
        return 0
    else
        echo "❌ Node.js 未安裝"
        return 1
    fi
}

# 檢查 npm
check_npm() {
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo "✅ npm 已安裝: $NPM_VERSION"
        return 0
    elif [ -f /usr/local/bin/npm ]; then
        NPM_VERSION=$(/usr/local/bin/npm --version)
        echo "✅ npm 已安裝: $NPM_VERSION (在 /usr/local/bin)"
        export PATH="/usr/local/bin:$PATH"
        return 0
    elif [ -f /opt/homebrew/bin/npm ]; then
        NPM_VERSION=$(/opt/homebrew/bin/npm --version)
        echo "✅ npm 已安裝: $NPM_VERSION (在 /opt/homebrew/bin)"
        export PATH="/opt/homebrew/bin:$PATH"
        return 0
    else
        echo "❌ npm 未安裝"
        return 1
    fi
}

# 檢查 Node.js
if ! check_node; then
    echo ""
    echo "⚠️  需要先安裝 Node.js"
    echo ""
    echo "請選擇安裝方式："
    echo "1. 訪問 https://nodejs.org/ 下載安裝（推薦）"
    echo "2. 使用 Homebrew: brew install node"
    echo ""
    echo "安裝完成後，重新執行此腳本："
    echo "  ./install-dependencies.sh"
    echo ""
    read -p "是否現在打開 Node.js 下載頁面？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "https://nodejs.org/" 2>/dev/null || echo "請手動訪問 https://nodejs.org/"
    fi
    exit 1
fi

# 檢查 npm
if ! check_npm; then
    echo "❌ npm 未找到，請確保 Node.js 安裝完整"
    exit 1
fi

echo ""
echo "📋 項目依賴列表："
echo "-------------------"
echo "生產依賴："
echo "  - @supabase/supabase-js: ^2.39.0"
echo "  - lucide-react: ^0.303.0"
echo "  - react: ^18.2.0"
echo "  - react-dom: ^18.2.0"
echo ""
echo "開發依賴："
echo "  - TypeScript 相關工具"
echo "  - Vite 構建工具"
echo "  - Tailwind CSS"
echo "  - ESLint"
echo ""

# 檢查是否已安裝
if [ -d "node_modules" ]; then
    echo "📦 檢測到已存在的依賴"
    read -p "是否重新安裝？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  正在刪除舊的依賴..."
        rm -rf node_modules package-lock.json
    else
        echo "✅ 使用現有依賴"
        exit 0
    fi
fi

# 安裝依賴
echo ""
echo "📥 正在安裝依賴..."
echo "這可能需要幾分鐘時間..."
echo ""

npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 依賴安裝成功！"
    echo ""
    echo "下一步："
    echo "1. 配置環境變數（如果還沒有）："
    echo "   cp .env.example .env"
    echo "   然後編輯 .env 文件填入 Supabase 配置"
    echo ""
    echo "2. 啟動開發服務器："
    echo "   npm run dev"
    echo ""
else
    echo ""
    echo "❌ 依賴安裝失敗"
    echo ""
    echo "可能的解決方案："
    echo "1. 檢查網絡連接"
    echo "2. 清除 npm 緩存: npm cache clean --force"
    echo "3. 使用國內鏡像: npm config set registry https://registry.npmmirror.com"
    echo ""
    exit 1
fi

