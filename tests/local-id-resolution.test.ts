import { describe, it } from "mocha";

import { SchemaShield, ValidationError } from "../lib";
import expect from "expect";

describe("local $id reference resolution", () => {
  it("supports the official base URI change and plain-name identifier case", () => {
    const validate = new SchemaShield().compile({
      $id: "http://localhost:1234/root",
      allOf: [{ $ref: "http://localhost:1234/nested.json#foo" }],
      definitions: {
        A: {
          $id: "nested.json",
          definitions: {
            B: { $id: "#foo", type: "integer" }
          }
        }
      }
    });

    expect(validate(1).valid).toBe(true);
    expect(validate("a").valid).toBe(false);
  });

  it("resolves nested bases, empty fragments, pointers from resource roots, and transitive refs", () => {
    const validate = new SchemaShield().compile({
      $id: "https://schemas.example/root.json",
      definitions: {
        resource: {
          $id: "nested/resource.json",
          definitions: {
            value: { type: "integer" },
            alias: { $ref: "#/definitions/value" }
          }
        }
      },
      properties: {
        whole: { $ref: "nested/resource.json#" },
        pointed: { $ref: "nested/resource.json#/definitions/value" },
        transitive: { $ref: "nested/resource.json#/definitions/alias" }
      }
    });

    expect(
      validate({ whole: {}, pointed: 2, transitive: 3 }).valid
    ).toBe(true);
    expect(
      validate({ whole: {}, pointed: "2", transitive: 3 }).valid
    ).toBe(false);
    expect(
      validate({ whole: {}, pointed: 2, transitive: "3" }).valid
    ).toBe(false);
  });

  it("resolves absolute HTTP and HTTPS identities only when registered locally", () => {
    const validate = new SchemaShield().compile({
      definitions: {
        httpValue: { $id: "http://schemas.example/value", type: "string" },
        httpsValue: {
          $id: "https://schemas.example/value",
          type: "integer"
        }
      },
      properties: {
        text: { $ref: "http://schemas.example/value" },
        count: { $ref: "https://schemas.example/value" }
      }
    });

    expect(validate({ text: "ok", count: 1 }).valid).toBe(true);
    expect(validate({ text: 1, count: "bad" }).valid).toBe(false);
  });

  it("rejects duplicate identities that target distinct nodes", () => {
    expect(() =>
      new SchemaShield().compile({
        definitions: {
          first: { $id: "https://schemas.example/duplicate", type: "string" },
          second: { $id: "https://schemas.example/duplicate", type: "number" }
        }
      })
    ).toThrow(/Duplicate schema identity/);
  });

  it("rejects identities declared outside draft-06/07 subschema positions", () => {
    const cases = [
      {
        keyword: "values",
        id: "https://schemas.example/ignored-values"
      },
      {
        keyword: "elements",
        id: "https://schemas.example/ignored-elements"
      },
      {
        keyword: "unknownKeyword",
        id: "https://schemas.example/ignored-unknown"
      }
    ];

    for (const testCase of cases) {
      let compileError: unknown;
      try {
        new SchemaShield().compile({
          [testCase.keyword]: { $id: testCase.id, type: "string" },
          allOf: [{ $ref: testCase.id }]
        });
      } catch (error) {
        compileError = error;
      }

      expect(compileError).toBeInstanceOf(ValidationError);
      expect((compileError as ValidationError).code).toBe(
        "REFERENCE_NOT_FOUND"
      );
    }
  });

  it("rejects representative unregistered URI forms at compile time without calling global fetch", () => {
    const globalWithFetch = globalThis as typeof globalThis & {
      fetch?: (...args: any[]) => any;
    };
    const originalFetch = globalWithFetch.fetch;
    let fetchCalls = 0;
    globalWithFetch.fetch = () => {
      fetchCalls++;
      throw new Error("network access attempted");
    };

    try {
      for (const ref of [
        "http://remote.example/schema",
        "https://remote.example/schema",
        "missing/relative.json",
        "#missing"
      ]) {
        expect(() => new SchemaShield().compile({ $ref: ref })).toThrow(
          /Reference not found/
        );
      }
      expect(fetchCalls).toBe(0);
    } finally {
      if (originalFetch) {
        globalWithFetch.fetch = originalFetch;
      } else {
        delete globalWithFetch.fetch;
      }
    }
  });

  it("isolates registries across compile calls on the same instance", () => {
    const shield = new SchemaShield();
    const first = shield.compile({
      $id: "https://schemas.example/isolated",
      type: "string"
    });

    expect(first("ok").valid).toBe(true);
    expect(() =>
      shield.compile({ $ref: "https://schemas.example/isolated" })
    ).toThrow(/Reference not found/);
    expect(first("still valid").valid).toBe(true);
  });

  it("keeps useful recursive cycles under the configured depth guard", () => {
    const validate = new SchemaShield({ maxDepth: 4 }).compile({
      $id: "https://schemas.example/node",
      type: "object",
      properties: {
        value: { type: "integer" },
        next: { $ref: "https://schemas.example/node" }
      },
      required: ["value"]
    });

    expect(validate({ value: 1, next: { value: 2 } }).valid).toBe(true);
    expect(
      validate({
        value: 1,
        next: {
          value: 2,
          next: { value: 3, next: { value: 4, next: { value: 5 } } }
        }
      }).valid
    ).toBe(false);
  });
});
