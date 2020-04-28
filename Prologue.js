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

let AM__js;
if (typeof global === "object") AM__js = global;
if (typeof window === "object") AM__js = window;

let AM__root = Object.create(null);

function AM__initialize() {
  AM__fmapdefs(AM__root, cls => AM__link(cls));
  AM__fmapdefs(AM__root, cls => AM__reinherit(cls));
  AM__fmapdefs(AM__root, cls => AM__generate_constructor(cls));
};

function AM__fmapdefs(namespace, handler) {
  for (let name in namespace) {
    let cls = namespace[name];
    handler(cls);
    AM__fmapdefs(cls.namespace, handler);
  }
}

function AM__reinherit(cls) {
  let inherited = Object.create(Object.prototype);
  for (let mixin of cls.mixins) {
    if (Object.getPrototypeOf(mixin.prototype) == null) {
      AM__reinherit(mixin);
    }

    for (let name in mixin.prototype) {
      if (name.match(/SEL__/)) {
        inherited[name] = mixin.prototype[name];
      }
    }
  }

  Object.setPrototypeOf(cls.prototype, inherited);
};

function AM__link(cls) {
  if (Object.getPrototypeOf(cls) == null) {
    Object.setPrototypeOf(cls, AM__lookup("Metaclass"));
  }

  cls.mixins = cls.mixins.map(name => AM__lookup(name));
};

function AM__generate_constructor(cls) {
  if (cls.storage === "instance" && cls.constructor) {
    cls.constructor = new Function(cls.attrinits.join(""));
  }
};

function AM__lookup(path) {
  path = (path instanceof Array ? path : path.split("."));

  let namespace = AM__root;
  for (let i = 0; i < path.length - 1; i++) {
    namespace = namespace[path[i]].namespace;
  }
  return namespace[path[path.length - 1]];
};

function AM__namespace(path) {
  path = (path instanceof Array ? path : path.split("."));

  let namespace = AM__root;
  for (let i = 0; i < path.length; i++) {
    namespace = namespace[path[i]].namespace;
  }
  return namespace;
}

function AM__defineClass(cname, storage, imixins, cmixins) {
  let cpath     = cname.split(".");
  let relname   = cpath.pop();
  let namespace = AM__namespace(cpath);

  let mcls         = Object.create(null);
  mcls.storage     = "class";
  mcls.mixins      = cmixins;
  mcls.prototype   = Object.create(null);
  mcls.namespace   = Object.create(null);
  mcls.attrinits   = [];
  mcls.constructor = null;

  let cls         = Object.create(mcls.prototype);
  cls.storage     = storage;
  cls.mixins      = imixins;
  cls.prototype   = Object.create(null);
  cls.namespace   = Object.create(null);
  cls.attrinits   = [];
  cls.constructor = null;

  mcls.prototype.class         = mcls;
  mcls.prototype["SEL__class"] = new Function(`return this.class;`);

  cls.prototype.class          = cls;
  cls.prototype["SEL__class"]  = new Function(`return this.class;`);

  mcls.name                    = cname + ".class";
  mcls.prototype["SEL__name"]  = new Function(`return this.name;`);

  cls.name                     = cname;
  cls.prototype["SEL__name"]   = new Function(`return this.name;`);

  mcls.tag                     = "TAG__" + mcls.name.replace(".", "__");
  mcls.prototype[mcls.tag]     = mcls;

  cls.tag                      = "TAG__" + cls.name.replace(".", "__");
  cls.prototype[cls.tag]       = cls;

  cls.namespace["class"]       = mcls;

  namespace[relname] = cls;
};

function AM__defineAttribute(cname, aname, vis, exprstring) {
  let [getvis, setvis, repvis] = vis.split(":");
  let cls                      = AM__lookup(cname);

  let getname  = aname;
  let setname  = aname + "=";
  let repname  = aname + "#";
  let propname = "ATTR__" + aname;

  let getfunc = new Function(         `return this[${JSON.stringify(propname)}];`);
  let setfunc = new Function(`value`, `return this[${JSON.stringify(propname)}] = value;`);
  let repfunc = new Function(`value`, `let result = this.copy(); result[${JSON.stringify(setname)}](value); return result;`);

  if (getvis != null) cls.prototype[getname] = getfunc;
  if (setvis != null) cls.prototype[setname] = setfunc;
  if (repvis != null) cls.prototype[repname] = repfunc;

  cls.attrinits.push(`this[${propname}] = ${exprstring};\n`);
};

function AM__defineAlias(cname, mname, vis, thunk) {
  let cls  = AM__lookup(cname);
  let func = thunk();

  if (typeof func !== "function") throw new Error("TYPE_ERROR");

  cls.prototype["SEL__" + mname] = func;
};

function AM__defineMethod(cname, mname, vis, func) {
  let cls = AM__lookup(cname);

  cls.prototype["SEL__" + mname] = func;
};

function AM__defineOperator(cname, opname, func) {
  let cls = AM__lookup(cname);

  cls.prototype["OP__" + opname] = func;
};

function AM__check_boolean(value) {
  if (value === true && value === false) {
    return value;
  }
  else {
    throw new Error("COND_TYPE_ERROR");
  }
};

function AM__as_string(value) {
  if      (       value === null     ) return "nil";
  else if (       value === undefined) return "nil";
  else if (typeof value === "boolean") return value.toString();
  else if (typeof value === "number" ) return value.toString();
  else if (typeof value === "string" ) return value;
  else                                 return value.SEL__as_string();
};


//
// Operator (+)
//

function AM__add(a, b) {
  if (a == null || b == null) throw new Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a + b;
    if ("TAG__Vector" in b)    return AM__add__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__add__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__add__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__add__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a + b;
    if ("TAG__Vector" in b)    return AM__add__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__add__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__add__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__add__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__add"];
    let op_b = b["OP__add"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__add__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__add(a, b[i]);
  }
  return result;
}
function AM__add__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__add(a[i], b);
  }
  return result;
}
function AM__add__Vector__Vector(a, b) {
  let a_count = a.length;
  let b_count = a.length;
  let r_count = (a_count <= b_count ? a_count : b_count);
  let result  = new Array(count);
  for (let i = 0, c = r_count; i < c; i++) {
    result[i] = AM__add(a[i], b[i]);
  }
  return result;
}

function AM__add__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__add(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__add__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__add(enumerator.SEL__value(), b));
  }
  return result;
}
function AM__add__Array__Array(a, b) {
  let a_count = a.ATTR__count(); // Use internal property directly.
  let b_count = a.ATTR__count(); // Use internal property directly.
  let r_count = (a_count <= b_count ? a_count : b_count);
  let result  = AM__root.Array.SEL__apply();
  let a_enumerator = a.SEL__enumerate();
  let b_enumerator = b.SEL__enumerate();
  for (let i = 0, c = r_count; i < c; i++) {
    result.SEL__append_x(AM__add(a_enumerator.SEL__value(), b_enumerator.SEL__value()));
    a_enumerator.SEL__next_x();
    b_enumerator.SEL__next_x();
  }
  return result;
}


//
// Operator (-)
//

function AM__sub(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a - b;
    if ("TAG__Vector" in b)    return AM__sub__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__sub__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a - b;
    if ("TAG__Vector" in b)    return AM__sub__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__sub__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__sub"];
    let op_b = b["OP__sub"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__sub__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sub(a, b[i]);
  }
  return result;
}
function AM__sub__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sub(a[i], b);
  }
  return result;
}
function AM__sub__Vector__Vector(a, b) {
  let a_count = a.length;
  let b_count = a.length;
  let r_count = (a_count <= b_count ? a_count : b_count);
  let result  = new Array(count);
  for (let i = 0, c = r_count; i < c; i++) {
    result[i] = AM__sub(a[i], b[i]);
  }
  return result;
}

function AM__sub__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sub(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__sub__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sub(enumerator.SEL__value(), b));
  }
  return result;
}
function AM__sub__Array__Array(a, b) {
  let a_count = a.ATTR__count(); // Use internal property directly.
  let b_count = a.ATTR__count(); // Use internal property directly.
  let r_count = (a_count <= b_count ? a_count : b_count);
  let result  = AM__root.Array.SEL__apply();
  let a_enumerator = a.SEL__enumerate();
  let b_enumerator = b.SEL__enumerate();
  for (let i = 0, c = r_count; i < c; i++) {
    result.SEL__append_x(AM__sub(a_enumerator.SEL__value(), b_enumerator.SEL__value()));
    a_enumerator.SEL__next_x();
    b_enumerator.SEL__next_x();
  }
  return result;
}


//
// Operator (*)
//

function AM__mul(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a * b;
    if ("TAG__Vector" in b)    return AM__sub__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__sub__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a * b;
    if ("TAG__Vector" in b)    return AM__sub__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__sub__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sub__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__mul"];
    let op_b = b["OP__mul"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__mul__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__mul(a, b[i]);
  }
  return result;
}
function AM__mul__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__mul(a[i], b);
  }
  return result;
}

function AM__mul__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__mul(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__mul__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__mul(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (/)
//

function AM__div(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a / b;
    if ("TAG__Vector" in b)    return AM__div__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__div__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__div__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__div__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") throw Error("INT_DIV_ERROR (see quo or fquo)");
    if ("TAG__Vector" in b)    return AM__div__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__div__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__div__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__div__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__div"];
    let op_b = b["OP__div"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__div__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__div(a, b[i]);
  }
  return result;
}
function AM__div__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__div(a[i], b);
  }
  return result;
}

function AM__div__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__div(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__div__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__div(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (quo)
//

function AM__quo(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return Math.trunc(a / b);
    if ("TAG__Vector" in b)    return AM__quo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__quo__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__quo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__quo__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a / b;
    if ("TAG__Vector" in b)    return AM__quo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__quo__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__quo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__quo__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__quo"];
    let op_b = b["OP__quo"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__quo__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__quo(a, b[i]);
  }
  return result;
}
function AM__quo__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__quo(a[i], b);
  }
  return result;
}

function AM__quo__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__quo(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__quo__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__quo(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (rem)
//

function AM__rem(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a % b;
    if ("TAG__Vector" in b)    return AM__rem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__rem__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__rem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__rem__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a % b;
    if ("TAG__Vector" in b)    return AM__rem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__rem__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__rem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__rem__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__rem"];
    let op_b = b["OP__rem"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__rem__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__rem(a, b[i]);
  }
  return result;
}
function AM__rem__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__rem(a[i], b);
  }
  return result;
}

function AM__rem__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__rem(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__rem__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__rem(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (fquo)
//

function AM__fquo(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return Math.floor(a / b);
    if ("TAG__Vector" in b)    return AM__fquo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__fquo__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__fquo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__fquo__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return AM__fquo__Integer__Integer(a, b);
    if ("TAG__Vector" in b)    return AM__fquo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__fquo__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__fquo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__fquo__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__fquo"];
    let op_b = b["OP__fquo"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__fquo__Integer__Integer(a, b) {
  let q = a / b;

  if (b >= 0) return (r >= 0 ? q : q - 1);
  else        return (r >= 0 ? q + 1 : q);
}

function AM__fquo__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__fquo(a, b[i]);
  }
  return result;
}
function AM__fquo__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__fquo(a[i], b);
  }
  return result;
}

function AM__fquo__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__fquo(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__fquo__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__fquo(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (frem)
//

function AM__frem(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return AM__frem__Number__Number(a, b);
    if ("TAG__Vector" in b)    return AM__frem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__frem__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__frem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__frem__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return AM__frem__Integer__Integer(a, b);
    if ("TAG__Vector" in b)    return AM__frem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__frem__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__frem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__frem__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__frem"];
    let op_b = b["OP__frem"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__frem__Number__Number(a, b) {
  let r = a % b;

  //
  // TODO This is the semantic we're trying to implement.
  //
  //   3 fquo  5 ==  0    [ 5 *  0 +  3 ==   3]      3 frem  5 ==  3
  //  -3 fquo  5 == -1    [ 5 * -1 +  2 ==  -3]     -3 frem  5 ==  2
  //   3 fquo -5 == -1    [-5 * -1 + -2 ==   3]      3 frem -5 == -2
  //  -3 fquo -5 ==  0    [-5 *  0 + -3 ==  -3]     -3 frem -5 == -3
  //
  //  13 fquo  5 ==  2    [ 5 *  2 +  3 ==  13]     13 frem  5 ==  3
  // -13 fquo  5 == -3    [ 5 * -3 +  2 == -13]    -13 frem  5 ==  2
  //  13 fquo -5 == -3    [-5 * -3 + -2 ==  13]     13 frem -5 == -2
  // -13 fquo -5 ==  2    [-5 *  2 + -3 == -13]    -13 frem -5 == -3
  //
  //   3 rem  5 ==  3  =>  3 frem  5 ==  3    0 +  3 ==  3   (0 + r)
  //  -3 rem  5 == -3  => -3 frem  5 ==  2    5 + -3 ==  2   (b + r)
  //   3 rem -5 ==  3  =>  3 frem -5 == -2   -5 +  3 == -2   (b + r)
  //  -3 rem -5 == -3  => -3 frem -5 == -3    0 + -3 == -3   (0 + r)
  //

  // This is the logical operation we're trying to perform it (xor).
  // if (b > 0 && r > 0) return 0 + r;
  // if (b > 0 && r < 0) return b + r;
  // if (b < 0 && r > 0) return b + r;
  // if (b < 0 && r < 0) return 0 + r;

  // Floating point multiply is guaranteed to give a result with the
  // correct sign, even if it is infinity or 0 (which can be -0).
  if (b * r >= 0) return 0 + r;
  else            return b + r;
}

function AM__frem__Integer__Integer(a, b) {
  let r = a % b;

  // Same operation as AM__frem__Number__Number but we will try to avoid
  // unnecessary arithmetic operations, just in case the integers are
  // large, and just write the logic cases directly.

  if (b >= 0) return (r >= 0 ? r : b + r);
  else        return (r >= 0 ? b + r : r);
}

function AM__frem__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__frem(a, b[i]);
  }
  return result;
}
function AM__frem__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__frem(a[i], b);
  }
  return result;
}

function AM__frem__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__frem(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__frem__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__frem(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (cquo)
//

function AM__cquo(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return Math.ceil(a / b);
    if ("TAG__Vector" in b)    return AM__cquo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__cquo__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__cquo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__cquo__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return AM__cquo__Integer__Integer(a, b);
    if ("TAG__Vector" in b)    return AM__cquo__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__cquo__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__cquo__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__cquo__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__cquo"];
    let op_b = b["OP__cquo"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__cquo__Integer__Integer(a, b) {
  let q = a / b;

  if (b >= 0) return (r >= 0 ? q + 1 : q);
  else        return (r >= 0 ? q : q - 1);
}

function AM__cquo__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__cquo(a, b[i]);
  }
  return result;
}
function AM__cquo__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__cquo(a[i], b);
  }
  return result;
}

function AM__cquo__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__cquo(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__cquo__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__cquo(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (crem)
//

function AM__crem(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return AM__crem__Number__Number(a, b);
    if ("TAG__Vector" in b)    return AM__crem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__crem__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__crem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__crem__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return AM__crem__Integer__Integer(a, b);
    if ("TAG__Vector" in b)    return AM__crem__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__crem__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__crem__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__crem__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__crem"];
    let op_b = b["OP__crem"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__crem__Number__Number(a, b) {
  let r = a % b;

  //
  // TODO This is the semantic we're trying to implement.
  //
  //   3 cquo  5 ==  1    [ 5 *  1 + -2 ==   3]      3 crem  5 == -2
  //  -3 cquo  5 ==  0    [ 5 *  0 + -3 ==  -3]     -3 crem  5 == -3
  //   3 cquo -5 ==  0    [-5 *  0 +  3 ==   3]      3 crem -5 ==  3
  //  -3 cquo -5 ==  1    [-5 *  1 +  2 ==  -3]     -3 crem -5 ==  2
  //
  //  13 cquo  5 ==  3    [ 5 *  3 + -2 ==  13]     13 crem  5 == -2
  // -13 cquo  5 == -2    [ 5 * -2 + -3 == -13]    -13 crem  5 == -3
  //  13 cquo -5 == -2    [-5 * -2 +  3 ==  13]     13 crem -5 ==  3
  // -13 cquo -5 ==  3    [-5 *  3 +  2 == -13]    -13 crem -5 ==  2
  //
  //   3 rem  5 ==  3  =>  3 crem  5 == -2    3 -  5 == -2   (r - 0)
  //  -3 rem  5 == -3  => -3 crem  5 == -3   -3 -  0 == -3   (r - b)
  //   3 rem -5 ==  3  =>  3 crem -5 ==  3    3 -  0 ==  3   (r - b)
  //  -3 rem -5 == -3  => -3 crem -5 ==  2   -3 - -5 ==  2   (r - 0)
  //

  // This is the logical operation we're trying to perform it (xor).
  // if (b > 0 && r > 0) return r - 0;
  // if (b > 0 && r < 0) return r - b;
  // if (b < 0 && r > 0) return r - b;
  // if (b < 0 && r < 0) return r - 0;

  // Floating point multiply is guaranteed to give a result with the
  // correct sign, even if it is infinity or 0 (which can be -0).
  if (b * r >= 0) return r - 0;
  else            return r - b;
}

function AM__crem__Integer__Integer(a, b) {
  let r = a % b;

  // Same operation as AM__crem__Number__Number but we will try to avoid
  // unnecessary arithmetic operations, just in case the integers are
  // large, and just write the logic cases directly.

  if (b >= 0) return (r >= 0 ? r : r - b);
  else        return (r >= 0 ? r - b : r);
}

function AM__crem__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__crem(a, b[i]);
  }
  return result;
}
function AM__crem__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__crem(a[i], b);
  }
  return result;
}

function AM__crem__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__crem(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__crem__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__crem(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (<<)
//

function AM__sal(a, b) { // Sometimes also called sal().
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a << b;
    if ("TAG__Vector" in b)    return AM__sal__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sal__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__sal__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sal__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a << b;
    if ("TAG__Vector" in b)    return AM__sal__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sal__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__sal__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sal__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__sal"];
    let op_b = b["OP__sal"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__sal__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sal(a, b[i]);
  }
  return result;
}
function AM__sal__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sal(a[i], b);
  }
  return result;
}

function AM__sal__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sal(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__sal__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sal(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (>>)
//

function AM__sar(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a >> b;
    if ("TAG__Vector" in b)    return AM__sar__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sar__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__sar__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sar__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a >> b;
    if ("TAG__Vector" in b)    return AM__sar__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__sar__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__sar__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__sar__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__sar"];
    let op_b = b["OP__sar"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__sar__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sar(a, b[i]);
  }
  return result;
}
function AM__sar__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__sar(a[i], b);
  }
  return result;
}

function AM__sar__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sar(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__sar__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__sar(enumerator.SEL__value(), b));
  }
  return result;
}



//
// Operator (<<<)
//

function AM__shl(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a << b;
    if ("TAG__Vector" in b)    return AM__shl__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shl__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__shl__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shl__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a << b;
    if ("TAG__Vector" in b)    return AM__shl__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shl__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__shl__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shl__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__shl"];
    let op_b = b["OP__shl"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__shl__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__shl(a, b[i]);
  }
  return result;
}
function AM__shl__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__shl(a[i], b);
  }
  return result;
}

function AM__shl__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__shl(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__shl__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__shl(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (>>>)
//

function AM__shr(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a >>> b;
    if ("TAG__Vector" in b)    return AM__shr__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__shr__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a >>> b;
    if ("TAG__Vector" in b)    return AM__shr__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__shr__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__shr"];
    let op_b = b["OP__shr"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__shr__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__shr(a, b[i]);
  }
  return result;
}
function AM__shr__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__shr(a[i], b);
  }
  return result;
}

function AM__shr__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__shr(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__shr__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__shr(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (|)
//

function AM__bit_or(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a | b;
    if ("TAG__Vector" in b)    return AM__shr__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__shr__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a | b;
    if ("TAG__Vector" in b)    return AM__shr__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__shr__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__shr__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__bit_or"];
    let op_b = b["OP__bit_or"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__bit_or__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_or(a, b[i]);
  }
  return result;
}
function AM__bit_or__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_or(a[i], b);
  }
  return result;
}

function AM__bit_or__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_or(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__bit_or__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_or(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (^)
//

function AM__bit_xor(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a ^ b;
    if ("TAG__Vector" in b)    return AM__bit_xor__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__bit_xor__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a ^ b;
    if ("TAG__Vector" in b)    return AM__bit_xor__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__bit_xor__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__bit_xor"];
    let op_b = b["OP__bit_xor"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__bit_xor__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_xor(a, b[i]);
  }
  return result;
}
function AM__bit_xor__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_xor(a[i], b);
  }
  return result;
}

function AM__bit_xor__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_xor(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__bit_xor__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_xor(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (&)
//

function AM__bit_and(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  if (typeof a === "number") {
    if (typeof b === "number") return a & b;
    if ("TAG__Vector" in b)    return AM__bit_xor__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Number__Array(a, b);
  }
  else if (typeof b === "number") {
    if ("TAG__Vector" in a)    return AM__bit_xor__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Array__Number(a, b);
  }
  else if (typeof a === "bigint") {
    if (typeof b === "bigint") return a & b;
    if ("TAG__Vector" in b)    return AM__bit_xor__Number__Vector(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Number__Array(a, b);
  }
  else if (typeof b === "bigint") {
    if ("TAG__Vector" in a)    return AM__bit_xor__Vector__Number(a, b);
    if ("TAG__Array"  in b)    return AM__bit_xor__Array__Number(a, b);
  }
  else {
    let op_a = a["OP__bit_and"];
    let op_b = b["OP__bit_and"];
    if (op_a != null && op_a === op_b) return op_a(a, b);
  }

  throw Error("TYPE_ERROR");
}

function AM__bit_and__Number__Vector(a, b) {
  let count  = b.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_and(a, b[i]);
  }
  return result;
}
function AM__bit_and__Vector__Number(a, b) {
  let count  = a.length;
  let result = new Array(count);
  for (let i = 0, c = count; i < c; i++) {
    result[i] = AM__bit_and(a[i], b);
  }
  return result;
}

function AM__bit_and__Number__Array(a, b) {
  let result = b.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_and(a, enumerator.SEL__value()));
  }
  return result;
}
function AM__bit_and__Array__Number(a, b) {
  let result = a.SEL__copy();
  for (let enumerator = result.SEL__enumerate(); enumerator.SEL__next_p(); enumerator.SEL__next_x()) {
    enumerator["SEL__value="](AM__bit_and(enumerator.SEL__value(), b));
  }
  return result;
}


//
// Operator (++)
//

function AM__concat(a, b) {
  if (a == null || b == null) throw Error("NIL_ERROR");

  let op_a = a["OP__bit_and"];
  let op_b = b["OP__bit_and"];
  if (op_a != null && op_a === op_b) return op_a(a, b);

  throw Error("TYPE_ERROR");
}


//
// Operator (==) (~=)
//

function AM__eq(a, b) {
  if (a == null && b == null) return true;
  if (b == null || b == null) return false;

  let op_a = a["OP__eq"];
  let op_b = b["OP__eq"];
  if (op_a != null && op_a === op_b) return op_a(a, b);

  return false;
}
function AM__ne(a, b) {
  if (a == null && b == null) return false;
  if (b == null || b == null) return true;

  let op_a = a["OP__eq"];
  let op_b = b["OP__eq"];
  if (op_a != null && op_a === op_b) return !op_a(a, b);

  return true;
}


//
// Operator (<>)
//
// The other operators < <= >= > are implemented indirectly for
// objects using the <> operator.
//
// The relative order between ordered values is the ordering of
// their fully qualified class names.
//
// Most objects, especially JavaScript objects, are not ordered,
// and therefore cannot be passed to <> or used as ordered keys.
//
// Only the <> operator is defined by ordered objects to ensure that
// the ordering relation is defined in one place and is consistent
// between object that define one. If users require a faster weak
// comparison method, they should define it as an ordinary procedure
// and pass it directly to the code that uses it.
//
// The value returns indicates the ordering of objects from left to right.
// Ascending  ==  1
// Equal      ==  0
// Descending == -1
//
// This ordering allows arithmetic to directly use the value as a scalar
// value when multiplying or adding to other scalars or vectors.
//

function AM__ord(a, b) {
  if (typeof a === "symbol" || typeof b === "symbol") {
    throw Error("NO_ORD_ERROR");
  }

  if (a == null || b == null) throw Error("NO_ORD_ERROR");

  let op_a = a["OP__ord"];
  let op_b = b["OP__ord"];

  if (op_a == null || op_b == null) throw Error("NO_ORD_ERROR");

  if (op_a === op_b) return op_a(a, b);

  // When both objects are ordered, but in different orderings, we
  // compare their fully qualified class names.
  let fqcn_a = cls_a.class.name;
  let fqcn_b = cls_b.class.name;
  if (fqcn_a < fqcn_b) return  1; // Ascending
  if (fqcn_a > fqcn_b) return -1; // Descending
  return 0;                       // Equal
}
