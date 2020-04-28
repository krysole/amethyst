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

let { transmute, equal } = require("./Util.js");

function LeftFactor(ast) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Grammar") {
    for (let rule of ast.rules) {
      LeftFactor(rule);
    }
  }

  else if (ast.tag === "Rule") {
    LeftFactor(ast.pattern);
  }

  else if (ast.tag === "Choice") {
    // Collate each branch into an array rather than a sequence.
    let branches = [];
    for (let pattern of ast.patterns) {
      if (pattern.tag === "Sequence") {
        branches.push(pattern.patterns);
      }
      else {
        branches.push([pattern]);
      }
    }

    // Collate the common head patterns of each branch sequence, and place the
    // tail of each branch in a corresponding array of tails for each
    // respective head.
    let heads = [];
    let tails = [];
    for (let branch of branches) {
      for (let i = 0; i < heads.length; i++) {
        if (equal(heads[i], branch[0])) {
          tails[i].push(branch.slice(1));
          branch = null;
          break;
        }
      }

      if (branch != null) {
        heads.push(branch[0]);
        tails.push([branch.slice(1)]);
      }
    }

    // Check for malformed choice patterns like (a | a b) and abort left
    // factoring for these cases. This ensures that all grammars generate a
    // working parser, although these malformed cases will not perform
    // optimally. The result would have to be saved to a variable in the head
    // and then returned, which is unecessarily complex for a case that
    // doesn't really arise in production grammars.
    for (let i = 0; i < tails.length; i++) {
      if (tails[i].length >= 2 && tails[i].some(tail => tail.length === 0)) {
        // Recurse into each branch to left factor that branch.
        for (let branch of ast.patterns) {
          LeftFactor(branch);
        }

        // Escape without altering structure of this choice node.
        return;
      }
    }

    // Reconstruct the ast.
    let result = { tag: "Choice", patterns: [] };
    for (let i = 0; i < heads.length; i++) {
      if (tails[i].length === 1) {
        if (tails[i][0].length === 0) {
          // No tail exists so we can just push the head.
          let branch = heads[i];

          result.patterns.push(branch);
        }
        else {
          // Single tail exists so recombine the head with the sole tail.
          let head   = heads[i];
          let tail   = tails[i][0];
          let branch = { tag: "Sequence", patterns: [head, ...tail] };

          result.patterns.push(branch);
        }
      }
      else {
        // Multiple tails that have been left factored.
        let head     = heads[i];
        let tailseqs = tails[i].map(ps => ({ tag: "Sequence", patterns: ps }));
        let tail     = { tag: "Choice", patterns: tailseqs };
        let branch   = { tag: "Sequence", patterns: [head, tail] };

        result.patterns.push(branch);
      }
    }

    // Transmute the current AST node into the new choice AST.
    transmute(ast, result);

    // Recurse into each branch to left factor that branch.
    for (let branch of ast.patterns) {
      LeftFactor(branch);
    }
  }
  else if (ast.tag === "Sequence") {
    for (let pattern of ast.patterns) {
      LeftFactor(pattern);
    }
  }
  else if (ast.tag === "Bind") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Negate") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Lookahead") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Repeat") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Repeat1") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Delimited") {
    LeftFactor(ast.element);
    LeftFactor(ast.delimiter);
  }
  else if (ast.tag === "Delimited1") {
    LeftFactor(ast.element);
    LeftFactor(ast.delimiter);
  }
  else if (ast.tag === "Optional") {
    LeftFactor(ast.pattern);
  }
  else if (ast.tag === "Immediate") {
  }
  else if (ast.tag === "Action") {
  }
  else if (ast.tag === "Predicate") {
  }
  else if (ast.tag === "PCall") {
    for (let pattern of ast.patterns) {
      LeftFactor(pattern);
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

module.exports = LeftFactor;
