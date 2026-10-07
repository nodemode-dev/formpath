@echo off
setlocal
cd /d "%~dp0"
set "CMD=%~1"
if "%CMD%"=="" set "CMD=boot"
if not "%~1"=="" shift
set "REST="
:collect
if "%~1"=="" goto dispatch
set "REST=%REST% %1"
shift
goto collect
:dispatch
if /i "%CMD%"=="boot" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="dev" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="install" ( call setup\install_all.bat %REST% & goto :eof )
if /i "%CMD%"=="install-desktop" ( call setup\install_desktop.bat & goto :eof )
if /i "%CMD%"=="backend" ( call setup\boot_backend.bat & goto :eof )
if /i "%CMD%"=="frontend" ( call setup\boot_frontend.bat & goto :eof )
if /i "%CMD%"=="build" ( call setup\build_frontend.bat & goto :eof )
if /i "%CMD%"=="serve" ( call setup\serve.bat & goto :eof )
if /i "%CMD%"=="freeze" ( call setup\freeze_backend.bat & goto :eof )
if /i "%CMD%"=="desktop" ( call setup\desktop.bat %REST% & goto :eof )
if /i "%CMD%"=="doctor" ( call setup\doctor.bat & goto :eof )
if /i "%CMD%"=="check" ( call setup\check.bat & goto :eof )
if /i "%CMD%"=="counts" ( call setup\counts.bat %REST% & goto :eof )
if /i "%CMD%"=="mcp" ( call setup\python.bat setup\mcp_stdio.py %REST% & goto :eof )
if /i "%CMD%"=="agents" ( call setup\python.bat setup\agents.py %REST% & goto :eof )
if /i "%CMD%"=="clean" ( call setup\clean.bat %REST% & goto :eof )
if /i "%CMD%"=="help" ( call :usage & exit /b 0 )
echo [formpth] unknown command: %CMD%
call :usage
exit /b 2
:usage
echo formpth.bat [command]
echo   boot ^| install ^| install-desktop ^| backend ^| frontend ^| build ^| serve ^| freeze
echo   desktop dev ^| desktop build ^| doctor ^| check ^| counts [--check] ^| mcp ^| agents install^|sync ^| clean [--all] ^| help
exit /b 0
