// Comprehensive, Tested Presets for ε-NFA to DFA Simulator
const PRESETS = [
    {
        id: "reference_textbook",
        name: "⭐ Uploaded Image Automaton (Starts with 'a')",
        description: "Exact match to uploaded reference image: Recognizes strings starting with 'a', with Dead state D on 'b'.",
        states: ["q0", "q1", "qf"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["qf"],
        include_dead_state: true,
        transitions: [
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "a", to: "qf" },
            { from: "qf", symbol: "a", to: "qf" },
            { from: "qf", symbol: "b", to: "qf" }
        ],
        test_strings: ["a", "ab", "aba", "abbb", "b", "ba", ""]
    },
    {
        id: "ends_with_abb",
        name: "(a|b)*abb — Strings Ending in 'abb'",
        description: "Textbook benchmark: NFA with epsilon transition before recognizing 'abb'.",
        states: ["q0", "q1", "q2", "q3", "q4"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["q4"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "a", to: "q0" },
            { from: "q0", symbol: "b", to: "q0" },
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "a", to: "q2" },
            { from: "q2", symbol: "b", to: "q3" },
            { from: "q3", symbol: "b", to: "q4" }
        ],
        test_strings: ["abb", "aabb", "babb", "ab", "a", "b", ""]
    },
    {
        id: "binary_ends_01",
        name: "(0|1)*01 — Binary Strings Ending in '01'",
        description: "Binary alphabet {0, 1} recognizing any bitstring ending with '01'.",
        states: ["q0", "q1", "q2", "q3"],
        alphabet: ["0", "1"],
        start_state: "q0",
        accept_states: ["q3"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "0", to: "q0" },
            { from: "q0", symbol: "1", to: "q0" },
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "0", to: "q2" },
            { from: "q2", symbol: "1", to: "q3" }
        ],
        test_strings: ["01", "101", "001", "0101", "00", "11", ""]
    },
    {
        id: "cascading_epsilon",
        name: "Cascading ε-Chains (q0 →ε→ q1 →ε→ q2)",
        description: "Tests transitive multi-hop epsilon closures across multiple states.",
        states: ["q0", "q1", "q2", "q3"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["q3"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "ε", to: "q2" },
            { from: "q2", symbol: "a", to: "q3" },
            { from: "q3", symbol: "b", to: "q3" }
        ],
        test_strings: ["a", "ab", "abb", "b", "ba", ""]
    },
    {
        id: "cyclic_epsilon",
        name: "Cyclic ε-Loop (q0 ⇄ε⇄ q1)",
        description: "Tests epsilon closures with direct mutual loops without infinite recursion.",
        states: ["q0", "q1", "q2"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["q2"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "ε", to: "q0" },
            { from: "q1", symbol: "a", to: "q2" }
        ],
        test_strings: ["a", "aa", "b", ""]
    },
    {
        id: "empty_string_accepted",
        name: "Empty String Accepted (Start state has ε to Final)",
        description: "Tests whether empty string ε is accepted directly at step 0.",
        states: ["q0", "q1", "q2"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["q2"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "ε", to: "q2" },
            { from: "q0", symbol: "a", to: "q1" },
            { from: "q1", symbol: "b", to: "q2" }
        ],
        test_strings: ["", "ab", "a", "b"]
    },
    {
        id: "a_star_b_plus",
        name: "a*b+ (Zero or more 'a's followed by one or more 'b's)",
        description: "Classic regular expression showcasing parallel epsilon branches.",
        states: ["q0", "q1", "q2"],
        alphabet: ["a", "b"],
        start_state: "q0",
        accept_states: ["q2"],
        include_dead_state: false,
        transitions: [
            { from: "q0", symbol: "a", to: "q0" },
            { from: "q0", symbol: "ε", to: "q1" },
            { from: "q1", symbol: "b", to: "q2" },
            { from: "q2", symbol: "b", to: "q2" }
        ],
        test_strings: ["b", "ab", "aab", "abbb", "a", ""]
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PRESETS;
}
