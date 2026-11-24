@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo  Launching Epsilon-NFA to DFA Simulator (C++ Engine)
echo ========================================================

if not exist backend\simulator.exe (
    echo Compiling C++ backend first...
    call build.bat
    if errorlevel 1 goto :fail
)

echo Starting HTTP Server at http://localhost:8080 ...
start "" http://localhost:8080
python server.py
goto :eof

:fail
echo [ERROR] Failed to initialize simulator.
pause
