import { describe, it } from "mocha";

import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";

function nestedObjectSchema(depth: number, leaf: any) {
  let schema = leaf;
  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: { next: schema },
      required: ["next"]
    };
  }
  return schema;
}

function nestedObjectData(depth: number, leaf: any) {
  let data = leaf;
  for (let i = 0; i < depth; i++) {
    data = { next: data };
  }
  return data;
}

function nestedDefaultedSchema(depth: number) {
  let schema: any = { type: "string" };
  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: {
        marker: { type: "string", default: `level-${i}` },
        next: schema
      },
      required: ["marker", "next"]
    };
  }
  return schema;
}

function nestedValuesCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";
  for (let i = 0; i < depth; i++) {
    schema = { type: "object", values: schema };
    data = { value: data };
  }
  return { schema, data };
}

function nestedElementsCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";
  for (let i = 0; i < depth; i++) {
    schema = { type: "array", elements: schema };
    data = [data];
  }
  return { schema, data };
}

describe("review blocker regressions", () => {
  it("rejects depth above maxDepth without exposing a RangeError", () => {
    const depth = 300;
    const validate = new SchemaShield({ maxDepth: 128, failFast: false }).compile(
      nestedObjectSchema(depth, { type: "string" })
    );
    const result = validate(nestedObjectData(depth, "leaf"));

    expect(result.valid).toBe(false);
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error).not.toBeInstanceOf(RangeError);
    expect((result.error as ValidationError).code).toBe("MAX_DEPTH_EXCEEDED");
    expect((result.error as ValidationError).getCause().keyword).toBe("maxDepth");
  });

  it("uses the fail-fast sentinel when maxDepth is exceeded", () => {
    const validate = new SchemaShield({ maxDepth: 32 }).compile(
      nestedObjectSchema(100, { type: "string" })
    );

    expect(validate(nestedObjectData(100, "leaf"))).toMatchObject({
      valid: false,
      error: true
    });
  });

  it("rolls back required defaults at every level when maxDepth is exceeded", () => {
    const schema = nestedDefaultedSchema(100);

    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const input = nestedObjectData(100, "leaf");
        const expected = structuredClone(input);
        const result = new SchemaShield({
          immutable,
          failFast,
          maxDepth: 32
        }).compile(schema)(input);

        expect(result.valid).toBe(false);
        expect(input).toEqual(expected);
        expect(result.data).toEqual(expected);
        if (failFast) {
          expect(result.error).toBe(true);
        } else {
          expect((result.error as ValidationError).code).toBe(
            "MAX_DEPTH_EXCEEDED"
          );
        }
      }
    }
  });

  it("rejects invalid maxDepth options at construction", () => {
    for (const maxDepth of [0, -1, 1.5, Number.NaN]) {
      expect(() => new SchemaShield({ maxDepth })).toThrow(ValidationError);
    }
  });

  it("validates deep propertyNames through the iterative path with a stable error path", () => {
    const depth = 1_000;
    const schema = nestedObjectSchema(depth, { type: "string" });
    let current = schema;
    for (let i = 0; i < depth; i++) {
      current.propertyNames = { pattern: "^next$" };
      current = current.properties.next;
    }
    const invalidData = nestedObjectData(depth, "leaf");
    invalidData.next.bad = "unexpected";

    const result = new SchemaShield({ maxDepth: 2_000, failFast: false })
      .compile(schema)(invalidData);

    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).getPath().instancePath).toContain("/bad");
  });

  it("validates deep values and elements with complete paths", () => {
    for (const testCase of [nestedValuesCase(1_000, true), nestedElementsCase(1_000, true)]) {
      const result = new SchemaShield({ maxDepth: 2_000, failFast: false })
        .compile(testCase.schema)(testCase.data);

      expect(result.valid).toBe(false);
      expect((result.error as ValidationError).getPath().instancePath.length).toBeGreaterThan(1_000);
    }
  });

  it("preserves an overwritten structural keyword callback and its error path", () => {
    const depth = 200;
    const shield = new SchemaShield({ maxDepth: 64, failFast: false });
    let calls = 0;
    shield.addKeyword(
      "properties",
      (schema, data, defineError) => {
        calls++;
        const child = schema.properties.next;
        if (!child || typeof child.$validate !== "function") {
          return;
        }
        const error = child.$validate(data.next);
        if (error) {
          return defineError("Overwritten properties rejected the child", {
            item: "next",
            cause: error,
            data: data.next
          });
        }
      },
      true
    );
    const result = shield.compile(
      nestedObjectSchema(depth, { type: "number" })
    )(nestedObjectData(depth, "invalid"));

    expect(result.valid).toBe(false);
    expect(calls).toBe(65);
    expect((result.error as ValidationError).code).toBe("MAX_DEPTH_EXCEEDED");
    expect((result.error as ValidationError).getPath().instancePath).toContain("/next");
  });

  it("applies required defaults before object observers regardless of key order", () => {
    const schema = {
      type: "object",
      minProperties: 1,
      properties: { value: { type: "string", default: "ready" } },
      required: ["value"]
    };

    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const input = {};
        const result = new SchemaShield({ immutable, failFast }).compile(schema)(input);

        expect(result.valid).toBe(true);
        expect(result.data).toEqual({ value: "ready" });
        expect(input).toEqual(immutable ? {} : { value: "ready" });
      }
    }
  });

  it("does not apply any required default when one staged default is invalid", () => {
    const schema = {
      type: "object",
      minProperties: 2,
      properties: {
        first: { type: "string", default: "valid" },
        second: { type: "string", default: 2 }
      },
      required: ["first", "second"]
    };

    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const input = {};
        const result = new SchemaShield({ immutable, failFast }).compile(schema)(input);

        expect(result.valid).toBe(false);
        expect(result.data).toEqual({});
        expect(input).toEqual({});
      }
    }
  });

  it("reuses one subschema shared by sibling properties", () => {
    const shared = { type: "string", minLength: 2 };
    const validate = new SchemaShield({ failFast: false }).compile({
      type: "object",
      properties: { left: shared, right: shared },
      required: ["left", "right"]
    });

    expect(validate({ left: "ok", right: "ok" }).valid).toBe(true);
    const invalid = validate({ left: "ok", right: "x" });
    expect(invalid.valid).toBe(false);
    expect((invalid.error as ValidationError).getPath().instancePath).toBe(
      "#/right"
    );
  });

  it("reuses one subschema shared between properties and combinators", () => {
    const shared = { type: "string", minLength: 2 };
    const validate = new SchemaShield({ failFast: false }).compile({
      type: "object",
      properties: { left: shared },
      required: ["left", "right"],
      allOf: [{ properties: { right: shared } }]
    });

    expect(validate({ left: "ok", right: "ok" }).valid).toBe(true);
    const invalid = validate({ left: "ok", right: "x" });
    expect(invalid.valid).toBe(false);
    expect((invalid.error as ValidationError).getPath().instancePath).toBe(
      "#/right"
    );
  });

  it("validates two independent deep branches", () => {
    const branchDepth = 1_000;
    const schema = {
      type: "object",
      properties: {
        left: nestedObjectSchema(branchDepth, { type: "string" }),
        right: nestedObjectSchema(branchDepth, { type: "string" })
      },
      required: ["left", "right"]
    };
    const data = {
      left: nestedObjectData(branchDepth, "left"),
      right: nestedObjectData(branchDepth, "right")
    };

    expect(
      new SchemaShield({ maxDepth: 2_000 }).compile(schema)(data).valid
    ).toBe(true);
  });

  it("reports an invalid leaf in each independent deep branch", () => {
    const branchDepth = 1_000;
    const schema = {
      type: "object",
      properties: {
        left: nestedObjectSchema(branchDepth, { type: "string" }),
        right: nestedObjectSchema(branchDepth, { type: "string" })
      },
      required: ["left", "right"]
    };
    const validate = new SchemaShield({
      maxDepth: 2_000,
      failFast: false
    }).compile(schema);

    for (const invalidBranch of ["left", "right"] as const) {
      const data = {
        left: nestedObjectData(branchDepth, "left"),
        right: nestedObjectData(branchDepth, "right")
      };
      let leaf = data[invalidBranch];
      for (let i = 0; i < branchDepth - 1; i++) {
        leaf = leaf.next;
      }
      leaf.next = 1;

      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      const path = (result.error as ValidationError).getPath().instancePath;
      expect(path.startsWith(`#/${invalidBranch}/next`)).toBe(true);
      expect(path.endsWith("/next")).toBe(true);
    }
  });
});
