@echo off
setlocal
set "PY=%~dp0..\backend\venv\Scripts\python.exe"
if exist "%PY%" ( "%PY%" %* & exit /b )
where py >nul 2>nul && ( py -3 %* & exit /b )
python %*
exit /b %ERRORLEVEL%
