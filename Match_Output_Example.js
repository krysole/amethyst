









function b {
  MATCH_0: while (true) {
    let SUBJECT = my_subject;

    MATCH_0_CASE_0: while (true) {
      let a, b;

      if (!(Array.class_tag in SUBJECT)) break MATCH_0_CASE_0;
      if (SUBJECT.count !== 3) break MATCH_0_CASE_0;

      if (SUBJECT.SEL__apply(0) !== "Operation 1") break MATCH_0_CASE_0;
      a = SUBJECT.SEL__apply(1);
      b = SUBJECT.SEL__apply(2);

      do_stuff;

      break MATCH_0;
    }

    MATCH_0_CASE_1: while (true) {
      let a, b, c, d;

      if (!(Array.class_tag in SUBJECT)) break MATCH_0_CASE_1;
      if (SUBJECT.count !== 5) break MATCH_0_CASE_1;

      if (SUBJECT.SEL__apply(0) !== "Operation 2") break MATCH_0_CASE_1;
      a = SUBJECT.SEL__apply(1);
      b = SUBJECT.SEL__apply(2);
      c = SUBJECT.SEL__apply(3);
      d = SUBJECT.SEL__apply(4);

      do_stuff;

      break MATCH_0;
    }

    MATCH_0_CASE_2: while (true) {
      if (!(Array.class_tag in SUBJECT)) break MATCH_0_CASE_2;
      if (SUBJECT.count !== 1) break MATCH_0_CASE_2;

      if (SUBJECT.SEL__apply(0) !== "Operation 3") break MATCH_0_CASE_2;

      do_stuff;

      break MATCH_0;
    }

    MATCH_0_ELSE: while (true) {
      throw Error("my_own_error");

      break MATCH_0;
    }

    throw Error("match_failure");
  }
}

function c(value) {
  MATCH_0: while (true) {
    let SUBJECT = value;

    MATCH_0_CASE_0: while (true) {
      if (SUBJECT !== 0) break MATCH_0_CASE_0;

      do_stuff;

      break MATCH_0;
    }

    MATCH_0_CASE_0: while (true) {
      if (SUBJECT !== 1) break MATCH_0_CASE_0;

      do_stuff;

      break MATCH_0;
    }

    MATCH_0_CASE_0: while (true) {
      if (SUBJECT !== 2) break MATCH_0_CASE_0;

      do_stuff;

      break MATCH_0;
    }

    throw Error("match_failure");
  }
}
