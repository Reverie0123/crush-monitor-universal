@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Reinstall when package-lock.json changed (after updating to a new version).
set "NEED_INSTALL="
if not exist node_modules\.install-stamp set NEED_INSTALL=1
if exist node_modules\.install-stamp (
  fc /b package-lock.json node_modules\.install-stamp >nul 2>&1 || set NEED_INSTALL=1
)
if defined NEED_INSTALL (
  echo 首次运行或依赖有更新：正在安装依赖，需要一两分钟...
  call npm.cmd ci || goto :fail
  copy /y package-lock.json node_modules\.install-stamp >nul
)
if not exist .env call npm.cmd run setup
set "PORT=3178"
for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORT=" .env 2^>nul') do if not "%%b"=="" set "PORT=%%b"
echo 正在更新网页...
call npx.cmd vite build --logLevel warn || goto :fail
rem Open the page only once the server answers, instead of racing it.
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest http://127.0.0.1:%PORT%/api/health -UseBasicParsing -TimeoutSec 1 | Out-Null; Start-Process 'http://127.0.0.1:%PORT%/'; break}catch{Start-Sleep -Seconds 1}}"
echo 服务启动中，网页会自动打开。使用期间请不要关闭这个窗口。
call npm.cmd start
pause
exit /b
:fail
echo.
echo 安装或构建失败。请确认已安装 Node.js 22.12 以上版本，并把上面的报错截图反馈。
pause