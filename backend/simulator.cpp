#include <iostream>
#include <string>
#include <vector>
#include <set>
#include <map>
#include <queue>
#include <sstream>
#include <algorithm>
#include <fstream>
#include "json.hpp"

// Utility: Normalize epsilon symbols
bool is_epsilon(const std::string& sym) {
    return sym.empty() || sym == "ε" || sym == "epsilon" || sym == "EPSILON" ||
           sym == "λ" || sym == "lambda" || sym == "LAMBDA" || sym == "E" || sym == "^";
}

std::string format_set(const std::set<std::string>& s) {
    if (s.empty()) return "∅";
    std::ostringstream oss;
    oss << "{";
    bool first = true;
    for (const auto& item : s) {
        if (!first) oss << ", ";
        oss << item;
        first = false;
    }
    oss << "}";
    return oss.str();
}

std::string state_name_for_index(int idx) {
    // Generate A, B, C, ..., Z, AA, AB, ...
    std::string name;
    int n = idx;
    while (n >= 0) {
        name = static_cast<char>('A' + (n % 26)) + name;
        n = (n / 26) - 1;
    }
    return name;
}

struct NFA {
    std::vector<std::string> states;
    std::vector<std::string> alphabet; // excludes epsilon
    std::string start_state;
    std::set<std::string> accept_states;
    // from_state -> symbol -> set of to_states
    std::map<std::string, std::map<std::string, std::set<std::string>>> transitions;

    std::set<std::string> get_transitions(const std::string& from, const std::string& sym) const {
        auto it1 = transitions.find(from);
        if (it1 != transitions.end()) {
            auto it2 = it1->second.find(sym);
            if (it2 != it1->second.end()) {
                return it2->second;
            }
        }
        return {};
    }

    std::set<std::string> epsilon_closure(const std::string& state) const {
        std::set<std::string> closure;
        std::queue<std::string> q;

        closure.insert(state);
        q.push(state);

        while (!q.empty()) {
            std::string curr = q.front();
            q.pop();

            auto eps_trans = get_transitions(curr, "ε");
            for (const auto& next_state : eps_trans) {
                if (closure.find(next_state) == closure.end()) {
                    closure.insert(next_state);
                    q.push(next_state);
                }
            }
        }
        return closure;
    }

    std::set<std::string> epsilon_closure_set(const std::set<std::string>& state_set) const {
        std::set<std::string> result;
        for (const auto& s : state_set) {
            auto cl = epsilon_closure(s);
            result.insert(cl.begin(), cl.end());
        }
        return result;
    }

    std::set<std::string> move(const std::set<std::string>& state_set, const std::string& sym) const {
        std::set<std::string> result;
        for (const auto& s : state_set) {
            auto targets = get_transitions(s, sym);
            result.insert(targets.begin(), targets.end());
        }
        return result;
    }
};

struct ConstructionStep {
    int step_id;
    std::string action; // "START_CLOSURE", "TRANSITION", "TRAP_TRANSITION"
    std::string source_dfa_state;
    std::set<std::string> source_subset;
    std::string symbol;
    std::set<std::string> move_result;
    std::set<std::string> closure_result;
    std::string target_dfa_state;
    std::set<std::string> target_subset;
    bool is_new_state;
    bool is_accepting;
    std::string explanation;
};

struct DFA {
    std::vector<std::string> states; // A, B, C...
    std::vector<std::string> alphabet;
    std::string start_state;
    std::set<std::string> accept_states;
    // from_state -> symbol -> to_state
    std::map<std::string, std::map<std::string, std::string>> transitions;
    // DFA state -> NFA subset
    std::map<std::string, std::set<std::string>> state_subsets;
    // NFA subset -> DFA state
    std::map<std::set<std::string>, std::string> subset_to_state;
    std::vector<ConstructionStep> steps;
    bool has_dead_state = false;
    std::string dead_state_name = "";
};

DFA convert_nfa_to_dfa(const NFA& nfa, bool include_dead_state) {
    DFA dfa;
    dfa.alphabet = nfa.alphabet;

    std::queue<std::set<std::string>> queue;
    int state_counter = 0;

    // Step 0: Find epsilon-closure of NFA start state
    auto start_closure = nfa.epsilon_closure(nfa.start_state);
    std::string start_name = state_name_for_index(state_counter++);
    
    dfa.start_state = start_name;
    dfa.states.push_back(start_name);
    dfa.state_subsets[start_name] = start_closure;
    dfa.subset_to_state[start_closure] = start_name;

    // Check if start state is accepting
    bool start_is_accepting = false;
    for (const auto& s : start_closure) {
        if (nfa.accept_states.count(s)) {
            start_is_accepting = true;
            break;
        }
    }
    if (start_is_accepting) {
        dfa.accept_states.insert(start_name);
    }

    int step_id = 1;
    // Record initial step
    {
        ConstructionStep step;
        step.step_id = step_id++;
        step.action = "START_CLOSURE";
        step.source_dfa_state = "";
        step.source_subset = {};
        step.symbol = "ε";
        step.move_result = {nfa.start_state};
        step.closure_result = start_closure;
        step.target_dfa_state = start_name;
        step.target_subset = start_closure;
        step.is_new_state = true;
        step.is_accepting = start_is_accepting;
        
        std::ostringstream oss;
        oss << "Initial State: Compute ε-closure(" << nfa.start_state << ") = " 
            << format_set(start_closure) << ". Designate as DFA Start State " << start_name
            << (start_is_accepting ? " (Accepting State because it contains " : " (Non-accepting)");
        if (start_is_accepting) {
            for (const auto& s : start_closure) {
                if (nfa.accept_states.count(s)) {
                    oss << s << " ∈ F";
                    break;
                }
            }
            oss << ")";
        }
        oss << ".";
        step.explanation = oss.str();
        dfa.steps.push_back(step);
    }

    queue.push(start_closure);

    bool dead_state_created = false;
    std::string dead_state_name = "Dead";

    while (!queue.empty()) {
        auto current_subset = queue.front();
        queue.pop();
        std::string current_name = dfa.subset_to_state[current_subset];

        for (const auto& sym : nfa.alphabet) {
            auto move_res = nfa.move(current_subset, sym);
            auto closure_res = nfa.epsilon_closure_set(move_res);

            if (closure_res.empty()) {
                if (include_dead_state) {
                    if (!dead_state_created) {
                        dead_state_created = true;
                        dfa.has_dead_state = true;
                        dfa.dead_state_name = dead_state_name;
                        dfa.states.push_back(dead_state_name);
                        dfa.state_subsets[dead_state_name] = {};
                        // Dead state self-loops on all symbols
                        for (const auto& s : nfa.alphabet) {
                            dfa.transitions[dead_state_name][s] = dead_state_name;
                        }
                    }
                    dfa.transitions[current_name][sym] = dead_state_name;

                    ConstructionStep step;
                    step.step_id = step_id++;
                    step.action = "TRAP_TRANSITION";
                    step.source_dfa_state = current_name;
                    step.source_subset = current_subset;
                    step.symbol = sym;
                    step.move_result = {};
                    step.closure_result = {};
                    step.target_dfa_state = dead_state_name;
                    step.target_subset = {};
                    step.is_new_state = false;
                    step.is_accepting = false;

                    std::ostringstream oss;
                    oss << "From DFA State " << current_name << " " << format_set(current_subset)
                        << " on symbol '" << sym << "': move is ∅. Transition to Trap State " << dead_state_name << ".";
                    step.explanation = oss.str();
                    dfa.steps.push_back(step);
                } else {
                    // No transition in trimmed DFA
                    ConstructionStep step;
                    step.step_id = step_id++;
                    step.action = "NO_TRANSITION";
                    step.source_dfa_state = current_name;
                    step.source_subset = current_subset;
                    step.symbol = sym;
                    step.move_result = {};
                    step.closure_result = {};
                    step.target_dfa_state = "∅";
                    step.target_subset = {};
                    step.is_new_state = false;
                    step.is_accepting = false;

                    std::ostringstream oss;
                    oss << "From DFA State " << current_name << " " << format_set(current_subset)
                        << " on symbol '" << sym << "': move is ∅. No transition (trimmed).";
                    step.explanation = oss.str();
                    dfa.steps.push_back(step);
                }
            } else {
                std::string target_name;
                bool is_new = false;
                bool is_acc = false;

                if (dfa.subset_to_state.find(closure_res) == dfa.subset_to_state.end()) {
                    is_new = true;
                    target_name = state_name_for_index(state_counter++);
                    dfa.states.push_back(target_name);
                    dfa.state_subsets[target_name] = closure_res;
                    dfa.subset_to_state[closure_res] = target_name;

                    // Check accepting
                    for (const auto& s : closure_res) {
                        if (nfa.accept_states.count(s)) {
                            is_acc = true;
                            break;
                        }
                    }
                    if (is_acc) {
                        dfa.accept_states.insert(target_name);
                    }
                    queue.push(closure_res);
                } else {
                    target_name = dfa.subset_to_state[closure_res];
                    is_acc = dfa.accept_states.count(target_name) > 0;
                }

                dfa.transitions[current_name][sym] = target_name;

                ConstructionStep step;
                step.step_id = step_id++;
                step.action = "TRANSITION";
                step.source_dfa_state = current_name;
                step.source_subset = current_subset;
                step.symbol = sym;
                step.move_result = move_res;
                step.closure_result = closure_res;
                step.target_dfa_state = target_name;
                step.target_subset = closure_res;
                step.is_new_state = is_new;
                step.is_accepting = is_acc;

                std::ostringstream oss;
                oss << "From DFA State " << current_name << " " << format_set(current_subset)
                    << " on input '" << sym << "':\n"
                    << "  1. move(" << current_name << ", '" << sym << "') = " << format_set(move_res) << "\n"
                    << "  2. ε-closure(" << format_set(move_res) << ") = " << format_set(closure_res) << "\n";
                if (is_new) {
                    oss << "  -> Discovered NEW DFA State " << target_name << " = " << format_set(closure_res)
                        << (is_acc ? " [ACCEPTING]" : " [Non-accepting]") << "!";
                } else {
                    oss << "  -> Leads to EXISTING DFA State " << target_name << " = " << format_set(closure_res);
                }
                step.explanation = oss.str();
                dfa.steps.push_back(step);
            }
        }
    }

    return dfa;
}

// DFA Minimization (Hopcroft / Partition refinement)
struct MinimizedDFA {
    std::vector<std::string> states;
    std::vector<std::string> alphabet;
    std::string start_state;
    std::set<std::string> accept_states;
    std::map<std::string, std::map<std::string, std::string>> transitions;
    std::map<std::string, std::set<std::string>> partition_mapping; // Min state -> set of original DFA states
    std::vector<std::string> partition_steps_log;
};

MinimizedDFA minimize_dfa(const DFA& dfa) {
    MinimizedDFA min_dfa;
    min_dfa.alphabet = dfa.alphabet;

    if (dfa.states.empty()) return min_dfa;

    // Partition states into P0 (accepting) and P1 (non-accepting)
    std::set<std::string> F, NF;
    for (const auto& s : dfa.states) {
        if (dfa.accept_states.count(s)) {
            F.insert(s);
        } else {
            NF.insert(s);
        }
    }

    std::vector<std::set<std::string>> partitions;
    if (!NF.empty()) partitions.push_back(NF);
    if (!F.empty()) partitions.push_back(F);

    min_dfa.partition_steps_log.push_back("Initial 0-equivalence partition: Non-accepting " + format_set(NF) + ", Accepting " + format_set(F));

    bool changed = true;
    int iteration = 1;
    while (changed) {
        changed = false;
        std::vector<std::set<std::string>> next_partitions;

        // Helper to find partition index of a state
        auto get_partition_idx = [&](const std::string& st, const std::vector<std::set<std::string>>& parts) -> int {
            for (size_t i = 0; i < parts.size(); ++i) {
                if (parts[i].count(st)) return static_cast<int>(i);
            }
            return -1; // e.g. undefined/dead
        };

        for (const auto& group : partitions) {
            if (group.size() <= 1) {
                next_partitions.push_back(group);
                continue;
            }

            // Split group based on signatures
            // Signature: vector of target partition indices for each symbol in alphabet
            std::map<std::vector<int>, std::set<std::string>> subgroups;
            for (const auto& st : group) {
                std::vector<int> signature;
                for (const auto& sym : dfa.alphabet) {
                    auto it1 = dfa.transitions.find(st);
                    if (it1 != dfa.transitions.end()) {
                        auto it2 = it1->second.find(sym);
                        if (it2 != it1->second.end()) {
                            signature.push_back(get_partition_idx(it2->second, partitions));
                        } else {
                            signature.push_back(-1);
                        }
                    } else {
                        signature.push_back(-1);
                    }
                }
                subgroups[signature].insert(st);
            }

            if (subgroups.size() > 1) {
                changed = true;
            }
            for (const auto& pair : subgroups) {
                next_partitions.push_back(pair.second);
            }
        }

        partitions = next_partitions;
        std::ostringstream oss;
        oss << "Iteration " << iteration++ << ": " << partitions.size() << " partitions: ";
        for (size_t i = 0; i < partitions.size(); ++i) {
            if (i > 0) oss << ", ";
            oss << "P" << i << " " << format_set(partitions[i]);
        }
        min_dfa.partition_steps_log.push_back(oss.str());
    }

    // Build the minimized DFA
    std::map<std::string, std::string> state_to_min_state;
    for (size_t i = 0; i < partitions.size(); ++i) {
        std::string m_name = "M" + std::to_string(i);
        min_dfa.states.push_back(m_name);
        min_dfa.partition_mapping[m_name] = partitions[i];

        bool is_acc = false;
        for (const auto& orig_st : partitions[i]) {
            state_to_min_state[orig_st] = m_name;
            if (orig_st == dfa.start_state) {
                min_dfa.start_state = m_name;
            }
            if (dfa.accept_states.count(orig_st)) {
                is_acc = true;
            }
        }
        if (is_acc) {
            min_dfa.accept_states.insert(m_name);
        }
    }

    // Build transitions
    for (const auto& m_name : min_dfa.states) {
        const auto& orig_states = min_dfa.partition_mapping[m_name];
        if (orig_states.empty()) continue;
        std::string rep = *orig_states.begin(); // Pick representative state

        for (const auto& sym : dfa.alphabet) {
            auto it1 = dfa.transitions.find(rep);
            if (it1 != dfa.transitions.end()) {
                auto it2 = it1->second.find(sym);
                if (it2 != it1->second.end()) {
                    std::string target_orig = it2->second;
                    if (state_to_min_state.count(target_orig)) {
                        min_dfa.transitions[m_name][sym] = state_to_min_state[target_orig];
                    }
                }
            }
        }
    }

    return min_dfa;
}

// String Simulation
struct StringSimStepNFA {
    int index;
    std::string character;
    std::set<std::string> current_states;
    std::set<std::string> move_states;
    std::set<std::string> next_states;
    std::string description;
};

struct StringSimResultNFA {
    std::string input_string;
    bool accepted;
    std::vector<StringSimStepNFA> steps;
    std::string final_verdict;
};

StringSimResultNFA simulate_nfa(const NFA& nfa, const std::string& input_str) {
    StringSimResultNFA res;
    res.input_string = input_str;

    auto current = nfa.epsilon_closure(nfa.start_state);
    
    // Initial step 0
    StringSimStepNFA step0;
    step0.index = 0;
    step0.character = "START";
    step0.current_states = {nfa.start_state};
    step0.move_states = {nfa.start_state};
    step0.next_states = current;
    step0.description = "Start at " + nfa.start_state + ", expand ε-closure: " + format_set(current);
    res.steps.push_back(step0);

    // If input is empty string
    if (input_str.empty() || input_str == "ε") {
        bool acc = false;
        for (const auto& s : current) {
            if (nfa.accept_states.count(s)) {
                acc = true;
                break;
            }
        }
        res.accepted = acc;
        res.final_verdict = acc ? "ACCEPTED: Empty string ε ends in accepting state set " + format_set(current)
                                : "REJECTED: Empty string ε ends in non-accepting state set " + format_set(current);
        return res;
    }

    for (size_t i = 0; i < input_str.size(); ++i) {
        std::string ch(1, input_str[i]);
        StringSimStepNFA step;
        step.index = static_cast<int>(i + 1);
        step.character = ch;
        step.current_states = current;

        auto mv = nfa.move(current, ch);
        step.move_states = mv;

        auto next_set = nfa.epsilon_closure_set(mv);
        step.next_states = next_set;

        std::ostringstream oss;
        oss << "Read '" << ch << "': move(" << format_set(current) << ", '" << ch << "') = " << format_set(mv);
        if (!mv.empty()) {
            oss << ", ε-closure(" << format_set(mv) << ") = " << format_set(next_set);
        } else {
            oss << " (All branches dead/trapped)";
        }
        step.description = oss.str();
        res.steps.push_back(step);

        current = next_set;
    }

    bool acc = false;
    for (const auto& s : current) {
        if (nfa.accept_states.count(s)) {
            acc = true;
            break;
        }
    }
    res.accepted = acc;
    if (acc) {
        std::ostringstream oss;
        oss << "ACCEPTED: Final active state set " << format_set(current) << " contains accepting state(s) {";
        bool first = true;
        for (const auto& s : current) {
            if (nfa.accept_states.count(s)) {
                if (!first) oss << ", ";
                oss << s;
                first = false;
            }
        }
        oss << "}";
        res.final_verdict = oss.str();
    } else {
        res.final_verdict = "REJECTED: Final active state set " + format_set(current) + " contains NO accepting states";
    }

    return res;
}

struct StringSimStepDFA {
    int index;
    std::string character;
    std::string from_state;
    std::string to_state;
    std::string description;
};

struct StringSimResultDFA {
    std::string input_string;
    bool accepted;
    std::vector<StringSimStepDFA> steps;
    std::string final_verdict;
};

StringSimResultDFA simulate_dfa(const DFA& dfa, const std::string& input_str) {
    StringSimResultDFA res;
    res.input_string = input_str;

    std::string current = dfa.start_state;

    // Initial step 0
    StringSimStepDFA step0;
    step0.index = 0;
    step0.character = "START";
    step0.from_state = "";
    step0.to_state = current;
    step0.description = "Start at DFA initial state " + current + " " + format_set(dfa.state_subsets.at(current));
    res.steps.push_back(step0);

    if (input_str.empty() || input_str == "ε") {
        bool acc = dfa.accept_states.count(current) > 0;
        res.accepted = acc;
        res.final_verdict = acc ? "ACCEPTED: DFA initial state " + current + " is an accepting state."
                                : "REJECTED: DFA initial state " + current + " is NOT an accepting state.";
        return res;
    }

    for (size_t i = 0; i < input_str.size(); ++i) {
        std::string ch(1, input_str[i]);
        StringSimStepDFA step;
        step.index = static_cast<int>(i + 1);
        step.character = ch;
        step.from_state = current;

        std::string next_st = "";
        auto it1 = dfa.transitions.find(current);
        if (it1 != dfa.transitions.end()) {
            auto it2 = it1->second.find(ch);
            if (it2 != it1->second.end()) {
                next_st = it2->second;
            }
        }

        if (next_st.empty()) {
            step.to_state = "TRAP";
            step.description = "Read '" + ch + "': No transition from state " + current + ". Simulation halts (REJECTED).";
            res.steps.push_back(step);
            current = "TRAP";
            break;
        } else {
            step.to_state = next_st;
            std::ostringstream oss;
            oss << "Read '" << ch << "': δ(" << current << ", '" << ch << "') -> " << next_st;
            if (dfa.state_subsets.count(next_st)) {
                oss << " " << format_set(dfa.state_subsets.at(next_st));
            }
            step.description = oss.str();
            res.steps.push_back(step);
            current = next_st;
        }
    }

    bool acc = (current != "TRAP" && dfa.accept_states.count(current) > 0);
    res.accepted = acc;
    if (acc) {
        res.final_verdict = "ACCEPTED: Final state " + current + " " + format_set(dfa.state_subsets.at(current)) + " is an accepting state.";
    } else {
        if (current == "TRAP") {
            res.final_verdict = "REJECTED: Halted in undefined / trap state.";
        } else {
            res.final_verdict = "REJECTED: Final state " + current + " is NOT an accepting state.";
        }
    }

    return res;
}

// Convert entire response to JSON
json::Value serialize_response(
    const NFA& nfa,
    const DFA& dfa,
    const MinimizedDFA& min_dfa,
    const std::vector<std::string>& test_strings
) {
    json::Value root = json::Value::object();

    // 1. NFA Details
    json::Value nfa_json = json::Value::object();
    {
        json::Value states_arr = json::Value::array();
        for (const auto& s : nfa.states) states_arr.push_back(s);
        nfa_json["states"] = states_arr;

        json::Value alpha_arr = json::Value::array();
        for (const auto& a : nfa.alphabet) alpha_arr.push_back(a);
        nfa_json["alphabet"] = alpha_arr;

        nfa_json["start_state"] = nfa.start_state;

        json::Value acc_arr = json::Value::array();
        for (const auto& f : nfa.accept_states) acc_arr.push_back(f);
        nfa_json["accept_states"] = acc_arr;

        json::Value trans_arr = json::Value::array();
        for (const auto& p1 : nfa.transitions) {
            for (const auto& p2 : p1.second) {
                for (const auto& to : p2.second) {
                    json::Value t = json::Value::object();
                    t["from"] = p1.first;
                    t["symbol"] = p2.first;
                    t["to"] = to;
                    trans_arr.push_back(t);
                }
            }
        }
        nfa_json["transitions"] = trans_arr;
    }
    root["nfa"] = nfa_json;

    // 2. Epsilon Closures Table
    json::Value closures_obj = json::Value::object();
    for (const auto& s : nfa.states) {
        auto cl = nfa.epsilon_closure(s);
        json::Value cl_arr = json::Value::array();
        for (const auto& item : cl) cl_arr.push_back(item);
        closures_obj[s] = cl_arr;
    }
    root["epsilon_closures"] = closures_obj;

    // 3. NFA Transition Table Matrix
    json::Value nfa_table = json::Value::array();
    for (const auto& s : nfa.states) {
        json::Value row = json::Value::object();
        row["state"] = s;
        row["is_start"] = (s == nfa.start_state);
        row["is_final"] = (nfa.accept_states.count(s) > 0);

        json::Value cols = json::Value::object();
        for (const auto& a : nfa.alphabet) {
            auto tgts = nfa.get_transitions(s, a);
            json::Value tarr = json::Value::array();
            for (const auto& t : tgts) tarr.push_back(t);
            cols[a] = tarr;
        }
        // Epsilon column
        auto eps_tgts = nfa.get_transitions(s, "ε");
        json::Value eps_arr = json::Value::array();
        for (const auto& t : eps_tgts) eps_arr.push_back(t);
        cols["ε"] = eps_arr;

        row["transitions"] = cols;
        nfa_table.push_back(row);
    }
    root["nfa_table"] = nfa_table;

    // 4. Subset Construction Steps (Animation & Table)
    json::Value steps_arr = json::Value::array();
    for (const auto& step : dfa.steps) {
        json::Value s = json::Value::object();
        s["step_id"] = step.step_id;
        s["action"] = step.action;
        s["source_state"] = step.source_dfa_state;

        json::Value src_sub = json::Value::array();
        for (const auto& x : step.source_subset) src_sub.push_back(x);
        s["source_subset"] = src_sub;

        s["symbol"] = step.symbol;

        json::Value mv_sub = json::Value::array();
        for (const auto& x : step.move_result) mv_sub.push_back(x);
        s["move_result"] = mv_sub;

        json::Value cl_sub = json::Value::array();
        for (const auto& x : step.closure_result) cl_sub.push_back(x);
        s["closure_result"] = cl_sub;

        s["target_state"] = step.target_dfa_state;

        json::Value tgt_sub = json::Value::array();
        for (const auto& x : step.target_subset) tgt_sub.push_back(x);
        s["target_subset"] = tgt_sub;

        s["is_new_state"] = step.is_new_state;
        s["is_accepting"] = step.is_accepting;
        s["explanation"] = step.explanation;

        steps_arr.push_back(s);
    }
    root["construction_steps"] = steps_arr;

    // 5. DFA Details
    json::Value dfa_json = json::Value::object();
    {
        json::Value states_arr = json::Value::array();
        for (const auto& s : dfa.states) states_arr.push_back(s);
        dfa_json["states"] = states_arr;

        json::Value alpha_arr = json::Value::array();
        for (const auto& a : dfa.alphabet) alpha_arr.push_back(a);
        dfa_json["alphabet"] = alpha_arr;

        dfa_json["start_state"] = dfa.start_state;

        json::Value acc_arr = json::Value::array();
        for (const auto& f : dfa.accept_states) acc_arr.push_back(f);
        dfa_json["accept_states"] = acc_arr;

        json::Value mapping_obj = json::Value::object();
        for (const auto& pair : dfa.state_subsets) {
            json::Value sub_arr = json::Value::array();
            for (const auto& item : pair.second) sub_arr.push_back(item);
            mapping_obj[pair.first] = sub_arr;
        }
        dfa_json["state_subsets"] = mapping_obj;

        json::Value trans_arr = json::Value::array();
        for (const auto& p1 : dfa.transitions) {
            for (const auto& p2 : p1.second) {
                json::Value t = json::Value::object();
                t["from"] = p1.first;
                t["symbol"] = p2.first;
                t["to"] = p2.second;
                trans_arr.push_back(t);
            }
        }
        dfa_json["transitions"] = trans_arr;
    }
    root["dfa"] = dfa_json;

    // 6. DFA Transition Table Matrix
    json::Value dfa_table = json::Value::array();
    for (const auto& s : dfa.states) {
        json::Value row = json::Value::object();
        row["state"] = s;
        row["is_start"] = (s == dfa.start_state);
        row["is_final"] = (dfa.accept_states.count(s) > 0);

        json::Value sub_arr = json::Value::array();
        if (dfa.state_subsets.count(s)) {
            for (const auto& item : dfa.state_subsets.at(s)) {
                sub_arr.push_back(item);
            }
        }
        row["subset"] = sub_arr;
        row["subset_str"] = dfa.state_subsets.count(s) ? format_set(dfa.state_subsets.at(s)) : "∅";

        json::Value cols = json::Value::object();
        for (const auto& a : dfa.alphabet) {
            std::string target = "-";
            auto it1 = dfa.transitions.find(s);
            if (it1 != dfa.transitions.end()) {
                auto it2 = it1->second.find(a);
                if (it2 != it1->second.end()) {
                    target = it2->second;
                }
            }
            cols[a] = target;
        }
        row["transitions"] = cols;
        dfa_table.push_back(row);
    }
    root["dfa_table"] = dfa_table;

    // 7. Minimized DFA Details
    json::Value min_dfa_json = json::Value::object();
    {
        json::Value states_arr = json::Value::array();
        for (const auto& s : min_dfa.states) states_arr.push_back(s);
        min_dfa_json["states"] = states_arr;

        json::Value alpha_arr = json::Value::array();
        for (const auto& a : min_dfa.alphabet) alpha_arr.push_back(a);
        min_dfa_json["alphabet"] = alpha_arr;

        min_dfa_json["start_state"] = min_dfa.start_state;

        json::Value acc_arr = json::Value::array();
        for (const auto& f : min_dfa.accept_states) acc_arr.push_back(f);
        min_dfa_json["accept_states"] = acc_arr;

        json::Value part_map = json::Value::object();
        json::Value nfa_sub_map = json::Value::object();
        for (const auto& p : min_dfa.partition_mapping) {
            json::Value arr = json::Value::array();
            std::set<std::string> combined_nfa_states;
            for (const auto& item : p.second) {
                arr.push_back(item);
                auto it = dfa.state_subsets.find(item);
                if (it != dfa.state_subsets.end()) {
                    combined_nfa_states.insert(it->second.begin(), it->second.end());
                }
            }
            part_map[p.first] = arr;

            json::Value nfa_arr = json::Value::array();
            for (const auto& ns : combined_nfa_states) nfa_arr.push_back(ns);
            nfa_sub_map[p.first] = nfa_arr;
        }
        min_dfa_json["partitions"] = part_map;
        min_dfa_json["nfa_subsets"] = nfa_sub_map;

        json::Value trans_arr = json::Value::array();
        for (const auto& p1 : min_dfa.transitions) {
            for (const auto& p2 : p1.second) {
                json::Value t = json::Value::object();
                t["from"] = p1.first;
                t["symbol"] = p2.first;
                t["to"] = p2.second;
                trans_arr.push_back(t);
            }
        }
        min_dfa_json["transitions"] = trans_arr;

        json::Value log_arr = json::Value::array();
        for (const auto& l : min_dfa.partition_steps_log) log_arr.push_back(l);
        min_dfa_json["steps_log"] = log_arr;
    }
    root["minimized_dfa"] = min_dfa_json;

    // 8. String Simulations
    json::Value sim_arr = json::Value::array();
    for (const auto& str : test_strings) {
        auto nfa_sim = simulate_nfa(nfa, str);
        auto dfa_sim = simulate_dfa(dfa, str);

        json::Value test_res = json::Value::object();
        test_res["input_string"] = str;
        test_res["accepted"] = dfa_sim.accepted;
        test_res["results_match"] = (nfa_sim.accepted == dfa_sim.accepted);

        // NFA simulation details
        json::Value nsim = json::Value::object();
        nsim["accepted"] = nfa_sim.accepted;
        nsim["verdict"] = nfa_sim.final_verdict;
        json::Value nsteps = json::Value::array();
        for (const auto& st : nfa_sim.steps) {
            json::Value s = json::Value::object();
            s["index"] = st.index;
            s["character"] = st.character;
            
            json::Value cur_arr = json::Value::array();
            for (const auto& x : st.current_states) cur_arr.push_back(x);
            s["current_states"] = cur_arr;

            json::Value mv_arr = json::Value::array();
            for (const auto& x : st.move_states) mv_arr.push_back(x);
            s["move_states"] = mv_arr;

            json::Value nxt_arr = json::Value::array();
            for (const auto& x : st.next_states) nxt_arr.push_back(x);
            s["next_states"] = nxt_arr;

            s["description"] = st.description;
            nsteps.push_back(s);
        }
        nsim["steps"] = nsteps;
        test_res["nfa_simulation"] = nsim;

        // DFA simulation details
        json::Value dsim = json::Value::object();
        dsim["accepted"] = dfa_sim.accepted;
        dsim["verdict"] = dfa_sim.final_verdict;
        json::Value dsteps = json::Value::array();
        for (const auto& st : dfa_sim.steps) {
            json::Value s = json::Value::object();
            s["index"] = st.index;
            s["character"] = st.character;
            s["from_state"] = st.from_state;
            s["to_state"] = st.to_state;
            s["description"] = st.description;
            dsteps.push_back(s);
        }
        dsim["steps"] = dsteps;
        test_res["dfa_simulation"] = dsim;

        sim_arr.push_back(test_res);
    }
    root["simulations"] = sim_arr;

    return root;
}

int main(int argc, char* argv[]) {
    // Read JSON input from stdin or file
    std::string input_text;
    if (argc > 1) {
        std::ifstream ifs(argv[1]);
        if (ifs.is_open()) {
            std::string line;
            while (std::getline(ifs, line)) {
                input_text += line + "\n";
            }
        } else {
            input_text = argv[1]; // passed as string directly
        }
    } else {
        std::string line;
        while (std::getline(std::cin, line)) {
            input_text += line + "\n";
        }
    }

    if (input_text.empty()) {
        std::cerr << "Error: No input JSON provided.\n";
        return 1;
    }

    try {
        json::Value root = json::parse(input_text);

        NFA nfa;
        // Parse states
        if (root.contains("states") && root["states"].is_array()) {
            for (const auto& s : root["states"].as_array()) {
                nfa.states.push_back(s.as_string());
            }
        }

        // Parse alphabet
        if (root.contains("alphabet") && root["alphabet"].is_array()) {
            for (const auto& a : root["alphabet"].as_array()) {
                std::string sym = a.as_string();
                if (!is_epsilon(sym)) {
                    nfa.alphabet.push_back(sym);
                }
            }
        }

        // Parse start state
        if (root.contains("start_state")) {
            nfa.start_state = root["start_state"].as_string();
        }

        // Parse accept states
        if (root.contains("accept_states") && root["accept_states"].is_array()) {
            for (const auto& f : root["accept_states"].as_array()) {
                nfa.accept_states.insert(f.as_string());
            }
        }

        // Parse transitions
        if (root.contains("transitions") && root["transitions"].is_array()) {
            for (const auto& t : root["transitions"].as_array()) {
                std::string from = t["from"].as_string();
                std::string sym = t["symbol"].as_string();
                std::string to = t["to"].as_string();

                if (is_epsilon(sym)) {
                    sym = "ε";
                }
                nfa.transitions[from][sym].insert(to);
            }
        }

        bool include_dead_state = false;
        if (root.contains("include_dead_state") && root["include_dead_state"].is_bool()) {
            include_dead_state = root["include_dead_state"].as_bool();
        }

        // Parse test strings
        std::vector<std::string> test_strings;
        if (root.contains("test_strings") && root["test_strings"].is_array()) {
            for (const auto& s : root["test_strings"].as_array()) {
                test_strings.push_back(s.as_string());
            }
        }

        // Run conversion
        DFA dfa = convert_nfa_to_dfa(nfa, include_dead_state);
        MinimizedDFA min_dfa = minimize_dfa(dfa);

        // Serialize and output
        json::Value result = serialize_response(nfa, dfa, min_dfa, test_strings);
        std::cout << result.dump(2) << std::endl;

    } catch (const std::exception& e) {
        json::Value err = json::Value::object();
        err["error"] = e.what();
        std::cout << err.dump() << std::endl;
        return 1;
    }

    return 0;
}
