import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";
import { hasOwn } from "./test-utils";

function defaultingBranch(extra: Record<string, any> = {}) {
  return {
    properties: {
      branchDefault: { default: "inserted", type: "string" }
    },
    required: ["branchDefault"],
    ...extra
  };
}

function nestedSchema(depth: number) {
  let schema: Record<string, any> = { type: "string" };
  for (let index = 0; index < depth; index++) {
    schema = {
      type: "object",
      properties: { nested: schema }
    };
  }
  return schema;
}

function nestedData(depth: number) {
  let data: any = "value";
  for (let index = 0; index < depth; index++) {
    data = { nested: data };
  }
  return data;
}

describe("transactional defaults", () => {
  it("rolls back defaults from a failed anyOf branch", () => {
    const data: Record<string, any> = {};
    const validate = new SchemaShield({
      failFast: false,
      useDefaults: true
    }).compile({
      anyOf: [defaultingBranch({ allOf: [false] }), { type: "object" }]
    });

    expect(validate(data).valid).toBe(true);
    expect(hasOwn(data, "branchDefault")).toBe(false);
  });

  it("rolls back all defaults when oneOf has multiple valid branches", () => {
    const data: Record<string, any> = {};
    const validate = new SchemaShield({
      failFast: false,
      useDefaults: true
    }).compile({
      oneOf: [defaultingBranch(), { type: "object" }]
    });

    expect(validate(data).valid).toBe(false);
    expect(hasOwn(data, "branchDefault")).toBe(false);
  });

  it("rolls back earlier defaults when a later allOf branch fails", () => {
    const data: Record<string, any> = {};
    const validate = new SchemaShield({
      failFast: false,
      useDefaults: true
    }).compile({
      allOf: [defaultingBranch(), false]
    });

    expect(validate(data).valid).toBe(false);
    expect(hasOwn(data, "branchDefault")).toBe(false);
  });

  it("rolls back defaults when a custom keyword throws", () => {
    const shield = new SchemaShield({ failFast: false, useDefaults: true });
    shield.addKeyword("explode", () => {
      throw new Error("controlled custom failure");
    });
    const validate = shield.compile(defaultingBranch({ explode: true }));
    const data: Record<string, any> = {};

    expect(() => validate(data)).toThrow("controlled custom failure");
    expect(hasOwn(data, "branchDefault")).toBe(false);
  });

  it("rolls back defaults created by a failed custom keyword branch", () => {
    const shield = new SchemaShield({ failFast: false });
    shield.addKeyword("mutatingFailure", (_schema, data, defineError, instance) => {
      instance.setDefault(data, "customDefault", "inserted");
      return defineError("Controlled custom rejection", { data });
    });
    const validate = shield.compile({
      anyOf: [{ mutatingFailure: true }, { type: "object" }]
    });
    const data: Record<string, any> = {};

    expect(validate(data).valid).toBe(true);
    expect(hasOwn(data, "customDefault")).toBe(false);
  });

  it("keeps defaults from combinator branches that produce a valid result", () => {
    for (const schema of [
      { anyOf: [defaultingBranch(), false] },
      { oneOf: [defaultingBranch(), false] },
      { allOf: [defaultingBranch(), { type: "object" }] }
    ]) {
      const data: Record<string, any> = {};
      const result = new SchemaShield({ failFast: false, useDefaults: true })
        .compile(schema)(data);

      expect(result.valid).toBe(true);
      expect(data.branchDefault).toBe("inserted");
    }
  });

  it("keeps the ordinary immutable-free fast path free of context machinery", () => {
    const validate = new SchemaShield().compile({ type: "string" });

    expect(hasOwn(validate.compiledSchema, "_requiresDepthGuard")).toBe(false);
    expect(String(validate)).not.toMatch(/context|journal|savepoint|branch/i);
  });

  it("fixes the ordinary combinator strategy at compile time", () => {
    const validate = new SchemaShield().compile({
      allOf: [{ type: "string" }, true]
    });

    expect(hasOwn(validate.compiledSchema, "_requiresDepthGuard")).toBe(false);
    expect(String(validate.compiledSchema.$validate)).not.toMatch(
      /context|journal|savepoint|rollback|transactions|validateSubschema/i
    );
    expect(validate("value").valid).toBe(true);
  });
});

describe("separate compile and runtime depth limits", () => {
  it("compiles depth two with maxDepth one and rejects only deep validation", () => {
    const validate = new SchemaShield({ maxDepth: 1, failFast: false }).compile(
      nestedSchema(2)
    );

    expect((validate.compiledSchema as any)._requiresDepthGuard).toBe(true);
    expect(validate({}).valid).toBe(true);
    const result = validate(nestedData(2));
    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("uses a fixed compile limit independent of maxDepth", () => {
    expect(() =>
      new SchemaShield({ maxDepth: 256 }).compile(nestedSchema(129))
    ).toThrow(
      expect.objectContaining({ code: "MAX_COMPILE_DEPTH_EXCEEDED" })
    );
    expect(() =>
      new SchemaShield({ maxDepth: 256 }).compile(nestedSchema(128))
    ).not.toThrow();
  });

  it("enforces maxDepth at the exact edge in every combinator", () => {
    for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
      const neutralBranch = keyword === "allOf";
      const schema = {
        [keyword]: [
          {
            properties: {
              nested: { type: "string" }
            }
          },
          neutralBranch
        ]
      };
      const data = { nested: "value" };

      const edge = new SchemaShield({ maxDepth: 2, failFast: false })
        .compile(schema)(data);
      expect(edge.valid).toBe(true);

      const excess = new SchemaShield({ maxDepth: 1, failFast: false })
        .compile(schema)(data);
      expect(excess.valid).toBe(false);
      expect(excess.error).toBeInstanceOf(ValidationError);
      expect((excess.error as ValidationError).code).toBe(
        "MAX_DEPTH_EXCEEDED"
      );
      expect(excess.error).not.toBeInstanceOf(RangeError);
    }
  });
});

describe("oneOf cardinality", () => {
  it("accepts exactly one valid branch and rejects zero or multiple", () => {
    const shield = new SchemaShield({ failFast: false });
    expect(shield.compile({ oneOf: [false, false] })("value").valid).toBe(
      false
    );
    expect(shield.compile({ oneOf: [true, false] })("value").valid).toBe(true);
    expect(shield.compile({ oneOf: [true, true] })("value").valid).toBe(false);
  });
});

describe("finite number type", () => {
  it("rejects non-finite numbers in single and union paths", () => {
    for (const failFast of [true, false]) {
      for (const schema of [
        { type: "number" },
        { type: ["string", "number"] }
      ]) {
        const validate = new SchemaShield({ failFast }).compile(schema);
        for (const value of [Infinity, -Infinity, Number.NaN]) {
          const result = validate(value);
          expect(result.valid).toBe(false);
          if (failFast) {
            expect(result.error).toBe(true);
          } else {
            expect(result.error).toBeInstanceOf(ValidationError);
          }
        }
        expect(validate(1.5).valid).toBe(true);
      }
    }
  });
});
