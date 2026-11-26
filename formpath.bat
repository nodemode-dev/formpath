@echo off
setlocal
cd /d "%~dp0"
set "CMD=%~1"
if "%CMD%"=="" set "CMD=boot"
set "PYS="
if /i "%CMD%"=="boot" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="dev" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="install" ( call setup\install_all.bat %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="install-desktop" ( call setup\install_desktop.bat & goto :eof )
if /i "%CMD%"=="backend" ( call setup\boot_backend.bat & goto :eof )
if /i "%CMD%"=="frontend" ( call setup\boot_frontend.bat & goto :eof )
if /i "%CMD%"=="build" ( call setup\build_frontend.bat & goto :eof )
if /i "%CMD%"=="serve" ( call setup\serve.bat & goto :eof )
if /i "%CMD%"=="freeze" ( call setup\freeze_backend.bat & goto :eof )
if /i "%CMD%"=="desktop" ( call setup\desktop.bat %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="doctor" ( call setup\doctor.bat & goto :eof )
if /i "%CMD%"=="check" ( call setup\check.bat & goto :eof )
if /i "%CMD%"=="counts" ( call setup\counts.bat %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="mcp" set "PYS=setup\mcp_stdio.py"
if /i "%CMD%"=="mcpb" set "PYS=setup\mcpb.py"
if /i "%CMD%"=="i18n" set "PYS=setup\i18n.py"
if /i "%CMD%"=="cli" set "PYS=setup\cli.py"
if /i "%CMD%"=="claude" set "PYS=setup\claude_launch.py"
if /i "%CMD%"=="agents" set "PYS=setup\agents.py"
if defined PYS setup\python.bat "%~dp0setup\bat_args.py" %PYS% %*
if /i "%CMD%"=="clean" ( call setup\clean.bat %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="help" ( call :usage & exit /b 0 )
echo [formpath] unknown command: %CMD%
call :usage
exit /b 2
:usage
echo formpath.bat [command]
echo   boot ^| install ^| install-desktop ^| backend ^| frontend ^| build ^| serve ^| freeze
echo   desktop dev ^| desktop build ^| doctor ^| check ^| counts [--check] ^| mcp [--attach] ^| mcpb check^|build DIR ^| cli list^|describe^|run ^| claude [args] ^| agents install^|sync ^| clean [--all] ^| help
exit /b 0
