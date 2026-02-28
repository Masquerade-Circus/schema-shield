import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

describe("type regressions", () => {
  it("does not treat null as object in union object|array", () => {
    const schemaShield = new SchemaShield({ failFast: true });
    const validate = schemaShield.compile({ type: ["array", "object"] });

    expect(validate(null).valid).toBe(false);
  });
});
