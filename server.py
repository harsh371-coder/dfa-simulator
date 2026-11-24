import http.server
import socketserver
import json
import subprocess
import os
import sys
import webbrowser
from urllib.parse import urlparse

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 8080))
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

def get_simulator_bin():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    win_bin = os.path.join(backend_dir, "simulator.exe")
    unix_bin = os.path.join(backend_dir, "simulator")

    if os.name == 'nt' and os.path.exists(win_bin):
        return win_bin
    if os.path.exists(unix_bin):
        return unix_bin
    if os.path.exists(win_bin):
        return win_bin

    # Auto-compile if g++ is installed
    src = os.path.join(backend_dir, "simulator.cpp")
    target = win_bin if os.name == 'nt' else unix_bin
    if os.path.exists(src):
        try:
            print(f"[*] Compiling C++ backend from {src} to {target}...")
            subprocess.run(["g++", "-std=c++14", "-O2", src, "-o", target], check=True)
            if os.path.exists(target):
                print(f"[✓] Successfully compiled {target}")
                return target
        except Exception as e:
            print(f"[!] Auto-compilation warning: {e}")

    return win_bin if os.name == 'nt' else unix_bin

class DFASimulatorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for dev
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            sim_bin = get_simulator_bin()
            resp = {
                "status": "ok",
                "engine": "C++ Native (Windows)" if os.name == 'nt' else "C++ Native (Linux/Unix)",
                "binary_path": os.path.basename(sim_bin),
                "binary_exists": os.path.exists(sim_bin)
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # Serve static files from web/
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path in ["/api/convert", "/api/simulate"]:
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length).decode("utf-8")

            sim_bin = get_simulator_bin()
            if not os.path.exists(sim_bin):
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                err = {"error": f"C++ Simulator binary not found at {sim_bin}. Please run g++ to compile backend/simulator.cpp."}
                self.wfile.write(json.dumps(err).encode("utf-8"))
                return

            try:
                # Run the compiled C++ simulator binary
                process = subprocess.Popen(
                    [sim_bin],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8"
                )
                stdout_data, stderr_data = process.communicate(input=post_data, timeout=10)

                if process.returncode != 0:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    err = {"error": stderr_data or stdout_data or "Simulator exited with non-zero code."}
                    self.wfile.write(json.dumps(err).encode("utf-8"))
                    return

                # Validate JSON output from C++
                json_result = json.loads(stdout_data)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(json_result).encode("utf-8"))

            except subprocess.TimeoutExpired:
                process.kill()
                self.send_response(504)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Simulator execution timed out"}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    port = PORT
    for attempt in range(5):
        try:
            server = socketserver.ThreadingTCPServer(("", port), DFASimulatorHandler)
            server.daemon_threads = True
            sim_bin = get_simulator_bin()
            print(f"==================================================")
            print(f"  Epsilon-NFA to DFA Simulator (C++ Engine) Server")
            print(f"  URL:         http://localhost:{port}")
            print(f"  Static Root: {WEB_DIR}")
            print(f"  C++ Binary:  {sim_bin} (Exists: {os.path.exists(sim_bin)})")
            print(f"==================================================")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down server.")
                server.shutdown()
            break
        except OSError as e:
            if "Address already in use" in str(e) or e.errno == 10048:
                port += 1
            else:
                raise e

if __name__ == "__main__":
    run_server()
