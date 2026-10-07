@echo off
setlocal
set "PY=%~dp0..\backend\venv\Scripts\python.exe"
if exist "%PY%" ( "%PY%" %* & exit /b %ERRORLEVEL% )
where py >nul 2>nul && ( py -3 %* & exit /b %ERRORLEVEL% )
python %*
exit /b %ERRORLEVEL%
