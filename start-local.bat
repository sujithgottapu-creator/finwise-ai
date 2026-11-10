@echo off
title FinWise AI Local Server
echo ======================================================
echo Starting FinWise AI Local Development Servers
echo ======================================================

set "PATH=C:\Program Files\nodejs;%PATH%"

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start /B "" "c:\Users\nough\Downloads\finwise-ai\finwise-ai\backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

timeout /t 2 /nobreak >nul

echo [2/2] Starting Next.js Production Frontend on http://localhost:3000 ...
cd /D "c:\Users\nough\Downloads\finwise-ai\finwise-ai\frontend"
"C:\Program Files\nodejs\npm.cmd" run start
pause
