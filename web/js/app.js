/**
 * Main Application Controller
 * Rebuilt from scratch: Clean, intuitive, responsive, and student-friendly.
 */

class App {
    constructor() {
        // Initialize pure SVG vector renderers
        this.dfaRenderer = new SvgAutomataRenderer('svg-dfa', 'DFA');
        this.nfaRenderer = new SvgAutomataRenderer('svg-nfa', 'ε-NFA');
        this.minDfaRenderer = new SvgAutomataRenderer('svg-mindfa', 'MINIMIZED DFA');

        this.currentData = null; // Backend response
        this.currentNFA = null;  // Current NFA model

        // Animation state
        this.animation = {
            isPlaying: false,
            currentStep: 0,
            totalSteps: 0,
            timer: null,
            speed: 2500 // Slow & deliberate: 2.5s default
        };

        this.initEventListeners();
        this.initPresetsDropdown();
        this.loadPreset("reference_textbook"); // Default: textbook image example!
    }

    initEventListeners() {
        // Preset Chips
        document.querySelectorAll('.quick-preset-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const presetId = e.currentTarget.dataset.preset;
                if (presetId) {
                    const sel = document.getElementById('preset-select');
                    if (sel) sel.value = presetId;
                    this.loadPreset(presetId);
                }
            });
        });

        // Preset Dropdown
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                if (e.target.value) this.loadPreset(e.target.value);
            });
        }

        // Action Buttons
        document.getElementById('btn-run')?.addEventListener('click', () => this.runConversion());
        document.getElementById('btn-reset')?.addEventListener('click', () => this.loadPreset("reference_textbook"));

        // Diagram View Switcher Tabs
        document.getElementById('tab-btn-dfa')?.addEventListener('click', () => this.setDiagramView('dfa'));
        document.getElementById('tab-btn-nfa')?.addEventListener('click', () => this.setDiagramView('nfa'));
        document.getElementById('tab-btn-mindfa')?.addEventListener('click', () => this.setDiagramView('mindfa'));
        document.getElementById('tab-btn-side')?.addEventListener('click', () => this.setDiagramView('side'));

        // Table Switcher Tabs
        const tableTabs = [
            { btn: 'table-tab-dfa', panel: 'table-panel-dfa' },
            { btn: 'table-tab-steps', panel: 'table-panel-steps' },
            { btn: 'table-tab-closures', panel: 'table-panel-closures' },
            { btn: 'table-tab-nfa', panel: 'table-panel-nfa' },
            { btn: 'table-tab-mindfa', panel: 'table-panel-mindfa' },
            { btn: 'table-tab-batch', panel: 'table-panel-batch' }
        ];

        tableTabs.forEach(t => {
            document.getElementById(t.btn)?.addEventListener('click', () => {
                tableTabs.forEach(o => {
                    document.getElementById(o.btn)?.classList.remove('active');
                    document.getElementById(o.panel)?.classList.add('hidden');
                });
                document.getElementById(t.btn)?.classList.add('active');
                document.getElementById(t.panel)?.classList.remove('hidden');
            });
        });

        // Animation Player Controls
        document.getElementById('anim-play')?.addEventListener('click', () => this.toggleAnimation());
        document.getElementById('anim-next')?.addEventListener('click', () => this.stepAnimation(1));
        document.getElementById('anim-prev')?.addEventListener('click', () => this.stepAnimation(-1));
        document.getElementById('anim-reset')?.addEventListener('click', () => this.resetAnimation());
        document.getElementById('anim-skip')?.addEventListener('click', () => this.skipToEndAnimation());

        // Speed Selector
        document.getElementById('anim-speed')?.addEventListener('change', (e) => {
            this.animation.speed = parseInt(e.target.value, 10);
            if (this.animation.isPlaying) {
                this.pauseAnimation();
                this.playAnimation();
            }
        });

        // Scrubber
        document.getElementById('anim-scrubber')?.addEventListener('input', (e) => {
            const step = parseInt(e.target.value, 10);
            this.goToStep(step);
        });

        // Transitions Builder
        document.getElementById('btn-add-transition')?.addEventListener('click', () => this.addTransitionRow());
        document.getElementById('input-states')?.addEventListener('input', () => this.syncBuilderStateOptions());
        document.getElementById('builder-quick-eps')?.addEventListener('click', () => {
            const sym = document.getElementById('new-trans-symbol');
            if (sym) sym.value = 'ε';
        });

        // String Tester
        document.getElementById('btn-test-string')?.addEventListener('click', () => this.runSingleStringTest());
        document.getElementById('single-string-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runSingleStringTest();
        });
        document.getElementById('btn-batch-test')?.addEventListener('click', () => this.runBatchTests());

        // Window resize to fit canvases
        window.addEventListener('resize', () => {
            if (this.dfaRenderer) this.dfaRenderer.fitToScreen();
            if (this.nfaRenderer) this.nfaRenderer.fitToScreen();
            if (this.minDfaRenderer) this.minDfaRenderer.fitToScreen();
        });
    }

    initPresetsDropdown() {
        const select = document.getElementById('preset-select');
        if (!select) return;
        select.innerHTML = '';
        PRESETS.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
    }

    loadPreset(presetId) {
        const preset = PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        this.currentNFA = JSON.parse(JSON.stringify(preset));

        const statesInput = document.getElementById('input-states');
        const alphabetInput = document.getElementById('input-alphabet');
        const deadStateCheck = document.getElementById('check-dead-state');
        const presetDesc = document.getElementById('preset-description');

        if (statesInput) statesInput.value = preset.states.join(", ");
        if (alphabetInput) alphabetInput.value = preset.alphabet.join(", ");
        if (deadStateCheck) deadStateCheck.checked = !!preset.include_dead_state;
        if (presetDesc) presetDesc.textContent = preset.description || "";

        this.syncBuilderStateOptions(preset.start_state, preset.accept_states);
        this.renderTransitionRows(preset.transitions);

        const testStringsInput = document.getElementById('input-test-strings');
        if (testStringsInput && preset.test_strings) {
            testStringsInput.value = preset.test_strings.join(", ");
        }

        // Highlight active preset chip
        document.querySelectorAll('.quick-preset-chip').forEach(chip => {
            if (chip.dataset.preset === presetId) {
                chip.classList.add('bg-orange-100', 'border-orange-400', 'text-orange-900', 'font-bold');
                chip.classList.remove('bg-slate-100', 'border-slate-300', 'text-slate-700');
            } else {
                chip.classList.remove('bg-orange-100', 'border-orange-400', 'text-orange-900', 'font-bold');
                chip.classList.add('bg-slate-100', 'border-slate-300', 'text-slate-700');
            }
        });

        // Trigger conversion automatically
        this.runConversion();
    }

    syncBuilderStateOptions(selectedStart, selectedAccepts) {
        const statesStr = document.getElementById('input-states')?.value || "";
        const states = statesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Start state selector
        const startSelect = document.getElementById('select-start-state');
        if (startSelect) {
            const prevVal = selectedStart || startSelect.value || states[0] || "";
            startSelect.innerHTML = "";
            states.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                if (s === prevVal) opt.selected = true;
                startSelect.appendChild(opt);
            });
        }

        // Accept states clickable chips
        const acceptContainer = document.getElementById('accept-states-chips');
        if (acceptContainer) {
            acceptContainer.innerHTML = "";
            const currentAccepts = selectedAccepts || this.getSelectedAcceptStates();
            states.forEach(s => {
                const isSelected = currentAccepts.includes(s);
                const chip = document.createElement('button');
                chip.type = "button";
                chip.className = `px-2.5 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1 ${
                    isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                               : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`;
                chip.innerHTML = isSelected ? `<span>✓</span><span>${s}</span>` : `<span>${s}</span>`;
                chip.dataset.state = s;
                chip.addEventListener('click', () => {
                    const willAccept = !chip.classList.contains('bg-emerald-600');
                    chip.classList.toggle('bg-emerald-600', willAccept);
                    chip.classList.toggle('border-emerald-600', willAccept);
                    chip.classList.toggle('text-white', willAccept);
                    chip.classList.toggle('bg-white', !willAccept);
                    chip.classList.toggle('border-slate-300', !willAccept);
                    chip.classList.toggle('text-slate-700', !willAccept);
                    chip.innerHTML = willAccept ? `<span>✓</span><span>${s}</span>` : `<span>${s}</span>`;
                });
                acceptContainer.appendChild(chip);
            });
        }
    }

    getSelectedAcceptStates() {
        const chips = document.querySelectorAll('#accept-states-chips button');
        const accepts = [];
        chips.forEach(chip => {
            if (chip.classList.contains('bg-emerald-600')) {
                accepts.push(chip.dataset.state);
            }
        });
        return accepts;
    }

    renderTransitionRows(transitions) {
        const tbody = document.getElementById('transitions-tbody');
        if (!tbody) return;
        tbody.innerHTML = "";

        transitions.forEach((t, idx) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 hover:bg-slate-50 text-xs";
            tr.innerHTML = `
                <td class="py-1.5 px-3 font-mono font-bold text-slate-800">${t.from}</td>
                <td class="py-1.5 px-2 text-center font-mono font-bold ${t.symbol === 'ε' || t.symbol === 'epsilon' ? 'text-purple-600' : 'text-orange-600'}">
                    ${t.symbol}
                </td>
                <td class="py-1.5 px-3 font-mono font-bold text-slate-800">${t.to}</td>
                <td class="py-1.5 px-2 text-right">
                    <button type="button" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded transition" data-idx="${idx}">
                        ✕
                    </button>
                </td>
            `;
            tr.querySelector('button')?.addEventListener('click', () => {
                this.currentNFA.transitions.splice(idx, 1);
                this.renderTransitionRows(this.currentNFA.transitions);
            });
            tbody.appendChild(tr);
        });
    }

    addTransitionRow() {
        const fromInput = document.getElementById('new-trans-from');
        const symInput = document.getElementById('new-trans-symbol');
        const toInput = document.getElementById('new-trans-to');

        const from = fromInput?.value.trim();
        let sym = symInput?.value.trim();
        const to = toInput?.value.trim();

        if (!from || !to) {
            alert("Please provide both 'From' and 'To' state names");
            return;
        }

        if (!sym || sym.toLowerCase() === 'eps' || sym.toLowerCase() === 'epsilon') {
            sym = 'ε';
        }

        if (!this.currentNFA.transitions) this.currentNFA.transitions = [];
        this.currentNFA.transitions.push({ from, symbol: sym, to });
        this.renderTransitionRows(this.currentNFA.transitions);

        if (fromInput) fromInput.value = "";
        if (toInput) toInput.value = "";
    }

    collectCurrentNFAFromForm() {
        const statesStr = document.getElementById('input-states')?.value || "";
        const alphaStr = document.getElementById('input-alphabet')?.value || "";
        const startState = document.getElementById('select-start-state')?.value || "";
        const acceptStates = this.getSelectedAcceptStates();
        const deadStateCheck = document.getElementById('check-dead-state')?.checked || false;

        const states = statesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        const alphabet = alphaStr.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'ε' && s !== 'epsilon');

        const testStr = document.getElementById('input-test-strings')?.value || "";
        const testStrings = testStr.split(',').map(s => s.trim());

        return {
            states: states,
            alphabet: alphabet,
            start_state: startState,
            accept_states: acceptStates,
            transitions: this.currentNFA ? this.currentNFA.transitions : [],
            include_dead_state: deadStateCheck,
            test_strings: testStrings
        };
    }

    async runConversion() {
        const payload = this.collectCurrentNFAFromForm();

        if (!payload.start_state) {
            alert("Please select a Start State");
            return;
        }
        if (payload.states.length === 0) {
            alert("Please enter at least one state in Q");
            return;
        }
        if (payload.alphabet.length === 0) {
            alert("Please enter alphabet symbols in Σ");
            return;
        }

        try {
            const resp = await fetch('/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server error ${resp.status}`);
            }

            const data = await resp.json();
            this.currentData = data;
            this.currentNFA = payload;

            // Render all three automata layouts
            this.dfaRenderer.computeLayout(data.dfa);
            this.nfaRenderer.computeLayout(data.nfa);
            this.minDfaRenderer.computeLayout(data.minimized_dfa);

            // Populate all transition tables
            this.renderTables(data);

            // Setup smooth animation
            this.setupAnimation(data.construction_steps);

            // Populate batch simulations
            this.renderBatchStringTests(data.simulations);

        } catch (err) {
            console.error(err);
            alert("Conversion Error: " + err.message);
        }
    }

    setDiagramView(viewName) {
        const cDfa = document.getElementById('container-dfa');
        const cNfa = document.getElementById('container-nfa');
        const cMin = document.getElementById('container-mindfa');

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        if (viewName === 'dfa') {
            document.getElementById('tab-btn-dfa')?.classList.add('active');
            if (cDfa) cDfa.classList.remove('hidden');
            if (cNfa) cNfa.classList.add('hidden');
            if (cMin) cMin.classList.add('hidden');
            this.dfaRenderer.fitToScreen();
        } else if (viewName === 'nfa') {
            document.getElementById('tab-btn-nfa')?.classList.add('active');
            if (cDfa) cDfa.classList.add('hidden');
            if (cNfa) cNfa.classList.remove('hidden');
            if (cMin) cMin.classList.add('hidden');
            this.nfaRenderer.fitToScreen();
        } else if (viewName === 'mindfa') {
            document.getElementById('tab-btn-mindfa')?.classList.add('active');
            if (cDfa) cDfa.classList.add('hidden');
            if (cNfa) cNfa.classList.add('hidden');
            if (cMin) cMin.classList.remove('hidden');
            this.minDfaRenderer.fitToScreen();
        } else if (viewName === 'side') {
            document.getElementById('tab-btn-side')?.classList.add('active');
            if (cDfa) cDfa.classList.remove('hidden');
            if (cNfa) cNfa.classList.remove('hidden');
            if (cMin) cMin.classList.add('hidden');
            this.dfaRenderer.fitToScreen();
            this.nfaRenderer.fitToScreen();
        }
    }

    // Smooth & Deliberate Progressive Building Animation
    setupAnimation(steps) {
        this.pauseAnimation();
        this.animation.currentStep = 0;
        this.animation.totalSteps = steps ? steps.length : 0;

        const scrubber = document.getElementById('anim-scrubber');
        if (scrubber) {
            scrubber.min = 0;
            scrubber.max = Math.max(0, this.animation.totalSteps - 1);
            scrubber.value = 0;
        }

        this.updateAnimationUI();
        this.goToStep(0);
    }

    toggleAnimation() {
        if (this.animation.isPlaying) {
            this.pauseAnimation();
        } else {
            this.playAnimation();
        }
    }

    playAnimation() {
        if (this.animation.currentStep >= this.animation.totalSteps - 1) {
            this.animation.currentStep = 0;
        }
        this.animation.isPlaying = true;
        const playBtn = document.getElementById('anim-play');
        if (playBtn) playBtn.innerHTML = '⏸ Pause';

        this.animation.timer = setInterval(() => {
            if (this.animation.currentStep < this.animation.totalSteps - 1) {
                this.stepAnimation(1);
            } else {
                this.pauseAnimation();
            }
        }, this.animation.speed);
    }

    pauseAnimation() {
        this.animation.isPlaying = false;
        if (this.animation.timer) {
            clearInterval(this.animation.timer);
            this.animation.timer = null;
        }
        const playBtn = document.getElementById('anim-play');
        if (playBtn) playBtn.innerHTML = '▶ Play (Slow)';
    }

    stepAnimation(delta) {
        const next = this.animation.currentStep + delta;
        if (next >= 0 && next < this.animation.totalSteps) {
            this.goToStep(next);
        } else if (next >= this.animation.totalSteps) {
            this.pauseAnimation();
        }
    }

    resetAnimation() {
        this.pauseAnimation();
        this.goToStep(0);
    }

    skipToEndAnimation() {
        this.pauseAnimation();
        if (this.animation.totalSteps > 0) {
            this.goToStep(this.animation.totalSteps - 1);
        }
    }

    goToStep(stepIndex) {
        if (!this.currentData || !this.currentData.construction_steps) return;
        if (stepIndex < 0 || stepIndex >= this.animation.totalSteps) return;

        this.animation.currentStep = stepIndex;
        this.updateAnimationUI();

        const step = this.currentData.construction_steps[stepIndex];

        // Progressive reveal in DFA Renderer
        this.dfaRenderer.renderProgressiveStep(
            this.currentData.dfa,
            stepIndex,
            this.currentData.construction_steps
        );

        // Update Explanation Card
        const hudBox = document.getElementById('anim-hud-content');
        if (hudBox) {
            hudBox.innerHTML = `
                <div class="flex items-center justify-between font-mono text-xs mb-1">
                    <span class="text-orange-700 font-bold uppercase tracking-wide">Step ${step.step_id} of ${this.animation.totalSteps}</span>
                    <span class="text-slate-500 font-semibold">Action: <b class="text-slate-900">${step.action}</b></span>
                </div>
                <div class="text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line">
                    ${step.explanation}
                </div>
            `;
        }

        // Highlight corresponding table row
        document.querySelectorAll('#table-steps-tbody tr').forEach(r => r.classList.remove('bg-orange-100', 'font-semibold'));
        const activeRow = document.getElementById(`step-row-${stepIndex}`);
        if (activeRow) {
            activeRow.classList.add('bg-orange-100', 'font-semibold');
        }
    }

    updateAnimationUI() {
        const counter = document.getElementById('anim-step-counter');
        const scrubber = document.getElementById('anim-scrubber');
        if (counter) {
            counter.textContent = `Step ${this.animation.currentStep + 1} / ${Math.max(1, this.animation.totalSteps)}`;
        }
        if (scrubber) {
            scrubber.value = this.animation.currentStep;
        }
    }

    // Render All Tables
    renderTables(data) {
        this.renderDFATable(data.dfa_table, data.dfa.alphabet);
        this.renderConstructionStepsTable(data.construction_steps);
        this.renderEpsilonClosuresTable(data.epsilon_closures);
        this.renderNFATable(data.nfa_table, data.nfa.alphabet);
        this.renderMinimizedDFATable(data.minimized_dfa);
    }

    renderDFATable(dfaTable, alphabet) {
        const thead = document.getElementById('table-dfa-thead');
        const tbody = document.getElementById('table-dfa-tbody');
        if (!thead || !tbody) return;

        let hHtml = `<tr><th class="py-2.5 px-3">DFA State</th><th class="py-2.5 px-3">Subset of NFA States</th>`;
        alphabet.forEach(a => { hHtml += `<th class="py-2.5 px-3 text-center text-orange-600 font-bold">δ(q, '${a}')</th>`; });
        hHtml += `</tr>`;
        thead.innerHTML = hHtml;

        let bHtml = "";
        dfaTable.forEach(row => {
            let badge = `<span class="font-mono font-bold">${row.state}</span>`;
            if (row.is_start && row.is_final) badge = `→★ ${badge}`;
            else if (row.is_start) badge = `→ ${badge}`;
            else if (row.is_final) badge = `★ ${badge}`;

            const subsetStr = row.subset && row.subset.length > 0 ? `{${row.subset.join(", ")}}` : `∅`;

            bHtml += `<tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="py-2 px-3">${badge}</td>
                <td class="py-2 px-3 font-mono text-slate-600">${subsetStr}</td>`;
            alphabet.forEach(a => {
                const tgt = row.transitions[a] || "∅";
                bHtml += `<td class="py-2 px-3 text-center font-mono font-semibold ${tgt === 'Dead' || tgt === '∅' ? 'text-slate-400' : 'text-slate-800'}">${tgt}</td>`;
            });
            bHtml += `</tr>`;
        });
        tbody.innerHTML = bHtml;
    }

    renderConstructionStepsTable(steps) {
        const tbody = document.getElementById('table-steps-tbody');
        if (!tbody) return;
        let html = "";
        steps.forEach((step, idx) => {
            const isInitial = step.action === "START_CLOSURE";
            const isNew = step.is_new_state;

            let badgeNew = isNew ? `<span class="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold">NEW</span>` : `<span class="text-slate-400 text-xs">Existing</span>`;
            if (isInitial) badgeNew = `<span class="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-bold">INITIAL</span>`;

            let srcStr = isInitial ? "-" : `<b class="text-slate-900">${step.source_state}</b> <span class="text-slate-500 font-mono text-[11px]">{${(step.source_subset||[]).join(", ")}}</span>`;
            let tgtStr = `<b class="text-emerald-700">${step.target_state}</b> <span class="text-slate-500 font-mono text-[11px]">{${(step.target_subset||[]).join(", ")}}</span>`;

            let symBadge = `<span class="font-mono font-bold ${step.symbol === 'ε' ? 'text-purple-600' : 'text-orange-600'}">${step.symbol}</span>`;
            let moveStr = step.move_result && step.move_result.length > 0 ? `{${step.move_result.join(", ")}}` : `∅`;
            let closureStr = step.closure_result && step.closure_result.length > 0 ? `{${step.closure_result.join(", ")}}` : `∅`;

            html += `<tr class="border-b border-slate-100 hover:bg-orange-50 cursor-pointer transition" data-step-idx="${idx}" id="step-row-${idx}">
                <td class="py-2 px-3 font-mono text-slate-500">#${step.step_id}</td>
                <td class="py-2 px-3">${srcStr}</td>
                <td class="py-2 px-3 text-center">${symBadge}</td>
                <td class="py-2 px-3 font-mono text-slate-500">${moveStr}</td>
                <td class="py-2 px-3 font-mono text-purple-700 font-semibold">${closureStr}</td>
                <td class="py-2 px-3">${tgtStr}</td>
                <td class="py-2 px-3 text-center">${badgeNew}</td>
            </tr>`;
        });
        tbody.innerHTML = html;

        // Interactive row clicking to jump animation
        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.stepIdx, 10);
                this.goToStep(idx);
            });
        });
    }

    renderEpsilonClosuresTable(closures) {
        const tbody = document.getElementById('table-closures-tbody');
        if (!tbody) return;
        let html = "";
        for (const [state, closure] of Object.entries(closures)) {
            html += `<tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3 font-mono font-bold text-slate-800">${state}</td>
                <td class="py-2 px-3 font-mono text-purple-700 font-semibold">
                    ε-closure(${state}) = { ${closure.join(", ")} }
                </td>
            </tr>`;
        }
        tbody.innerHTML = html;
    }

    renderNFATable(nfaTable, alphabet) {
        const thead = document.getElementById('table-nfa-thead');
        const tbody = document.getElementById('table-nfa-tbody');
        if (!thead || !tbody) return;

        let hHtml = `<tr><th class="py-2.5 px-3">State</th>`;
        alphabet.forEach(a => { hHtml += `<th class="py-2.5 px-3 text-center text-orange-600 font-bold">δ(q, '${a}')</th>`; });
        hHtml += `<th class="py-2.5 px-3 text-center text-purple-700 font-bold">δ(q, 'ε')</th></tr>`;
        thead.innerHTML = hHtml;

        let bHtml = "";
        nfaTable.forEach(row => {
            let badge = `<span class="font-mono font-bold">${row.state}</span>`;
            if (row.is_start && row.is_final) badge = `→★ ${badge}`;
            else if (row.is_start) badge = `→ ${badge}`;
            else if (row.is_final) badge = `★ ${badge}`;

            bHtml += `<tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3">${badge}</td>`;
            alphabet.forEach(a => {
                const tgts = row.transitions[a] || [];
                const str = tgts.length > 0 ? `{${tgts.join(", ")}}` : `<span class="text-slate-400">∅</span>`;
                bHtml += `<td class="py-2 px-3 text-center font-mono text-slate-800">${str}</td>`;
            });
            const epsTgts = row.transitions['ε'] || [];
            const epsStr = epsTgts.length > 0 ? `{${epsTgts.join(", ")}}` : `<span class="text-slate-400">∅</span>`;
            bHtml += `<td class="py-2 px-3 text-center font-mono text-purple-700 font-semibold">${epsStr}</td></tr>`;
        });
        tbody.innerHTML = bHtml;
    }

    renderMinimizedDFATable(minDfa) {
        const logBox = document.getElementById('mindfa-log-box');
        const thead = document.getElementById('table-mindfa-thead');
        const tbody = document.getElementById('table-mindfa-tbody');
        if (!minDfa || !thead || !tbody) return;

        if (logBox && minDfa.minimization_log) {
            logBox.innerHTML = minDfa.minimization_log.map(line => `<div>• ${line}</div>`).join("");
        }

        let hHtml = `<tr><th class="py-2.5 px-3">State</th><th class="py-2.5 px-3">Original Merged DFA States</th>`;
        minDfa.alphabet.forEach(a => { hHtml += `<th class="py-2.5 px-3 text-center text-purple-700 font-bold">'${a}'</th>`; });
        hHtml += `</tr>`;
        thead.innerHTML = hHtml;

        let bHtml = "";
        minDfa.states.forEach(s => {
            const isStart = (s === minDfa.start_state);
            const isFinal = (minDfa.accept_states || []).includes(s);
            let badge = `<span class="font-mono font-bold">${s}</span>`;
            if (isStart && isFinal) badge = `→★ ${badge}`;
            else if (isStart) badge = `→ ${badge}`;
            else if (isFinal) badge = `★ ${badge}`;

            const origGroup = (minDfa.partitions && minDfa.partitions[s]) ? `{${minDfa.partitions[s].join(", ")}}` : s;

            bHtml += `<tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3">${badge}</td>
                <td class="py-2 px-3 font-mono text-slate-600">${origGroup}</td>`;

            minDfa.alphabet.forEach(a => {
                const tr = (minDfa.transitions || []).find(t => t.from === s && t.symbol === a);
                const tgt = tr ? tr.to : "∅";
                bHtml += `<td class="py-2 px-3 text-center font-mono font-semibold text-slate-800">${tgt}</td>`;
            });
            bHtml += `</tr>`;
        });
        tbody.innerHTML = bHtml;
    }

    // String Acceptance Testing
    async runSingleStringTest() {
        const inputEl = document.getElementById('single-string-input');
        const box = document.getElementById('test-verdict-box');
        if (!inputEl || !box || !this.currentData) return;

        const str = inputEl.value;

        box.classList.remove('hidden');
        box.innerHTML = `<span class="text-slate-500">Simulating string "${str}"...</span>`;

        try {
            const resp = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ automaton: this.currentData.dfa, string: str })
            });

            const res = await resp.json();
            const accepted = res.accepted;
            const pathStr = res.path ? res.path.join(" ──> ") : "";

            if (accepted) {
                box.className = "p-3 rounded-lg text-xs font-mono font-medium border bg-emerald-50 border-emerald-300 text-emerald-900";
                box.innerHTML = `
                    <div class="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                        <span>✅ ACCEPTED</span>
                        <span class="text-xs font-normal text-emerald-600">(Reaches accepting state)</span>
                    </div>
                    <div class="mt-1 text-slate-700"><b>Path:</b> ${pathStr}</div>
                `;
            } else {
                box.className = "p-3 rounded-lg text-xs font-mono font-medium border bg-rose-50 border-rose-300 text-rose-900";
                box.innerHTML = `
                    <div class="flex items-center gap-2 font-bold text-rose-800 text-sm">
                        <span>❌ REJECTED</span>
                        <span class="text-xs font-normal text-rose-600">(Ends in non-accepting state or Dead)</span>
                    </div>
                    <div class="mt-1 text-slate-700"><b>Path:</b> ${pathStr}</div>
                `;
            }
        } catch (err) {
            box.className = "p-3 rounded-lg text-xs font-mono border bg-rose-50 border-rose-300 text-rose-800";
            box.textContent = "Error testing string: " + err.message;
        }
    }

    renderBatchStringTests(simulations) {
        const tbody = document.getElementById('string-tests-tbody');
        if (!tbody || !simulations) return;
        let html = "";
        simulations.forEach(sim => {
            const acc = sim.dfa_accepted;
            const agree = (sim.nfa_accepted === sim.dfa_accepted);
            const badge = acc ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">ACCEPTED</span>`
                              : `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">REJECTED</span>`;
            const agreeBadge = agree ? `<span class="text-emerald-700 font-semibold">✓ 100% Match (ε-NFA == DFA)</span>`
                                     : `<span class="text-rose-700 font-bold">⚠ Disagreement</span>`;

            html += `<tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3 font-mono font-bold text-slate-800">"${sim.string}"</td>
                <td class="py-2 px-3">${badge}</td>
                <td class="py-2 px-3 text-xs">${agreeBadge}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    runBatchTests() {
        this.runConversion();
    }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.dfaApp = new App();
});
