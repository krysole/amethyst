//
// The Metaparser Compiler Language
//
// Copyright 2019 Lorenz Pretterhofer <krysole@alexicalmistake.com>
//
// Permission to use, copy, modify, and distribute this work for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE WORK IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS WORK INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS WORK.
//
"use strict";

//
// NOTE
//
// The Left Recursion analysis does not support mutual left recursion between
// multiple production rules. It only allows rewriting of productions that
// call themselves into repetition patterns, allowing additional plain BNF
// grammars to be expressed as the grammar auther requires.
//
// Mutual left recursion is theoretically possible with an extension of this
// technique, but it is much more complicated and outside of the scope of this
// system for the time being.
//

export function LeftRecursion(ast) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Grammar") {
    for (let rule of ast.rules) {
      LeftRecursion(rule);
    }
  }

  else if (ast.tag === "Rule") {
    let base = BasePattern(ast.pattern, ast.name, true);
    let iter = IterPattern(ast.pattern, ast.name, true);

    if (base.tag === "Fail") {
      throw new Error(`No valid base case for production rule ${ast.name}.`);
    }

    if (iter.tag !== "Fail") {
      ast.pattern = {
        tag: "Sequence",
        patterns: [
          { tag: "Bind", name: "LRECRESULT", pattern: base },
          {
            tag: "Repeat",
            pattern: {
              tag: "Sequence",
              patterns: [
                { tag: "Bind", name: "LRECTEMP", pattern: iter },
                { tag: "Bind", name: "LRECRESULT", pattern: { tag: "Action", code: "LRECTEMP" } }
              ]
            }
          },
          { tag: "Action", code: "LRECRESULT" }
        ]
      };
    }
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}

function BasePattern(ast, name, edge) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Choice") {
    let patterns = [];
    for (let pattern of ast.patterns.map(p => BasePattern(p, name, edge))) {
      if (pattern.tag !== "Fail") {
        patterns.push(pattern);
      }
    }
    if (patterns.length !== 0) return { tag: "Choice", patterns: patterns };
    else                       return { tag: "Fail" };
  }
  else if (ast.tag === "Sequence") {
    let patterns = [];
    for (let pattern of ast.patterns) {
      if (patterns.length === 0) {
        patterns.push(BasePattern(pattern, name, edge));
      }
      else {
        patterns.push(BasePattern(pattern, name, false));
      }
    }
    if (patterns[0].tag !== "Fail") return { tag: "Sequence", patterns: patterns };
    else                            return { tag: "Fail" };
  }
  else if (ast.tag === "Bind") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Bind", name: ast.name, pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Negate") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Negate", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Lookahead") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Lookahead", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Repeat") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Repeat", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Repeat1") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Repeat1", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Delimited") {
    let element = BasePattern(ast.element, name, edge);
    let delimiter = BasePattern(ast.delimiter, name, edge);
    if (element.tag !== "Fail") return { tag: "Delimited", element: element, delimiter: delimiter };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Delimited1") {
    let element = BasePattern(ast.element, name, edge);
    let delimiter = BasePattern(ast.delimiter, name, edge);
    if (element.tag !== "Fail") return { tag: "Delimited1", element: element, delimiter: delimiter };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Optional") {
    let pattern = BasePattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Optional", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Immediate") {
    return { tag: "Immediate", code: ast.code };
  }
  else if (ast.tag === "Action") {
    return { tag: "Action", code: ast.code };
  }
  else if (ast.tag === "Predicate") {
    return { tag: "Predicate", code: ast.code };
  }
  else if (ast.tag === "PCall") {
    if (ast.name === name && edge) return { tag: "Fail" };
    else                           return { tag: "Call", name: ast.name, patterns: ast.patterns };
  }
  else if (ast.tag === "Call") {
    if (ast.name === name && edge) return { tag: "Fail" };
    else                           return { tag: "Call", name: ast.name, code: ast.code };
  }
  else if (ast.tag === "TokenTag") {
    return { tag: "TokenTag", name: ast.name };
  }
  else if (ast.tag === "TokenText") {
    return { tag: "TokenText", text: ast.text };
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}

function IterPattern(ast, name, edge) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Choice") {
    let patterns = [];
    for (let pattern of ast.patterns.map(p => IterPattern(p, name, edge))) {
      if (pattern.tag !== "Fail") {
        patterns.push(pattern);
      }
    }
    if (patterns.length !== 0) return { tag: "Choice", patterns: patterns };
    else                       return { tag: "Fail" };
  }
  else if (ast.tag === "Sequence") {
    let patterns = [];
    for (let pattern of ast.patterns) {
      if (patterns.length === 0) {
        patterns.push(IterPattern(pattern, name, edge));
      }
      else {
        patterns.push(IterPattern(pattern, name, false));
      }
    }
    if (patterns[0].tag !== "Fail") return { tag: "Sequence", patterns: patterns };
    else                            return { tag: "Fail" };
  }
  else if (ast.tag === "Bind") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Bind", name: ast.name, pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Negate") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Negate", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Lookahead") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Lookahead", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Repeat") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Repeat", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Repeat1") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Repeat1", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Delimited") {
    let element = IterPattern(ast.element, name, edge);
    let delimiter = IterPattern(ast.delimiter, name, edge);
    if (element.tag !== "Fail") return { tag: "Delimited", element: element, delimiter: delimiter };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Delimited1") {
    let element = IterPattern(ast.element, name, edge);
    let delimiter = IterPattern(ast.delimiter, name, edge);
    if (element.tag !== "Fail") return { tag: "Delimited1", element: element, delimiter: delimiter };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Optional") {
    let pattern = IterPattern(ast.pattern, name, edge);
    if (pattern.tag !== "Fail") return { tag: "Optional", pattern: pattern };
    else                        return { tag: "Fail" };
  }
  else if (ast.tag === "Immediate") {
    if (!edge) return { tag: "Immediate", code: ast.code };
    else       return { tag: "Fail" };
  }
  else if (ast.tag === "Action") {
    if (!edge) return { tag: "Action", code: ast.code };
    else       return { tag: "Fail" };
  }
  else if (ast.tag === "Predicate") {
    if (!edge) return { tag: "Predicate", code: ast.code };
    else       return { tag: "Fail" };
  }
  else if (ast.tag === "PCall") {
    if (!edge) {
      return { tag: "PCall", name: ast.name, patterns: ast.patterns };
    }
    else {
      if (ast.name === name) throw new Error("Cannot pcall production rule left recursively.");
      else                   return { tag: "Fail" };
    }
  }
  else if (ast.tag === "Call") {
    if (!edge) {
      return { tag: "Call", name: ast.name, code: ast.code };
    }
    else {
      if (ast.name === name) return { tag: "Action", code: "LRECRESULT" };
      else                   return { tag: "Fail" };
    }
  }
  else if (ast.tag === "TokenTag") {
    if (!edge) return { tag: "TokenTag", name: ast.name };
    else       return { tag: "Fail" };
  }
  else if (ast.tag === "TokenText") {
    if (!edge) return { tag: "TokenText", text: ast.text };
    else       return { tag: "Fail" };
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}
