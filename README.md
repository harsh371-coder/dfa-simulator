# ε-NFA to DFA Simulator & Textbook Visualizer

[![C++14](https://img.shields.io/badge/Engine-C%2B%2B14-blue.svg?logo=c%2B%2B)](https://isocpp.org/)
[![Python](https://img.shields.io/badge/Server-Python_3.8+-green.svg?logo=python)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Ready-2496ed.svg?logo=docker)](https://www.docker.com/)
[![CI](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

A full-stack, mathematically rigorous simulator and textbook-style interactive visualizer that converts any **Nondeterministic Finite Automaton with ε-transitions (ε-NFA)** into an equivalent **Deterministic Finite Automaton (DFA)** using the subset (powerset) construction algorithm, with optional **DFA Minimization** via Hopcroft's partition-refinement algorithm.

The core computational engine is written in **C++14** for optimal performance and formal accuracy, connected to a lightweight, thread-safe Python HTTP server and a modern, side-by-side SVG frontend.

---

## 🌟 Key Highlights

* **100% Textbook-Accurate Diagrams (Pure Straight Lines)**:
  * Directed transitions are rendered as pure straight lines with clean black arrowheads directly between circle perimeters.
  * Start state features an incoming arrow from the left: `---> (q0)`.
  * Accepting / final states are rendered with concentric double circles: `(( qf ))`.
  * Dead / trap states are labeled `D` and positioned cleanly below.
  * Self-loops are rendered as crisp vertical teardrop loops labeled `a, b`.
* **Side-by-Side Modern Interface**:
  * Input configuration and string acceptance testing on the left.
  * Textbook diagram canvas with progressive building animation on the right.
  * Interactive, tabbed transition tables at the bottom.
* **Calm & Smooth Building Animation**:
  * Step-by-step subset construction unfolds at a relaxed, configurable pace (default 2.5s slow).
  * State positions are precalculated and fixed so nodes never jump or jitter.
  * Active states glow with a gentle pulsating halo (`.halo-pulse`).
* **Complete Transition Tables & Mathematical Traces**:
  1. **Converted DFA Transition Table** (with constituent NFA subsets).
  2. **Interactive Subset Construction Trace Table** (click any row to jump the visualizer directly to that step!).
  3. **ε-Closure Table** ($\epsilon\text{-closure}(q)$ for every state $q \in Q$).
  4. **Original ε-NFA Transition Table**.
  5. **Minimized DFA Table & Hopcroft Partitions Log**.
  6. **Batch String Test Suite**.
* **Dual String Acceptance Simulator**:
  * Test any input string (including empty string $\epsilon$) with real-time acceptance verdict and state path traversal.

---

## 📐 Mathematical Algorithms (C++ Core)

1. **Epsilon Closure ($\epsilon\text{-closure}$)**:
   * Computed via visited-set Breadth-First Search (BFS).
   * Robust against cyclic $\epsilon$-transitions ($q_0 \leftrightarrows q_1$), self-loops, and multi-hop cascading chains.
2. **Subset / Powerset Construction**:
   * Evaluates $move(S, a) = \bigcup_{q \in S} \delta(q, a)$ for every input symbol $a \in \Sigma$.
   * Computes target composite state $S' = \epsilon\text{-closure}(move(S, a))$.
   * Handles optional Trap / Dead state ($\emptyset$) transitions.
3. **Hopcroft's DFA Minimization**:
   * Partitions states into non-accepting ($P_0$) and accepting ($P_1$).
   * Iteratively refines equivalence classes using signature vectors until fixed-point convergence.

---

## 🚀 Quick Start

### Prerequisites
* **C++ Compiler**: `g++` (MinGW for Windows, GCC for Linux, Clang for macOS).
* **Python**: Python 3.8+ (standard library only; no `pip` dependencies needed!).

---

### Windows
Double-click `run.bat` or run in terminal:
```cmd
# Automatically compiles C++ engine and starts server at http://localhost:8080
run.bat
```

### Linux / macOS
```bash
# Make executable and run
chmod +x build.sh run.sh
./run.sh
```
Or using `make`:
```bash
make run
```
Open **`http://localhost:8080`** in your browser.

---

## 🐳 Docker Deployment

You can build and run the entire application in a container with a single command:

```bash
docker compose up --build
```
Then visit **`http://localhost:8080`**.

Or manually:
```bash
docker build -t dfa-simulator .
docker run -p 8080:8080 dfa-simulator
```

---

## ☁️ 1-Click Cloud Deployment

### Deploy to Render
1. Push your repository to GitHub.
2. In [Render.com](https://render.com), click **New +** ➔ **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml`, builds the Docker image, and deploys it with automatic SSL.

### Deploy to Railway
1. In [Railway.app](https://railway.app), click **New Project** ➔ **Deploy from GitHub repo**.
2. Railway detects the `Dockerfile` and deploys automatically.

### Deploy to Fly.io
```bash
fly launch
fly deploy
```

---

## 🧪 Automated Test Suite

Run all verification tests across presets and C++ edge cases:

```bash
# Test all preconfigured automata presets (100% agreement check)
python tests/test_all_presets.py

# Run simulator unit test suite
python -m unittest tests/test_simulator.py

# Run server API integration tests
python tests/test_server.py
```

---

## 📡 REST API Reference

### 1. `POST /api/convert`
Converts an $\epsilon$-NFA into a DFA and Minimized DFA.

**Request Body**:
```json
{
  "states": ["q0", "q1", "qf"],
  "alphabet": ["a", "b"],
  "start_state": "q0",
  "accept_states": ["qf"],
  "include_dead_state": true,
  "transitions": [
    { "from": "q0", "symbol": "ε", "to": "q1" },
    { "from": "q1", "symbol": "a", "to": "qf" },
    { "from": "qf", "symbol": "a", "to": "qf" },
    { "from": "qf", "symbol": "b", "to": "qf" }
  ],
  "test_strings": ["a", "ab", "b", ""]
}
```

**Response**:
Returns full JSON payload containing `nfa`, `dfa`, `minimized_dfa`, `epsilon_closures`, `construction_steps`, and string `simulations`.

### 2. `POST /api/simulate`
Simulates a single string on the automaton.

**Request Body**:
```json
{
  "automaton": { ... },
  "string": "aba"
}
```

**Response**:
```json
{
  "accepted": true,
  "path": ["q0", "qf", "qf", "qf"]
}
```

### 3. `GET /api/health`
Health check endpoint returning system status and C++ engine detection.

---

## 📁 Repository Structure

```
├── backend/
│   ├── simulator.cpp       # Core C++14 Automata & Subset Construction Engine
│   └── json.hpp            # Lightweight zero-dependency JSON parser
├── web/
│   ├── index.html          # Clean side-by-side UI layout
│   ├── css/
│   │   └── styles.css      # Modern styling & animations
│   └── js/
│       ├── app.js          # Controller orchestrating API & UI
│       ├── presets.js      # Curated educational automata presets
│       └── svg_renderer.js # Pure vector SVG textbook renderer (100% straight lines)
├── tests/
│   ├── test_simulator.py   # Unit tests for C++ engine
│   ├── test_all_presets.py # Comprehensive tests across all presets
│   └── test_server.py      # HTTP API integration tests
├── .github/workflows/
│   └── ci.yml              # GitHub Actions CI workflow (Linux & Windows)
├── Dockerfile              # Production Dockerfile
├── docker-compose.yml      # Docker Compose setup
├── render.yaml             # Render.com Blueprint deployment file
├── Procfile                # Heroku / Railway entrypoint
├── requirements.txt        # Python dependency documentation
├── Makefile                # Cross-platform build automation
├── build.bat / run.bat     # Windows one-click scripts
├── build.sh / run.sh       # Linux/macOS one-click scripts
└── server.py               # Multithreaded Python HTTP bridge & static server
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
