@echo off
setlocal
cd /d "%~dp0.."
if not exist src-tauri\icons\icon.ico call frontend\node_modules\.bin\tauri.cmd icon assets\formpath_icon.png
if /i "%~1"=="build" (
  call setup\build_frontend.bat || exit /b 1
  call setup\freeze_backend.bat || exit /b 1
  call frontend\node_modules\.bin\tauri.cmd build || exit /b 1
  echo [formpath] bundles are in src-tauri\target\release\bundle
) else (
  call setup\freeze_backend.bat || exit /b 1
  call frontend\node_modules\.bin\tauri.cmd dev
)
