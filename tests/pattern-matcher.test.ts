import { describe, it } from "mocha";

import expect from "expect";
import { compilePatternMatcher } from "../lib/utils/pattern-matcher";

function matches(pattern: string, value: string) {
  const compiled = compilePatternMatcher(pattern);
  return compiled instanceof RegExp ? compiled.test(value) : compiled(value);
}

describe("pattern matcher fast paths", () => {
  it("matches literal patterns with substring semantics", () => {
    expect(matches("abc", "zabcx")).toBe(true);
    expect(matches("abc", "abx")).toBe(false);
  });

  it("preserves anchored exact-match behavior", () => {
    expect(matches("^abc$", "abc")).toBe(true);
    expect(matches("^abc$", "abc\n")).toBe(false);
  });

  it("matches anchored prefix and suffix patterns", () => {
    expect(matches("^pre", "prefix")).toBe(true);
    expect(matches("^pre", "xpre")).toBe(false);

    expect(matches("post$", "outpost")).toBe(true);
    expect(matches("post$", "postx")).toBe(false);
  });

  it("falls back to regex semantics when pattern has metacharacters", () => {
    expect(matches("a.c", "abc")).toBe(true);
    expect(matches("a.c", "ac")).toBe(false);

    expect(matches("^\\t$", "\t")).toBe(true);
    expect(matches("^\\t$", "\\t")).toBe(false);
  });

});
