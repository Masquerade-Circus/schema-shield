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

  it("collapses allOf containing false to an always-invalid compiled schema", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      allOf: [{}, false, { type: "number" }]
    });

    expect(validate.compiledSchema.allOf).toBeUndefined();
    expect(validate.compiledSchema.$validate?.name).toBe("oneOf");
    expect(validate(123).valid).toBe(false);
    expect(validate("hello").valid).toBe(false);
  });

  it("removes false branches from single-key anyOf and collapses the remaining branch", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      anyOf: [false, { type: "number" }]
    });

    expect(validate.compiledSchema.anyOf).toBeUndefined();
    expect(validate.compiledSchema.$validate?.name).toBe("number");
    expect(validate(123).valid).toBe(true);
    expect(validate("hello").valid).toBe(false);
  });

  it("prunes single-branch oneOf with a trivially valid branch", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      oneOf: [true]
    });

    expect(validate.compiledSchema.oneOf).toBeUndefined();
    expect(validate.compiledSchema.$validate?.name).toBe("Validate_Any");
    expect(validate(123).valid).toBe(true);
    expect(validate("hello").valid).toBe(true);
  });

  it("collapses single-branch oneOf with false to an always-invalid compiled schema", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      oneOf: [false]
    });

    expect(validate.compiledSchema.oneOf).toEqual([]);
    expect(validate.compiledSchema.$validate?.name).toBe("oneOf");
    expect(validate(123).valid).toBe(false);
    expect(validate("hello").valid).toBe(false);
  });

  it("precomputes only properties that need runtime validation", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      type: "object",
      properties: {
        noopObject: {},
        noopBoolean: true,
        forbidden: false,
        constrained: { type: "number" },
        withDefault: { default: 1 }
      },
      required: ["withDefault"]
    });

    expect(validate.compiledSchema.properties).toHaveProperty("noopObject");
    expect(validate.compiledSchema.properties).toHaveProperty("noopBoolean");
    expect((validate.compiledSchema as any)._propertyValidationEntries).toEqual([
      {
        key: "forbidden",
        schemaProp: validate.compiledSchema.properties.forbidden,
        hasDefault: false
      },
      {
        key: "constrained",
        schemaProp: validate.compiledSchema.properties.constrained,
        hasDefault: false
      },
      {
        key: "withDefault",
        schemaProp: validate.compiledSchema.properties.withDefault,
        hasDefault: true
      }
    ]);

    const data: any = { noopObject: "anything", noopBoolean: "anything" };
    expect(validate(data).valid).toBe(true);
    expect(data.withDefault).toBe(1);
    expect(validate({ forbidden: true }).valid).toBe(false);
    expect(validate({ constrained: "not-number", withDefault: 1 }).valid).toBe(false);
  });

  it("rebuilds property metadata supplied by the input schema", () => {
    const schema = {
      type: "object",
      properties: { value: { type: "number" } }
    };
    const expected = new SchemaShield().compile(schema);
    const validate = new SchemaShield().compile({
      ...schema,
      _propertyValidationEntries: []
    });

    expect(expected({ value: "invalid" }).valid).toBe(false);
    expect(validate({ value: "invalid" }).valid).toBe(false);
  });

  it("rebuilds additionalProperties metadata supplied by the input schema", () => {
    const schema = {
      type: "object",
      additionalProperties: { type: "number" }
    };
    const expected = new SchemaShield().compile(schema);
    const validate = new SchemaShield().compile({
      ...schema,
      _apValidate: null
    });

    expect(expected({ value: "invalid" }).valid).toBe(false);
    expect(validate({ value: "invalid" }).valid).toBe(false);
  });

  it("rebuilds patternProperties metadata supplied by the input schema", () => {
    const schema = {
      patternProperties: {
        "^restricted$": { type: "number" }
      }
    };
    const expected = new SchemaShield().compile(schema);
    const validate = new SchemaShield().compile({
      ...schema,
      _patternPropertyEntries: [],
      _patternKeyMatchIndexCache: new Map([["restricted", []]])
    });

    expect(expected({ restricted: "invalid" }).valid).toBe(false);
    expect(validate({ restricted: "invalid" }).valid).toBe(false);
  });

  it("precomputes combinator branch entries at compile time", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      allOf: [{ type: "number" }],
      anyOf: [{ minimum: 1 }, { maximum: 5 }],
      oneOf: [{ maximum: 2 }, { const: 4 }]
    });

    expect((validate.compiledSchema as any)._allOfBranchEntries).toEqual([
      {
        kind: "validate",
        validate: validate.compiledSchema.allOf[0].$validate
      }
    ]);
    expect((validate.compiledSchema as any)._anyOfBranchEntries).toEqual([
      {
        kind: "validate",
        validate: validate.compiledSchema.anyOf[0].$validate
      },
      {
        kind: "validate",
        validate: validate.compiledSchema.anyOf[1].$validate
      }
    ]);
    expect((validate.compiledSchema as any)._oneOfBranchEntries).toEqual([
      {
        kind: "validate",
        validate: validate.compiledSchema.oneOf[0].$validate
      },
      {
        kind: "validate",
        validate: validate.compiledSchema.oneOf[1].$validate
      }
    ]);
    expect(Object.keys(validate.compiledSchema)).not.toContain("_oneOfBranchEntries");

    expect(validate(1).valid).toBe(true);
    expect(validate(4).valid).toBe(true);
    expect(validate(3).valid).toBe(false);
  });

  it("captures a linked additionalProperties validator after references are linked", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      definitions: {
        stringValue: { type: "string" }
      },
      additionalProperties: { $ref: "#/definitions/stringValue" }
    });
    const compiled = validate.compiledSchema as any;

    expect(compiled._apValidate).toBe(
      compiled.additionalProperties.$validate
    );
    expect(validate({ value: "valid" }).valid).toBe(true);
    expect(validate({ value: 1 }).valid).toBe(false);
  });

  it("rebuilds combinator metadata supplied by the input schema", () => {
    const schema = {
      type: "number",
      allOf: [{ minimum: 5 }]
    };
    const expected = new SchemaShield().compile(schema);
    const validate = new SchemaShield().compile({
      ...schema,
      _allOfBranchEntries: [{ kind: "alwaysValid" }]
    });

    expect(expected(1).valid).toBe(false);
    expect(validate(1).valid).toBe(false);
  });

  it("never prunes trivial values handled by custom overrides", () => {
    const cases = [
      { keyword: "required", schema: { required: [] } },
      { keyword: "uniqueItems", schema: { uniqueItems: false } },
      { keyword: "properties", schema: { properties: {} } },
      { keyword: "patternProperties", schema: { patternProperties: {} } },
      { keyword: "dependencies", schema: { dependencies: {} } },
      { keyword: "items", schema: { items: true } },
      { keyword: "propertyNames", schema: { propertyNames: true } },
      {
        keyword: "additionalProperties",
        schema: { additionalProperties: true }
      },
      {
        keyword: "additionalProperties",
        schema: {
          additionalProperties: false,
          patternProperties: { "^x": true }
        }
      },
      { keyword: "additionalItems", schema: { additionalItems: true } },
      { keyword: "additionalItems", schema: { additionalItems: false } },
      { keyword: "allOf", schema: { allOf: [] } },
      { keyword: "allOf", schema: { allOf: [true, {}] } },
      { keyword: "anyOf", schema: { anyOf: [{}] } },
      { keyword: "anyOf", schema: { anyOf: [true] } },
      { keyword: "oneOf", schema: { oneOf: [{}] } },
      { keyword: "oneOf", schema: { oneOf: [true] } }
    ];

    for (const testCase of cases) {
      const shield = new SchemaShield();
      let calls = 0;
      shield.addKeyword(
        testCase.keyword,
        () => {
          calls++;
        },
        true
      );

      const validate = shield.compile(testCase.schema);
      const entry = (validate.compiledSchema as any)
        ._iterativeValidatorEntries.find(
          (item: { keyword: string }) => item.keyword === testCase.keyword
        );

      expect(entry.structuralOpcode).toBe(0);
      expect("iterativeKeyword" in entry).toBe(false);
      expect(validate({}).valid).toBe(true);
      expect(calls).toBe(1);
    }
  });

  it("assigns structural opcodes only to builtin keyword implementations", () => {
    const validate = new SchemaShield().compile({
      type: "object",
      properties: { value: { type: "string" } }
    });
    const entry = (validate.compiledSchema as any)._iterativeValidatorEntries.find(
      (item: { keyword: string }) => item.keyword === "properties"
    );

    expect(entry.structuralOpcode).toBe(1);
    expect("iterativeKeyword" in entry).toBe(false);
  });

  it("precomputes combinator branches after references are linked", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      allOf: [{ $ref: "#/definitions/value" }],
      definitions: {
        value: { type: "number" }
      }
    });
    const branch = validate.compiledSchema.allOf[0];
    const entries = (validate.compiledSchema as any)._allOfBranchEntries;

    expect(entries[0].validate).toBe(branch.$validate);
    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
  });

  it("removes no-op combinators without invalidating sibling keywords", () => {
    const validate = new SchemaShield({ failFast: true }).compile({
      type: "string",
      allOf: [true, {}],
      anyOf: [{}],
      oneOf: [true]
    });

    expect(validate.compiledSchema.allOf).toBeUndefined();
    expect(validate.compiledSchema.anyOf).toBeUndefined();
    expect(validate.compiledSchema.oneOf).toBeUndefined();
    expect(validate.compiledSchema.$validate?.name).toBe("string");
    expect(validate("hello").valid).toBe(true);
    expect(validate(123).valid).toBe(false);
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
