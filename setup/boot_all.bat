@echo off
setlocal
cd /d "%~dp0.."
start "formpath engine" cmd /k "cd /d %cd%\backend && boot_backend.bat"
start "formpath frontend" cmd /k "cd /d %cd%\frontend && boot_frontend.bat"
echo [formpath] frontend http://localhost:5230 and engine http://127.0.0.1:8230
