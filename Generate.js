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
  }
  return result;
}

function ConvertToBlock(ast) {
  if (ast.tag === "Block") {
    return ast;
  }
  else {
    return { tag: "Block", statements: [{ tag: "S_Expression", expression: ast }] }
  }
}

export function Generate(ast, prefix, className, scope) {
  if (ast == null) {
    throw new Error(`Expected non-null AST node.`);
  }

  else if (ast.tag === "Unit") {
    ast.js = ``;

    for (let declaration of ast.declarations) {
      Generate(declaration, prefix, null, null);
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
      Generate(method, "", ast.name, null);

      if (method.tag === "Accessor") {
        if (method.static) cattrs.push(method);
        else               iattrs.push(method);
      }
      if (method.tag === "Method") {
        if (method.static) cmethods.push(method);
        else               imethods.push(method);
      }
    }

    let name    = JSON.stringify(ast.name);
    let imixins = ast.imixins.map(name => JSON.stringify(name)).join(", ");
    let cmixins = ast.cmixins.map(name => JSON.stringify(name)).join(", ");

    ast.js += prefix + `AM__defineClass(${name}, [${imixins}], [${cmixins}]);\n`;
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

  else if (ast.tag === "Accessor") {
    ast.js = ``;

    let name = JSON.stringify(`${className}${ast.static ? ".class" : ""}:${ast.name}`);
    let vis  = JSON.stringify(`${ast.get}:${ast.set}:${ast.rep}`);

    ast.js += prefix + `AM__defineAttribute(${name}, ${vis});\n`;
  }
  else if (ast.tag === "Method") {
    ast.js = ``;

    let name = JSON.stringify(`${className}${ast.static ? ".class" : ""}:${ast.name}`);
    let vis  = JSON.stringify(`${ast.vis}`);

    let fname = `SEL__${className}${ast.static ? ".class" : ""}__${ast.name}`.replace(".", "__");

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

    if (ast.body.tag !== "Block") {
      ast.body = { tag: "Block", statements: [{ tag: "S_Return", expression: ast.body }] };
    }
    ast.body.parameters = ast.parameters;
    Generate(ast.body, prefix + "    ", className, null);

    if (restindex == null) {
      let parameters = ast.parameters.map(p => Mangle(p.name)).join(", ");

      ast.js += prefix + `AM__defineMethod(${name}, ${vis},\n`;
      ast.js += prefix + `  function ${fname}(${parameters}) {\n`;
      ast.js +=               ast.body.js;
      ast.js += prefix + `  }\n`;
      ast.js += prefix + `);\n`;
    }
    else {
      ast.js += prefix + `AM__defineMethod(${name}, ${vis},\n`;
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
          ast.js += prefix + `    let ${name} = new __root.Array.allocate();\n`;
          ast.js += prefix + `    for (let i = ${restindex}, c = arguments.length - ${postcount}; i < c; i++) {\n`;
          ast.js += prefix + `      ${name}.append_x(arguments[i]);\n`;
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
      Generate(statement, prefix, className, ast);

      ast.js += statement.js;
    }
  }

  else if (ast.tag === "S_Let") {
    for (let variable of ast.variables) Generate(variable.value, prefix, className, scope);

    let variables = ast.variables.map(v => `${Mangle(v.name)} = ${v.value.js}`).join(", ");

    ast.js = prefix + `let ${variables};\n`;
  }
  else if (ast.tag === "S_If") {
    ast.js = ``;

    if (ast.alternative == null) {
      ast.consiquent  = ConvertToBlock(ast.consiquent,  true);

      Generate(ast.condition,   prefix,        className, scope);
      Generate(ast.consiquent,  prefix + "  ", className, scope);

      ast.js += prefix + `if (${ast.condition.js}) {\n`;
      ast.js +=             ast.consiquent.js;
      ast.js += prefix + `}\n`;
    }
    else {
      ast.consiquent  = ConvertToBlock(ast.consiquent,  true);
      ast.alternative = ConvertToBlock(ast.alternative, true);

      Generate(ast.condition,   prefix,        className, scope);
      Generate(ast.consiquent,  prefix + "  ", className, scope);
      Generate(ast.alternative, prefix + "  ", className, scope);

      ast.js += prefix + `if (${ast.condition.js}) {\n`;
      ast.js +=             ast.consiquent.js;
      ast.js += prefix + `}\n`;
      ast.js += prefix + `else {\n`;
      ast.js +=             ast.alternative.js;
      ast.js += prefix + `}\n`;
    }
  }
  else if (ast.tag === "S_Match") {
    throw Error("NOT_IMPLEMENTED");
  }
  else if (ast.tag === "S_Once") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    Generate(ast.body, prefix + "  ", className, scope);

    ast.js += prefix + `do {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
    ast.js += prefix + `while (false);\n`;
  }
  else if (ast.tag === "S_Forever") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    Generate(ast.body, prefix + "  ", className, scope);

    ast.js += prefix + `while (true) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_While") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    Generate(ast.condition, prefix,        className, scope);
    Generate(ast.body,      prefix + "  ", className, scope);

    let negated = (ast.negated ? "!" : "");

    ast.js += prefix + `while (${negated}${ast.condition.js}) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Do_While") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    Generate(ast.condition, prefix,        className, scope);
    Generate(ast.body,      prefix + "  ", className, scope);

    let negated = (ast.negated ? "!" : "");

    ast.js += prefix + `do {\n`;
    ast.js += ast.body.js;
    ast.js += prefix + `}\n`;
    ast.js += prefix + `while (${negated}${ast.condition.js});\n`;
  }
  else if (ast.tag === "S_For") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    for (let variable  of ast.variables)  Generate(variable.value, prefix, className, scope);
    for (let condition of ast.conditions) Generate(condition,      prefix, className, scope);
    for (let increment of ast.increments) Generate(increment,      prefix, className, scope);
    Generate(ast.body, prefix + "  ", className, scope);

    let variables  = ast.variables.map(v => `${Mangle(v.name)} = ${v.value.js}`).join(", ");
    let conditions = ast.conditions.map(c => c.js).join(" && ");
    let increments = ast.increments.map(i => i.js).join(", ");

    ast.js += prefix + `for (let ${variables}; ${conditions}; ${increments}) {\n`;
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Each") {
    ast.js = ``;

    ast.body = ConvertToBlock(ast.body, true);

    Generate(ast.subject, prefix,        className, scope);
    Generate(ast.body,    prefix + "  ", className, scope);

    ast.js += prefix + `for (let ENUMERATOR = ${ast.subject.js}.enumerate()); ENUMERATOR.continue_p(); ENUMERATOR.advance()) {\n`;
    if (ast.key != null) {
      ast.js += prefix + `  let ${Mangle(ast.key)} = ENUMERATOR.key(), ${Mangle(ast.value)} = ENUMERATOR.value();\n`;
    }
    else {
      ast.js += prefix + `  let ${Mangle(ast.value)} = ENUMERATOR.value();\n`;
    }
    ast.js +=             ast.body.js;
    ast.js += prefix + `}\n`;
  }
  else if (ast.tag === "S_Break") {
    ast.js = prefix + `break;\n`;
  }
  else if (ast.tag === "S_Continue") {
    ast.js = prefix + `continue;\n`;
  }
  else if (ast.tag === "S_Return") {
    if (ast.expression == null) ast.expression = { tag: "E_Nil" };

    Generate(ast.expression, prefix, className, scope);

    ast.js = prefix + `return ${ast.expression.js};\n`;
  }
  else if (ast.tag === "S_Expression") {
    Generate(ast.expression, prefix, className, scope);

    ast.js = prefix + `${ast.expression.js};\n`;
  }

  else if (ast.tag === "E_OR") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) || AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_XOR") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) !== AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_AND") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    ast.js = `(AM__check_boolean(${ast.a.js}) && AM__check_boolean(${ast.b.js}))`;
  }
  else if (ast.tag === "E_NOT") {
    Generate(ast.a, prefix, className, scope);

    ast.js = `(!AM__check_boolean(${ast.a.js}))`;
  }

  else if (ast.tag === "E_Ternary") {
    Generate(ast.condition,   prefix,        className, scope);
    Generate(ast.consiquent,  prefix + "  ", className, scope);
    Generate(ast.alternative, prefix + "  ", className, scope);

    ast.js = `(${ast.condition.js} ? ${ast.consiquent.js} : ${ast.alternative.js})`;
  }
  else if (ast.tag === "E_Relational") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    if (ast.o === "==") ast.js =        `AM__eq(${ast.a.js}, ${ast.b.js})`;
    if (ast.o === "~=") ast.js =        `AM__ne(${ast.a.js}, ${ast.b.js})`;
    if (ast.o === "<")  ast.js = `(0 <  AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === "<=") ast.js = `(0 <= AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === ">=") ast.js = `(0 >= AM__ord(${ast.a.js}, ${ast.b.js}))`;
    if (ast.o === ">")  ast.js = `(0 >  AM__ord(${ast.a.js}, ${ast.b.js}))`;
  }
  else if (ast.tag === "E_Order") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    ast.js = `AM__ord(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Is") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    ast.js = `(function(v,c){return c.tag in v;})(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Infix") {
    Generate(ast.a, prefix, className, scope);
    Generate(ast.b, prefix, className, scope);

    if (ast.o === "++")   ast.pname = "AM__concat";
    if (ast.o === "|")    ast.pname = "AM__bit_or";
    if (ast.o === "^")    ast.pname = "AM__bit_xor";
    if (ast.o === "&")    ast.pname = "AM__bit_and";
    if (ast.o === "<<")   ast.pname = "AM__shl";
    if (ast.o === ">>")   ast.pname = "AM__sar";
    if (ast.o === ">>>")  ast.pname = "AM__shr";
    if (ast.o === "+")    ast.pname = "AM__add";
    if (ast.o === "-")    ast.pname = "AM__sub";
    if (ast.o === "*")    ast.pname = "AM__mul";
    if (ast.o === "/")    ast.pname = "AM__div";
    if (ast.o === "quo")  ast.pname = "AM__quo";
    if (ast.o === "rem")  ast.pname = "AM__rem";
    if (ast.o === "fquo") ast.pname = "AM__fquo";
    if (ast.o === "frem") ast.pname = "AM__frem";
    if (ast.o === "cquo") ast.pname = "AM__cquo";
    if (ast.o === "crem") ast.pname = "AM__crem";

    ast.js = `${ast.pname}(${ast.a.js}, ${ast.b.js})`;
  }
  else if (ast.tag === "E_Prefix") {
    Generate(ast.a, prefix, className, scope);

    if (ast.name === "+") ast.js = `${ast.a.js}.posate()`;
    if (ast.name === "-") ast.js = `${ast.a.js}.negate()`;
    if (ast.name === "~") ast.js = `${ast.a.js}.not()`;
  }
  else if (ast.tag === "E_Message") {
    if (ast.recipient == null) {
      if (ast.selector.match(/^[A-Z][A-Za-z0-9_]*$/)) {
        if (ast.arguments.length !== 0) {
          throw new Error("Global variable lookup expected zero arguments.");
        }

        if (ast.rep != null) {
          throw new Error("Global variable lookup expected no replace argument.");
        }

        if (ast.set != null) {
          throw new Error("Global variable lookup expected no set argument.");
        }

        ast.js = `__root.${ast.selector}`;
      }
      else if (Lookup(scope, ast.selector) != null) {
        if (ast.arguments.length !== 0) {
          throw new Error("Local variable lookup expected no arguments.");
        }

        if (ast.rep != null) {
          throw new Error("Local variable lookup expected no replace argument.");
        }

        if (ast.set == null) {
          ast.js = `${Mangle(ast.selector)}`;
        }
        else {
          Generate(ast.set, prefix, className, scope);

          ast.js = `(${Mangle(ast.selector)} = ${ast.set.js})`;
        }
      }
      else {
        if (ast.rep != null) ast.selector += "#";
        if (ast.set != null) ast.selector += "=";

        if (ast.rep != null) ast.arguments.push(ast.rep);
        if (ast.set != null) ast.arguments.push(ast.set);

        for (let argument of ast.arguments) {
          Generate(argument, prefix, className, scope);
        }

        if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
          ast.js = `this.${Mangle("SEL__" + ast.selector)}(${ast.arguments.map(a => a.js).join(", ")})`;
        }
        else {
          ast.js = `this[${JSON.stringify("SEL__" + ast.selector)}](${ast.arguments.map(a => a.js).join(", ")})`;
        }
      }
    }
    else if (ast.recipient.tag === "E_Super") {
      if (ast.rep != null) ast.selector += "#";
      if (ast.set != null) ast.selector += "=";

      if (ast.rep != null) ast.arguments.push(ast.rep);
      if (ast.set != null) ast.arguments.push(ast.set);

      for (let argument of ast.arguments) {
        Generate(argument, prefix, className, scope);
      }

      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `Object.getPrototypeOf(this).${Mangle("SEL__" + ast.selector)}(${ast.arguments.map(a => a.js).join(", ")})`;
      }
      else {
        ast.js = `Object.getPrototypeOf(this).${ast.recipient.js}[${JSON.stringify("SEL__" + ast.selector)}](${ast.arguments.map(a => a.js).join(", ")})`;
      }
    }
    else {
      if (ast.rep != null) ast.selector += "#";
      if (ast.set != null) ast.selector += "=";

      if (ast.rep != null) ast.arguments.push(ast.rep);
      if (ast.set != null) ast.arguments.push(ast.set);

      Generate(ast.recipient, prefix, className, scope);
      for (let argument of ast.arguments) {
        Generate(argument, prefix, className, scope);
      }

      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `${ast.recipient.js}.${Mangle("SEL__" + ast.selector)}(${ast.arguments.map(a => a.js).join(", ")})`;
      }
      else {
        ast.js = `${ast.recipient.js}[${JSON.stringify("SEL__" + ast.selector)}](${ast.arguments.map(a => a.js).join(", ")})`;
      }
    }
  }
  else if (ast.tag === "E_Property") {
    let recipient;
    if (ast.recipient != null) {
      Generate(ast.recipient, prefix, className, scope);
      recipient = ast.recipient.js;
    }
    else {
      recipient = `__JS`;
    }

    if (ast.set != null) {
      Generate(ast.set, prefix, className, scope);

      if (ast.selector.match(/^[A-Za-z0-9_]+(\?|\!)?$/)) {
        ast.js = `(${recipient}.${Mangle(ast.selector)} = ${ast.set.js})`;
      }
      else {
        ast.js = `(${recipient}[${JSON.stringify(ast.selector)}] = ${ast.set.js})`;
      }
    }
    else if (ast.arguments != null) {
      for (let argument of ast.arguments) {
        Generate(argument, prefix, className, scope);
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

    if (ast.body.tag !== "Block") {
      ast.body = { tag: "Block", statements: [{ tag: "S_Return", expression: ast.body }] };
    }
    ast.body.parameters = ast.parameters;
    Generate(ast.body, prefix + "  ", className, scope);

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
          ast.js += prefix + `  let ${name} = new __root.Array.allocate();\n`;
          ast.js += prefix + `  for (let i = ${restindex}, c = arguments.length - ${postcount}; i < c; i++) {\n`;
          ast.js += prefix + `    ${name}.append_x(arguments[i]);\n`;
          ast.js += prefix + `  }\n`;
        }
      }
      ast.js +=             ast.body.js;
      ast.js += prefix + `})`;
    }
  }
  else if (ast.tag === "E_Dictionary") {
    ast.js = `(new __root.Dictionary.allocate())`;
    for (let element of ast.elements) {
      if (element.tag === "E_Expand") {
        Generate(element.expression, prefix, className, scope);
        ast.js += `.insert_all_x(${element.expression.js})`;
      }
      else if (element.tag === "E_Keyval") {
        Generate(element.key,   prefix, className, scope);
        Generate(element.value, prefix, className, scope);
        ast.js += `.insert_x(${element.key.js}, ${element.value.js})`;
      }
      else {
        Generate(element, prefix, className, scope);
        ast.js += `.insert_keyval_x(${element.js})`;
      }
    }
  }
  else if (ast.tag === "E_Array") {
    ast.js = `(new __root.Array.allocate())`;
    for (let element of ast.elements) {
      if (element.tag === "E_Expand") {
        Generate(element.expression, prefix, className, scope);
        ast.js += `.append_all_x(${element.expression.js})`;
      }
      else {
        Generate(element, prefix, className, scope);
        ast.js += `.append_x(${element.js})`;
      }
    }
  }
  else if (ast.tag === "E_Keyval") {
    Generate(ast.key,   prefix, className, scope);
    Generate(ast.value, prefix, className, scope);

    ast.js = `__root.Keyval["[]"](${ast.key.js}, ${ast.value.js})`;
  }
  else if (ast.tag === "E_Interval") {
    let ivalue = (ast.initial.open ? ast.initial.open : ast.initial.closed);
    let fvalue = (ast.final.open   ? ast.final.open   : ast.final.closed);
    let iexcl  = (ast.initial.open ? "true"           : "false");
    let fexcl  = (ast.final.open   ? "true"           : "false");

    Generate(ivalue, prefix, className, scope);
    Generate(fvalue, prefix, className, scope);

    ast.js = `__root.Interval["[]"](${ivalue.js}, ${fvalue.js}, ${iexcl}, ${fexcl})`;
  }
  else if (ast.tag === "E_Concatenate") {
    if (ast.elements.length === 0) {
      ast.js = `AM__as_string(${JSON.stringify("")})`;
    }
    else if (ast.elements.length === 1) {
      Generate(ast.elements[0], prefix, className, scope);
      ast.js = `AM__as_string(${ast.elements[0].js})`;
    }
    else {
      for (let element of ast.elements) Generate(element, prefix, className, scope);

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

  else {
    throw new Error(`Expected valid AST node tag, found node tag ${ast.tag}.`);
  }
}
