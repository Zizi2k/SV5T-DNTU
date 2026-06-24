@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo === DANG DAY PROJECT LEN GITHUB: SV5T-DNTU ===
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua co GitHub CLI. Cai bang: winget install GitHub.cli
  pause
  exit /b 1
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo Chua dang nhap GitHub. Cua so dang nhap se mo...
  gh auth login -h github.com -p https -w
)

echo.
echo Tao repo va push...
gh repo create SV5T-DNTU --public --source=. --remote=origin --push

if errorlevel 1 (
  echo.
  echo Thu push neu repo da ton tai...
  git -c safe.directory=%CD% push -u origin main
)

echo.
echo Bat GitHub Pages:
echo   GitHub ^> SV5T-DNTU ^> Settings ^> Pages ^> Branch: main, folder /(root)
echo.
pause
