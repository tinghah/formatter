@echo off
title Excel Formatter - Starting...
color 0A
echo.
echo   ============================================
echo         Excel Formatter - One Click Start
echo   ============================================
echo.

cd /d "%~dp0"

REM ── Check if node_modules exist, install if not ──
if not exist "node_modules" (
    echo   [*] Installing root dependencies...
    call npm install
    echo.
)

if not exist "client\node_modules" (
    echo   [*] Installing client dependencies...
    cd client
    call npm install
    cd ..
    echo.
)

echo   [1/2] Starting Backend Server on port 5555...
start "ExcelFormatter-Server" /MIN cmd /c "node server/index.js"
timeout /t 2 /nobreak >nul

echo   [2/2] Starting Frontend Dev Server on port 8181...
start "ExcelFormatter-Client" /MIN cmd /c "cd client && npx vite --port 8181 --host"
timeout /t 3 /nobreak >nul

echo.
echo   ╔══════════════════════════════════════╗
echo   ║  ✅  Both servers are running!       ║
echo   ║                                      ║
echo   ║  Backend:  http://localhost:5555      ║
echo   ║  Frontend: http://localhost:8181      ║
echo   ╚══════════════════════════════════════╝
echo.

start http://localhost:8181
echo   Browser opened. Press any key to close this window...
pause > nul
