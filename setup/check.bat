@echo off
setlocal
cd /d "%~dp0.."
set "FAIL=0"
set "PY=backend\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
echo [formpath] frontend typecheck and build
pushd frontend
call npm run build --silent || set "FAIL=1"
popd
echo [formpath] engine compile
"%PY%" -m compileall -q backend\app || set "FAIL=1"
echo [formpath] engine self-check
"%PY%" backend\formpath_engine.py --selfcheck || set "FAIL=1"
"%PY%" setup\agents.py sync --check || set "FAIL=1"
exit /b %FAIL%
