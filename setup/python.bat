@echo off
setlocal
set "PY=%~dp0..\backend\venv\Scripts\python.exe"
if not exist "%PY%" goto nopy
"%PY%" %*
exit /b
:nopy
where py >nul 2>nul
if errorlevel 1 goto nolauncher
py -3 %*
exit /b
:nolauncher
python %*
exit /b %ERRORLEVEL%
