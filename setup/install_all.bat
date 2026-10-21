@echo off
setlocal
cd /d "%~dp0.."
echo [formpath] installing the engine service
pushd backend
call oc_install.bat || ( popd & exit /b 1 )
popd
echo [formpath] installing the frontend
pushd frontend
call oc_install.bat || ( popd & exit /b 1 )
popd
echo [formpath] done. Boot with formpath.bat
