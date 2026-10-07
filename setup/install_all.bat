@echo off
setlocal
cd /d "%~dp0.."
echo [formpth] installing the engine service
pushd backend
call oc_install.bat || ( popd & exit /b 1 )
popd
echo [formpth] installing the frontend
pushd frontend
call oc_install.bat || ( popd & exit /b 1 )
popd
echo [formpth] done. Boot with formpth.bat
