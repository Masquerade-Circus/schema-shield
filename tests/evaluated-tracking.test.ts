import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

const DRAFT_2019 = "https://json-schema.org/draft/2019-09/schema";
const DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";

describe("evaluated tracking across modern applicators", () => {
  it("discards annotations from failed anyOf and oneOf branches", () => {
    for (const keyword of ["anyOf", "oneOf"] as const) {
      const validate = new SchemaShield().compile({
        $schema: DRAFT_2020,
        [keyword]: [
          {
            properties: { rejected: { const: "accepted" } },
            required: ["rejected"]
          },
          { properties: { kept: true }, required: ["kept"] }
        ],
        unevaluatedProperties: false
      });

      expect(validate({ rejected: "wrong", kept: true }).valid).toBe(false);
      expect(validate({ kept: true }).valid).toBe(true);
    }
  });

  it("keeps object and array annotations isolated by instance location", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      type: "object",
      properties: {
        left: {
          type: "object",
          properties: { value: true },
          unevaluatedProperties: false
        },
        right: {
          prefixItems: [true],
          unevaluatedItems: false
        }
      },
      unevaluatedProperties: false
    });

    expect(validate({ left: { value: 1 }, right: [1] }).valid).toBe(true);
    expect(validate({ left: { value: 1, extra: 2 }, right: [1] }).valid).toBe(
      false
    );
    expect(validate({ left: { value: 1 }, right: [1, 2] }).valid).toBe(false);

    const collidingNames = new SchemaShield().compile({
      $schema: DRAFT_2020,
      properties: {
        container: { properties: { repeated: true } }
      },
      unevaluatedProperties: false
    });
    expect(
      collidingNames({ container: { repeated: true }, repeated: true }).valid
    ).toBe(false);

    const collidingIndexes = new SchemaShield().compile({
      $schema: DRAFT_2020,
      prefixItems: [{ prefixItems: [true, true] }],
      unevaluatedItems: false
    });
    expect(collidingIndexes([["zero", "one"], "one"]).valid).toBe(false);
  });

  it("collects annotations from an applied empty dependent schema", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      properties: { trigger: {} },
      dependentSchemas: {
        trigger: { properties: { dependent: {} } }
      },
      unevaluatedProperties: false
    });

    expect(validate({ trigger: true, dependent: true }).valid).toBe(true);
    expect(validate({ dependent: true }).valid).toBe(false);
  });

  it("tracks external, dynamic, and recursive reference results", () => {
    const externalShield = new SchemaShield();
    externalShield.addSchema(
      {
        $schema: DRAFT_2020,
        $id: "https://schemas.example/evaluated-target",
        properties: { external: true }
      },
      { uri: "https://schemas.example/evaluated-target" }
    );
    const external = externalShield.compile({
      $schema: DRAFT_2020,
      $ref: "https://schemas.example/evaluated-target",
      unevaluatedProperties: false
    });
    expect(external({ external: true }).valid).toBe(true);
    expect(external({ external: true, extra: true }).valid).toBe(false);

    const dynamic = new SchemaShield().compile({
      $schema: DRAFT_2020,
      $dynamicAnchor: "node",
      type: "object",
      properties: {
        value: true,
        next: { $dynamicRef: "#node" }
      },
      unevaluatedProperties: false
    });
    expect(dynamic({ value: 1, next: { value: 2 } }).valid).toBe(true);
    expect(dynamic({ value: 1, next: { extra: 2 } }).valid).toBe(false);

    const recursive = new SchemaShield().compile({
      $schema: DRAFT_2019,
      $recursiveAnchor: true,
      type: "object",
      properties: {
        value: true,
        next: { $recursiveRef: "#" }
      },
      unevaluatedProperties: false
    });
    expect(recursive({ value: 1, next: { value: 2 } }).valid).toBe(true);
    expect(recursive({ value: 1, next: { extra: 2 } }).valid).toBe(false);
  });

  it("marks only successful contains matches", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      contains: { type: "string" },
      unevaluatedItems: { type: "number" }
    });

    expect(validate(["match", 1, 2]).valid).toBe(true);
    expect(validate(["match", false]).valid).toBe(false);
  });

  it("does not let propertyNames consume property values", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      propertyNames: { maxLength: 1 },
      unevaluatedProperties: { type: "number" }
    });

    expect(validate({ a: 1 }).valid).toBe(true);
    expect(validate({ a: "one" }).valid).toBe(false);
  });

  it("runs unevaluated keywords after siblings regardless of source order", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      unevaluatedProperties: false,
      allOf: [{ properties: { accepted: true } }]
    });

    expect(validate({ accepted: true }).valid).toBe(true);
    expect(validate({ rejected: true }).valid).toBe(false);
  });
});

describe("evaluated tracking lifecycle", () => {
  it("isolates sequential and concurrent validator calls", async () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      properties: { accepted: true },
      unevaluatedProperties: false
    });

    expect(validate({ accepted: 1 }).valid).toBe(true);
    expect(validate({ leaked: 1 }).valid).toBe(false);
    expect(validate({ accepted: 2 }).valid).toBe(true);

    const results = await Promise.all([
      Promise.resolve().then(() => validate({ accepted: 3 })),
      Promise.resolve().then(() => validate({ leaked: 2 })),
      Promise.resolve().then(() => validate({ accepted: 4 }))
    ]);
    expect(results.map((result) => result.valid)).toEqual([true, false, true]);
  });

  it("preserves maxDepth failures and detailed paths", () => {
    const validate = new SchemaShield({ failFast: false, maxDepth: 2 }).compile({
      $schema: DRAFT_2020,
      type: "object",
      properties: { next: { $ref: "#" } },
      unevaluatedProperties: false
    });

    const result = validate({ next: { next: { next: {} } } });
    expect(result.valid).toBe(false);
    expect(result.error).not.toBe(true);
    expect(result.error && result.error.getCause().code).toBe(
      "MAX_DEPTH_EXCEEDED"
    );
  });

  it("rolls back defaults from failed alternatives in mutable and immutable mode", () => {
    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const validate = new SchemaShield({
          failFast,
          immutable,
          useDefaults: true
        }).compile({
          $schema: DRAFT_2020,
          anyOf: [
            {
              properties: {
                transient: { const: "valid", default: "invalid" }
              },
              required: ["transient"]
            },
            { properties: { kept: true }, required: ["kept"] }
          ],
          unevaluatedProperties: false
        });
        const input = { kept: true };
        const result = validate(input);

        expect(result.valid).toBe(true);
        expect(result.data).toEqual({ kept: true });
        expect(input).toEqual({ kept: true });
      }
    }
  });

  it("keeps the public result shape unchanged", () => {
    const result = new SchemaShield().compile({
      $schema: DRAFT_2020,
      unevaluatedProperties: false
    })({});

    expect(Object.keys(result).sort()).toEqual(["data", "error", "valid"]);
  });

  it("reports unevaluated instance and schema paths", () => {
    const result = new SchemaShield({ failFast: false }).compile({
      $schema: DRAFT_2020,
      properties: { accepted: true },
      unevaluatedProperties: false
    })({ accepted: true, rejected: true });

    expect(result.valid).toBe(false);
    expect(result.error).not.toBe(true);
    expect(result.error && result.error.getPath()).toEqual({
      schemaPath: "#/unevaluatedProperties",
      instancePath: "#/rejected"
    });
  });

  it("leaves draft6 and draft7 unevaluated keywords inactive", () => {
    for (const $schema of [
      "http://json-schema.org/draft-06/schema#",
      "http://json-schema.org/draft-07/schema#"
    ]) {
      const validate = new SchemaShield().compile({
        $schema,
        unevaluatedItems: false,
        unevaluatedProperties: false
      });
      expect(validate([1]).valid).toBe(true);
      expect(validate({ extra: true }).valid).toBe(true);
    }
  });
});
