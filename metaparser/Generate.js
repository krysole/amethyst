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

let fs   = require("fs");
let url  = require("url");
let path = require("path");

let version = require("./package.json").version;

function scannerlessBuiltins() {
  return fs.readFileSync(path.join(__dirname, "ScannerlessBuiltins.fragment"), "utf8");
}

function tokenBuiltins() {
  return fs.readFileSync(path.join(__dirname, "TokenBuiltins.fragment"), "utf8");
}

function Generate(ast, prefix, tokenFlag) {
  if (ast == null) {
    throw new Error(`Expected non-null ast node.`);
  }

  else if (ast.tag === "Grammar") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    for (let rule of ast.rules) Generate(rule, prefix + "  ");

    ast.js += prefix + `// Generated by MetaParser ${version}.\n`;
    ast.js += prefix + `"use strict";\n`;
    ast.js += prefix + `\n`;
    ast.js += prefix + `const FAIL = Symbol("FAIL");\n`;
    ast.js += prefix + `\n`;
    ast.js += prefix + `class ${ast.name} {\n`;
    ast.js += prefix + `  \n`;
    if (tokenFlag) {
      for (let line of tokenBuiltins().split("\n")) {
        ast.js += prefix + `  ${line}\n`;
      }
    }
    else {
      for (let line of scannerlessBuiltins().split("\n")) {
        ast.js += prefix + `  ${line}\n`;
      }
    }
    for (let rule of ast.rules) {
      ast.js += prefix + `  \n`;
      ast.js += rule.js;
    }
    ast.js += prefix + `  \n`;
    ast.js += prefix + `}\n`;
    ast.js += prefix + `\n`;
    ast.js += prefix + `module.exports = ${ast.name};\n`;
  }

  else if (ast.tag === "Rule") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  ");

    ast.js += prefix + `${ast.name}(${ast.parameters.join(", ")}) {\n`;
    ast.js += prefix + `  let RESULT = FAIL;\n`;
    if (ast.bound.length > 0) {
      ast.js += prefix + `  let ${ast.bound.join(", ")};\n`;
    }
    ast.js += prefix + `  \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  return RESULT;\n`;
    ast.js += prefix + `}\n`;
  }

  else if (ast.tag === "Choice") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    for (let pattern of ast.patterns) Generate(pattern, prefix + "  ");

    ast.js += prefix + `while (true) { // CHOICE\n`;
    ast.js += prefix + `  let INITPOS = this._position;\n`;
    for (let pattern of ast.patterns) {
      ast.js += prefix + `  \n`;
      ast.js += prefix + `  this._position = INITPOS;\n`;
      ast.js += pattern.js;
      ast.js += prefix + `  if (RESULT !== FAIL) break;\n`;
    }
    ast.js +=          `  \n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Sequence") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    for (let pattern of ast.patterns) Generate(pattern, prefix + "  ");

    ast.js += prefix + `while (true) { // SEQUENCE\n`;
    for (let pattern of ast.patterns) {
      ast.js += pattern.js;
      ast.js += prefix + `  if (RESULT === FAIL) break;\n`;
      ast.js += prefix + `  \n`;
    }
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Bind") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix);

    ast.js += ast.pattern.js;
    ast.js += prefix + `${ast.name} = RESULT;\n`;
  }
  else if (ast.tag === "Negate") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  ");

    ast.js += prefix + `while (true) { // NEGATE\n`;
    ast.js += prefix + `  let INITPOS = this._position;\n`;
    ast.js += prefix + `  \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `  if (RESULT === FAIL) RESULT = null;\n`;
    ast.js += prefix + `  else                 RESULT = FAIL;\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  this._position = INITPOS;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Lookahead") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  ");

    ast.js += prefix + `while (true) { // LOOKAHEAD\n`;
    ast.js += prefix + `  let INITPOS = this._position;\n`;
    ast.js += prefix + `  \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  this._position = INITPOS;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Repeat") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  " + "  ");

    ast.js += prefix + `while (true) { // REPEAT\n`;
    ast.js += prefix + `  let ARRAY = [];\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  while (true) {\n`;
    ast.js += prefix + `    let INITPOS = this._position;\n`;
    ast.js += prefix + `    \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `    if (RESULT === FAIL) {\n`;
    ast.js += prefix + `      this._position = INITPOS;\n`;
    ast.js += prefix + `      break;\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    ARRAY.push(RESULT);\n`;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  RESULT = ARRAY;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Repeat1") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  " + "  ");

    ast.js += prefix + `while (true) { // REPEAT1\n`;
    ast.js += prefix + `  let ARRAY = [];\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  while (true) {\n`;
    ast.js += prefix + `    let INITPOS = this._position;\n`;
    ast.js += prefix + `    \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `    if (RESULT === FAIL) {\n`;
    ast.js += prefix + `      this._position = INITPOS;\n`;
    ast.js += prefix + `      break;\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    ARRAY.push(RESULT);\n`;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  if (ARRAY.length === 0) RESULT = FAIL;\n`;
    ast.js += prefix + `  else                    RESULT = ARRAY;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Delimited") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.element,   prefix + "    ");
    Generate(ast.delimiter, prefix + "      ");

    ast.js += prefix + `while (true) { // DELIMITED\n`;
    ast.js += prefix + `  let ARRAY = [];\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  while (true) {\n`;
    ast.js += prefix + `    let INITPOS = this._position;\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    if (ARRAY.length > 0) {\n`;
    ast.js += ast.delimiter.js;
    ast.js += prefix + `      if (RESULT === FAIL) {\n`;
    ast.js += prefix + `        this._position = INITPOS;\n`;
    ast.js += prefix + `        break;\n`;
    ast.js += prefix + `      }\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += ast.element.js;
    ast.js += prefix + `    if (RESULT === FAIL) {\n`;
    ast.js += prefix + `      this._position = INITPOS;\n`;
    ast.js += prefix + `      break;\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    ARRAY.push(RESULT);\n`;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `  RESULT = ARRAY;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Delimited1") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.element,   prefix + "    ");
    Generate(ast.delimiter, prefix + "      ");

    ast.js += prefix + `while (true) { // DELIMITED\n`;
    ast.js += prefix + `  let ARRAY = [];\n`;
    ast.js += prefix + `  \n`;
    ast.js += prefix + `  while (true) {\n`;
    ast.js += prefix + `    let INITPOS = this._position;\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    if (ARRAY.length > 0) {\n`;
    ast.js += ast.delimiter.js;
    ast.js += prefix + `      if (RESULT === FAIL) {\n`;
    ast.js += prefix + `        this._position = INITPOS;\n`;
    ast.js += prefix + `        break;\n`;
    ast.js += prefix + `      }\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += ast.element.js;
    ast.js += prefix + `    if (RESULT === FAIL) {\n`;
    ast.js += prefix + `      this._position = INITPOS;\n`;
    ast.js += prefix + `      break;\n`;
    ast.js += prefix + `    }\n`;
    ast.js += prefix + `    \n`;
    ast.js += prefix + `    ARRAY.push(RESULT);\n`;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `  if (ARRAY.length === 0) RESULT = FAIL;\n`;
    ast.js += prefix + `  else                    RESULT = ARRAY;\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Optional") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    Generate(ast.pattern, prefix + "  ");

    ast.js += prefix + `while (true) { // OPTIONAL\n`;
    ast.js += prefix + `  let INITPOS = this._position;\n`;
    ast.js += prefix + `  \n`;
    ast.js += ast.pattern.js;
    ast.js += prefix + `  if (RESULT === FAIL) {\n`;
    ast.js += prefix + `    this._position = INITPOS;\n`;
    ast.js += prefix + `    RESULT = null;\n`;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `  break;\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "Immediate") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = ${ast.code}();\n`;
  }
  else if (ast.tag === "Action") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = ${ast.code};\n`;
  }
  else if (ast.tag === "Predicate") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = (${ast.code} ? null : FAIL);\n`;
  }
  else if (ast.tag === "PCall") {
    if (prefix == null) prefix = ``;
    ast.js = ``;

    for (let pattern of ast.patterns) Generate(pattern, prefix + "    ");

    ast.js += prefix + `RESULT = this.${ast.name}(\n`;
    for (let i = 0, c = ast.patterns.length; i < c; i++) {
      ast.js += prefix + `  () => {\n`;
      ast.js += prefix + `    let RESULT = FAIL;\n`;
      ast.js += prefix + `    \n`;
      ast.js += ast.patterns[i].js;
      ast.js += prefix + `    \n`;
      ast.js += prefix + `    return RESULT;\n`;
      ast.js += prefix + `  }${i === c - 1 ? "" : ","}\n`;
    }
    ast.js += prefix + `);\n`;
  }
  else if (ast.tag === "Call") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = this.${ast.name}(${ast.code != null ? ast.code : ""});\n`;
  }
  else if (ast.tag === "TokenTag") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = this._tag(${JSON.stringify(ast.name)});\n`;
  }
  else if (ast.tag === "TokenText") {
    if (prefix == null) prefix = ``;

    ast.js = prefix + `RESULT = this._text(${ast.text});\n`;
  }

  else {
    throw new Error(`Expected valid node tag, found ${ast.tag}.`);
  }
}

module.exports = Generate;
