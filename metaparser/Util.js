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

module.exports.transmute =
function transmute(target, source) {
  for (let name in target) {
    delete target[name];
  }
  for (let name in source) {
    target[name] = source[name];
  }
}

module.exports.equal =
function equal(a, b) {
  if (a === b) {
    return true;
  }
  else if (a == null && b == null) {
    return true;
  }
  else if (a instanceof Array && b instanceof Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!equal(a[i], b[i])) return false;
    }
    return true;
  }
  else if (typeof a === "object" && typeof b === "object") {
    for (let name in a) {
      if (!(name in b)) return false;
    }
    for (let name in b) {
      if (!(name in a)) return false;
    }
    for (let name in a) {
      if (!equal(a[name], b[name])) return false;
    }
    return true;
  }
  else {
    return false;
  }
}

module.exports.union =
function union(a, b) {
  let v = [];
  for (let e of a) {
    if (!v.includes(e)) v.push(e);
  }
  for (let e of b) {
    if (!v.includes(e)) v.push(e);
  }
  return v;
}
