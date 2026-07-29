import { describe, it } from "mocha";
import expect from "expect";
import {
  AddSchemaOptions,
  JSONSchema,
  SchemaShield,
  ValidationError
} from "../lib";

function captureError(action: () => void): ValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error("Expected SchemaShield to throw");
}

describe("SchemaShield.addSchema input contracts", () => {
  it("rejects invalid schemas and options with controlled errors", () => {
    const shield = new SchemaShield();
    const invalidSchemas = [null, undefined, [], "schema", 1, new Date()];

    for (const schema of invalidSchemas) {
      const error = captureError(() => shield.addSchema(schema as JSONSchema));
      expect(error.code).toBe("INVALID_SCHEMA");
    }

    for (const options of [null, [], "options", 1]) {
      const error = captureError(() =>
        shield.addSchema({ $id: "https://schemas.example/options" }, options as any)
      );
      expect(error.code).toBe("INVALID_ADD_SCHEMA_OPTIONS");
    }
  });

  it("rejects malformed, relative, and fragment-bearing retrieval identities", () => {
    const invalidUris = [
      "relative/schema.json",
      "https://schemas.example/schema#",
      "https://schemas.example/schema#part",
      "http://[invalid"
    ];

    for (const uri of invalidUris) {
      const error = captureError(() =>
        new SchemaShield().addSchema({}, { uri })
      );
      expect(error.code).toBe("INVALID_SCHEMA_URI");
    }
  });

  it("rejects invalid aliases and root identifiers that cannot identify a resource", () => {
    const invalidAliases: any[] = [
      "https://schemas.example/alias",
      ["relative"],
      ["https://schemas.example/alias#part"],
      [1]
    ];

    for (const aliases of invalidAliases) {
      const error = captureError(() =>
        new SchemaShield().addSchema(
          { $id: "https://schemas.example/schema" },
          { aliases }
        )
      );
      expect(error.code).toBe("INVALID_SCHEMA_ALIAS");
    }

    for (const schema of [{}, { $id: "relative.json" }, { $id: "#name" }]) {
      const error = captureError(() => new SchemaShield().addSchema(schema));
      expect(error.code).toBe("INVALID_SCHEMA_ID");
    }

    const booleanError = captureError(() => new SchemaShield().addSchema(true));
    expect(booleanError.code).toBe("INVALID_SCHEMA_ID");
  });

  it("rejects non-JSON schema values before snapshotting", () => {
    const invalidSchemas: JSONSchema[] = [
      { $id: "https://schemas.example/undefined", value: undefined },
      { $id: "https://schemas.example/function", value: () => true },
      { $id: "https://schemas.example/nan", value: Number.NaN },
      { $id: "https://schemas.example/infinity", value: Infinity }
    ];

    for (const schema of invalidSchemas) {
      const error = captureError(() => new SchemaShield().addSchema(schema));
      expect(error.code).toBe("INVALID_SCHEMA");
    }
  });

  it("rejects duplicate identities, aliases, and collisions with the compiled root", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      { $id: "child.json", type: "string" },
      {
        uri: "https://schemas.example/base/child.json",
        aliases: ["https://schemas.example/child", "https://schemas.example/child"]
      }
    );

    const duplicate = captureError(() =>
      shield.addSchema({ type: "number" }, { uri: "https://schemas.example/child" })
    );
    expect(duplicate.code).toBe("DUPLICATE_SCHEMA_ID");

    const rootCollision = captureError(() =>
      shield.compile({
        $id: "https://schemas.example/base/child.json",
        type: "boolean"
      })
    );
    expect(rootCollision.code).toBe("DUPLICATE_SCHEMA_ID");
  });

  it("fails unresolved references synchronously without remote loading", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      { $ref: "https://remote.invalid/missing" },
      { uri: "https://schemas.example/broken" }
    );

    const unreachable = shield.compile({ type: "string" });
    expect(unreachable("ok").valid).toBe(true);

    const error = captureError(() =>
      shield.compile({ $ref: "https://schemas.example/broken" })
    );
    expect(error.code).toBe("REFERENCE_NOT_FOUND");
  });

  it("does not inspect invalid or duplicate nested ids in unreachable resources", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        definitions: {
          malformed: { $id: "http://[invalid", type: "string" }
        }
      },
      { uri: "https://schemas.example/unreachable-malformed" }
    );
    shield.addSchema(
      {
        definitions: {
          first: { $id: "duplicate.json", type: "string" },
          second: { $id: "duplicate.json", type: "number" }
        }
      },
      { uri: "https://schemas.example/unreachable-duplicate" }
    );

    const validate = shield.compile({ type: "integer" });
    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);

    expect(
      captureError(() =>
        shield.compile({
          $ref: "https://schemas.example/unreachable-malformed"
        })
      ).code
    ).toBe("INVALID_SCHEMA_ID");
    expect(
      captureError(() =>
        shield.compile({
          $ref: "https://schemas.example/unreachable-duplicate"
        })
      ).code
    ).toBe("DUPLICATE_SCHEMA_ID");
  });

  it("keeps failed multi-identity registration atomic", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      { type: "string" },
      { uri: "https://schemas.example/existing" }
    );

    expect(
      captureError(() =>
        shield.addSchema(
          { type: "number" },
          {
            uri: "https://schemas.example/not-registered",
            aliases: ["https://schemas.example/existing"]
          }
        )
      ).code
    ).toBe("DUPLICATE_SCHEMA_ID");
    expect(
      captureError(() =>
        shield.compile({ $ref: "https://schemas.example/not-registered" })
      ).code
    ).toBe("REFERENCE_NOT_FOUND");
  });

  it("rejects malformed JSON Pointer escapes with a controlled ref error", () => {
    for (const ref of ["#/definitions/%", "#/definitions/bad~2token"]) {
      const error = captureError(() =>
        new SchemaShield().compile({
          definitions: {
            "%": { type: "string" },
            "bad~2token": { type: "string" }
          },
          $ref: ref
        })
      );
      expect(error.code).toBe("REFERENCE_NOT_FOUND");
      expect(error.keyword).toBe("$ref");
    }
  });
});

describe("SchemaShield.addSchema reference resolution", () => {
  it("infers an absolute root id and resolves an explicitly registered URI", () => {
    const shield = new SchemaShield();
    shield.addSchema({ $id: "https://schemas.example/text", type: "string" });
    shield.addSchema({ type: "integer" }, { uri: "https://schemas.example/count" });

    const validate = shield.compile({
      properties: {
        text: { $ref: "https://schemas.example/text" },
        count: { $ref: "https://schemas.example/count" }
      }
    });

    expect(validate({ text: "ok", count: 2 }).valid).toBe(true);
    expect(validate({ text: 2, count: "bad" }).valid).toBe(false);
  });

  it("treats retrieval URI, resolved root id, and aliases as one resource", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        $id: "resource.json",
        definitions: { value: { type: "integer" } },
        $ref: "#/definitions/value"
      },
      {
        uri: "https://retrieval.example/base/input.json",
        aliases: ["https://schemas.example/value"]
      }
    );

    for (const ref of [
      "https://retrieval.example/base/input.json",
      "https://retrieval.example/base/resource.json",
      "https://schemas.example/value"
    ]) {
      const validate = shield.compile({ $ref: ref });
      expect(validate(2).valid).toBe(true);
      expect(validate("2").valid).toBe(false);
    }
  });

  it("uses a root $id as the base when the same node also has $ref", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        $id: "https://schemas.example/id-base/a.json",
        $ref: "b.json"
      },
      { uri: "https://retrieval.example/other/a.json" }
    );
    shield.addSchema(
      { type: "string" },
      { uri: "https://schemas.example/id-base/b.json" }
    );

    const validate = shield.compile({
      $ref: "https://retrieval.example/other/a.json"
    });
    expect(validate("ok").valid).toBe(true);
    expect(validate(1).valid).toBe(false);
  });

  it("resolves root fragments, JSON Pointers, relative refs, and transitive refs", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        $id: "c.json",
        $defs: { value: { type: "integer" } }
      },
      { uri: "https://schemas.example/base/c-retrieval.json" }
    );
    shield.addSchema(
      {
        $id: "b.json",
        definitions: {
          pointed: { $ref: "c.json#/$defs/value" },
          alias: { $ref: "#/definitions/pointed" }
        }
      },
      { uri: "https://schemas.example/base/b-retrieval.json" }
    );
    shield.addSchema(
      { $ref: "b.json#/definitions/alias" },
      { uri: "https://schemas.example/base/a.json" }
    );

    const validate = shield.compile({ $ref: "https://schemas.example/base/a.json#" });
    expect(validate(4).valid).toBe(true);
    expect(validate("4").valid).toBe(false);
  });

  it("keeps registered nested and plain-name identities directly addressable", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      {
        definitions: {
          nested: {
            $id: "nested.json",
            definitions: {
              named: { $id: "#value", type: "integer" }
            }
          }
        }
      },
      { uri: "https://schemas.example/direct/root.json" }
    );

    const validate = shield.compile({
      $ref: "https://schemas.example/direct/nested.json#value"
    });
    expect(validate(3).valid).toBe(true);
    expect(validate("3").valid).toBe(false);
  });

  it("supports boolean resources", () => {
    const shield = new SchemaShield();
    shield.addSchema(true, { uri: "https://schemas.example/allow" });
    shield.addSchema(false, { uri: "https://schemas.example/deny" });

    expect(shield.compile({ $ref: "https://schemas.example/allow" })(1).valid).toBe(
      true
    );
    expect(shield.compile({ $ref: "https://schemas.example/deny" })(1).valid).toBe(
      false
    );
  });

  it("supports cross-document cycles under maxDepth", () => {
    const shield = new SchemaShield({ maxDepth: 5, failFast: false });
    shield.addSchema(
      {
        type: "object",
        properties: { value: { type: "integer" }, next: { $ref: "b.json" } },
        required: ["value"]
      },
      { uri: "https://schemas.example/cycle/a.json" }
    );
    shield.addSchema(
      {
        type: "object",
        properties: { value: { type: "integer" }, next: { $ref: "a.json" } },
        required: ["value"]
      },
      { uri: "https://schemas.example/cycle/b.json" }
    );

    const validate = shield.compile({
      $ref: "https://schemas.example/cycle/a.json"
    });
    expect(validate({ value: 1, next: { value: 2 } }).valid).toBe(true);

    let input: any = { value: 0 };
    const root = input;
    for (let index = 1; index < 10; index++) {
      input.next = { value: index };
      input = input.next;
    }
    const result = validate(root);
    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).getCause().code).toBe(
      "MAX_DEPTH_EXCEEDED"
    );
  });
});

describe("SchemaShield.addSchema lifecycle and integrations", () => {
  it("snapshots schemas and keeps existing validators stable", () => {
    const external: JSONSchema = {
      $id: "https://schemas.example/snapshot",
      type: "string"
    };
    const shield = new SchemaShield();
    shield.addSchema(external);
    (external as Record<string, any>).type = "number";

    const first = shield.compile({ $ref: "https://schemas.example/snapshot" });
    expect(first("before").valid).toBe(true);
    expect(first(1).valid).toBe(false);

    shield.addSchema(
      { type: "number" },
      { uri: "https://schemas.example/future" }
    );
    const second = shield.compile({ $ref: "https://schemas.example/future" });
    expect(second(1).valid).toBe(true);
    expect(first("after").valid).toBe(true);
    expect(first(1).valid).toBe(false);
  });

  it("allows registration in any order and resolves only on future compile calls", () => {
    const shield = new SchemaShield();
    shield.addSchema(
      { $ref: "b.json" },
      { uri: "https://schemas.example/order/a.json" }
    );

    expect(
      captureError(() =>
        shield.compile({ $ref: "https://schemas.example/order/a.json" })
      ).code
    ).toBe("REFERENCE_NOT_FOUND");

    shield.addSchema(
      { type: "string" },
      { uri: "https://schemas.example/order/b.json" }
    );
    expect(
      shield.compile({ $ref: "https://schemas.example/order/a.json" })("ok").valid
    ).toBe(true);
  });

  it("applies external defaults with rollback and immutable isolation", () => {
    const shield = new SchemaShield({
      useDefaults: true,
      immutable: true,
      failFast: false
    });
    shield.addSchema(
      {
        type: "object",
        properties: { value: { type: "string", default: "external" } }
      },
      { uri: "https://schemas.example/defaults" }
    );

    const validInput: Record<string, any> = {};
    const valid = shield.compile({
      $ref: "https://schemas.example/defaults"
    })(validInput);
    expect(valid.valid).toBe(true);
    expect(validInput).toEqual({});
    expect(valid.data).toEqual({ value: "external" });

    const rollbackInput: Record<string, any> = {};
    const invalid = shield.compile({
      allOf: [{ $ref: "https://schemas.example/defaults" }, false]
    })(rollbackInput);
    expect(invalid.valid).toBe(false);
    expect(rollbackInput).toEqual({});
    expect(invalid.data).toEqual({});
  });

  it("preserves a custom $ref override without forcing registry resolution", () => {
    const shield = new SchemaShield({ failFast: false });
    shield.addSchema(
      { $ref: "https://schemas.example/missing" },
      { uri: "https://schemas.example/custom-ref-resource" }
    );
    shield.addKeyword(
      "$ref",
      (schema, data, defineError) =>
        data === schema.$ref
          ? undefined
          : defineError("custom ref rejected", { data }),
      true
    );

    const validate = shield.compile({
      $ref: "https://schemas.example/custom-ref-resource"
    });
    expect(validate("https://schemas.example/custom-ref-resource").valid).toBe(
      true
    );
    expect(validate("other").valid).toBe(false);
  });
});
