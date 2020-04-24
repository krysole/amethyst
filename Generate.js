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


function Transmute(target, source) {
  for (let name in target) delete target[name];
  for (let name in source) target[name] = source[name];
  return target;
}

function Lookup(scope, name) {
  let local = scope.locals.find(l => l.name === name);
  if (local != null) {
    return local;
  }
  else if (scope.parent != null) {
    return Lookup(scope.parent, name);
  }
  else {
    return null;
  }
}

function Mangle(identifier) {
  let result = "";
  for (let i = 0; i < identifier.length; i++) {
    let c = identifier[i];

    if (c >= "A" && c <= "Z") result += c;
    if (c >= "a" && c <= "z") result += c;
    if (c >= "0" && c <= "9") result += c;
    if (c === "_")            result += c;
    if (c === "?")            result += "_p";
    if (c === "!")            result += "_x";
    if (c === "'")            result += "_prime";
    if (c === "=")            result += "__SET";
    if (c === "#")            result += "__COPYSET";
  }
  return result;
}

function MangleOperator(prefix, opname) {
  let name;
  if (opname === "++")   name = "concat";
  if (opname === "|")    name = "bit_or";
  if (opname === "^")    name = "bit_xor";
  if (opname === "&")    name = "bit_and";
  if (opname === "<<")   name = "sal";
  if (opname === ">>")   name = "sar";
  if (opname === "<<<")  name = "shl";
  if (opname === ">>>")  name = "shr";
  if (opname === "+")    name = "add";
  if (opname === "-")    name = "sub";
  if (opname === "*")    name = "mul";
  if (opname === "/")    name = "div";
  if (opname === "quo")  name = "quo";
  if (opname === "rem")  name = "rem";
  if (opname === "fquo") name = "fquo";
  if (opname === "frem") name = "frem";
  if (opname === "cquo") name = "cquo";
  if (opname === "crem") name = "crem";
  return `${prefix}__${name}`;
}

export function Generate(ast, prefix, cls, method, loop, scope) {
  if (ast == null) {
    throw new Error(`Expected non-null AST node.`);
  }

  else if (ast.tag === "Unit") {
    ast.js = ``;

    for (let declaration of ast.declarations) {
      Generate(declaration, prefix, null, null, null, null);
    }

    for (let declaration of ast.declarations) {
      ast.js += prefix + `\n`;
      ast.js += declaration.js;
    }
  }

  else if (ast.tag === "Class") {
    ast.js = ``;

    if (ast.cmixins == null) ast.cmixins = ["Class"];

    let iattrs   = [];
    let cattrs   = [];
    let imethods = [];
    let cmethods = [];

    for (let method of ast.methods) {
      Generate(method, "", ast, null, null, null);

      if (method.tag === "Attribute") {
        if (method.static) cattrs.push(method);
        else               iattrs.push(method);
      }
      if (method.tag === "Method") {
        if (method.static) cmethods.push(method);
        else               imethods.push(method);
      }
    }

    let name    = JSON.stringify(ast.name);
    let storage = JSON.stringify(ast.storage);
    let imixins = ast.imixins.map(name => JSON.stringify(name)).join(", ");
    let cmixins = ast.cmixins.map(name => JSON.stringify(name)).join(", ");

    ast.js += prefix + `AM__defineClass(${name}, ${storage}, [${imixins}], [${cmixins}]);\n`;
    for (let attribute of cattrs) {
      ast.js += prefix + `\n`;
      ast.js += attribute.js;
    }
    for (let method of cmethods) {
      ast.js += prefix + `\n`;
      ast.js += method.js;
    }
    for (let attribute of iattrs) {
      ast.js += prefix + `\n`;
      ast.js += attribute.js;
    }
    for (let method of imethods) {
      ast.js += prefix + `\n`;
      ast.js += method.js;
    }
  }

  else if (ast.tag === "Attribute") {
    ast.js = ``;

    Generate(ast.value, "", cls, ast, null, null);

    let cname = JSON.stringify(`${cls.name}${ast.static ? ".class" : ""}`);
    let aname = JSON.stringify(ast.name);
    let vis   = JSON.stringify(`${ast.get}:${ast.set}`);
    let init  = JSON.stringify(ast.value.js);

    if (ast.cpy != null) vis = vis + ":" + ast.cpy;

    ast.js += prefix + `AM__defineAttribute(${cname}, ${aname}, ${vis}, ${init});\n`;
  }
  else if (ast.tag === "Operator") {
    ast.js = ``;

    ast.genlabel = 0;

    ast.body.parameters = ast.parameters;
    Generate(ast.body, prefix + "    ", cls, ast, null, null);

    let cname      = JSON.stringify(`${cls.name}${ast.static ? ".class" : ""}`);
    let oname      = JSON.stringify(ast.name);
    let parameters = ast.parameters.map(p => Mangle(p.name)).join(", ");

    ast.js += prefix + `AM__defineOperator(${cname}, ${oname},\n`;
    ast.js += prefix + `  function ${MangleOperator(ast.name)}(${parameters}) {\n`;
    ast.js +=               ast.body.js;
    ast.js += prefix + `  }\n`;
    ast.js += prefix + `);\n`;
  }
  else if (ast.tag === "Method") {
    ast.js = ``;

    ast.genlabel = 0;

    let precount = 0, postcount = 0, restindex = null;
    for (let i = 0; i < ast.parameters.length; i++) {
      if (ast.parameters[i].tag === "Plain_Parameter") {
        if (restindex == null) {
          precount += 1;
        }
        else {
          postcount += 1;
        }
      }
      if (ast.parameters[i].tag === "Rest_Parameter") {
        if (restindex == null) {
          restindex = i;
        }
        else {
          throw new Error("Expected zero or one rest parameter.");
        }
      }
    }

    ast.body.parameters = ast.parameters;
    Generate(ast.body, prefix + "    ", cls, ast, null, null);

    let cname = JSON.stringify(`${cls.name}${ast.static ? ".class" : ""}`);
    let mname = JSON.stringify(ast.name);
    let fname = `SEL__${cls.name.replace(".", "__")}${ast.static ? "__class" : ""}__${Mangle(ast.name)}`;
    let vis   = JSON.stringify(ast.vis);

    if (restindex == null) {
      let parameters = ast.parameters.map(p => Mangle(p.name)).join(", ");

      ast.js += prefix + `AM__defineMethod(${cname}, ${mname}, ${vis},\n`;
      ast.js += prefix + `  function ${fname}(${parameters}) {\n`;
      ast.js +=               ast.body.js;
      ast.js += prefix + `  }\n`;
      ast.js += prefix + `);\n`;
    }
    else {
      ast.js += prefix + `AM__defineMethod(${cname}, ${mname}, ${vis},\n`;
      ast.js += prefix + `  function ${fname}() {\n`;
      for (let i = 0; i < ast.parameters.length; i++) {
        let name = Mangle(ast.parameters[i].name);
        if (ast.parameters[i].tag === "Plain_Parameter" && i < restindex) {
          ast.js += prefix + `    let ${name} = arguments[${i}];\n`;
        }
        if (ast.parameters[i].tag === "Plain_Parameter" && i > restindex) {
          ast.js += prefix + `    let ${name} = arguments[arguments.length - 1 - ${ast.parameters.length - 1 - i}];\n`;
        }
        if (ast.parameters[i].tag === "Rest_Parameter") {
          ast.js += prefix + `    let ${name} = new AM__root.Array.constructor();\n`;
          ast.js += prefix + `    for (let i = ${restindex}, c = arguments.length - ${postcount}; i < c; i++) {\n`;
          ast.js += prefix + `      ${name}["SEL__append!"](arguments[i]);\n`;
          ast.js += prefix + `    }\n`;
        }
      }
      ast.js +=               ast.body.js;
      ast.js += prefix + `  }\n`;
      ast.js += prefix + `);\n`;
    }
  }

  else if (ast.tag === "Block") {
    ast.js = ``;

    ast.parent = scope;
    ast.locals = [];

    if (ast.parameters != null) {
      for (let parameter of ast.parameters) {
        ast.locals.push(parameter);
      }
    }
    for (let statement of ast.statements) {
      if (statement.tag === "S_Let") {
        for (let variable of statement.variables) {
          ast.locals.push(variable);
        }
      }
    }

    for (let statement of ast.statements) {
      Generate(statement, prefix, cls, method, loop, ast);

      ast.js += statement.js;
    }
  }

  else if (ast.tag === "S_Let") {
    for (let variable of ast.variables) Generate(variable.value, prefix, cls, method, loop, scope);

    let variables = ast.variables.map(v => `${Mangle(v.name)} = ${v.value.js}`).join(", ");

    ast.js = prefix + `let ${variables};\n`;
  }
  else if (ast.tag === "S_If") {
    ast.js = ``;

    if (ast.alternative == null) {
      Generate(ast.condition,   prefix,        cls, method, loop, scope);
      Generate(ast.consiquent,  prefix + "  ", cls, method, loop, scope);

      ast.js += prefix + `if (${ast.condition.js}) {\n`;
      ast.js +=             ast.consiquent.js;
      ast.js += prefix + `}\n`;
    }
    else {
      Generate(ast.condition,   prefix,        cls, method, loop, scope);
      Generate(ast.consiquent,  prefix + "  ", cls, method, loop, scope);
      Generate(ast.alternative, prefix + "  ", cls, method, loop, scope);

      ast.js += prefix + `if (${ast.condition.js}) {\n`;
      ast.js +=             ast.consiquent.js;
      ast.js += prefix + `}\n`;
      ast.js += prefix + `else {\n`;
      ast.js +=             ast.alternative.js;
      ast.js += prefix + `}\n`;
    }
  }
  else if (ast.tag === "S_Given") {
    ast.js = ``;

    ast.parent = scope;
    ast.locals = [];
    ast.loopLabel = "LABEL__" + method.genlabel++;

    if (ast.name != null) {
      ast.variable = { tag: "Variable", name: ast.name };
      ast.locals.push(ast.variable);
    }

    Generate(ast.subject, prefix + "  ", cls, method, loop, ast);
    for (let c of ast.cases) {
      Generate(c, prefix + "  ", cls, method, ast, ast);
    }

    ast.js += prefix + `${ast.loopLabel}: while (true) {\n`;
    ast.js += prefix + `  let SUBJECT = ${ast.subject.js};\n`;
    if (ast.name != null) {
      ast.js += prefix + `  let ${Mangle(ast.name)} = SUBJECT;\n`;
    }
    for (let c of ast.cases) ast.js += c.js;
    ast.js += prefix + `  throw Error("MATCH_ERROR");\n`;
    ast.js += prefix + `}\n`;

    throw new Error("NOT_IMPLEMENTED");
  }
  else if (ast.tag === "S_Once") {
    ast.js = ``;

    Generate(ast.body, prefix + "  ", cls, method, ast, scope);

    ast.js += prefix + `do {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
    ast.js += prefix + `while (false);\n`;
  }
  else if (ast.tag === "S_Forever") {
    ast.js = ``;

    Generate(ast.body, prefix + "  ", cls, method, ast, scope);

    ast.js += prefix + `while (true) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_While") {
    ast.js = ``;

    Generate(ast.condition, prefix,        cls, method, loop, scope);
    Generate(ast.body,      prefix + "  ", cls, method, ast,  scope);

    let negated = (ast.negated ? "!" : "");

    ast.js += prefix + `while (${negated}${ast.condition.js}) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Do_While") {
    ast.js = ``;

    Generate(ast.condition, prefix,        cls, method, loop, scope);
    Generate(ast.body,      prefix + "  ", cls, method, ast,  scope);

    let negated = (ast.negated ? "!" : "");

    ast.js += prefix + `do {\n`;
    ast.js += ast.body.js;
    ast.js += prefix + `}\n`;
    ast.js += prefix + `while (${negated}${ast.condition.js});\n`;
  }
  else if (ast.tag === "S_For") {
    ast.js = ``;

    ast.parent = scope;
    ast.locals = ast.variables;

    for (let variable  of ast.variables)  Generate(variable.value, prefix, cls, method, loop, ast);
    for (let condition of ast.conditions) Generate(condition,      prefix, cls, method, loop, ast);
    for (let increment of ast.increments) Generate(increment,      prefix, cls, method, loop, ast);
    Generate(ast.body, prefix + "  ", cls, method, ast, ast);

    let variables  = ast.variables.map(v => `${Mangle(v.name)} = ${v.value.js}`).join(", ");
    let conditions = ast.conditions.map(c => c.js).join(" && ");
    let increments = ast.increments.map(i => i.js).join(", ");

    ast.js += prefix + `for (let ${variables}; ${conditions}; ${increments}) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Each") {
    ast.js = ``;

    let attrs = ["first", "second", "third", "fourth", "fifth"].map(name => JSON.stringify("SEL__" + name));
    if (ast.names.length > 5) throw new Error("Each supports 1 to 5 bindings.");

    ast.variables = [];
    for (let name of ast.names) {
      ast.variables.push({ tag: "Variable", name: name });
    }

    ast.parent = scope;
    ast.locals = ast.variables;

    Generate(ast.subject, prefix,        cls, method, loop, ast);
    Generate(ast.body,    prefix + "  ", cls, method, ast,  ast);

    ast.js += prefix + `for (let ENUMERATOR = ${ast.subject.js}["SEL__enumerate"](); ENUMERATOR["SEL__next?"](); ENUMERATOR["SEL__next!"]()) {\n`;
    for (let i = 0, c = ast.names.length; i < c; i++) {
      ast.js += prefix + `  let ${Mangle(ast.names[i])} = ENUMERATOR[${attrs[i]}]();\n`;
    }
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Break") {
    if (loop.noContinue) throw new Error("NO_BREAK_ERROR");
    if (loop.loopLabel != null) ast.js = prefix + `break ${loop.loopLabel};\n`;
    else                        ast.js = prefix + `break;\n`;
  }
  else if (ast.tag === "S_Continue") {
    if (loop.noContinue) throw new Error("NO_CONTINUE_ERROR");
    if (loop.loopLabel != null) ast.js = prefix + `continue ${loop.loopLabel};\n`;
    else                        ast.js = prefix + `continue;\n`;
  }
  else if (ast.tag === "S_Return") {
    if (ast.expression == null) ast.expression = { tag: "E_Nil" };

    Generate(ast.expression, prefix, cls, method, loop, scope);

    ast.js = prefix + `return ${ast.expression.js};\n`;
  }
  else if (ast.tag === "S_Raise") {
    if (ast.expression == null) ast.expression = { tag: "E_Nil" };

    Generate(ast.expression, prefix, cls, method, loop, scope);

    // TODO This will have to be changed to support static type overloading
    //      rather than literal type overloading, with default fallback.
    if (ast.expression.tag === "E_Nil") {
      ast.js = prefix + `throw new Error("ERROR");\n`;
    }
    else if (ast.expression.tag === "E_String") {
      ast.js = prefix + `throw new Error(${ast.expression.js});\n`;
    }
    else {
      ast.js = prefix + `throw ${ast.expression.js};\n`;
    }
  }
  else if (ast.tag === "S_Expression") {
    Generate(ast.expression, prefix, cls, method, loop, scope);

    ast.js = prefix + `${ast.expression.js};\n`;
  }

  else if (ast.tag === "E_OR") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) || AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_XOR") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) !== AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_AND") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) && AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_NOT") {
    Generate(ast.a, prefix, cls, method, loop, scope);

    ast.js = `(!AM__check_boolean(${ast.a.js}))`;
  }

  else if (ast.tag === "E_Ternary") {
    Generate(ast.condition,   prefix,        cls, method, loop, scope);
    Generate(ast.consiquent,  prefix + "  ", cls, method, loop, scope);
    Generate(ast.alternative, prefix + "  ", cls, method, loop, scope);

    ast.js = `(${ast.condition.js} ? ${ast.consiquent.js} : ${ast.alternative.js})`;
  }
  else if (ast.tag === "E_Relational") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    if (ast.o === "==") ast.js =        `AM__eq(${ast.a.js}, ${ast.b.js})`;
    if (ast.o === "~=") ast.js =        `AM__ne(${ast.a.js}, ${ast.b.js})`;
    if (ast.o === "<")  ast.js = `(0 <  AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === "<=") ast.js = `(0 <= AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === ">=") ast.js = `(0 >= AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === ">")  ast.js = `(0 >  AM__ord(${ast.a.js}, ${ast.b.js}))`;
  }
  else if (ast.tag === "E_Order") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `AM__ord(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Is") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `(function(v,c){return c.tag in v;})(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Infix") {
    Generate(ast.a, prefix, cls, method, loop, scope);
    Generate(ast.b, prefix, cls, method, loop, scope);

    ast.js = `${MangleOperator("AM", ast.o)}(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Prefix") {
    Generate(ast.a, prefix, cls, method, loop, scope);

    if (ast.a.tag === "E_String") {
      throw new Error("Prefix operator expected valid operand type.");
    }
    if (ast.a.tag === "E_Number") {
      if (ast.name === "+") ast.a.value = +ast.a.value;
      if (ast.name === "-") ast.a.value = -ast.a.value;
      if (ast.name === "~") ast.a.value = ~ast.a.value;
      Transmute(ast, ast.a);
      return Generate(ast, prefix, cls, method, loop, scope);
    }
    if (ast.a.tag === "E_Boolean") {
      if (ast.name === "+") throw new Error("Prefix + operator expected value operand type.");
      if (ast.name === "-") throw new Error("Prefix - operator expected valid operand type.");
      if (ast.name === "~") ast.a.value = !ast.a.value;
      Transmute(ast, ast.a);
      return Generate(ast, prefix, cls, method, loop, scope);
    }
    if (ast.a.tag === "E_Nil") {
      throw new Error("Prefix operator expected valid operand type.");
    }

    if (ast.name === "+") ast.js = `${ast.a.js}["SEL__posate"]()`;
    if (ast.name === "-") ast.js = `${ast.a.js}["SEL__negate"]()`;
    if (ast.name === "~") ast.js = `${ast.a.js}["SEL__not"]()`;
  }
  else if (ast.tag === "E_Message") {
    if (ast.recipient == null && ast.selector.match(/^[A-Z][A-Za-z0-9_]*$/)) {
      if (ast.arguments.length !== 0) {
        throw new Error("Global variable lookup expected zero arguments.");
      }

      if (ast.cpy != null) {
        throw new Error("Global variable lookup expected no copyset argument.");
      }

      if (ast.set != null) {
        throw new Error("Global variable lookup expected no set argument.");
      }

      ast.js = `AM__root.${ast.selector}`;
    }
    else if (ast.recipient == null && Lookup(scope, ast.selector) != null) {
      if (ast.arguments.length !== 0) {
        throw new Error("Local variable lookup expected no arguments.");
      }

      if (ast.cpy != null) {
        throw new Error("Local variable lookup expected no copyset argument.");
      }

      if (ast.set == null) {
        ast.js = `${Mangle(ast.selector)}`;
      }
      else {
        Generate(ast.set, prefix, cls, method, loop, scope);

        ast.js = `(${Mangle(ast.selector)} = ${ast.set.js})`;
      }
    }
    else if (ast.recipient == null && ast.selector === "argc") {
      // NOTE This is after local handling to allow shadowing.
      ast.js = `arguments.length`;
    }
    else if (ast.recipient == null && ast.selector === "argv") {
      // NOTE This is after local handling to allow shadowing.
      ast.js = `arguments`;
    }
    else if (ast.recipient != null && ast.selector === "new") { // METAMETHOD (new)
      if (ast.cpy       != null) throw new Error("'new' metamethod expected no copyset argument.");
      if (ast.set       != null) throw new Error("'new' metamethod expected no set argument.");

      Generate(ast.recipient, prefix, cls, method, loop, scope);
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let rcpt = ast.recipient.js;
      let args = ast.arguments.map(a => a.js).join(", ");

      ast.js = `(new ${rcpt}(${args}))`;
    }
    else if (ast.recipient != null && ast.selector === "allocate") { // METAMETHOD (allocate)
      if (ast.cpy != null) throw new Error("allocate metamethod expected no copyset argument.");
      if (ast.set != null) throw new Error("allocate metamethod expected no set argument.");

      Generate(ast.recipient, prefix, cls, method, loop, scope);
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let rcpt = ast.recipient.js;
      let args = ast.arguments.map(a => a.js).join(", ");

      ast.js = `(new ${rcpt}.constructor(${args}))`;
    }
    else if (ast.selector === "call") { // METAMETHOD (call)
      if (ast.cpy != null) throw new Error("call metamethod expected no copyset argument.");
      if (ast.set != null) throw new Error("call metamethod expected no set argument.");

      if (ast.arguments.length < 1) throw new Error("call metamethod expected at least one argument.");

      ast.selector = ast.arguments.shift();

      Generate(ast.recipient, prefix, cls, method, loop, scope);
      Generate(ast.selector,  prefix, cls, method, loop, scope);
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let rcpt = ast.recipient.js;
      let sel  = ast.selector.js;
      let args = ast.arguments.map(a => a.js).join(", ");

      ast.js = `${rcpt}[${sel}](${args})`;
    }
    else if (ast.selector === "prop") { // METAMETHOD (prop)
      if (ast.cpy != null) throw new Error("prop metamethod expected no copyset argument.");

      if (ast.arguments.length !== 1) throw new Error("prop metamethod expected exactly one argument.");

      ast.selector = ast.arguments.shift();

      Generate(ast.recipient, prefix, cls, method, loop, scope);
      Generate(ast.selector,  prefix, cls, method, loop, scope);
      if (ast.set != null) Generate(ast.set, prefix, cls, method, loop, scope);
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let rcpt = ast.recipient.js;
      let sel  = ast.selector.js;
      let args = ast.arguments.map(a => a.js).join(", ");

      if (ast.set != null) {
        ast.js = `(${rcpt}[${sel}] = ${ast.set.js})`;
      }
      else {
        ast.js = `${rcpt}[${sel}]`;
      }
    }
    else if (ast.recipient != null && ast.recipient.tag === "E_Super") {
      if (ast.cpy != null) ast.selector += "#";
      if (ast.set != null) ast.selector += "=";

      if (ast.cpy != null) ast.arguments.push(ast.cpy);
      if (ast.set != null) ast.arguments.push(ast.set);

      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let sel  = JSON.stringify("SEL__" + ast.selector);
      let args = ast.arguments.map(a => a.js).join(", ");
      let sep  = (ast.argument.length === 0 ? "" : ", ");

      ast.js = `Object.getPrototypeOf(this)[${sel}].call(this${sep}${args})`;
    }
    else {
      if (ast.cpy != null) ast.selector += "#";
      if (ast.set != null) ast.selector += "=";

      if (ast.cpy != null) ast.arguments.push(ast.cpy);
      if (ast.set != null) ast.arguments.push(ast.set);

      if (ast.recipient != null) {
        Generate(ast.recipient, prefix, cls, method, loop, scope);
      }
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      let rcpt = (ast.recipient != null ? ast.recipient.js : "this");
      let sel  = JSON.stringify("SEL__" + ast.selector);
      let args = ast.arguments.map(a => a.js).join(", ");

      ast.js = `${rcpt}[${sel}](${args})`;
    }
  }
  else if (ast.tag === "E_Property") {
    let recipient;
    if (ast.recipient != null) {
      Generate(ast.recipient, prefix, cls, method, loop, scope);
      recipient = ast.recipient.js;
    }
    else {
      recipient = `AM__js`;
    }

    if (ast.set != null) {
      Generate(ast.set, prefix, cls, method, loop, scope);

      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `(${recipient}.${Mangle(ast.selector)} = ${ast.set.js})`;
      }
      else {
        ast.js = `(${recipient}[${JSON.stringify(ast.selector)}] = ${ast.set.js})`;
      }
    }
    else if (ast.arguments != null) {
      for (let argument of ast.arguments) {
        Generate(argument, prefix, cls, method, loop, scope);
      }

      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `${recipient}.${Mangle(ast.selector)}(${ast.arguments.map(a => a.js).join(", ")})`;
      }
      else {
        ast.js = `${recipient}[${JSON.stringify(ast.selector)}](${ast.arguments.map(a => a.js).join(", ")})`;
      }
    }
    else {
      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `${recipient}.${Mangle(ast.selector)}`;
      }
      else {
        ast.js = `${recipient}[${JSON.stringify(ast.selector)}]`;
      }
    }
  }

  else if (ast.tag === "E_Proc") {
    ast.js = ``;

    let precount = 0, postcount = 0, restindex = null;
    for (let i = 0; i < ast.parameters.length; i++) {
      if (ast.parameters[i].tag === "Plain_Parameter") {
        if (restindex == null) {
          precount += 1;
        }
        else {
          postcount += 1;
        }
      }
      if (ast.parameters[i].tag === "Rest_Parameter") {
        if (restindex == null) {
          restindex = i;
        }
        else {
          throw new Error("Expected zero or one rest parameter.");
        }
      }
    }

    ast.body.parameters = ast.parameters;
    Generate(ast.body, prefix + "  ", cls, method, loop, scope);

    if (restindex == null) {
      let parameters = ast.parameters.map(p => Mangle(p.name)).join(", ");

      ast.js +=          `((${parameters}) => {\n`;
      ast.js +=             ast.body.js;
      ast.js += prefix + `})`;
    }
    else {
      ast.js += `(() => {\n`;
      for (let i = 0; i < ast.parameters.length; i++) {
        let name = Mangle(ast.parameters[i].name);
        if (ast.parameters[i].tag === "Plain_Parameter" && i < restindex) {
          ast.js += prefix + `  let ${name} = arguments[${i}];\n`;
        }
        if (ast.parameters[i].tag === "Plain_Parameter" && i > restindex) {
          ast.js += prefix + `  let ${name} = arguments[arguments.length - 1 - ${ast.parameters.length - 1 - i}];\n`;
        }
        if (ast.parameters[i].tag === "Rest_Parameter") {
          ast.js += prefix + `  let ${name} = new AM__root.Array.constructor();\n`;
          ast.js += prefix + `  for (let i = ${restindex}, c = arguments.length - ${postcount}; i < c; i++) {\n`;
          ast.js += prefix + `    ${name}["SEL__append!"](arguments[i]);\n`;
          ast.js += prefix + `  }\n`;
        }
      }
      ast.js +=             ast.body.js;
      ast.js += prefix + `})`;
    }
  }
  else if (ast.tag === "E_Dictionary") {
    ast.js = `(new AM__root.Dictionary.constructor())`;
    for (let element of ast.elements) {
      if (element.tag === "E_Expand") {
        Generate(element.expression, prefix, cls, method, loop, scope);
        ast.js += `["SEL__insert_all!"](${element.expression.js})`;
      }
      else if (element.tag === "E_Keyval") {
        Generate(element.key,   prefix, cls, method, loop, scope);
        Generate(element.value, prefix, cls, method, loop, scope);
        ast.js += `["SEL__insert!"](${element.key.js}, ${element.value.js})`;
      }
      else {
        Generate(element, prefix, cls, method, loop, scope);
        ast.js += `["SEL__insert_keyval!"](${element.js})`;
      }
    }
  }
  else if (ast.tag === "E_Array") {
    ast.js = `(new AM__root.Array.constructor())`;
    for (let element of ast.elements) {
      if (element.tag === "E_Expand") {
        Generate(element.expression, prefix, cls, method, loop, scope);
        ast.js += `["SEL__append_all!"](${element.expression.js})`;
      }
      else {
        Generate(element, prefix, cls, method, loop, scope);
        ast.js += `["SEL__append!"](${element.js})`;
      }
    }
  }
  else if (ast.tag === "E_Keyval") {
    Generate(ast.key,   prefix, cls, method, loop, scope);
    Generate(ast.value, prefix, cls, method, loop, scope);

    ast.js = `AM__root.Keyval["SEL__apply"](${ast.key.js}, ${ast.value.js})`;
  }
  else if (ast.tag === "E_Interval") {
    let ivalue = (ast.initial.open ? ast.initial.open : ast.initial.closed);
    let fvalue = (ast.final.open   ? ast.final.open   : ast.final.closed);
    let iexcl  = (ast.initial.open ? "true"           : "false");
    let fexcl  = (ast.final.open   ? "true"           : "false");

    Generate(ivalue, prefix, cls, method, loop, scope);
    Generate(fvalue, prefix, cls, method, loop, scope);

    ast.js = `AM__root.Interval["SEL__apply"](${ivalue.js}, ${fvalue.js}, ${iexcl}, ${fexcl})`;
  }
  else if (ast.tag === "E_Concatenate") {
    if (ast.elements.length === 0) {
      Transmute(ast, { tag: "E_String", value: "" });
      return Generate(ast, prefix, cls, method, loop, scope);
    }
    else if (ast.elements.length === 1 && ast.elements[0].tag === "E_String") {
      Transmute(ast, ast.elements[0]);
      return Generate(ast, prefix, cls, method, loop, scope);
    }
    else if (ast.elements.length === 1) {
      Generate(ast.elements[0], prefix, cls, method, loop, scope);
      ast.js = `AM__as_string(${ast.elements[0].js})`;
    }
    else {
      for (let element of ast.elements) Generate(element, prefix, cls, method, loop, scope);

      let elements = ast.elements.map(e => `AM__as_string(${e.js})`).join(" + ");

      ast.js = `(${elements})`;
    }
  }

  else if (ast.tag === "E_String") {
    ast.js = JSON.stringify(ast.value);
  }
  else if (ast.tag === "E_Number") {
    ast.js = JSON.stringify(ast.value);
  }
  else if (ast.tag === "E_Boolean") {
    ast.js = (ast.value ? "true" : "false");
  }
  else if (ast.tag === "E_Nil") {
    ast.js = "null";
  }

  else if (ast.tag === "E_Self") {
    ast.js = "this";
  }
  else if (ast.tag === "E_Super") {
    throw new Error("Super can only be used as a message recipient.");
  }

  else if (ast.tag === "C_Pattern") {
    ast.js = ``;

    if (ast.pattern.tag !== "P_Literal") throw Error("Expected P_Literal in C_Pattern only.");

    ast.noBreak    = loop.noBreak;
    ast.noContinue = loop.noContinue;
    ast.loopLabel  = loop.loopLabel;
    ast.caseLabel  = "LABEL__" + method.genlabel++;

    let literals = ["E_Self", "E_String", "E_Number", "E_Boolean", "E_Nil"];
    if (!literals.includes(ast.pattern.expression.tag)) {
      throw new Error("P_Literal pattern expected literal expression.");
    }

    Generate(ast.pattern.expression, prefix + "  ", cls, method, ast, scope);
    Generate(ast.body,               prefix + "  ", cls, method, ast, scope);

    ast.js += prefix + `${ast.caseLabel}: while (true) {\n`;
    ast.js += prefix + `  if (AM__ne(SUBJECT, ${ast.pattern.expression.js})) break ${ast.caseLabel};\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `  break ${ast.loopLabel};\n`;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "C_Else") {
    ast.js = ``;

    ast.noBreak    = loop.noBreak;
    ast.noContinue = loop.noContinue;
    ast.loopLabel  = loop.loopLabel;
    ast.caseLabel  = "LABEL__" + method.genlabel++;

    Generate(ast.body, prefix + "  ", cls, method, ast, scope);

    ast.js += prefix + `${ast.caseLabel}: while (true) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `  break ${ast.loopLabel};\n`; // Leave match loop.
    ast.js += prefix + `}\n`;
  }

  else {
    throw new Error(`Expected valid AST node tag, found node tag ${ast.tag}.`);
  }
}
