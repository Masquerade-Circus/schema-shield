import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";
import { hasOwn } from "./test-utils";

describe("maxDepth options", () => {
  it("rejects invalid values", () => {
    for (const value of [0, -1, 1.5, Number.NaN, Infinity, "128", 257]) {
      expect(() => new SchemaShield({ maxDepth: value as any })).toThrow(
        ValidationError
      );
    }
  });

  it("keeps a builtin acyclic schema on the direct fast path", () => {
    const validate = new SchemaShield({ maxDepth: 1 }).compile({
      type: "object",
      properties: { value: { type: "string" } }
    });

    expect(hasOwn(validate.compiledSchema, "_requiresDepthGuard")).toBe(false);
    expect(String(validate.compiledSchema.$validate)).not.toMatch(
      /context|guard|depth|journal/i
    );
    expect(validate({ value: "ok" }).valid).toBe(true);
  });

  it("applies maxDepth only during validation", () => {
    const validate = new SchemaShield({ maxDepth: 1, failFast: false }).compile({
      properties: {
        nested: {
          properties: {
            value: { type: "string" }
          }
        }
      }
    });

    expect((validate.compiledSchema as any)._requiresDepthGuard).toBe(true);
    const result = validate({ nested: { value: "ok" } });
    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).code).toBe("MAX_DEPTH_EXCEEDED");
  });
});
