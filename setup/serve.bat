@echo off
setlocal
cd /d "%~dp0.."
if not exist frontend\dist\index.html call setup\build_frontend.bat
set "FORMPATH_DIST=%cd%\frontend\dist"
cd backend
if not exist venv\Scripts\activate.bat ( echo [formpath] engine venv missing, run formpath.bat install & exit /b 1 )
call venv\Scripts\activate.bat
if not defined FORMPATH_HOST set "FORMPATH_HOST=127.0.0.1"
if not defined FORMPATH_PORT set "FORMPATH_PORT=8230"
echo [formpath] serving http://%FORMPATH_HOST%:%FORMPATH_PORT%
uvicorn app.main:app --host %FORMPATH_HOST% --port %FORMPATH_PORT%
