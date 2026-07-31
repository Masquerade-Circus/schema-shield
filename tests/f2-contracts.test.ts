import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";
import { hasOwn } from "./test-utils";

describe("F2 production corrections", () => {
  it("preserves explicit error codes through nested causes", () => {
    const shield = new SchemaShield({ failFast: false });
    shield.addKeyword("codedFailure", (_schema, data, defineError) =>
      defineError("coded rejection", { code: "CODED_REJECTION", data })
    );
    const result = shield.compile({
      properties: { value: { codedFailure: true } }
    })({ value: "bad" });

    expect(result.valid).toBe(false);
    const cause = (result.error as ValidationError).getCause();
    expect(cause.code).toBe("CODED_REJECTION");
    expect(cause.message).toBe("coded rejection");
  });

  it("escapes JSON Pointer tokens in schema and instance paths", () => {
    const key = "tilde~/slash";
    const result = new SchemaShield({ failFast: false }).compile({
      type: "object",
      properties: { [key]: { type: "string" } },
      required: [key]
    })({ [key]: 1 });

    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).getPath()).toEqual({
      schemaPath: "#/properties/tilde~0~1slash/type",
      instancePath: "#/tilde~0~1slash"
    });
  });

  it("applies required defaults and defines __proto__ as own data", () => {
    const schema = JSON.parse(`{
      "type": "object",
      "minProperties": 2,
      "properties": {
        "safe": { "type": "string", "default": "value" },
        "__proto__": { "type": "object", "default": { "polluted": true } }
      },
      "required": ["safe", "__proto__"]
    }`);
    const input: Record<string, any> = {};
    const result = new SchemaShield({
      failFast: false,
      useDefaults: true
    }).compile(schema)(input);

    expect(result.valid).toBe(true);
    expect(Reflect.getPrototypeOf(input)).toBe(Object.prototype);
    expect(hasOwn(input, "__proto__")).toBe(true);
    expect(input.safe).toBe("value");
    expect(input.__proto__).toEqual({ polluted: true });
    expect(({} as any).polluted).toBeUndefined();
  });

  it("inserts defaults before normal runtime validation rejects an invalid one", () => {
    const input: Record<string, any> = {};
    const result = new SchemaShield({
      failFast: false,
      useDefaults: true
    }).compile({
      properties: {
        first: { type: "string", default: "valid" },
        second: { type: "string", default: 2 }
      },
      required: ["first", "second"]
    })(input);

    expect(result.valid).toBe(false);
    expect(input).toEqual({ first: "valid", second: 2 });
  });

  it("supports boolean and transitive local references", () => {
    const allowedRef = new SchemaShield({ failFast: false }).compile({
      definitions: { allowed: true },
      $ref: "#/definitions/allowed"
    });
    expect(allowedRef("value").valid).toBe(true);

    const booleanRef = new SchemaShield({ failFast: false }).compile({
      definitions: { denied: false },
      $ref: "#/definitions/denied"
    });
    expect(booleanRef("value").valid).toBe(false);

    const transitive = new SchemaShield({ failFast: false }).compile({
      definitions: {
        text: { type: "string" },
        alias: { $ref: "#/definitions/text" }
      },
      $ref: "#/definitions/alias"
    });
    expect(transitive("value").valid).toBe(true);
    expect(transitive(1).valid).toBe(false);
  });

  it("rejects missing local references with a controlled compile error", () => {
    expect(() =>
      new SchemaShield().compile({ $ref: "#/definitions/missing" })
    ).toThrow(/reference.*not found/i);
  });

  it("preserves type, format, keyword, and $ref overrides", () => {
    const shield = new SchemaShield({ failFast: false });
    shield.addType("string", (data) => data === "type-override", true);
    shield.addFormat("email", (data) => data === "format-override", true);
    shield.addKeyword("minLength", (_schema, data, defineError) =>
      data === "keyword-override"
        ? undefined
        : defineError("keyword override rejected", { data }), true);
    shield.addKeyword("$ref", (schema, data, defineError) =>
      data === schema.$ref
        ? undefined
        : defineError("ref override rejected", { data }), true);

    expect(shield.compile({ type: "string" })("type-override").valid).toBe(true);
    expect(shield.compile({ type: "string" })("other").valid).toBe(false);
    expect(
      shield.compile({ format: "email" })("format-override").valid
    ).toBe(true);
    expect(shield.compile({ minLength: 100 })("keyword-override").valid).toBe(
      true
    );
    const ref = shield.compile({ $ref: "expected" });
    expect(ref("expected").valid).toBe(true);
    expect(ref("wrong").valid).toBe(false);
  });
});
