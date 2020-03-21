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

import { transmute } from "./Util.js";

export function Simplify(ast) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Grammar") {
    for (let rule of ast.rules) {
      Simplify(rule);
    }
  }

  else if (ast.tag === "Rule") {
    Simplify(ast.pattern);
  }

  else if (ast.tag === "Choice") {
    for (let pattern of ast.patterns) {
      Simplify(pattern);
    }

    let flattened = [];
    for (let pattern of ast.patterns) {
      if (pattern.tag === "Choice") {
        for (let subpattern of pattern.patterns) {
          flattened.push(subpattern);
        }
      }
      else {
        flattened.push(pattern);
      }
    }

    if (flattened.length > 1) transmute(ast, { tag: "Choice", patterns: flattened });
    else                      transmute(ast, flattened[0]);
  }
  else if (ast.tag === "Sequence") {
    for (let pattern of ast.patterns) {
      Simplify(pattern);
    }

    let flattened = [];
    for (let pattern of ast.patterns) {
      if (pattern.tag === "Sequence") {
        for (let subpattern of pattern.patterns) {
          flattened.push(subpattern);
        }
      }
      else {
        flattened.push(pattern);
      }
    }

    if (flattened.length > 1) transmute(ast, { tag: "Sequence", patterns: flattened });
    else                      transmute(ast, flattened[0]);
  }
  else if (ast.tag === "Bind") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Negate") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Lookahead") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Repeat") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Repeat1") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Delimited") {
    Simplify(ast.element);
    Simplify(ast.delimiter);
  }
  else if (ast.tag === "Delimited1") {
    Simplify(ast.element);
    Simplify(ast.delimiter);
  }
  else if (ast.tag === "Optional") {
    Simplify(ast.pattern);
  }
  else if (ast.tag === "Immediate") {
  }
  else if (ast.tag === "Action") {
  }
  else if (ast.tag === "Predicate") {
  }
  else if (ast.tag === "PCall") {
    for (let pattern of ast.patterns) {
      Simplify(pattern);
    }
  }
  else if (ast.tag === "Call") {
  }
  else if (ast.tag === "TokenTag") {
  }
  else if (ast.tag === "TokenText") {
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}
