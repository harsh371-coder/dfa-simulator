CXX ?= g++
CXXFLAGS ?= -std=c++14 -O2 -Wall
PYTHON ?= python3

ifeq ($(OS),Windows_NT)
    BIN = backend/simulator.exe
    RM = del /Q /F
else
    BIN = backend/simulator
    RM = rm -f
endif

.PHONY: all build run test docker clean

all: build

build: $(BIN)

$(BIN): backend/simulator.cpp backend/json.hpp
	$(CXX) $(CXXFLAGS) backend/simulator.cpp -o $(BIN)

run: build
	$(PYTHON) server.py

test: build
	$(PYTHON) tests/test_all_presets.py
	$(PYTHON) -m unittest tests/test_simulator.py

docker-build:
	docker build -t epsilon-dfa-simulator .

docker-run:
	docker run -p 8080:8080 epsilon-dfa-simulator

clean:
	$(RM) backend/simulator backend/simulator.exe
