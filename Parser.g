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

grammar Parser {

  unit {
    ( ( declaration ; ";" )*:ds ";"? TERM !ds )*:dss END
    !{ tag: "Unit", declarations: dss.flat() }
  }


  declaration {
  | classDeclaration
  }

  classDeclaration {
    "class" local:n mixins:ims mixins?:cms storage?:s TERM? "{" mlist:ms "}"
    !(s != null ? s.text : "instance"):s
    !{ tag: "Class", name: n, storage: s, imixins: ims, cmixins: cms, methods: ms }
  }


  method {
  | vis:p static?:s ID:n "(" plist:ps ")" sparam(n.text):x pbody:b
    !{ tag: "Method", name: x.name, vis: p, static: s, parameters: ps, sparam: x.parameter, body: b }
  | vis:p static?:s ID:n                  sparam(n.text):x pbody:b
    !{ tag: "Method", name: x.name, vis: p, static: s, parameters: [], sparam: x.parameter, body: b }
  | vis:p static?:s "[" plist:ps "]"      sparam("[]"):x    pbody:b
    !{ tag: "Method", name: x.name, vis: p, static: s, parameters: ps, sparam: x.parameter, body: b }

  | "operator" static?:s infixop:n "(" local:pa "," local:pb ")" pbody:b
    !{ tag: "Plain_Parameter", name: pa }:pa
    !{ tag: "Plain_Parameter", name: pb }:pb
    !{ tag: "Operator", name: n, static: s, parameters: [pa, pb], body: b }

  | vis:gp ":" vis:sp ":" vis:rp static?:s ID:n ( "=" expression | !null ):e
    !{ tag: "Attribute", name: n.text, get: gp, set: sp, cpy: rp,   static: s, value: e }
  | vis:gp ":" vis:sp            static?:s ID:n ( "=" expression | !null ):e
    !{ tag: "Attribute", name: n.text, get: gp, set: sp, cpy: null, static: s, value: e }
  | vis:p                        static?:s ID:n ( "=" expression | !null ):e
    !{ tag: "Attribute", name: n.text, get: p,  set: p,  cpy: null, static: s, value: e }
  }


  statement {
  | letStatement
  | ifStatement
  | unlessStatement
  | givenStatement
  | onceStatement
  | foreverStatement
  | whileStatement
  | untilStatement
  | doWhileStatement
  | doUntilStatement
  | forStatement
  | eachStatement

  | inlineStatement
  }
  inlineStatement {
  | inlineStatement:b "if"     expression:c !{ tag: "S_If", negated: false, condition: c, consiquent: b, alterantive: null }
  | inlineStatement:b "unless" expression:c !{ tag: "S_If", negated: true,  condition: c, consiquent: b, alterantive: null }
  | inlineStatement:b "while"  expression:c !{ tag: "S_While", negated: false, condition: c, body: b }
  | inlineStatement:b "until"  expression:c !{ tag: "S_While", negated: true,  condition: c, body: b }
  | inlineStatement:b "forever"             !{ tag: "S_Forever", body: b }

  | basicStatement
  }
  basicStatement {
  | breakStatement
  | continueStatement
  | returnStatement
  | raiseStatement
  | expressionStatement
  }

  letStatement {
    "let" ( variable ; "," )+:vs
    !{ tag: "S_Let", variables: vs }
  }
  ifStatement {
    "if" expression:c
    ( TERM? "then" sbody | TERM? block ):t
    ( TERM? elseBranch | !null ):f
    !{ tag: "S_If", negated: false, condition: c, consiquent: t, alternative: f }
  }
  unlessStatement {
    "unless" expression:c
    ( TERM? "then" sbody | TERM? block ):t
    ( TERM? elseBranch | !null ):f
    !{ tag: "S_If", negated: true, condition: c, consiquent: t, alternative: f }
  }
  elseBranch {
  | "else" ifStatement
  | "else" unlessStatement
  | "else" sbody
  }
  givenStatement {
    "given" ( local:n "=" | !null:n ) expression:s "match" mbody:cs
    !{ tag: "S_Given", name: n, subject: s, cases: cs }
  }
  caseStatement {
  | "case" pattern:p
    ( TERM? "do" sbody | TERM? block ):b
    !{ tag: "C_Pattern", pattern: p, body: b }
  | "else" sbody:b
    !{ tag: "C_Else", body: b }
  }
  onceStatement {
  | "once" sbody:b
    !{ tag: "S_Once", body: b }
  | block:b
    !{ tag: "S_Once", body: b }
  }
  foreverStatement {
    "forever" sbody:b
    !{ tag: "S_Forever", body: b }
  }
  whileStatement {
    "while" expression:c
    ( TERM? "do" sbody | TERM? block ):b
    !{ tag: "S_While", negated: false, condition: c, body: b }
  }
  untilStatement {
    "until" expression:c
    ( TERM? "do" sbody | TERM? block ):b
    !{ tag: "S_While", negated: true, condition: c, body: b }
  }
  doWhileStatement {
    "do" sbody:b
    TERM? "while" expression:c
    !{ tag: "S_Do_While", negated: false, body: b, condition: c }
  }
  doUntilStatement {
    "do" sbody:b
    TERM? "until" expression:c
    !{ tag: "S_Do_While", negated: true, body: b, condition: c }
  }
  forStatement {
    "for"
    ( variable ; "," )+:vs ";"
    ( expression ; "," )+:cs ";"
    ( expression ; "," )+:is
    ( TERM? "do" sbody | TERM? block ):b
    !{ tag: "S_For", variables: vs, conditions: cs, increments: is, body: b }
  }
  eachStatement {
    "each" ( local ; "," )+:ns "in" expression:s
    ( TERM? "do" sbody | TERM? block ):b
    !{ tag: "S_Each", names: ns, subject: s, body: b }
  }
  breakStatement {
    "break"
    !{ tag: "S_Break" }
  }
  continueStatement {
    "continue"
    !{ tag: "S_Continue" }
  }
  returnStatement {
    "return" expression?:e
    !{ tag: "S_Return", expression: e }
  }
  raiseStatement {
    "raise" expression?:e
    !{ tag: "S_Raise", expression: e }
  }
  expressionStatement {
    ~"{" expression:e
    !{ tag: "S_Expression", expression: e }
  }


  expression {
    logicExpression
  }
  logicExpression {
  | logicExpression:a "or"  notExpression:b !{ tag: "E_OR",  a: a, b: b }
  | logicExpression:a "xor" notExpression:b !{ tag: "E_XOR", a: a, b: b }
  | logicExpression:a "and" notExpression:b !{ tag: "E_AND", a: a, b: b }
  |                         notExpression
  }
  notExpression {
  | "not" notExpression:a !{ tag: "E_NOT", a: a }
  | setExpression
  }
  setExpression {
  | secondaryExpression:m "#" setExpression:e
    ?(m.tag === "E_Message") !(m.cpy = e) !m
  | secondaryExpression:m "=" setExpression:e
    ?(m.tag === "E_Message") !(m.set = e) !m
  | secondaryExpression:m "=" setExpression:e
    ?(m.tag === "E_Property" && m.arguments == null) !(m.set = e) !m
  | ternaryExpression
  }
  ternaryExpression {
  | relationalExpression:c "?" relationalExpression:t ":" relationalExpression:f
    !{ tag: "E_Ternary", condition: c, consiquent: t, alternative: f }
  | relationalExpression
  }
  relationalExpression {
  | concatExpression:k  "=>":o concatExpression:v !{ tag: "E_Keyval", key: k, value: v }
  | concatExpression:a "===":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a "~==":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  "==":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  "~=":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  ">=":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  "<=":o concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  ">":o  concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  "<":o  concatExpression:b !{ tag: "E_Relational", o: o.text, a: a, b: b }
  | concatExpression:a  "<>":o concatExpression:b !{ tag: "E_Order",                 a: a, b: b }
  | concatExpression
  }
  concatExpression {
  | concatExpression:a "++":o bitwiseExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  |                           bitwiseExpression:b
  }
  bitwiseExpression {
  | bitwiseExpression:a "|":o shiftExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | bitwiseExpression:a "^":o shiftExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | bitwiseExpression:a "&":o shiftExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  |                           shiftExpression
  }
  shiftExpression {
  | shiftExpression:a  "<<":o addExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | shiftExpression:a  ">>":o addExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | shiftExpression:a "<<<":o addExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | shiftExpression:a ">>>":o addExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  |                           addExpression
  }
  addExpression {
  | addExpression:a "+":o mulExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | addExpression:a "-":o mulExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  |                       mulExpression
  }
  mulExpression {
  | mulExpression:a    "*":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a    "/":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a  "quo":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a  "rem":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a "fquo":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a "frem":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a "cquo":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  | mulExpression:a "crem":o prefixExpression:b !{ tag: "E_Infix", o: o.text, a: a, b: b }
  |                          prefixExpression
  }
  prefixExpression {
  | "+":o secondaryExpression:a !{ tag: "E_Prefix", o: o.text, a: a }
  | "-":o secondaryExpression:a !{ tag: "E_Prefix", o: o.text, a: a }
  | "~":o secondaryExpression:a !{ tag: "E_Prefix", o: o.text, a: a }
  |       secondaryExpression
  }
  secondaryExpression {
  | secondaryExpression:e "." "$" ID:n "(" elist:as ")" !{ tag: "E_Property", recipient: e, selector: n.text, arguments: as }
  | secondaryExpression:e "." "$" ID:n                  !{ tag: "E_Property", recipient: e, selector: n.text, arguments: null }
  | secondaryExpression:e "."     ID:n "(" elist:as ")" !{ tag: "E_Message",  recipient: e, selector: n.text, arguments: as }
  | secondaryExpression:e "."     ID:n                  !{ tag: "E_Message",  recipient: e, selector: n.text, arguments: [] }
  | secondaryExpression:e              "[" elist:as "]" !{ tag: "E_Message",  recipient: e, selector: "[]",   arguments: as }
  | primaryExpression
  }
  primaryExpression {
  | "(" expression:a ")" !a

  |        "[" plist:ps "]" "->" expression:b !{ tag: "E_Proc", parameters: ps, body: { tag: "Block", statements: [{ tag: "S_Return", expression: b }] } }
  | "proc" "[" plist:ps "]" pbody:b           !{ tag: "E_Proc", parameters: ps, body: b }
  | "proc"                  pbody:b           !{ tag: "E_Proc", parameters: [], body: b }

  | "{" klist:es "}" !{ tag: "E_Dictionary", elements: es }
  | "{" elist:es "}" !{ tag: "E_Dictionary", elements: es }
  | "[" elist:es "]" !{ tag: "E_Array",      elements: es }

  | "[" expression:i ".."  expression:f "]" !{ tag: "E_Interval", initial: { closed: i }, final: { closed: f } }
  | "[" expression:i "..." expression:f "]" !{ tag: "E_Interval", initial: { closed: i }, final: { open:   f } }

  | "$" ID:n "(" elist:as ")" !{ tag: "E_Property", recipient: null, selector: n.text, arguments: as }
  | "$" ID:n                  !{ tag: "E_Property", recipient: null, selector: n.text, arguments: null }
  | local:n  "(" elist:as ")" !{ tag: "E_Message",  recipient: null, selector: n,      arguments: as }
  | local:n                   !{ tag: "E_Message",  recipient: null, selector: n,      arguments: [] }

  | literalExpression
  }
  literalExpression {
  | "self"   !{ tag: "E_Self" }
  | "super"  !{ tag: "E_Super" }

  | "\"" concatenateFragment*:es "\"" !{ tag: "E_Concatenate", elements: es }

  | NUMBER:n !{ tag: "E_Number",  value: n.value }
  | "true"   !{ tag: "E_Boolean", value: true    }
  | "false"  !{ tag: "E_Boolean", value: false   }
  | "nil"    !{ tag: "E_Nil" }
  }


  pattern {
  | literalPattern
  }
  literalPattern {
  | ("+"|"-"|"~"):o literalExpression:e
    !{ tag: "P_Literal", expression: { tag: "E_Prefix", o: o.text, a: e } }
  | literalExpression:e
    !{ tag: "P_Literal", expression: e }
  }


  concatenateFragment {
  | STRING:t               !{ tag: "E_String", value: t.value }
  | "{{" expression:e "}}" !e
  }
  mlist {
  | INDENT ( ( method ; ";" )*:ps ";"? TERM !ps )*:pss DEDENT !pss.flat()
  |          ( method ; ";" )*:ps ";"? TERM?                  !ps
  }
  mixins {
    "(" ( local ; "," )*:ims ")" !ims
  }
  vis {
  | "public"  !"public"
  | "private" !"private"
  }
  static {
  | "static" !true
  |          !false
  }
  plist {
  | INDENT ( ( parameter ; "," )*:ps ","? TERM !ps )*:pss DEDENT !pss.flat()
  |          ( parameter ; "," )*:ps ","? TERM?                  !ps
  }
  sparam(name) {
  | "#" parameter:p !{ name: name + "#", parameter: p    }
  | "=" parameter:p !{ name: name + "=", parameter: p    }
  |                 !{ name: name,       parameter: null }
  }
  parameter {
  | "*" local:n !{ tag: "Rest_Parameter",  name: n }
  |     local:n !{ tag: "Plain_Parameter", name: n }
  }
  pbody {
  | TERM? "as" expression:e                                                    !{ tag: "Alias", expression: e }
  | TERM? "do" expression:e                                                    !{ tag: "Block", statements: [{ tag: "S_Return", expression: e }] }
  | TERM? "{" INDENT ( ( statement ; ";" )*:ss ";"? TERM !ss )*:sss DEDENT "}" !{ tag: "Block", statements: sss.flat() }
  | TERM? "{"          ( statement ; ";" )*:ss ";"? TERM?                  "}" !{ tag: "Block", statements: ss         }
  }
  mbody {
  | TERM? "{" INDENT ( ( caseStatement ; ";" )*:ss ";"? TERM !ss )*:sss DEDENT "}" !sss.flat()
  | TERM? "{"          ( caseStatement ; ";" )*:ss ";"? TERM?                  "}" !ss
  }
  sbody {
  | block
  | inlineStatement:s !{ tag: "Block", statements: [s] }
  }
  variable {
    ID:n ( "=" expression:e | !null:e )
    !{ tag: "Variable", name: n.text, value: e }
  }
  elist {
  | INDENT ( ( element ; "," )*:es ","? TERM !es )*:ess DEDENT !ess.flat()
  |          ( element ; "," )*:es ","? TERM?                  !es
  }
  klist {
  | INDENT ( ( keyval ; "," )*:es ","? TERM !es )*:ess DEDENT !ess.flat()
  |          ( keyval ; "," )*:es ","? TERM?                  !es
  }
  element {
  | "*" expression:e !{ tag: "E_Expand", expression: e }
  |     expression:e !e
  }
  keyval {
    ID:n ":" expression:v
    !{ tag: "E_String", value: n.text }:k
    !{ tag: "E_Keyval", key: k , value: v }
  }
  storage {
  | "abstract" | "class" | "instance" | "basic" | "vector"
  | "string" | "number" | "integer" | "boolean" | "nil"
  }
  slist {
  | INDENT ( ( statement ; ";" )*:ss ";"? TERM !ss )*:sss DEDENT !sss.flat()
  |          ( statement ; ";" )*:ss ";"? TERM                   !ss
  }
  block {
    TERM? "{" slist:ss "}" !{ tag: "Block", statements: ss }
  }
  local {
    ID:n
    ?![
      "let",
      "if", "unless", "then", "else",
      "given", "match",
      "once", "forever", "while", "until", "for", "each", "in",
      "break", "continue",
      "return",
      "and", "xor", "or", "not",
      "quo", "rem", "fquo", "frem", "cquo", "crem",
      "proc",
      "self", "super", "true", "false", "nil",
      "do",
    ].includes(n.text)
    !n.text
  }
  infixop {
    OP:o
    ?[
      "==", "<>",
      "+", "-", "*", "/",
      "quo", "rem",
      "fquo", "frem",
      "cquo", "crem",
      "|", "^", "&",
      "<<<", ">>>", "<<", ">>",
      "++"
    ].includes(o.text)
    !o.text
  }

}
