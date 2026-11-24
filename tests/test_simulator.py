import subprocess
import json
import os
import unittest

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

class TestDFASimulator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SIMULATOR_BIN):
            raise RuntimeError(f"Simulator binary not found at {SIMULATOR_BIN}")

    def run_simulator(self, payload):
        proc = subprocess.Popen(
            [SIMULATOR_BIN],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8"
        )
        stdout, stderr = proc.communicate(input=json.dumps(payload), timeout=5)
        self.assertEqual(proc.returncode, 0, f"Error: {stderr}")
        return json.loads(stdout)

    def test_classic_abb(self):
        payload = {
            "states": ["q0", "q1", "q2", "q3", "q4"],
            "alphabet": ["a", "b"],
            "start_state": "q0",
            "accept_states": ["q4"],
            "transitions": [
                {"from": "q0", "symbol": "a", "to": "q0"},
                {"from": "q0", "symbol": "b", "to": "q0"},
                {"from": "q0", "symbol": "ε", "to": "q1"},
                {"from": "q1", "symbol": "a", "to": "q2"},
                {"from": "q2", "symbol": "b", "to": "q3"},
                {"from": "q3", "symbol": "b", "to": "q4"}
            ],
            "include_dead_state": False,
            "test_strings": ["ab", "aab", "babb", "abb", ""]
        }
        res = self.run_simulator(payload)
        self.assertIn("dfa", res)
        self.assertIn("construction_steps", res)
        self.assertIn("simulations", res)

        for sim in res["simulations"]:
            self.assertTrue(sim["results_match"], f"Mismatch on string '{sim['input_string']}'")

        # 'abb' must be accepted
        abb_sim = next(s for s in res["simulations"] if s["input_string"] == "abb")
        self.assertTrue(abb_sim["accepted"])

        # 'ab' must be rejected (needs abb)
        ab_sim = next(s for s in res["simulations"] if s["input_string"] == "ab")
        self.assertFalse(ab_sim["accepted"])

    def test_cyclic_epsilon(self):
        # Directed loop: q0 -ε-> q1 -ε-> q2 -ε-> q0
        payload = {
            "states": ["q0", "q1", "q2"],
            "alphabet": ["0", "1"],
            "start_state": "q0",
            "accept_states": ["q2"],
            "transitions": [
                {"from": "q0", "symbol": "ε", "to": "q1"},
                {"from": "q1", "symbol": "ε", "to": "q2"},
                {"from": "q2", "symbol": "ε", "to": "q0"},
                {"from": "q0", "symbol": "0", "to": "q1"}
            ],
            "include_dead_state": False,
            "test_strings": ["", "0", "00", "1"]
        }
        res = self.run_simulator(payload)
        # Check epsilon-closure of q0 contains all 3 states
        q0_closure = res["epsilon_closures"]["q0"]
        self.assertEqual(set(q0_closure), {"q0", "q1", "q2"})

        # Since q2 is accepting and in closure of q0, empty string MUST be accepted
        empty_sim = next(s for s in res["simulations"] if s["input_string"] == "")
        self.assertTrue(empty_sim["accepted"])
        self.assertTrue(empty_sim["results_match"])

    def test_dead_state_option(self):
        payload = {
            "states": ["q0", "q1"],
            "alphabet": ["a", "b"],
            "start_state": "q0",
            "accept_states": ["q1"],
            "transitions": [
                {"from": "q0", "symbol": "a", "to": "q1"}
            ],
            "include_dead_state": True,
            "test_strings": ["a", "b", "aa"]
        }
        res = self.run_simulator(payload)
        dfa_states = res["dfa"]["states"]
        self.assertIn("Dead", dfa_states)
        dead_trans = [t for t in res["dfa"]["transitions"] if t["from"] == "Dead"]
        # Dead state must loop to itself on 'a' and 'b'
        self.assertEqual(len(dead_trans), 2)

    def test_single_state(self):
        payload = {
            "states": ["q0"],
            "alphabet": ["x"],
            "start_state": "q0",
            "accept_states": ["q0"],
            "transitions": [
                {"from": "q0", "symbol": "ε", "to": "q0"},
                {"from": "q0", "symbol": "x", "to": "q0"}
            ],
            "include_dead_state": False,
            "test_strings": ["", "x", "xx"]
        }
        res = self.run_simulator(payload)
        for sim in res["simulations"]:
            self.assertTrue(sim["accepted"])
            self.assertTrue(sim["results_match"])

if __name__ == "__main__":
    unittest.main()
