@echo off
setlocal
cd /d "%~dp0.."
set "ROOT=%cd%"
if not exist backend\venv\Scripts\activate.bat ( echo [formpath] engine venv missing, run formpath.bat install & exit /b 1 )
call backend\venv\Scripts\activate.bat
python -c "import PyInstaller" >nul 2>nul || ( echo [formpath] PyInstaller missing, run formpath.bat install-desktop & exit /b 1 )
if defined FORMPATH_TARGET ( set "TRIPLE=%FORMPATH_TARGET%" ) else ( for /f "tokens=2" %%t in ('rustc -vV ^| findstr /b "host:"') do set "TRIPLE=%%t" )
if not defined TRIPLE ( echo [formpath] rustc not found, install Rust or set FORMPATH_TARGET & exit /b 1 )
if not exist frontend\dist\index.html call setup\build_frontend.bat
cd backend
if exist build\pyinstaller rmdir /s /q build\pyinstaller
if exist dist-engine rmdir /s /q dist-engine
pyinstaller --noconfirm --clean --onefile --name formpath-engine --distpath dist-engine --workpath build\pyinstaller --specpath build\pyinstaller --add-data "%ROOT%\frontend\dist;frontend_dist" --collect-submodules app --collect-submodules uvicorn --collect-submodules keyring --collect-data spellchecker --collect-submodules fontTools "%ROOT%\backend\formpath_engine.py" || exit /b 1
if not exist "%ROOT%\src-tauri\binaries" mkdir "%ROOT%\src-tauri\binaries"
copy /y dist-engine\formpath-engine.exe "%ROOT%\src-tauri\binaries\formpath-engine-%TRIPLE%.exe" >nul
"%ROOT%\src-tauri\binaries\formpath-engine-%TRIPLE%.exe" --selfcheck
