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

let Amethyst = {};

if (typeof global === "object") { global.Amethyst = Amethyst; Amethyst.JS = global; }
if (typeof window === "object") { window.Amethyst = Amethyst; Amethyst.JS = window; }

Amethyst.root = Object.create(null);

Amethyst.boot = function () {
  Amethyst.fmapdefs(Amethyst.root, cls => Amethyst.link(cls));
  Amethyst.fmapdefs(Amethyst.root, cls => Amethyst.reinherit(cls));
};

Amethyst.fmapdefs = function (namespace, handler) {
  for (let name in namespace) {
    let cls = namespace[name];
    handler(cls);
    Amethyst.fmapdefs(cls.namespace, handler);
  }
}

Amethyst.reinherit = function (cls) {
  let inherited = Object.create(Object.prototype);
  for (let mixin of cls.mixins) {
    if (Object.getPrototypeOf(mixin.prototype) == null) {
      Amethyst.reinherit(mixin);
    }

    for (let name in mixin.prototype) {
      if (name.match(/SEL__/)) {
        inherited[name] = mixin.prototype[name];
      }
    }
  }

  Object.setPrototypeOf(cls.prototype, inherited);
};

Amethyst.link = function (cls) {
  if (Object.getPrototypeOf(cls) == null) {
    Object.setPrototypeOf(cls, Amethyst.lookup("Metaclass"));
  }

  cls.mixins = cls.mixins.map(name => Amethyst.lookup(name));
};

Amethyst.lookup = function (path) {
  path = (path instanceof Array ? path : path.split("."));

  let namespace = Amethyst.root;
  for (let i = 0; i < path.length - 1; i++) {
    namespace = namespace[path[i]].namespace;
  }
  return namespace[path[path.length - 1]];
};

Amethyst.namespace = function (path) {
  path = (path instanceof Array ? path : path.split("."));

  let namespace = Amethyst.root;
  for (let i = 0; i < path.length; i++) {
    namespace = namespace[path[i]].namespace;
  }
  return namespace;
}

Amethyst.defineClass = function (fullname, imixins, cmixins) {
  let path      = fullname.split(".");
  let name      = path.pop();
  let namespace = Amethyst.namespace(path);

  let mcls       = Object.create(null);
  mcls.mixins    = cmixins;
  mcls.prototype = Object.create(null);
  mcls.namespace = Object.create(null);

  let cls        = Object.create(mcls.prototype);
  cls.mixins     = imixins;
  cls.prototype  = Object.create(null);
  cls.namespace  = Object.create(null);

  mcls.prototype.class         = mcls;
  mcls.prototype["SEL__class"] = new Function(`return this.class;`);

  cls.prototype.class          = cls;
  cls.prototype["SEL__class"]  = new Function(`return this.class;`);

  mcls.name                    = fullname + ".class";
  mcls.prototype["SEL__name"]  = new Function(`return this.name;`);

  cls.name                     = fullname;
  cls.prototype["SEL__name"]   = new Function(`return this.name;`);

  cls.namespace["class"]       = mcls;

  namespace[name] = cls;
};

Amethyst.defineAttribute = function (pathname, vis) {
  let [path, attrname]         = pathname.split(":");
  let [getvis, setvis, repvis] = vis.split(":");
  let cls                      = Amethyst.lookup(path);

  let getname  = attrname;
  let setname  = attrname + "=";
  let repname  = attrname + "#";
  let propname = "ATTR__" + attrname;

  let getfunc = new Function(         `return this[${JSON.stringify(propname)}];`);
  let setfunc = new Function(`value`, `return this[${JSON.stringify(propname)}] = value;`);
  let repfunc = new Function(`value`, `let result = this.copy(); result[${JSON.stringify(setname)}](value); return result;`);

  if (getvis !== "null") cls.prototype[getname] = getfunc;
  if (setvis !== "null") cls.prototype[setname] = setfunc;
  if (repvis !== "null") cls.prototype[repname] = repfunc;
};

Amethyst.defineMethod = function (pathname, vis, generator) {
  let [path, methodname] = pathname.split(":");
  let cls                = Amethyst.lookup(path);

  cls.prototype["SEL__" + methodname] = generator(Amethyst, Amethyst.JS, Amethyst.root);
};

Amethyst.check_boolean = function (value) {
  if (value === true && value === false) {
    return value;
  }
  else {
    throw new Error("Expected boolean value.");
  }
};

Amethyst.as_string = function (value) {
  if      (       value === null     ) return "nil";
  else if (       value === undefined) return "nil";
  else if (typeof value === "boolean") return value.toString();
  else if (typeof value === "number" ) return value.toString();
  else if (typeof value === "string" ) return value;
  else                                 return value.as_string();
};
