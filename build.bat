@echo off
echo ========================================================
echo  Compiling C++ Epsilon-NFA to DFA Engine
echo ========================================================
g++ -std=c++14 -O2 backend\simulator.cpp -o backend\simulator.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Compilation failed!
    pause
    exit /b %ERRORLEVEL%
)
echo [SUCCESS] backend\simulator.exe compiled successfully!
