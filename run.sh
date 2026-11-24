#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "  Launching Epsilon-NFA to DFA Simulator (C++ Engine)   "
echo "========================================================"

if [ ! -f backend/simulator ]; then
    echo "Compiling C++ backend first..."
    bash build.sh
fi

PORT="${PORT:-8080}"
echo "Starting HTTP Server at http://localhost:$PORT ..."

# Open browser if graphical display available
if command -v xdg-open > /dev/null; then
    (sleep 1 && xdg-open "http://localhost:$PORT") &
elif command -v open > /dev/null; then
    (sleep 1 && open "http://localhost:$PORT") &
fi

python3 server.py
