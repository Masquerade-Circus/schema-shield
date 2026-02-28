import { describe, it } from "mocha";

import expect from "expect";
import { SchemaShield } from "../lib";

describe("compile-time pruning", () => {
  it("prunes no-op required keyword", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      required: []
    });

    expect(validate.compiledSchema.$validate?.name).toBe("Validate_Any");
    expect(validate({ anything: true }).valid).toBe(true);
  });

  it("prunes no-op items=true keyword while keeping type validation", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      type: "array",
      items: true
    });

    expect(validate.compiledSchema.$validate?.name).toBe("array");
    expect(validate([]).valid).toBe(true);
    expect(validate({}).valid).toBe(false);
  });

  it("prunes allOf composed of trivially valid branches", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      allOf: [true, {}]
    });

    expect(validate.compiledSchema.$validate?.name).toBe("Validate_Any");
    expect(validate("hello").valid).toBe(true);
  });

  it("prunes anyOf when one branch is trivially valid", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      anyOf: [{}, { type: "number" }]
    });

    expect(validate.compiledSchema.$validate?.name).toBe("Validate_Any");
    expect(validate("hello").valid).toBe(true);
    expect(validate(123).valid).toBe(true);
  });

  it("prunes uniqueItems=false keyword while keeping type validation", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      type: "array",
      uniqueItems: false
    });

    expect(validate.compiledSchema.$validate?.name).toBe("array");
    expect(validate([1, 1]).valid).toBe(true);
    expect(validate({}).valid).toBe(false);
  });

  it("collapses nested allOf wrappers", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      allOf: [
        {
          allOf: [{ type: "number" }]
        }
      ]
    });

    expect(validate.compiledSchema.$validate?.name).toBe("number");
    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
  });

  it("collapses single-wrapper nested anyOf and oneOf", () => {
    const anyOfValidate = new SchemaShield({ failFast: true }).compile({
      anyOf: [
        {
          anyOf: [{ type: "null" }]
        }
      ]
    });

    const oneOfValidate = new SchemaShield({ failFast: true }).compile({
      oneOf: [
        {
          oneOf: [{ type: "null" }]
        }
      ]
    });

    expect(anyOfValidate.compiledSchema.$validate?.name).toBe("null");
    expect(oneOfValidate.compiledSchema.$validate?.name).toBe("null");

    expect(anyOfValidate(null).valid).toBe(true);
    expect(anyOfValidate(1).valid).toBe(false);

    expect(oneOfValidate(null).valid).toBe(true);
    expect(oneOfValidate(1).valid).toBe(false);
  });
});
