import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

const schemaShield = new SchemaShield({ failFast: true });

function expectValidity(schema: any, data: any, valid: boolean) {
  const validate = schemaShield.compile(schema);
  const result = validate(data);

  expect(result.valid).toBe(valid);
}

describe("boolean combinator semantics", () => {
  it("treats allOf true as always valid", () => {
    expectValidity({ allOf: [true] }, 0, true);
    expectValidity({ allOf: [true] }, "", true);
  });

  it("treats allOf false as always invalid", () => {
    expectValidity({ allOf: [false] }, 0, false);
    expectValidity({ allOf: [false] }, "foo", false);
  });

  it("treats anyOf true as always valid", () => {
    expectValidity({ anyOf: [true] }, 0, true);
    expectValidity({ anyOf: [true] }, "", true);
  });

  it("treats anyOf false as always invalid", () => {
    expectValidity({ anyOf: [false] }, 0, false);
    expectValidity({ anyOf: [false] }, "foo", false);
  });

  it("treats oneOf true as always valid", () => {
    expectValidity({ oneOf: [true] }, 0, true);
    expectValidity({ oneOf: [true] }, "", true);
  });

  it("treats oneOf false as always invalid", () => {
    expectValidity({ oneOf: [false] }, 0, false);
    expectValidity({ oneOf: [false] }, "foo", false);
  });
});
