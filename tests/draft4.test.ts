import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield } from "../lib";

const draft4 = "http://json-schema.org/draft-04/schema#";

describe("draft-04 dialect behavior", () => {
  it("ignores validation keywords introduced after draft-04", () => {
    const shield = new SchemaShield();
    const schemas = [
      { $schema: draft4, const: 1 },
      { $schema: draft4, contains: { type: "integer" } },
      { $schema: draft4, propertyNames: { pattern: "^allowed$" } },
      { $schema: draft4, if: false, then: false }
    ];
    const data = [2, ["text"], { blocked: true }, "value"];

    for (let index = 0; index < schemas.length; index++) {
      expect(shield.compile(schemas[index])(data[index]).valid).toBe(true);
    }
  });

  it("uses draft-04 id scopes for local references", () => {
    const validate = new SchemaShield().compile({
      $schema: draft4,
      id: "https://schemas.example/root.json",
      definitions: {
        integer: {
          id: "integer.json",
          type: "integer"
        }
      },
      properties: {
        value: { $ref: "integer.json" }
      }
    });

    expect(validate({ value: 1 }).valid).toBe(true);
    expect(validate({ value: "1" }).valid).toBe(false);
  });

  it("ignores draft-04 siblings beside $ref", () => {
    const validate = new SchemaShield().compile({
      $schema: draft4,
      definitions: { integer: { type: "integer" } },
      $ref: "#/definitions/integer",
      type: "string"
    });

    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
  });

  it("does not prepare ignored draft-04 definition siblings beside $ref", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      { type: "integer" },
      { uri: "https://schemas.example/integer" }
    );

    const validate = shield.compile(
      {
        $schema: draft4,
        $ref: "https://schemas.example/integer",
        definitions: {
          ignored: { type: null }
        }
      },
      { validateSchema: false }
    );

    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
  });

  it("ignores numeric exclusive bounds that are invalid in draft-04", () => {
    const shield = new SchemaShield();
    const minimum = shield.compile(
      {
        $schema: draft4,
        minimum: 1,
        exclusiveMinimum: 10
      },
      { validateSchema: false }
    );
    const maximum = shield.compile(
      {
        $schema: draft4,
        maximum: 10,
        exclusiveMaximum: 1
      },
      { validateSchema: false }
    );
    const standaloneMinimum = shield.compile(
      {
        $schema: draft4,
        exclusiveMinimum: 10
      },
      { validateSchema: false }
    );
    const standaloneMaximum = shield.compile(
      {
        $schema: draft4,
        exclusiveMaximum: 1
      },
      { validateSchema: false }
    );

    expect(minimum(1).valid).toBe(true);
    expect(maximum(10).valid).toBe(true);
    expect(standaloneMinimum(1).valid).toBe(true);
    expect(standaloneMaximum(10).valid).toBe(true);
  });

  it("enforces boolean exclusive bounds when large values round to the boundary", () => {
    const shield = new SchemaShield();
    const maximum = shield.compile({
      $schema: draft4,
      maximum: 972783798187987123879878123.18878137,
      exclusiveMaximum: true
    });
    const minimum = shield.compile({
      $schema: draft4,
      minimum: -972783798187987123879878123.18878137,
      exclusiveMinimum: true
    });

    expect(maximum(972783798187987123879878123.188781371).valid).toBe(false);
    expect(minimum(-972783798187987123879878123.188781371).valid).toBe(false);
  });
});
