@echo off
setlocal
cd /d "%~dp0"
if not exist venv\Scripts\activate.bat ( echo [formpath] engine venv missing, run formpath.bat install & exit /b 1 )
call venv\Scripts\activate.bat
if not defined FORMPATH_HOST set "FORMPATH_HOST=127.0.0.1"
if not defined FORMPATH_PORT set "FORMPATH_PORT=8230"
uvicorn app.main:app --reload --host %FORMPATH_HOST% --port %FORMPATH_PORT%
