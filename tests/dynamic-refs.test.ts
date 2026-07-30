import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield, ValidationError } from "../lib";

const DRAFT_2019 = "https://json-schema.org/draft/2019-09/schema";
const DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";

describe("dynamic and recursive references", () => {
  it("uses recursive scope only when the initial resource opts in", () => {
    for (const [recursiveAnchor, expected] of [
      [true, true],
      [false, false]
    ] as const) {
      const shield = new SchemaShield();
      const validate = shield.compile({
        $schema: DRAFT_2019,
        $id: "https://schemas.example/recursive/root",
        $recursiveAnchor: recursiveAnchor,
        anyOf: [{ type: "integer" }, { $ref: "inner" }],
        $defs: {
          inner: {
            $id: "inner",
            $recursiveAnchor: true,
            anyOf: [
              { type: "string" },
              {
                type: "object",
                additionalProperties: { $recursiveRef: "#" }
              }
            ]
          }
        }
      });
      shield.compile({ type: "string" });

      expect(validate({ leaf: 1 }).valid).toBe(expected);
      expect(validate({ leaf: true }).valid).toBe(false);
    }
  });

  it("keeps ordinary anchors and pointers on the static dynamicRef path", () => {
    const ordinaryAnchor = new SchemaShield().compile({
      $schema: DRAFT_2020,
      type: "array",
      items: { $dynamicRef: "#item" },
      $defs: { item: { $anchor: "item", type: "string" } }
    });
    expect(ordinaryAnchor(["ok"]).valid).toBe(true);
    expect(ordinaryAnchor([1]).valid).toBe(false);

    const pointer = new SchemaShield().compile({
      $schema: DRAFT_2020,
      $id: "https://schemas.example/pointer/root",
      $dynamicAnchor: "item",
      type: ["array", "string"],
      $ref: "inner",
      $defs: {
        inner: {
          $id: "inner",
          type: "array",
          items: { $dynamicRef: "#/$defs/item" },
          $defs: { item: { $dynamicAnchor: "item", type: "integer" } }
        }
      }
    });
    expect(pointer([1]).valid).toBe(true);
    expect(pointer(["wrong static target"]).valid).toBe(false);
  });

  it("reuses one generic schema under distinct outermost dynamic scopes", () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      $id: "https://schemas.example/path/root",
      if: {
        properties: { kind: { const: "number" } },
        required: ["kind"]
      },
      then: { $ref: "number-path" },
      else: { $ref: "string-path" },
      $defs: {
        generic: {
          $id: "generic",
          properties: {
            values: { items: { $dynamicRef: "#value" } }
          },
          $defs: { fallback: { $dynamicAnchor: "value" } }
        },
        numberPath: {
          $id: "number-path",
          $defs: {
            value: { $dynamicAnchor: "value", type: "number" }
          },
          $ref: "generic"
        },
        stringPath: {
          $id: "string-path",
          $defs: {
            value: { $dynamicAnchor: "value", type: "string" }
          },
          $ref: "generic"
        }
      }
    });

    expect(validate({ kind: "number", values: [1] }).valid).toBe(true);
    expect(validate({ kind: "number", values: ["1"] }).valid).toBe(false);
    expect(validate({ kind: "string", values: [1] }).valid).toBe(false);
    expect(validate({ kind: "string", values: ["1"] }).valid).toBe(true);
  });

  it("removes failed branch resources from dynamic scope", async () => {
    const validate = new SchemaShield().compile({
      $schema: DRAFT_2020,
      $id: "https://schemas.example/cleanup/root",
      anyOf: [{ $ref: "string-path" }, { $ref: "number-path" }],
      $defs: {
        generic: {
          $id: "generic",
          $dynamicRef: "#value",
          $defs: { fallback: { $dynamicAnchor: "value", type: "boolean" } }
        },
        stringPath: {
          $id: "string-path",
          $defs: { value: { $dynamicAnchor: "value", type: "string" } },
          $ref: "generic"
        },
        numberPath: {
          $id: "number-path",
          $defs: { value: { $dynamicAnchor: "value", type: "number" } },
          $ref: "generic"
        }
      }
    });

    expect(validate(1).valid).toBe(true);
    expect(validate("text").valid).toBe(true);
    expect(validate(true).valid).toBe(false);

    const results = await Promise.all([
      Promise.resolve().then(() => validate(2).valid),
      Promise.resolve().then(() => validate("again").valid),
      Promise.resolve().then(() => validate(null).valid)
    ]);
    expect(results).toEqual([true, true, false]);
  });

  it("resolves dynamic scopes through registered resources and aliases", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        $schema: DRAFT_2020,
        $id: "generic",
        $dynamicAnchor: "node",
        anyOf: [
          { type: "string" },
          {
            type: "object",
            properties: { child: { $dynamicRef: "#node" } }
          }
        ]
      },
      { uri: "https://registry.example/generic" }
    );
    shield.addSchema(
      {
        $schema: DRAFT_2020,
        $id: "extension",
        $dynamicAnchor: "node",
        type: "object",
        properties: { value: { type: "integer" } },
        required: ["value"],
        $ref: "generic"
      },
      {
        uri: "https://registry.example/extension-source",
        aliases: ["https://registry.example/extension-alias"]
      }
    );

    const validate = shield.compile({
      $schema: DRAFT_2020,
      $ref: "https://registry.example/extension-alias"
    });
    expect(validate({ value: 1, child: { value: 2 } }).valid).toBe(true);
    expect(validate({ value: 1, child: "static-only" }).valid).toBe(false);
  });

  it("limits dynamic recursion and rolls back defaults after depth failure", () => {
    const validate = new SchemaShield({
      maxDepth: 4,
      useDefaults: true,
      failFast: false
    }).compile({
      $schema: DRAFT_2020,
      $dynamicAnchor: "node",
      type: "object",
      properties: {
        marker: { type: "string", default: "added" },
        next: { $dynamicRef: "#node" }
      }
    });
    const input = { next: { next: { next: { next: {} } } } };

    const result = validate(input);
    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).getCause().code).toBe(
      "MAX_DEPTH_EXCEEDED"
    );
    expect(input).toEqual({ next: { next: { next: { next: {} } } } });
  });
});
