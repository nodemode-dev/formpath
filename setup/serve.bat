@echo off
setlocal
cd /d "%~dp0.."
if not exist frontend\dist\index.html call setup\build_frontend.bat
set "FORMPTH_DIST=%cd%\frontend\dist"
cd backend
if not exist venv\Scripts\activate.bat ( echo [formpth] engine venv missing, run formpth.bat install & exit /b 1 )
call venv\Scripts\activate.bat
if not defined FORMPTH_HOST set "FORMPTH_HOST=127.0.0.1"
if not defined FORMPTH_PORT set "FORMPTH_PORT=8230"
echo [formpth] serving http://%FORMPTH_HOST%:%FORMPTH_PORT%
uvicorn app.main:app --host %FORMPTH_HOST% --port %FORMPTH_PORT%
