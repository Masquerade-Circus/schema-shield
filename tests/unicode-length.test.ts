import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

function isValidLength(
  keyword: "minLength" | "maxLength",
  limit: number,
  value: string
): boolean {
  return new SchemaShield().compile({ [keyword]: limit })(value).valid;
}

describe("Unicode string length", () => {
  it("counts supplementary code points in the official draft-06 cases", () => {
    expect(isValidLength("minLength", 2, "💩")).toBe(false);
    expect(isValidLength("maxLength", 2, "💩💩")).toBe(true);
  });

  it("counts code points without normalization or grapheme segmentation", () => {
    const cases = [
      { value: "ab", length: 2 },
      { value: "漢字", length: 2 },
      { value: "💩", length: 1 },
      { value: "\ud83d", length: 1 },
      { value: "\udca9", length: 1 },
      { value: "\udca9\ud83d", length: 2 },
      { value: "e\u0301", length: 2 },
      { value: "\u00e9", length: 1 },
      { value: "👩‍💻", length: 3 }
    ];

    for (const testCase of cases) {
      expect(
        isValidLength("minLength", testCase.length, testCase.value)
      ).toBe(true);
      expect(
        isValidLength("maxLength", testCase.length, testCase.value)
      ).toBe(true);
      expect(
        isValidLength("maxLength", testCase.length - 1, testCase.value)
      ).toBe(false);
    }
  });

  it("handles boundary limits and long mixed strings", () => {
    const values = [
      "",
      "a",
      "💩",
      "a💩",
      "abcdefg",
      "a💩b💩c💩d",
      "abcdefghijk",
      `${"a💩".repeat(256)}${"漢".repeat(257)}\ud83d`
    ];
    const limits = [0, 1, 2, 7, 11];

    for (const value of values) {
      const expectedLength = Array.from(value).length;
      for (const limit of limits) {
        expect(isValidLength("minLength", limit, value)).toBe(
          expectedLength >= limit
        );
        expect(isValidLength("maxLength", limit, value)).toBe(
          expectedLength <= limit
        );
      }
    }
  });

  it("matches Array.from length across a deterministic mixed corpus", () => {
    const atoms = ["a", "漢", "💩", "\ud83d", "\udca9", "\u0301", "‍"];
    let state = 0x5eed1234;

    for (let sample = 0; sample < 128; sample++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const atomCount = state % 24;
      let value = "";
      for (let index = 0; index < atomCount; index++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        value += atoms[state % atoms.length];
      }

      const expectedLength = Array.from(value).length;
      for (const limit of [0, 1, 2, 7, 11, expectedLength]) {
        expect(isValidLength("minLength", limit, value)).toBe(
          expectedLength >= limit
        );
        expect(isValidLength("maxLength", limit, value)).toBe(
          expectedLength <= limit
        );
      }
    }
  });
});
