@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5500
set URL=http://127.0.0.1:%PORT%/index.html
set ADMIN=http://127.0.0.1:%PORT%/quan-ly.html

echo.
echo === SV5T - Xem web tren may (local) ===
echo.

netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if errorlevel 1 (
  echo Dang khoi dong server tai cong %PORT%...
  start "SV5T Web Server" /min cmd /c "cd /d "%~dp0" && python -m http.server %PORT%"
  timeout /t 2 /nobreak >nul
) else (
  echo Server da chay san tai cong %PORT%.
)

echo Mo trinh duyet...
start "" "%URL%"
start "" "%ADMIN%"

echo.
echo  Cổng sinh viên: %URL%
echo  Cổng quản lý:   %ADMIN%
echo.
echo  Giu cua so "SV5T Web Server" de server tiep tuc chay.
echo  Dong cua so do de tat server.
echo.
pause
