import { describe, it } from "mocha";

import expect from "expect";
import { Formats } from "../lib/formats";
import { SchemaShield } from "../lib";

describe("format cache regressions", () => {
  it("caches results for built-in formats", () => {
    const originalEmail = Formats.email;
    if (!originalEmail) {
      throw new Error("Expected built-in email format validator");
    }

    let callCount = 0;

    Formats.email = (data) => {
      callCount++;
      return originalEmail(data);
    };

    try {
      const validate = new SchemaShield().compile({
        type: "string",
        format: "email"
      });

      expect(validate("cache@test.com").valid).toBe(true);
      expect(validate("cache@test.com").valid).toBe(true);
      expect(callCount).toBe(1);
    } finally {
      Formats.email = originalEmail;
    }
  });

  it("does not cache results for custom formats", () => {
    let callCount = 0;

    const validator = new SchemaShield();
    validator.addFormat("flip", () => {
      callCount++;
      return callCount % 2 === 1;
    });

    const validate = validator.compile({
      type: "string",
      format: "flip"
    });

    expect(validate("same-input").valid).toBe(true);
    expect(validate("same-input").valid).toBe(false);
    expect(callCount).toBe(2);
  });
});
