@echo off

REM Start backend
start cmd /k "cd /d %~dp0backend && call ..\.venv\Scripts\activate && python -m server_app.app"

REM Give backend time to start
timeout /t 6 /nobreak >nul

REM Start frontend
start cmd /k "cd /d %~dp0frontend && npm run dev"

REM Wait for frontend
timeout /t 3 /nobreak >nul

REM Open browser
start http://localhost:5178