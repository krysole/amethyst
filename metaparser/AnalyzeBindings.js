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

import { union } from "./Util.js";

export function AnalyzeBindings(ast) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Grammar") {
    for (let rule of ast.rules) {
      AnalyzeBindings(rule);
    }
  }

  else if (ast.tag === "Rule") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }

  else if (ast.tag === "Choice") {
    for (let pattern of ast.patterns) {
      AnalyzeBindings(pattern);
    }

    ast.bound = ast.patterns.map(p => p.bound).reduce(union, []);
  }
  else if (ast.tag === "Sequence") {
    for (let pattern of ast.patterns) {
      AnalyzeBindings(pattern);
    }

    ast.bound = ast.patterns.map(p => p.bound).reduce(union, []);
  }
  else if (ast.tag === "Bind") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound.slice();
    if (!ast.bound.includes(ast.name)) {
      ast.bound.push(ast.name);
    }
  }
  else if (ast.tag === "Negate") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }
  else if (ast.tag === "Lookahead") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }
  else if (ast.tag === "Repeat") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }
  else if (ast.tag === "Repeat1") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }
  else if (ast.tag === "Delimited") {
    AnalyzeBindings(ast.element);
    AnalyzeBindings(ast.delimiter);

    ast.bound = union(ast.element.bound, ast.delimiter.bound);
  }
  else if (ast.tag === "Delimited1") {
    AnalyzeBindings(ast.element);
    AnalyzeBindings(ast.delimiter);

    ast.bound = union(ast.element.bound, ast.delimiter.bound);
  }
  else if (ast.tag === "Optional") {
    AnalyzeBindings(ast.pattern);

    ast.bound = ast.pattern.bound;
  }
  else if (ast.tag === "Immediate") {
    ast.bound = [];
  }
  else if (ast.tag === "Action") {
    ast.bound = [];
  }
  else if (ast.tag === "Predicate") {
    ast.bound = [];
  }
  else if (ast.tag === "PCall") {
    for (let pattern of ast.patterns) {
      AnalyzeBindings(pattern);
    }

    ast.bound = ast.patterns.map(p => p.bound).reduce(union, []);
  }
  else if (ast.tag === "Call") {
    ast.bound = [];
  }
  else if (ast.tag === "TokenTag") {
    ast.bound = [];
  }
  else if (ast.tag === "TokenText") {
    ast.bound = [];
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}
