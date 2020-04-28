//
// The Amethyst Programming Language
//
// Copyright 2020 Lorenz Pretterhofer <krysole@alexicalmistake.com>
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

class Loc {

  constructor(path, string, start, end) {
    let line   = 1;
    let column = 1;

    for (let i = 0, c = start; i < c; i++) {
      if (string[i] === "\r") {
        if (string[i + 1] === "\n") i++;
        line++;
        column = 1;
      }
      else if (string[i] === "\n") {
        if (string[i + 1] === "\r") i++;
        line++;
        column = 1;
      }
      else {
        column++;
      }
    }

    this.path   = path;
    this.start  = start;
    this.line   = line;
    this.column = column;
    this.end    = end;
  }

  toString() {
    return `${this.path}:${this.line}:${this.column}`;
  }

}

class Lexer {

  constructor(input, path) {
    this.input       = input;
    this.path        = path;
    this.position    = 0;
    this.indentation = 0;
    this.nesting     = ["DEFAULT"];
    this.tokens      = [];
  }

  push(tag) {
    this.nesting.push(tag);

    return true;
  }

  pop(tag) {
    if (this.nesting[this.nesting.length - 1] === tag) {
      this.nesting.pop();
      return true;
    }
    else {
      return false;
    }
  }

  top(tag) {
    if (this.nesting[this.nesting.length - 1] === tag) {
      return true;
    }
    else {
      return false;
    }
  }

  get(index) {
    while (index >= this.tokens.length) {
      this.advance();
      // This may produce an infinite stream of END tokens. This is intentional.
      // The parser is expected to stop asking for tokens after an END token.
    }

    return this.tokens[index];
  }

  all() {
    while (this.tokens.length === 0 || this.tokens[this.tokens.length - 1].tag !== "END") {
      this.advance();
    }

    return this.tokens;
  }

  emit(token) {
    this.tokens.push(token);
  }

  read(regexp) {
    regexp.lastIndex = this.position;

    let result = this.input.match(regexp);
    if (result != null) this.position += result[0].length;

    return result;
  }

  loc(start, length) {
    return new Loc(this.path, this.input, start, start + length);
  }

  advance() {
    let result = null;

    if (this.top("STRING")) {
      // STRING
      result = this.read(/((?!{{)(?!")(?![\n\r])(?!\\).|\\.)+/y);
      if (result != null) {
        this.emit({
          tag:   "STRING",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: this.unescape(result[0])
        });
        return;
      }

      // {{
      result = this.read(/{{/y);
      if (result != null) {
        this.push("INTERPOLATION");
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // "
      result = this.read(/"/y);
      if (result != null && this.pop("STRING")) {
        this.emit({
          tag: "PUNC",
          loc: this.loc(result.index, result[0].length),
          text: result[0],
          value: null
        });
        return;
      }

      // INVALID
      throw new Error(`Invalid token at ${this.loc(this.position), 0}.`);
    }
    else {
      // Filter out any whitespace tokens before attempting to read next token.
      if (this.whitespace()) {
        return; // Whitespace used token read ahead.
      }

      // ID
      result = this.read(/[A-Za-z_][A-Za-z_0-9]*[']*[?!]?/y);
      if (result != null) {
        this.emit({
          tag:   "ID",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // NUMBER [FLOAT]
      result = this.read(/[0-9][0-9_]*\.[0-9][0-9_]*([eE][0-9][0-9_])?/y);
      if (result != null) {
        this.emit({
          tag:   "NUMBER",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: parseFloat(result[0].replace(/_/g, ""))
        });
        return;
      }

      // NUMBER [HEXADECIMAL]
      result = this.read(/0x([0-9A-Fa-f][0-9A-Fa-f_]*)/y);
      if (result != null) {
        this.emit({
          tag:   "NUMBER",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: parseInt(result[1], 16)
        });
        return;
      }

      // NUMBER [OCTAL]
      result = this.read(/0o([0-7][0-7_]*)/y);
      if (result != null) {
        this.emit({
          tag:   "NUMBER",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: parseInt(result[1], 8)
        });
        return;
      }

      // NUMBER [BINARY]
      result = this.read(/0b([0-1][0-1_]*)/y);
      if (result != null) {
        this.emit({
          tag:   "NUMBER",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: parseInt(result[1], 2)
        });
        return;
      }

      // NUMBER [DECIMAL]
      result = this.read(/([0-9][0-9_]*)/y);
      if (result != null) {
        this.emit({
          tag:   "NUMBER",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: parseInt(result[1], 10)
        });
        return;
      }

      // "
      result = this.read(/"/y);
      if (result != null) {
        this.push("STRING");
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // OP
      // === ~== == ~= <= >= < > <>
      // = # ->
      // + - * /
      // | ^ & ~
      // <<< >>> << >>
      // ++
      result = this.read(/<>|<<<|>>>|<<|>>|===|~==|==|~=|<=|>=|<|>|=|#|->|\+\+|\+|\-|\*|\/|\||\^|\&|\~/y);
      if (result != null) {
        this.emit({
          tag:   "OP",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC
      // ... .. . : , ; ?
      result = this.read(/\$|\.\.\.|\.\.|\.|\:|\,|\;|\?/y);
      if (result != null) {
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC "("
      result = this.read(/\(/y);
      if (result != null) {
        this.push("PAREN");
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC ")"
      result = this.read(/\)/y);
      if (result != null && this.pop("PAREN") ||
          result != null && this.pop("BRACKET")) {
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC "["
      result = this.read(/\[/y);
      if (result != null) {
        this.push("BRACKET");
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC "]"
      result = this.read(/\]/y);
      if (result != null && this.pop("PAREN") ||
          result != null && this.pop("BRACKET")) {
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC "{"
      result = this.read(/\{/y);
      if (result != null) {
        this.push("BRACE");
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // PUNC "}"
      result = this.read(/\}/y);
      if (result != null && this.pop("BRACE")) {
        this.emit({
          tag:   "PUNC",
          loc:   this.loc(result.index, result[0].length),
          text:  result[0],
          value: null
        });
        return;
      }

      // END
      if (this.position === this.input.length) {
        if (this.tokens.length > 0 && this.tokens[this.tokens.length - 1].tag !== "TERM") {
          // Insert TERM after non TERM and before END token.
          this.emit({
            tag:   "TERM",
            loc:   this.loc(this.position, 0),
            text:  "",
            value: null
          });
        }
        this.emit({
          tag:   "END",
          loc:   this.loc(this.position, 0),
          text:  "",
          value: null
        });
        return;
      }

      // INVALID
      throw new Error(`Invalid token at ${this.loc(this.position, 0)}.`);
    }
  }

  whitespace() {
    // We handle whitespace separately from the rest of the lexer since we're
    // not preserving whitespace tokens. We emit all layout tokens here except
    // for LINE_TERMINATOR before END where one is missing, which can be seen
    // in the END token rule.

    let indentation     = null;
    let newlinePosition = null;
    let linePosition    = null;
    let result          = null;

    while (true) {
      if (this.top("BLOCK_COMMENT")) {
        // BLOCK_COMMENT_START
        result = this.read(/{#/y);
        if (result != null) {
          this.push("BLOCK_COMMENT");
          continue;
        }

        // BLOCK_COMMENT_END
        result = this.read(/#}/y);
        if (result != null && this.pop("BLOCK_COMMENT")) {
          continue;
        }

        // BLOCK_COMMENT_TEXT
        result = this.read(/[\s\S]/y); // Bloody dot doesn't work quite right in JS... or most systems really.
        if (result != null) {
          continue;
        }

        // BLOCK_COMMENT_UNTERMINATED
        throw new Error(`Unterminated block comment at ${this.loc(this.position, 0)}.`);
      }
      else {
        // SPACES
        result = this.read(/[ ]+/y);
        if (result != null) {
          continue;
        }

        // LINE_COMMENT
        result = this.read(/--((?![\n\r]).)*(?=(\r\n?|\n\r?))/y);
        if (result != null) {
          continue;
        }

        // BLOCK_COMMENT_START
        result = this.read(/{#/y);
        if (result != null) {
          this.push("BLOCK_COMMENT");
          continue;
        }

        // NEWLINE
        result = this.read(/\r\n?|\n\r?/y);
        if (result != null) {
          // After a newline read out any indentation spaces.
          // Tabs are not supported.
          indentation     = this.read(/[ ]*/y)[0].length;
          newlinePosition = result.index;
          linePosition    = result.index + result[0].length;
          continue;
        }

        // NO_WHITESPACE
        break;
      }
    }

    // Layout rule handling.
    if (indentation != null) {
      if (indentation > this.indentation + 2) {
        return false; // Continuation line, no token generated.
      }
      else if (indentation === this.indentation + 2) {
        this.indentation = indentation;
        this.emit({
          tag:   "INDENT",
          loc:   this.loc(linePosition, 0),
          text:  "",
          value: null
        });
        return true; // Token emitted.
      }
      else if (indentation === this.indentation) {
        if (this.tokens.length === 0) {
          // Don't emit LINE_TERMINATOR for leading whitespace.
        }
        else if (this.tokens[this.tokens.length - 1].tag === "(") {
          // Don't emit LINE_TERMINATOR for empty () pairs.
          let token = this.get(this.tokens.length);
          if (token.tag === ")") {
            return true; // Token emitted.
          }
          else {
            throw new Error(`Expected ')' at ${this.loc(this.position, 0)}.`);
          }
        }
        else if (this.tokens[this.tokens.length - 1].tag === "[") {
          // Don't emit LINE_TERMINATOR for empty [] pairs.
          let token = this.get(this.tokens.length);
          if (token.tag === "]") {
            return true; // Token emitted.
          }
          else {
            throw new Error(`Expected ']' at ${this.loc(this.position, 0)}.`);
          }
        }
        else if (this.tokens[this.tokens.length - 1].tag === "{") {
          // Don't emit LINE_TERMINATOR for empty [] pairs.
          let token = this.get(this.tokens.length);
          if (token.tag === "}") {
            return true; // Token emitted.
          }
          else {
            throw new Error(`Expected '}' at ${this.loc(this.position, 0)}.`);
          }
        }
        else {
          this.emit({
            tag:   "TERM",
            loc:   this.loc(newlinePosition, 0),
            text:  "",
            value: null
          });
          return true; // Token emitted.
        }
      }
      else if (indentation === this.indentation - 2) {
        this.indentation = indentation;
        if (this.tokens[this.tokens.length - 1].tag !== "INDENT") {
          // Generate final LINE_TERMINATOR for indented block unless there is
          // no code in the block.
          this.emit({
            tag:   "TERM",
            loc:   this.loc(newlinePosition, 0),
            text:  "",
            value: null
          });
        }
        this.emit({
          tag:   "DEDENT",
          loc:   this.loc(linePosition, 0),
          text:  "",
          value: null
        });
        return true; // Token emitted.
      }
      else {
        // Invalid indentation level, bad source code line.
        throw new Error(`Invalid indentation at ${this.loc(this.position, 0)}.`);
      }
    }
    else {
      return false; // No token emitted.
    }
  }

  unescape(s, loc) {
    let i = 0;
    let r = "";
    let c = null;

    while (i < s.length) {
      c = s[i++];

      if (c === "\\") {
        c = s[i++];

        if      (c === "a")  r += "\x07";
        else if (c === "b")  r += "\x08";
        else if (c === "t")  r += "\x09";
        else if (c === "n")  r += "\x0A";
        else if (c === "v")  r += "\x0B";
        else if (c === "f")  r += "\x0C";
        else if (c === "r")  r += "\x0D";
        else if (c === "\\") r += "\\";
        else if (c === "\'") r += "\'";
        else if (c === "\"") r += "\"";
        else if (c === "x") {
          let e = "";

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          r += String.fromCharCode(parseInt(e, 16));
        }
        else if (c === "u") {
          let e = "";

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          r += String.fromCharCode(parseInt(e, 16));
        }
        else if (c === "U") {
          let e = "";

          if (s[i] === "+") i++;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          c = s[i++];
          if (!c.match(/[0-9A-Fa-f]/)) throw new Error(`Bad excape code at ${loc}.`);
          e += c;

          r += String.fromCharCode(parseInt(e, 16));
        }
        else {
          throw new Error(`Bad excape code at ${loc}.`);
        }
      }
      else {
        r += c
      }
    }

    return r;
  }

}

module.exports     = Lexer;
module.exports.Loc = Loc;
