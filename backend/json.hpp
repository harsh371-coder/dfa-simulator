#ifndef SIMPLE_JSON_HPP
#define SIMPLE_JSON_HPP

#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <stdexcept>
#include <cctype>
#include <memory>
#include <iostream>

namespace json {

enum class Type { Null, Boolean, Number, String, Array, Object };

struct Value {
    Type type = Type::Null;
    bool bool_val = false;
    double num_val = 0.0;
    std::string str_val;
    std::vector<Value> arr_val;
    std::map<std::string, Value> obj_val;

    Value() : type(Type::Null) {}
    Value(bool b) : type(Type::Boolean), bool_val(b) {}
    Value(int n) : type(Type::Number), num_val(n) {}
    Value(double n) : type(Type::Number), num_val(n) {}
    Value(const char* s) : type(Type::String), str_val(s) {}
    Value(const std::string& s) : type(Type::String), str_val(s) {}

    static Value object() {
        Value v;
        v.type = Type::Object;
        return v;
    }

    static Value array() {
        Value v;
        v.type = Type::Array;
        return v;
    }

    bool is_null() const { return type == Type::Null; }
    bool is_bool() const { return type == Type::Boolean; }
    bool is_number() const { return type == Type::Number; }
    bool is_string() const { return type == Type::String; }
    bool is_array() const { return type == Type::Array; }
    bool is_object() const { return type == Type::Object; }

    const std::string& as_string() const { return str_val; }
    int as_int() const { return static_cast<int>(num_val); }
    double as_double() const { return num_val; }
    bool as_bool() const { return bool_val; }
    const std::vector<Value>& as_array() const { return arr_val; }
    std::vector<Value>& as_array() { return arr_val; }
    const std::map<std::string, Value>& as_object() const { return obj_val; }
    std::map<std::string, Value>& as_object() { return obj_val; }

    bool contains(const std::string& key) const {
        return type == Type::Object && obj_val.find(key) != obj_val.end();
    }

    Value& operator[](const std::string& key) {
        if (type != Type::Object) {
            type = Type::Object;
            obj_val.clear();
        }
        return obj_val[key];
    }

    const Value& operator[](const std::string& key) const {
        static Value null_val;
        if (type != Type::Object) return null_val;
        auto it = obj_val.find(key);
        if (it != obj_val.end()) return it->second;
        return null_val;
    }

    Value& operator[](size_t index) {
        if (type != Type::Array) {
            type = Type::Array;
            arr_val.clear();
        }
        if (index >= arr_val.size()) arr_val.resize(index + 1);
        return arr_val[index];
    }

    const Value& operator[](size_t index) const {
        static Value null_val;
        if (type != Type::Array || index >= arr_val.size()) return null_val;
        return arr_val[index];
    }

    void push_back(const Value& v) {
        if (type != Type::Array) {
            type = Type::Array;
            arr_val.clear();
        }
        arr_val.push_back(v);
    }

    std::string dump(int indent = -1, int current_indent = 0) const {
        std::ostringstream ss;
        std::string nl = (indent >= 0) ? "\n" : "";
        std::string space = (indent >= 0) ? " " : "";
        std::string ind = (indent >= 0) ? std::string(current_indent, ' ') : "";
        std::string next_ind = (indent >= 0) ? std::string(current_indent + indent, ' ') : "";

        switch (type) {
            case Type::Null:
                ss << "null";
                break;
            case Type::Boolean:
                ss << (bool_val ? "true" : "false");
                break;
            case Type::Number:
                if (num_val == (int64_t)num_val) {
                    ss << (int64_t)num_val;
                } else {
                    ss << num_val;
                }
                break;
            case Type::String: {
                ss << "\"";
                for (char c : str_val) {
                    switch (c) {
                        case '"': ss << "\\\""; break;
                        case '\\': ss << "\\\\"; break;
                        case '\b': ss << "\\b"; break;
                        case '\f': ss << "\\f"; break;
                        case '\n': ss << "\\n"; break;
                        case '\r': ss << "\\r"; break;
                        case '\t': ss << "\\t"; break;
                        default:
                            if (static_cast<unsigned char>(c) < 32) {
                                char buf[8];
                                snprintf(buf, sizeof(buf), "\\u%04x", c);
                                ss << buf;
                            } else {
                                ss << c;
                            }
                    }
                }
                ss << "\"";
                break;
            }
            case Type::Array: {
                if (arr_val.empty()) {
                    ss << "[]";
                } else {
                    ss << "[" << nl;
                    for (size_t i = 0; i < arr_val.size(); ++i) {
                        ss << next_ind << arr_val[i].dump(indent, current_indent + (indent >= 0 ? indent : 0));
                        if (i + 1 < arr_val.size()) ss << ",";
                        ss << nl;
                    }
                    ss << ind << "]";
                }
                break;
            }
            case Type::Object: {
                if (obj_val.empty()) {
                    ss << "{}";
                } else {
                    ss << "{" << nl;
                    size_t i = 0;
                    for (auto const& pair : obj_val) {
                        ss << next_ind << "\"" << pair.first << "\":" << space
                           << pair.second.dump(indent, current_indent + (indent >= 0 ? indent : 0));
                        if (++i < obj_val.size()) ss << ",";
                        ss << nl;
                    }
                    ss << ind << "}";
                }
                break;
            }
        }
        return ss.str();
    }
};

class Parser {
    const std::string& src;
    size_t pos = 0;

    void skip_whitespace() {
        while (pos < src.size() && (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n' || src[pos] == '\r')) {
            pos++;
        }
    }

    char peek() {
        skip_whitespace();
        if (pos >= src.size()) return '\0';
        return src[pos];
    }

    char get() {
        skip_whitespace();
        if (pos >= src.size()) return '\0';
        return src[pos++];
    }

    std::string parse_string() {
        if (get() != '"') throw std::runtime_error("Expected '\"' at start of string");
        std::string s;
        while (pos < src.size()) {
            char c = src[pos++];
            if (c == '"') return s;
            if (c == '\\') {
                if (pos >= src.size()) throw std::runtime_error("Unterminated escape sequence");
                char esc = src[pos++];
                switch (esc) {
                    case '"': s += '"'; break;
                    case '\\': s += '\\'; break;
                    case '/': s += '/'; break;
                    case 'b': s += '\b'; break;
                    case 'f': s += '\f'; break;
                    case 'n': s += '\n'; break;
                    case 'r': s += '\r'; break;
                    case 't': s += '\t'; break;
                    case 'u': {
                        if (pos + 4 > src.size()) throw std::runtime_error("Incomplete unicode escape");
                        std::string hex_str = src.substr(pos, 4);
                        pos += 4;
                        unsigned int codepoint = 0;
                        std::stringstream hss;
                        hss << std::hex << hex_str;
                        hss >> codepoint;
                        // Quick utf-8 encode for standard range
                        if (codepoint <= 0x7f) {
                            s += static_cast<char>(codepoint);
                        } else if (codepoint <= 0x7ff) {
                            s += static_cast<char>(0xc0 | ((codepoint >> 6) & 0x1f));
                            s += static_cast<char>(0x80 | (codepoint & 0x3f));
                        } else {
                            s += static_cast<char>(0xe0 | ((codepoint >> 12) & 0x0f));
                            s += static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f));
                            s += static_cast<char>(0x80 | (codepoint & 0x3f));
                        }
                        break;
                    }
                    default: s += esc; break;
                }
            } else {
                s += c;
            }
        }
        throw std::runtime_error("Unterminated string");
    }

    Value parse_number() {
        size_t start = pos;
        if (pos < src.size() && (src[pos] == '-' || src[pos] == '+')) pos++;
        while (pos < src.size() && (std::isdigit(src[pos]) || src[pos] == '.' || src[pos] == 'e' || src[pos] == 'E' || src[pos] == '+' || src[pos] == '-')) {
            pos++;
        }
        std::string num_str = src.substr(start, pos - start);
        double val = std::stod(num_str);
        return Value(val);
    }

    Value parse_array() {
        if (get() != '[') throw std::runtime_error("Expected '['");
        Value v = Value::array();
        if (peek() == ']') {
            get();
            return v;
        }
        while (true) {
            v.push_back(parse_value());
            char c = peek();
            if (c == ']') {
                get();
                break;
            } else if (c == ',') {
                get();
            } else {
                throw std::runtime_error("Expected ',' or ']' in array");
            }
        }
        return v;
    }

    Value parse_object() {
        if (get() != '{') throw std::runtime_error("Expected '{'");
        Value v = Value::object();
        if (peek() == '}') {
            get();
            return v;
        }
        while (true) {
            skip_whitespace();
            if (peek() != '"') throw std::runtime_error("Expected string key in object");
            std::string key = parse_string();
            if (get() != ':') throw std::runtime_error("Expected ':' after key in object");
            Value val = parse_value();
            v[key] = val;
            char c = peek();
            if (c == '}') {
                get();
                break;
            } else if (c == ',') {
                get();
            } else {
                throw std::runtime_error("Expected ',' or '}' in object");
            }
        }
        return v;
    }

public:
    Parser(const std::string& input) : src(input), pos(0) {}

    Value parse_value() {
        skip_whitespace();
        char c = peek();
        if (c == '{') return parse_object();
        if (c == '[') return parse_array();
        if (c == '"') return Value(parse_string());
        if (std::isdigit(c) || c == '-') return parse_number();
        if (c == 't' || c == 'f') {
            std::string word;
            while (pos < src.size() && std::isalpha(src[pos])) word += src[pos++];
            if (word == "true") return Value(true);
            if (word == "false") return Value(false);
            throw std::runtime_error("Invalid boolean literal: " + word);
        }
        if (c == 'n') {
            std::string word;
            while (pos < src.size() && std::isalpha(src[pos])) word += src[pos++];
            if (word == "null") return Value();
            throw std::runtime_error("Invalid literal: " + word);
        }
        throw std::runtime_error(std::string("Unexpected character: ") + c);
    }
};

inline Value parse(const std::string& str) {
    Parser p(str);
    return p.parse_value();
}

} // namespace json

#endif // SIMPLE_JSON_HPP
