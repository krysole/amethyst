# TASKLIST #

- Get code compiling and running a simple main method.
- Start looking at testing different parts of the Array object.

- Implement `Array_Enumerator` and `Array:enumerate`.
- Ensure that all `Enumerator` classes support JavaScript enumerability.
- Ensure that `expr.my_method(*argv)` generates `...argv` correctly.

=======================================

- Implement foundation classes.
  * Object, Class, Metaclass
  * Boolean, Number, Integer, String, Symbol, Procedure
  * Vector (JSON Array), Basic (JSON Dictionary)
  * Array, Dictionary, Set, Buffer (?)
  * Enumerator, Enumerablen

- Implement metamethods for the compile time type Basic (JS Objects).
  * `[]`/`[]=` for convenience in addition to `prop`/`prop=`.
  * `define?` for hasOwnProperty support.
  * `include?` for `"property" in object` support.
  * `remove!` for Basic objects, but not Amethyst objects.

- Implement metamethods for argv that allow it to be used directly.
  * `count` as an alternative to using `argc` if people prefer that.
  * `[]` to make fetching arguments more intuitive than `prop`.

- Implement something like `Array.from()` or `Vector.from()`.
- Implement something like `Dictionary.from()` or `Set.from()`.

- Figure out if we can increase Array performance using i32 math (like shift/mask).
- Figure out a way to limit metamethods to specific compile time types.
- Figure out a better syntax for attributes if possible.
- Figure out if nil should have a class or not.
- Figure out what I'm doing with `AM__as_string` in prelude.
- Figure out if the attribute notation could be better.
  * Maybe a 'rwc' flag system. I.e., `attr "r"`, `attr "rw"`, `attr "c"`.

- Add reflection and metaprogramming.
- Add ordering for all supportable types.
- Add parameter/assignment patterns.
- Add full pattern matching.

- Consider adding an errata or tolerances document. Some examples follow.
  * Things that use version ordinals have a 53 bit limit. (Array.am)

=======================================

Fix metaparser production compilation of following rule.

```
literalPattern {
  ("+"|"-"|"~"|!null):o literalExpression:e
  ?(e.tag !== "E_Super")
  ?(o == null ? e : { tag: "E_Prefix", o: o.text, a: e }):e
  !{ tag: "P_Literal", expression: e }
}
```

Specifically the second condition is failing for some reason.
