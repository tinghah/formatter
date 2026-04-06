@echo off
echo.
echo  ========================================
echo    Excel Formatter - Stopping Servers
echo  ========================================
echo.

echo  Stopping Node.js servers on ports 5555 and 8181...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5555 ^| findstr LISTENING') do (
  echo  Killing PID %%a (Backend)
  taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8181 ^| findstr LISTENING') do (
  echo  Killing PID %%a (Frontend)
  taskkill /F /PID %%a >nul 2>&1
)

echo.
echo  ✅ Servers stopped.
pause
