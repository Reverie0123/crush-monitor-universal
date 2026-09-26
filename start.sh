#!/usr/bin/env bash
# Mac / Linux: installs on first run (and again after an update), builds the
# page, starts the server and opens it in the browser. Same steps as 启动.bat.
cd "$(dirname "$0")" || exit 1

fail() {
  echo
  echo "安装或构建失败。请确认已安装 Node.js 22.12 以上版本，并把上面的报错截图反馈。"
  echo "Install or build failed. Make sure Node.js 22.12+ is installed (https://nodejs.org)."
  exit 1
}

command -v npm >/dev/null 2>&1 || fail

# Reinstall when package-lock.json changed (after updating to a new version).
if ! cmp -s package-lock.json node_modules/.install-stamp 2>/dev/null; then
  echo "首次运行或依赖有更新：正在安装依赖，需要一两分钟… / Installing dependencies…"
  npm ci || fail
  cp package-lock.json node_modules/.install-stamp
fi
[ -f .env ] || npm run setup || fail

PORT=$(grep -E '^PORT=' .env 2>/dev/null | tail -n 1 | cut -d= -f2 | tr -d '\r ')
URL="http://127.0.0.1:${PORT:-3178}/"

echo "正在更新网页… / Building the page…"
npx vite build --logLevel warn || fail

# Open the page only once the server answers, instead of racing it.
(
  for _ in $(seq 1 60); do
    if curl -fs "${URL}api/health" >/dev/null 2>&1; then
      open "$URL" 2>/dev/null || xdg-open "$URL" >/dev/null 2>&1
      exit 0
    fi
    sleep 1
  done
) &

echo "服务启动中，网页会自动打开。使用期间请不要关闭这个窗口。"
echo "Starting; the page opens by itself. Keep this window open while you use it."
exec npm start
