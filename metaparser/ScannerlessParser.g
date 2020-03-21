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

grammar ScannerlessParser {

  grammar {
    id("grammar") id:n
    p("{")
    rule*:rs
    p("}")
    end
    !{ tag: "Grammar", name: n, rules: rs }
  }


  rule {
    id:n parameters:ps p("{") choice:p p("}")
    !{ tag: "Rule", name: n, parameters: ps, pattern: p }
  }
  parameters {
  | p("(") id:p ( p(",") id )*:ps p(")") !ps.unshift(p) !ps
  |                                                     ![]
  }


  choice {
    p("|")? sequence:a
    ( p("|") sequence:b !{ tag: "Choice", patterns: [a, b] }:a )*
    !a
  }
  sequence {
    bind:a
    ( ws bind:b !{ tag: "Sequence", patterns: [a, b] }:a )*
    !a
  }
  bind {
  | delimited:p ~ws p(":") ~ws id:n !{ tag: "Bind", name: n, pattern: p }
  | delimited
  }
  delimited {
  | p("(") choice:e p(";") choice:d p(")") p("*") !{ tag: "Delimited",  element: e, delimiter: d }
  | p("(") choice:e p(";") choice:d p(")") p("+") !{ tag: "Delimited1", element: e, delimiter: d }
  | operator
  }
  operator {
  | p("~") primary:p        !{ tag: "Negate",    pattern: p }
  | p("&") primary:p        !{ tag: "Lookahead", pattern: p }
  |        primary:p p("*") !{ tag: "Repeat",    pattern: p }
  |        primary:p p("+") !{ tag: "Repeat1",   pattern: p }
  |        primary:p p("?") !{ tag: "Optional",  pattern: p }
  |        primary
  }
  primary {
  | immediate
  | action
  | predicate
  | pcall
  | call
  | subpattern
  }
  immediate {
    p("%") jsInline:c !{ tag: "Immediate", code: c }
  }
  action {
    p("!") jsInline:c !{ tag: "Action", code: c }
  }
  predicate {
    p("?") jsInline:c !{ tag: "Predicate", code: c }
  }
  pcall {
    id:n p("[") ( choice ; p(",") )*:ps p("]")
    !{ tag: "PCall", name: n, patterns: ps }
  }
  call {
    id:n jsEnclosed?:c
    !{ tag: "Call", name: n, code: c }
  }
  subpattern {
    p("(") choice:p p(")") !p
  }


  jsInline {
    pos:s jsInlineFragment+ pos:e slice(s, e)
  }
  jsInlineFragment {
  | range("A", "Z") | range("a", "z") | char("_$") | range("0", "9")
  | char(".") | char("!")
  | char("(") jsEnclosedFragment* char(")")
  | char("[") jsEnclosedFragment* char("]")
  | char("{") jsEnclosedFragment* char("}")
  | char("\"") ( char("\\") char | ~char("\"") char )* char("\"")
  | char("\'") ( char("\\") char | ~char("\'") char )* char("\'")
  | char("`") ( string("${") jsEnclosedFragment* string("}") | char("\\") char | ~char("`") char )* char("`")
  }
  jsEnclosed {
    char("(") pos:s jsEnclosedFragment* pos:e char(")") slice(s, e)
  }
  jsEnclosedFragment {
  | char("(") jsEnclosedFragment* char(")")
  | char("[") jsEnclosedFragment* char("]")
  | char("{") jsEnclosedFragment* char("}")
  | char("\"") ( char("\\") char | ~char("\"") char )* char("\"")
  | char("\'") ( char("\\") char | ~char("\'") char )* char("\'")
  | char("`") ( string("${") jsEnclosedFragment* string("}") | char("\\") char | ~char("`") char )* char("`")
  | ~char("()[]{}\"\'`") char
  }


  id(expected) {
    ws* initIdChar:c restIdChar*:cs !(c + cs.join("")):i
    ?((expected != null && expected === i) || (expected == null))
    !i
  }
  p(charset) {
    ws* string(charset)
  }
  end {
    ws* ~char
  }


  initIdChar { range("A", "Z") | range("a", "z") | char("_") }
  restIdChar { range("A", "Z") | range("a", "z") | char("_") | range("0", "9") }

  ws {
  | char(" \t")
  | newline
  | string("//") ( ~newline      char )* newline
  | string("/*") ( ~string("*/") char )* string("*/")
  }
  newline {
  | char("\r") char("\n")?
  | char("\n") char("\r")?
  }

}
