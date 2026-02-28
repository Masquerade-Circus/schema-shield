import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

describe("uniqueItems regressions", () => {
  const validate = new SchemaShield().compile({
    type: "array",
    uniqueItems: true
  });

  it("keeps nested string arrays with delimiters distinct", () => {
    const result = validate([["a;s:1"], ["a", "s:1"]]);
    expect(result.valid).toBe(true);
  });

  it("detects duplicate nested string arrays with delimiters", () => {
    const result = validate([["a;s:1"], ["a;s:1"]]);
    expect(result.valid).toBe(false);
  });

  it("keeps nested -0 and 0 arrays distinct", () => {
    const result = validate([[0], [-0]]);
    expect(result.valid).toBe(true);
  });

  it("treats nested NaN arrays as duplicates", () => {
    const result = validate([[NaN], [NaN]]);
    expect(result.valid).toBe(false);
  });

  it("treats top-level -0 and 0 as duplicates", () => {
    const result = validate([-0, 0]);
    expect(result.valid).toBe(false);
  });

  it("treats top-level NaN values as duplicates", () => {
    const result = validate([NaN, NaN]);
    expect(result.valid).toBe(false);
  });
});
