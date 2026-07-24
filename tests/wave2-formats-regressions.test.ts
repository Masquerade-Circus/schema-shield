import { describe, it } from "mocha";

import expect from "expect";
import { SchemaShield } from "../lib";

describe("wave 2 format regressions", () => {
  it("rejects a URI with an unclosed IPv6 host", () => {
    const validate = new SchemaShield().compile({
      type: "string",
      format: "uri"
    });

    expect(validate("http://[").valid).toBe(false);
  });

  it("accepts an email with a continuous 32-character local part", () => {
    const validate = new SchemaShield().compile({
      type: "string",
      format: "email"
    });

    expect(validate(`${"a".repeat(32)}@example.com`).valid).toBe(true);
  });
});
