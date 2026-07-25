import { describe, it } from "mocha";

import { SchemaShield, ValidationError } from "../lib";
import expect from "expect";

describe("wave 1 regressions", () => {
  it("keeps detailed ValidationError results isolated across validations", () => {
    const validate = new SchemaShield({ failFast: false }).compile({
      type: "object",
      properties: {
        first: { type: "string" },
        second: { type: "string" }
      }
    });

    const firstResult = validate({ first: 1, second: "valid" });
    expect(firstResult.error).toBeInstanceOf(ValidationError);
    expect((firstResult.error as ValidationError).getPath().instancePath).toBe(
      "#/first"
    );

    const secondResult = validate({ first: "valid", second: 2 });
    expect(secondResult.error).toBeInstanceOf(ValidationError);
    expect(secondResult.error).not.toBe(firstResult.error);
    expect((secondResult.error as ValidationError).getPath().instancePath).toBe(
      "#/second"
    );
    expect((firstResult.error as ValidationError).getPath().instancePath).toBe(
      "#/first"
    );
  });

  it("escapes JSON Pointer tokens in detailed error paths", () => {
    const validate = new SchemaShield({ failFast: false }).compile({
      type: "object",
      properties: {
        "a/b~c": { type: "string" }
      }
    });

    const result = validate({ "a/b~c": 1 });
    expect(result.error).toBeInstanceOf(ValidationError);
    expect((result.error as ValidationError).getPath()).toEqual({
      schemaPath: "#/properties/a~1b~0c/type",
      instancePath: "#/a~1b~0c"
    });
  });

  it("rejects multipleOf when finite operands produce an infinite quotient", () => {
    const validate = new SchemaShield().compile({ multipleOf: 0.123456789 });

    expect(validate(1e308).valid).toBe(false);
  });

  it("defines a required __proto__ default as an own data property", () => {
    const schema = JSON.parse(`{
      "type": "object",
      "properties": {
        "__proto__": { "default": { "polluted": true } }
      },
      "required": ["__proto__"]
    }`);
    const data = {};
    const validate = new SchemaShield().compile(schema);

    const result = validate(data);

    expect(result.valid).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(data, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
    expect((data as any).__proto__).toEqual({ polluted: true });
    expect(({} as any).polluted).toBeUndefined();
  });

  it("keeps a missing reference invalid after another schema is compiled", () => {
    const shield = new SchemaShield();
    const validateMissing = shield.compile({ $ref: "urn:later" });

    expect(validateMissing(1).valid).toBe(false);

    shield.compile({ $id: "urn:later", type: "number" });

    expect(validateMissing(1).valid).toBe(false);
  });

  it("reports the terminal missing reference through a ref chain", () => {
    const validate = new SchemaShield({ failFast: false }).compile({
      definitions: {
        alias: { $ref: "#/definitions/terminal" }
      },
      $ref: "#/definitions/alias"
    });

    const result = validate("value");

    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).message).toBe(
      "Missing reference: #/definitions/terminal"
    );
  });

  it("ignores $id values nested inside unknown keywords", () => {
    const id = "https://localhost:1234/unknownKeyword/my_identifier.json";
    const validate = new SchemaShield().compile({
      definitions: {
        hidden: {
          not: {
            unknown: [{ $id: id, type: "integer" }]
          }
        },
        visible: { $id: id, type: "string" }
      },
      anyOf: [{ $ref: "#/definitions/hidden" }, { $ref: id }]
    });

    expect(validate("value").valid).toBe(true);
    expect(validate(1).valid).toBe(false);
  });
});
