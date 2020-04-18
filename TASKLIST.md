# TASKLIST #

- Finish initial draft of Array.am and get it loading successfully.
- Finish designing and implementing initial version of pattern matching.

- Implement `as_string` or equivalent, and don't forget to update the
  code using it in the prologue.

- Rewrite all operator code generation to use new generic operators.

- Finish writing initial versions of all builtin classes.
  * Boolean, Number, Integer, String, Symbol, Procedure
  * Vector (JSON Array), Basic (JSON Dictionary)
  * Array, Dictionary, Set, Buffer (?)

- Implement ordering for all built in types.

- Figure out if nil should have a class or not.

- Add >>> operator in some form as zero fill shr to match JS.
- Finalize support for BigInt.
- Investigate JS support for '**' as possible alternative to Math.pow().

- Figure out if ordering is actually correct for functions.
- Consider using base string of symbols for ordering.
- Consider a generalized way of generating vector arithmetic.
- Consider a way of removing vector arithmetic from generic operator.
