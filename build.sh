#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Compiling C++ Epsilon-NFA to DFA Engine (Linux/macOS) "
echo "========================================================"

g++ -std=c++14 -O2 backend/simulator.cpp -o backend/simulator

echo "[SUCCESS] backend/simulator compiled successfully!"
