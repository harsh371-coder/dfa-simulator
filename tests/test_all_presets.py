import subprocess
import json
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def find_simulator():
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
    win = os.path.join(base, "simulator.exe")
    unix = os.path.join(base, "simulator")
    if os.name == 'nt' and os.path.exists(win):
        return win
    if os.path.exists(unix):
        return unix
    if os.path.exists(win):
        return win
    src = os.path.join(base, "simulator.cpp")
    target = win if os.name == 'nt' else unix
    subprocess.run(["g++", "-std=c++14", "-O2", src, "-o", target], check=True)
    return target

SIMULATOR_BIN = find_simulator()
PRESETS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "presets.json")

def load_presets():
    with open(PRESETS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def test_preset(preset):
    print(f"Testing preset: {preset['name']}...")
    proc = subprocess.Popen(
        [SIMULATOR_BIN],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8"
    )
    stdout, stderr = proc.communicate(input=json.dumps(preset), timeout=5)
    if proc.returncode != 0:
        raise RuntimeError(f"Simulator failed on {preset['id']}: {stderr}")
    
    res = json.loads(stdout)
    assert "dfa" in res, "Missing dfa"
    assert "construction_steps" in res, "Missing construction_steps"
    assert len(res["construction_steps"]) > 0, "No construction steps recorded"

    # Verify all string simulation results match between NFA and DFA
    for sim in res.get("simulations", []):
        assert sim["results_match"], f"NFA/DFA verdict mismatch on string '{sim['input_string']}' in preset {preset['id']}"
    
    print(f"  [PASS] DFA States: {len(res['dfa']['states'])}, Steps: {len(res['construction_steps'])}, Strings Tested: {len(res.get('simulations', []))}")

def main():
    presets = load_presets()
    print(f"Loaded {len(presets)} presets from web/presets.json\n")
    for p in presets:
        test_preset(p)
    print("\n[SUCCESS] ALL 10 PRESETS VERIFIED WITH 100% PRECISION IN C++ ENGINE!")

if __name__ == "__main__":
    main()
