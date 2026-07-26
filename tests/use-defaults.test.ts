import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";
import { hasOwn as own } from "./test-utils";

describe("useDefaults constructor option", () => {
  it("rejects unsupported values during construction", () => {
    for (const value of [1, "all", null, {}, []]) {
      expect(() => new SchemaShield({ useDefaults: value as any })).toThrow(
        /useDefaults must be false, true, or "empty"/
      );
    }
  });
});

describe("useDefaults false and omitted", () => {
  it("treats defaults as annotations without filling optional or required properties", () => {
    for (const options of [{}, { useDefaults: false as const }]) {
      const optionalInput: Record<string, any> = {};
      const optional = new SchemaShield(options).compile({
        type: "object",
        properties: { value: { type: "string", default: "filled" } }
      })(optionalInput);

      expect(optional.valid).toBe(true);
      expect(optionalInput).toEqual({});

      const requiredInput: Record<string, any> = {};
      const required = new SchemaShield({ ...options, failFast: false }).compile({
        type: "object",
        properties: { value: { type: "string", default: "filled" } },
        required: ["value"]
      })(requiredInput);

      expect(required.valid).toBe(false);
      expect(requiredInput).toEqual({});
      expect((required.error as ValidationError).getCause().keyword).toBe(
        "required"
      );
    }
  });

  it("ignores an invalid default during compile and validation", () => {
    const validate = new SchemaShield().compile({
      type: "object",
      properties: { count: { type: "integer", default: "invalid" } }
    });
    const input: Record<string, any> = {};

    expect(validate(input)).toEqual({ data: input, error: null, valid: true });
    expect(input).toEqual({});
  });

  it("keeps default annotations off the guarded callable fast path", () => {
    const validate = new SchemaShield().compile({
      type: "object",
      properties: { value: { type: "string", default: "annotation" } }
    });

    expect(own(validate.compiledSchema, "_requiresDepthGuard")).toBe(false);
    expect(own(validate.compiledSchema, "_canApplyDefaults")).toBe(false);
    expect(String(validate)).not.toMatch(/context|journal|savepoint|rollback/i);
    expect(String(validate.compiledSchema.$validate)).not.toMatch(
      /useDefaults|defaultKeys|applyDefaults/i
    );
  });
});

describe("useDefaults true", () => {
  it("inserts optional and required defaults before required validation", () => {
    const input: Record<string, any> = {};
    const result = new SchemaShield({ useDefaults: true }).compile({
      type: "object",
      properties: {
        optional: { type: "string", default: "optional" },
        required: { type: "string", default: "required" }
      },
      required: ["required"]
    })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({ optional: "optional", required: "required" });
  });

  it("replaces own undefined but preserves every other present value", () => {
    const input: Record<string, any> = {
      undefinedValue: undefined,
      nullValue: null,
      emptyString: "",
      zero: 0,
      falseValue: false,
      emptyArray: [],
      emptyObject: {}
    };
    const result = new SchemaShield({ useDefaults: true }).compile({
      type: "object",
      properties: {
        undefinedValue: { default: "filled" },
        nullValue: { default: "filled" },
        emptyString: { default: "filled" },
        zero: { default: 1 },
        falseValue: { default: true },
        emptyArray: { default: ["filled"] },
        emptyObject: { default: { filled: true } }
      }
    })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({
      undefinedValue: "filled",
      nullValue: null,
      emptyString: "",
      zero: 0,
      falseValue: false,
      emptyArray: [],
      emptyObject: {}
    });
  });

  it("inserts an invalid default and rejects it through normal runtime validation", () => {
    const input: Record<string, any> = {};
    const validate = new SchemaShield({ useDefaults: true, failFast: false }).compile({
      type: "object",
      properties: { count: { type: "integer", default: "invalid" } }
    });

    const result = validate(input);

    expect(result.valid).toBe(false);
    expect(input.count).toBe("invalid");
    expect((result.error as ValidationError).getCause().keyword).toBe("type");
  });

  it("clones object and array defaults for each validation", () => {
    const schema = {
      type: "object",
      properties: {
        settings: { default: { nested: { enabled: true } } },
        tags: { default: ["base"] }
      }
    };
    const validate = new SchemaShield({ useDefaults: true }).compile(schema);
    const first = validate({}).data;
    const second = validate({}).data;

    first.settings.nested.enabled = false;
    first.tags.push("changed");

    expect(second).toEqual({
      settings: { nested: { enabled: true } },
      tags: ["base"]
    });
    expect(first.settings).not.toBe(second.settings);
    expect(first.tags).not.toBe(second.tags);
    expect(schema.properties.settings.default).toEqual({
      nested: { enabled: true }
    });
    expect(schema.properties.tags.default).toEqual(["base"]);
  });

  it("applies nested defaults only when the container exists or has a default", () => {
    const withoutContainerDefault = new SchemaShield({
      useDefaults: true
    }).compile({
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: { name: { type: "string", default: "Ada" } }
        }
      }
    });
    const absent: Record<string, any> = {};
    const present = { profile: {} as Record<string, any> };

    expect(withoutContainerDefault(absent).valid).toBe(true);
    expect(absent).toEqual({});
    expect(withoutContainerDefault(present).valid).toBe(true);
    expect(present).toEqual({ profile: { name: "Ada" } });

    const withContainerDefault = new SchemaShield({ useDefaults: true }).compile({
      type: "object",
      properties: {
        profile: {
          type: "object",
          default: {},
          properties: { name: { type: "string", default: "Ada" } }
        }
      }
    });
    const created: Record<string, any> = {};

    expect(withContainerDefault(created).valid).toBe(true);
    expect(created).toEqual({ profile: { name: "Ada" } });
  });
});

describe('useDefaults "empty"', () => {
  it("replaces undefined, null, and empty strings while preserving other empty values", () => {
    const input: Record<string, any> = {
      undefinedValue: undefined,
      nullValue: null,
      emptyString: "",
      zero: 0,
      falseValue: false,
      emptyArray: [],
      emptyObject: {}
    };
    const result = new SchemaShield({ useDefaults: "empty" }).compile({
      type: "object",
      properties: {
        undefinedValue: { default: "undefined" },
        nullValue: { default: "null" },
        emptyString: { default: "empty" },
        zero: { default: 1 },
        falseValue: { default: true },
        emptyArray: { default: ["filled"] },
        emptyObject: { default: { filled: true } }
      }
    })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({
      undefinedValue: "undefined",
      nullValue: "null",
      emptyString: "empty",
      zero: 0,
      falseValue: false,
      emptyArray: [],
      emptyObject: {}
    });
  });
});

describe("useDefaults integration", () => {
  it("mutates only the returned immutable copy", () => {
    const input: Record<string, any> = {};
    const result = new SchemaShield({ immutable: true, useDefaults: true }).compile({
      type: "object",
      properties: { value: { type: "string", default: "filled" } }
    })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({});
    expect(result.data).toEqual({ value: "filled" });
    expect(result.data).not.toBe(input);
  });

  it("defines __proto__ as safe own data", () => {
    const schema = JSON.parse(`{
      "type": "object",
      "properties": {
        "__proto__": { "type": "object", "default": { "polluted": true } }
      }
    }`);
    const input: Record<string, any> = {};
    const result = new SchemaShield({ useDefaults: true }).compile(schema)(input);

    expect(result.valid).toBe(true);
    expect(Reflect.getPrototypeOf(input)).toBe(Object.prototype);
    expect(own(input, "__proto__")).toBe(true);
    expect(input.__proto__).toEqual({ polluted: true });
    expect(({} as any).polluted).toBeUndefined();
  });

  it("preserves current allOf, anyOf, and oneOf rollback behavior", () => {
    const defaultingBranch = (extra: Record<string, any> = {}) => ({
      type: "object",
      properties: { value: { type: "string", default: "inserted" } },
      ...extra
    });

    const cases = [
      { schema: { allOf: [defaultingBranch(), false] }, valid: false },
      {
        schema: {
          anyOf: [defaultingBranch({ allOf: [false] }), { type: "object" }]
        },
        valid: true
      },
      {
        schema: { oneOf: [defaultingBranch(), { type: "object" }] },
        valid: false
      }
    ];

    for (const item of cases) {
      const input: Record<string, any> = {};
      const result = new SchemaShield({
        useDefaults: true,
        failFast: false
      }).compile(item.schema)(input);

      expect(result.valid).toBe(item.valid);
      expect(own(input, "value")).toBe(false);
    }
  });

  it("restores replaced values when a transactional branch rolls back", () => {
    const cases = [
      { useDefaults: true as const, value: undefined },
      { useDefaults: "empty" as const, value: null },
      { useDefaults: "empty" as const, value: "" }
    ];

    for (const item of cases) {
      const input: Record<string, any> = { value: item.value };
      const result = new SchemaShield({
        useDefaults: item.useDefaults,
        failFast: false
      }).compile({
        allOf: [
          {
            type: "object",
            properties: { value: { default: "inserted" } }
          },
          false
        ]
      })(input);

      expect(result.valid).toBe(false);
      expect(own(input, "value")).toBe(true);
      expect(input.value).toBe(item.value);
    }
  });

  it("applies defaults through local references", () => {
    const input = { profile: {} as Record<string, any> };
    const result = new SchemaShield({ useDefaults: true }).compile({
      type: "object",
      definitions: {
        profile: {
          type: "object",
          properties: { name: { type: "string", default: "Ada" } }
        }
      },
      properties: { profile: { $ref: "#/definitions/profile" } }
    })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({ profile: { name: "Ada" } });
  });

  it("leaves boolean schemas unchanged", () => {
    const shield = new SchemaShield({ useDefaults: true });

    expect(shield.compile(true)("value").valid).toBe(true);
    expect(shield.compile(false)("value").valid).toBe(false);
  });

  it("keeps custom keyword setDefault independent from useDefaults", () => {
    const shield = new SchemaShield({ useDefaults: false });
    shield.addKeyword("customDefault", (_schema, data, _defineError, instance) => {
      instance.setDefault(data, "value", "custom");
    });
    const input: Record<string, any> = {};
    const result = shield.compile({ customDefault: true })(input);

    expect(result.valid).toBe(true);
    expect(input).toEqual({ value: "custom" });
  });
});

describe("useDefaults semantic ordering", () => {
  const modes = [true, "empty"] as const;
  const orders = ["observer-first", "properties-first"] as const;
  const properties = { value: { type: "string", default: "filled" } };

  function orderedSchema(
    order: (typeof orders)[number],
    observerKey: string,
    observerValue: any
  ) {
    return order === "observer-first"
      ? { type: "object", [observerKey]: observerValue, properties }
      : { type: "object", properties, [observerKey]: observerValue };
  }

  it("runs defaults before minProperties in either textual order", () => {
    for (const useDefaults of modes) {
      const results = orders.map((order) => {
        const input: Record<string, any> = {};
        const result = new SchemaShield({ useDefaults }).compile(
          orderedSchema(order, "minProperties", 1)
        )(input);
        return { data: input, valid: result.valid };
      });

      expect(results).toEqual([
        { data: { value: "filled" }, valid: true },
        { data: { value: "filled" }, valid: true }
      ]);
    }
  });

  it("runs defaults before maxProperties in either textual order", () => {
    for (const useDefaults of modes) {
      const results = orders.map((order) => {
        const input: Record<string, any> = {};
        const result = new SchemaShield({ useDefaults }).compile(
          orderedSchema(order, "maxProperties", 0)
        )(input);
        return { data: input, valid: result.valid };
      });

      expect(results).toEqual([
        { data: { value: "filled" }, valid: false },
        { data: { value: "filled" }, valid: false }
      ]);
    }
  });

  it("runs defaults before dependencies in either textual order", () => {
    for (const useDefaults of modes) {
      const results = orders.map((order) => {
        const input: Record<string, any> = {};
        const result = new SchemaShield({ useDefaults }).compile(
          orderedSchema(order, "dependencies", { value: ["companion"] })
        )(input);
        return { data: input, valid: result.valid };
      });

      expect(results).toEqual([
        { data: { value: "filled" }, valid: false },
        { data: { value: "filled" }, valid: false }
      ]);
    }
  });

  it("runs defaults before custom keywords in either textual order", () => {
    for (const useDefaults of modes) {
      const results = orders.map((order) => {
        const shield = new SchemaShield({ useDefaults });
        shield.addKeyword("observesDefault", (_schema, data, defineError) => {
          if (!own(data, "value") || data.value !== "filled") {
            return defineError("Default was not visible", { data });
          }
        });
        const input: Record<string, any> = {};
        const result = shield.compile(
          orderedSchema(order, "observesDefault", true)
        )(input);
        return { data: input, valid: result.valid };
      });

      expect(results).toEqual([
        { data: { value: "filled" }, valid: true },
        { data: { value: "filled" }, valid: true }
      ]);
    }
  });

  it("replaces inherited values with a safe own default", () => {
    const prototype = { value: "inherited" };
    const input = Object.create(prototype) as Record<string, any>;
    const result = new SchemaShield({ useDefaults: true }).compile({
      type: "object",
      properties: { value: { type: "string", default: "own" } }
    })(input);

    expect(result.valid).toBe(true);
    expect(own(input, "value")).toBe(true);
    expect(input.value).toBe("own");
    expect(Reflect.getPrototypeOf(input)).toBe(prototype);
    expect(prototype).toEqual({ value: "inherited" });
    expect(({} as any).value).toBeUndefined();
  });
});
