import urllib.request
import json
import threading
import time
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import DFASimulatorHandler, PORT
import socketserver

def test_api():
    test_port = 8089
    server = socketserver.TCPServer(("127.0.0.1", test_port), DFASimulatorHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(0.5)

    try:
        # 1. Test /api/health
        url_health = f"http://127.0.0.1:{test_port}/api/health"
        with urllib.request.urlopen(url_health, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            assert data["status"] == "ok"
            assert data["binary_exists"] == True
            print("  [PASS] /api/health OK")

        # 2. Test /api/convert
        url_convert = f"http://127.0.0.1:{test_port}/api/convert"
        sample_payload = {
            "states": ["q0", "q1"],
            "alphabet": ["0", "1"],
            "start_state": "q0",
            "accept_states": ["q1"],
            "transitions": [
                {"from": "q0", "symbol": "0", "to": "q1"},
                {"from": "q0", "symbol": "ε", "to": "q0"}
            ],
            "include_dead_state": False,
            "test_strings": ["0", "1"]
        }
        req = urllib.request.Request(
            url_convert,
            data=json.dumps(sample_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            assert "dfa" in data
            assert len(data["dfa"]["states"]) > 0
            print("  [PASS] /api/convert OK")

        # 3. Test static file serving
        url_index = f"http://127.0.0.1:{test_port}/index.html"
        with urllib.request.urlopen(url_index, timeout=3) as resp:
            content = resp.read().decode("utf-8")
            assert "<!DOCTYPE html>" in content
            assert "ε-NFA to DFA Simulator" in content
            print("  [PASS] Static file serving OK")

        print("\n[SUCCESS] Server integration tests passed!")
    finally:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    test_api()
