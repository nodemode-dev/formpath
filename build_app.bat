@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "OPEN=0"
for %%A in (%*) do (
  if /i "%%~A"=="--open" ( set "OPEN=1" ) else if /i "%%~A"=="--help" ( goto :usage ) else if /i "%%~A"=="-h" ( goto :usage ) else ( call :usage & exit /b 2 )
)

echo.
echo [formpath] == checking the tools
where python >nul 2>nul || ( echo [formpath] Python 3.12 or newer is needed: https://www.python.org/downloads/ & exit /b 1 )
where node >nul 2>nul || ( echo [formpath] Node 22 or newer is needed: https://nodejs.org & exit /b 1 )
where cargo >nul 2>nul || ( echo [formpath] Rust is needed: https://rustup.rs & exit /b 1 )
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do if %%V LSS 22 ( echo [formpath] Node 22 or newer is needed, this is Node %%V: https://nodejs.org & exit /b 1 )
where claude >nul 2>nul && ( echo [formpath] Claude Code found; the app's terminal dock can start it ) || ( echo [formpath] Claude Code is not installed; the app builds without it: https://claude.com/claude-code )

echo.
echo [formpath] == installing the engine and the window
call setup\install_all.bat || goto :failed

echo.
echo [formpath] == installing the desktop packages and checking the Tauri toolchain
call setup\install_desktop.bat || goto :failed

echo.
echo [formpath] == building the window, freezing the engine and building the desktop app
echo [formpath] the first build compiles several hundred Rust crates
call setup\desktop.bat build || goto :failed

echo.
echo [formpath] done. The installers are in src-tauri\target\release\bundle (msi and nsis)
if "%OPEN%"=="1" start "" "src-tauri\target\release\bundle"
exit /b 0

:failed
echo.
echo [formpath] the build stopped at the step above; fix what it says and run build_app.bat again
exit /b 1

:usage
echo build_app.bat           build formpath's desktop app on Windows, start to finish
echo   --open                open the folder with the installers when the build is done
exit /b 0
