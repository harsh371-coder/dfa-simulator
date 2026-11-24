/**
 * SVG Automata Renderer
 * Pure Textbook Vector Renderer: 100% Straight Directed Lines, Concentric Double Circles,
 * Clean Teardrop Self-Loops, and Smooth Non-Jittery Progressive Building Animation.
 */

class SvgAutomataRenderer {
    constructor(svgElementId, captionLabel = "DFA") {
        this.svg = document.getElementById(svgElementId);
        this.captionLabel = captionLabel;
        this.nodes = new Map(); // id -> { id, label, x, y, isStart, isFinal, isDead, subsetStr }
        this.edges = [];        // [ { from, to, symbol, isEpsilon } ]
        this.nodeRadius = 26;

        // Active highlights for smooth animation
        this.activeNodeId = null;
        this.activeEdgeKey = null;

        // Pan and Zoom
        this.pan = { x: 0, y: 0 };
        this.zoom = 1;
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };

        // Dragging
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };

        this.initEvents();
    }

    initEvents() {
        if (!this.svg) return;

        // Node drag and background pan
        this.svg.addEventListener('mousedown', (e) => {
            const targetNode = e.target.closest('.automata-node');
            if (targetNode) {
                const nodeId = targetNode.dataset.nodeId;
                const node = this.nodes.get(nodeId);
                if (node) {
                    this.draggedNode = node;
                    const pt = this.getSvgPoint(e);
                    this.dragOffset = { x: pt.x - node.x, y: pt.y - node.y };
                }
            } else {
                this.isPanning = true;
                this.startPan = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.draggedNode) {
                const pt = this.getSvgPoint(e);
                this.draggedNode.x = pt.x - this.dragOffset.x;
                this.draggedNode.y = pt.y - this.dragOffset.y;
                this.render();
            } else if (this.isPanning) {
                this.pan.x = e.clientX - this.startPan.x;
                this.pan.y = e.clientY - this.startPan.y;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            this.draggedNode = null;
            this.isPanning = false;
        });

        // Mouse wheel zoom
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoomAt(factor, e.clientX, e.clientY);
        });
    }

    getSvgPoint(e) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.pan.x) / this.zoom,
            y: (e.clientY - rect.top - this.pan.y) / this.zoom
        };
    }

    zoomAt(factor, clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const ptX = (clientX - rect.left - this.pan.x) / this.zoom;
        const ptY = (clientY - rect.top - this.pan.y) / this.zoom;

        const newZoom = Math.min(Math.max(this.zoom * factor, 0.4), 2.5);
        this.pan.x = clientX - rect.left - ptX * newZoom;
        this.pan.y = clientY - rect.top - ptY * newZoom;
        this.zoom = newZoom;
        this.updateTransform();
    }

    resetView() {
        this.fitToScreen();
    }

    fitToScreen() {
        if (!this.svg || this.nodes.size === 0) return;
        const rect = this.svg.getBoundingClientRect();
        const width = rect.width || 640;
        const height = rect.height || 420;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            minX = Math.min(minX, n.x - 70);
            maxX = Math.max(maxX, n.x + 70);
            minY = Math.min(minY, n.y - 70);
            maxY = Math.max(maxY, n.y + 70);
        });

        const boundsW = Math.max(maxX - minX, 100);
        const boundsH = Math.max(maxY - minY, 100);

        const padding = 50;
        const scaleX = (width - padding * 2) / boundsW;
        const scaleY = (height - padding * 2) / boundsH;
        this.zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.75), 1.25);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        this.pan.x = (width / 2) - (centerX * this.zoom);
        this.pan.y = (height / 2) - (centerY * this.zoom);

        this.updateTransform();
    }

    updateTransform() {
        const g = this.svg.querySelector('.viewport-group');
        if (g) {
            g.setAttribute('transform', `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`);
        }
    }

    /**
     * Compute clean, formal textbook layout matching uploaded reference image:
     * - Horizontal flow from start state to final state
     * - Dead / Trap state placed diagonally below start state
     */
    computeLayout(automaton) {
        this.nodes.clear();
        this.edges = [];

        if (!automaton || !automaton.states || automaton.states.length === 0) return;

        const startState = automaton.start_state;
        const acceptStates = new Set(automaton.accept_states || []);

        // Group multiple transitions between same state pair (e.g. 'a' and 'b' -> 'a, b')
        const edgeMap = new Map();
        (automaton.transitions || []).forEach(t => {
            const key = `${t.from}__${t.to}`;
            if (!edgeMap.has(key)) {
                edgeMap.set(key, { from: t.from, to: t.to, symbols: [] });
            }
            if (!edgeMap.get(key).symbols.includes(t.symbol)) {
                edgeMap.get(key).symbols.push(t.symbol);
            }
        });

        this.edges = Array.from(edgeMap.values()).map(e => ({
            from: e.from,
            to: e.to,
            symbol: e.symbols.join(", "),
            isEpsilon: e.symbols.includes("ε") || e.symbols.includes("epsilon")
        }));

        // BFS depth calculation
        const depth = new Map();
        const queue = [startState];
        depth.set(startState, 0);

        while (queue.length > 0) {
            const curr = queue.shift();
            const currD = depth.get(curr);
            (automaton.transitions || []).forEach(t => {
                if (t.from === curr && t.to !== "Dead" && t.to !== "TRAP" && t.to !== "∅") {
                    if (!depth.has(t.to)) {
                        depth.set(t.to, currD + 1);
                        queue.push(t.to);
                    }
                }
            });
        }

        let maxD = 0;
        depth.forEach(d => { maxD = Math.max(maxD, d); });
        automaton.states.forEach(s => {
            if (!depth.has(s) && s !== "Dead" && s !== "TRAP" && s !== "∅") {
                depth.set(s, ++maxD);
            }
        });

        const depthGroups = new Map();
        depth.forEach((d, s) => {
            if (!depthGroups.has(d)) depthGroups.set(d, []);
            depthGroups.get(d).push(s);
        });

        // Layout parameters
        const startX = 120;
        const colGap = 220;
        const baseY = 160;

        depthGroups.forEach((statesAtD, d) => {
            const x = startX + d * colGap;
            const total = statesAtD.length;
            statesAtD.forEach((s, idx) => {
                const yOffset = (idx - (total - 1) / 2) * 120;
                const isFinal = acceptStates.has(s);

                const subset = automaton.state_subsets ? automaton.state_subsets[s] : null;
                const subsetStr = subset && subset.length > 0 ? `{${subset.join(",")}}` : "";

                // Display label: smart mapping to q0 / qf / D if applicable, else s
                let displayLabel = s;
                if (s === "Dead" || s === "TRAP" || s === "∅") {
                    displayLabel = "D";
                } else if (automaton.state_subsets && automaton.state_subsets[s]) {
                    const sub = automaton.state_subsets[s];
                    if (s === startState && (sub.includes("q0") || sub.length === 1 && sub[0].startsWith("q"))) {
                        displayLabel = sub.includes("q0") ? "q0" : sub[0];
                    } else if (acceptStates.has(s) && (sub.includes("qf") || sub.includes("q_f"))) {
                        displayLabel = "qf";
                    }
                } else if (automaton.partition_mapping && automaton.partition_mapping[s]) {
                    const origs = automaton.partition_mapping[s];
                    if (origs.includes("Dead")) {
                        displayLabel = "D";
                    } else if (s === startState) {
                        displayLabel = "q0";
                    } else if (acceptStates.has(s)) {
                        displayLabel = "qf";
                    }
                }

                this.nodes.set(s, {
                    id: s,
                    label: displayLabel,
                    x: x,
                    y: baseY + yOffset,
                    isStart: (s === startState),
                    isFinal: isFinal,
                    isDead: false,
                    subsetStr: subsetStr
                });
            });
        });

        // Position Dead / Trap state below start state (diagonal straight line, matching uploaded image)
        automaton.states.forEach(s => {
            if (s === "Dead" || s === "TRAP" || s === "∅") {
                const startPos = this.nodes.get(startState) || { x: startX, y: baseY };
                this.nodes.set(s, {
                    id: s,
                    label: s === "Dead" ? "D" : s,
                    x: startPos.x + 130,
                    y: startPos.y + 135,
                    isStart: false,
                    isFinal: false,
                    isDead: true,
                    subsetStr: "∅"
                });
            }
        });

        this.render();
        this.fitToScreen();
    }

    setCaption(label) {
        this.captionLabel = label;
        this.render();
    }

    /**
     * Render the automaton with 100% pure straight lines and textbook styling
     */
    render() {
        if (!this.svg) return;

        let content = `
            <defs>
                <!-- Standard crisp black triangle marker -->
                <marker id="marker-arrow-${this.captionLabel}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#000000" />
                </marker>
                <!-- Highlighted vivid orange marker for active transitions -->
                <marker id="marker-active-${this.captionLabel}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ea580c" />
                </marker>
                <!-- Purple marker for epsilon transitions -->
                <marker id="marker-eps-${this.captionLabel}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#7c3aed" />
                </marker>
            </defs>
            <g class="viewport-group" transform="translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})">
        `;

        // Check for bidirectional edges to apply parallel separation while keeping lines 100% straight
        const edgePairs = new Set();
        this.edges.forEach(e => {
            if (this.edges.some(other => other.from === e.to && other.to === e.from && e.from !== e.to)) {
                edgePairs.add(e.from + "->" + e.to);
            }
        });

        // 1. Render Transitions (Pure Straight Lines & Clean Teardrop Loops)
        this.edges.forEach(edge => {
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            if (!fromNode || !toNode) return;

            const edgeKey = edge.from + "->" + edge.to;
            const isActive = (this.activeEdgeKey === edgeKey);
            const isEpsilon = edge.isEpsilon;
            const markerId = isActive ? `marker-active-${this.captionLabel}` : (isEpsilon ? `marker-eps-${this.captionLabel}` : `marker-arrow-${this.captionLabel}`);
            const strokeColor = isActive ? '#ea580c' : (isEpsilon ? '#7c3aed' : '#000000');
            const strokeWidth = isActive ? 3.2 : 2.2;

            if (edge.from === edge.to) {
                // Clean teardrop self-loop
                const r = this.nodeRadius;
                const isBottom = fromNode.isDead || fromNode.y > 210;
                const dir = isBottom ? 1 : -1;

                const startX = fromNode.x - 12;
                const startY = fromNode.y + r * dir;
                const endX = fromNode.x + 12;
                const endY = fromNode.y + r * dir;

                const c1X = fromNode.x - 30;
                const c1Y = fromNode.y + (r + 48) * dir;
                const c2X = fromNode.x + 30;
                const c2Y = fromNode.y + (r + 48) * dir;

                const labelY = isBottom ? (fromNode.y + r + 42) : (fromNode.y - r - 26);

                content += `
                    <g class="transition-edge ${isActive ? 'edge-active' : ''}">
                        <path d="M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}"
                              fill="none"
                              stroke="${strokeColor}"
                              stroke-width="${strokeWidth}"
                              marker-end="url(#${markerId})" />
                        <rect x="${fromNode.x - 22}" y="${labelY - 10}" width="44" height="20" fill="#ffffff" rx="3" />
                        <text x="${fromNode.x}" y="${labelY + 4}"
                              text-anchor="middle"
                              font-family="'JetBrains Mono', monospace"
                              font-size="14"
                              font-weight="bold"
                              fill="#ea580c">${edge.symbol}</text>
                    </g>
                `;
            } else {
                // 100% PURE STRAIGHT LINE
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) return;

                const ux = dx / dist;
                const uy = dy / dist;

                // Perpendicular vector for parallel offset if bidirectional
                const hasReverse = edgePairs.has(edgeKey);
                const offset = hasReverse ? 9 : 0;
                const px = -uy * offset;
                const py = ux * offset;

                const r = this.nodeRadius;
                const x1 = fromNode.x + ux * r + px;
                const y1 = fromNode.y + uy * r + py;
                const x2 = toNode.x - ux * (r + 4) + px;
                const y2 = toNode.y - uy * (r + 4) + py;

                // Label midpoint: shifted outward from the line
                const midX = (x1 + x2) / 2 + (-uy * 14);
                const midY = (y1 + y2) / 2 + (ux * 14);

                content += `
                    <g class="transition-edge ${isActive ? 'edge-active' : ''}">
                        <!-- Pure Straight Line -->
                        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                              stroke="${strokeColor}"
                              stroke-width="${strokeWidth}"
                              stroke-dasharray="${isEpsilon ? '6,4' : 'none'}"
                              marker-end="url(#${markerId})" />
                        <!-- Bold Orange Label with White Halo -->
                        <rect x="${midX - 18}" y="${midY - 10}" width="36" height="19" fill="#ffffff" rx="3" />
                        <text x="${midX}" y="${midY + 4}"
                              text-anchor="middle"
                              font-family="'JetBrains Mono', monospace"
                              font-size="14"
                              font-weight="bold"
                              fill="#ea580c">${edge.symbol}</text>
                    </g>
                `;
            }
        });

        // 2. Render Nodes (Crisp Circles & Concentric Double Circles)
        this.nodes.forEach(node => {
            const r = this.nodeRadius;
            const isStart = node.isStart;
            const isFinal = node.isFinal;
            const isActive = (this.activeNodeId === node.id);

            content += `<g class="automata-node ${isActive ? 'node-active' : ''}" data-node-id="${node.id}" style="cursor: grab;">`;

            // Active Pulsating Halo
            if (isActive) {
                content += `
                    <circle cx="${node.x}" cy="${node.y}" r="${r + 9}"
                            fill="none" stroke="#ea580c" stroke-width="2.5" opacity="0.75" class="halo-pulse" />
                `;
            }

            // Incoming Start Arrow (Horizontal from left: ---> (q0))
            if (isStart) {
                content += `
                    <line x1="${node.x - r - 38}" y1="${node.y}" x2="${node.x - r - 2}" y2="${node.y}"
                          stroke="#000000" stroke-width="2.5" marker-end="url(#marker-arrow-${this.captionLabel})" />
                `;
            }

            // Outer Circle
            content += `
                <circle cx="${node.x}" cy="${node.y}" r="${r}"
                        fill="#ffffff"
                        stroke="${isActive ? '#ea580c' : '#000000'}"
                        stroke-width="2.5" />
            `;

            // Concentric Inner Circle for Final / Accepting State (double circle, matching reference image)
            if (isFinal) {
                content += `
                    <circle cx="${node.x}" cy="${node.y}" r="${r - 6}"
                            fill="none"
                            stroke="${isActive ? '#ea580c' : '#000000'}"
                            stroke-width="2.2" />
                `;
            }

            // State Label
            const labelColor = node.isDead ? '#ea580c' : (node.id.startsWith('q') ? '#ea580c' : '#000000');
            content += `
                <text x="${node.x}" y="${node.y + 5}"
                      text-anchor="middle"
                      font-family="'JetBrains Mono', Inter, sans-serif"
                      font-size="15"
                      font-weight="bold"
                      fill="${labelColor}">${node.label}</text>
            `;

            // Optional Subsets Label below node
            if (node.subsetStr && node.subsetStr !== "∅" && node.subsetStr.length > 0) {
                content += `
                    <text x="${node.x}" y="${node.y + r + 16}"
                          text-anchor="middle"
                          font-family="'JetBrains Mono', monospace"
                          font-size="11"
                          font-weight="600"
                          fill="#64748b">${node.subsetStr}</text>
                `;
            }

            content += `</g>`;
        });

        content += `</g>`;
        this.svg.innerHTML = content;
    }

    /**
     * Progressive Building Animation: Reveals automaton step-by-step
     * with stable coordinates (no view jumps) and smooth highlights.
     */
    renderProgressiveStep(fullAutomaton, stepIndex, steps) {
        if (!fullAutomaton || stepIndex < 0 || !steps || steps.length === 0) return;

        // Keep all precomputed coordinates stable
        if (this.nodes.size === 0) {
            this.computeLayout(fullAutomaton);
        }

        const visibleStates = new Set();
        const visibleTransitions = [];

        for (let i = 0; i <= stepIndex && i < steps.length; i++) {
            const step = steps[i];
            if (step.action === "START_CLOSURE") {
                if (step.target_state) visibleStates.add(step.target_state);
            } else if (step.action === "TRANSITION" || step.action === "TRAP_TRANSITION") {
                if (step.source_state) visibleStates.add(step.source_state);
                if (step.target_state && step.target_state !== "∅") {
                    visibleStates.add(step.target_state);
                    visibleTransitions.push({
                        from: step.source_state,
                        to: step.target_state,
                        symbol: step.symbol,
                        isEpsilon: false
                    });
                }
            }
        }

        // Filter edges and group symbols
        const edgeMap = new Map();
        visibleTransitions.forEach(t => {
            const key = `${t.from}__${t.to}`;
            if (!edgeMap.has(key)) {
                edgeMap.set(key, { from: t.from, to: t.to, symbols: [] });
            }
            if (!edgeMap.get(key).symbols.includes(t.symbol)) {
                edgeMap.get(key).symbols.push(t.symbol);
            }
        });

        this.edges = Array.from(edgeMap.values()).map(e => ({
            from: e.from,
            to: e.to,
            symbol: e.symbols.join(", "),
            isEpsilon: false
        }));

        // Set active step highlights
        const currentStep = steps[stepIndex];
        if (currentStep) {
            this.activeNodeId = currentStep.target_state || currentStep.source_state || null;
            if (currentStep.source_state && currentStep.target_state && currentStep.target_state !== "∅") {
                this.activeEdgeKey = currentStep.source_state + "->" + currentStep.target_state;
            } else {
                this.activeEdgeKey = null;
            }
        } else {
            this.activeNodeId = null;
            this.activeEdgeKey = null;
        }

        // Render with only visible nodes
        const backupNodes = new Map(this.nodes);
        this.nodes.forEach((val, key) => {
            if (!visibleStates.has(key)) {
                this.nodes.delete(key);
            }
        });

        this.render();

        // Restore node map so coordinates remain fixed
        this.nodes = backupNodes;
    }
}
