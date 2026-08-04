import { describe, it } from "mocha";
import expect from "expect";

import {
  JSONSchema,
  SchemaShield,
  ValidationError
} from "../lib";

const DRAFT_7 = "http://json-schema.org/draft-07/schema#";
const DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";

function captureError(action: () => void): ValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error("Expected SchemaShield to throw");
}

describe("builtin metaschema contract", () => {
  it("rejects unknown $schema identities instead of matching URI fragments", () => {
    const error = captureError(() =>
      new SchemaShield().compile({
        $schema: "https://example.com/draft/2020-12/schema",
        type: "string"
      })
    );

    expect(error.code).toBe("UNKNOWN_METASCHEMA");
    expect(error.keyword).toBe("$schema");
  });

  it("rejects present but malformed $schema values", () => {
    for (const value of [null, 1, {}, [], ""]) {
      const error = captureError(() =>
        new SchemaShield().compile({ $schema: value, type: "string" })
      );
      expect(error.code).toBe("UNKNOWN_METASCHEMA");
      expect(error.keyword).toBe("$schema");
    }
  });

  it("metavalidates official schemas by default", () => {
    const error = captureError(() =>
      new SchemaShield().compile({ $schema: DRAFT_7, type: "custom" })
    );

    expect(error.code).toBe("INVALID_SCHEMA");
    expect(error.getPath().instancePath).toBe("#/type");
  });

  it("uses the official draft-06 patternProperties name constraint", () => {
    const error = captureError(() =>
      new SchemaShield().compile({
        $schema: "http://json-schema.org/draft-06/schema#",
        patternProperties: { "[": { type: "string" } }
      })
    );

    expect(error.code).toBe("INVALID_SCHEMA");
  });

  it("uses the official draft-07 writeOnly constraint", () => {
    const error = captureError(() =>
      new SchemaShield().compile({ $schema: DRAFT_7, writeOnly: "yes" } as any)
    );

    expect(error.code).toBe("INVALID_SCHEMA");
    expect(error.getPath().instancePath).toBe("#/writeOnly");
  });

  it("allows trusted callers to skip metavalidation explicitly", () => {
    const shield = new SchemaShield();
    shield.addType("custom", (value) => value === "custom");

    const validate = shield.compile(
      { $schema: DRAFT_7, type: "custom" },
      { validateSchema: false }
    );

    expect(validate("custom").valid).toBe(true);
    expect(validate("other").valid).toBe(false);
  });

  it("exposes schema validation without compiling an application validator", () => {
    const shield = new SchemaShield({ failFast: false });

    expect(shield.validateSchema({ $schema: DRAFT_2020, type: "string" }).valid).toBe(
      true
    );
    const invalid = shield.validateSchema({
      $schema: DRAFT_2020,
      minLength: -1
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBeInstanceOf(ValidationError);
  });

  it("makes official metaschemas available as local reference resources", () => {
    const validateSchemaDocument = new SchemaShield().compile(
      { $ref: DRAFT_7 },
      { validateSchema: false }
    );

    expect(validateSchemaDocument({ type: "integer" }).valid).toBe(true);
    expect(validateSchemaDocument({ type: "invalid" }).valid).toBe(false);
  });

  it("metavalidates every reachable registered resource", () => {
    const shield = new SchemaShield();
    shield.addSchema({
      $schema: DRAFT_7,
      $id: "https://schemas.example/invalid-resource",
      type: "invalid"
    });

    const error = captureError(() =>
      shield.compile({ $ref: "https://schemas.example/invalid-resource" })
    );
    expect(error.code).toBe("INVALID_SCHEMA");
  });

  it("rejects attempts to replace a builtin metaschema", () => {
    const collision = captureError(() =>
      new SchemaShield().addSchema(
        { $id: DRAFT_7, type: "string" },
        { uri: DRAFT_7 }
      )
    );

    expect(collision.code).toBe("BUILTIN_SCHEMA_ID_COLLISION");
  });

  it("treats an identical builtin registration as a compatibility no-op", () => {
    const draft7 = require("../lib/official-meta-schemas.json").draft7;
    const shield = new SchemaShield();

    expect(() => shield.addSchema(draft7)).not.toThrow();
    expect(shield.compile({ $schema: DRAFT_7, type: "integer" })(1).valid).toBe(
      true
    );
  });

  it("rejects malformed compile options", () => {
    const error = captureError(() =>
      new SchemaShield().compile({ type: "string" }, {
        validateSchema: "yes"
      } as any)
    );
    expect(error.code).toBe("INVALID_COMPILE_OPTIONS");
  });
});

describe("custom metaschema contract", () => {
  it("requires a parent dialect declaration", () => {
    const error = captureError(() =>
      new SchemaShield().addMetaSchema({
        $id: "https://schemas.example/meta/missing-parent",
        type: ["object", "boolean"]
      })
    );
    expect(error.code).toBe("INVALID_SCHEMA");
    expect(error.keyword).toBe("$schema");
  });

  it("registers a custom dialect separately from ordinary resources", () => {
    const customMetaschema = "https://schemas.example/meta/custom";
    const shield = new SchemaShield();
    shield.addType("custom", (value) => value === "accepted");
    shield.addMetaSchema({
      $schema: DRAFT_2020,
      $id: customMetaschema,
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      type: ["object", "boolean"],
      properties: {
        type: { enum: ["custom"] }
      }
    });

    const validate = shield.compile({
      $schema: customMetaschema,
      type: "custom"
    });
    expect(validate("accepted").valid).toBe(true);
    expect(validate("rejected").valid).toBe(false);
  });

  it("does not promote an ordinary schema resource to a dialect", () => {
    const uri = "https://schemas.example/not-a-dialect";
    const shield = new SchemaShield();
    shield.addSchema({ $id: uri, type: ["object", "boolean"] });

    const error = captureError(() =>
      shield.compile({ $schema: uri, type: "string" })
    );
    expect(error.code).toBe("UNKNOWN_METASCHEMA");
  });

  it("rejects unregistered fragments on custom metaschema selectors", () => {
    const uri = "https://schemas.example/meta/exact";
    const shield = new SchemaShield();
    shield.addMetaSchema({
      $schema: DRAFT_2020,
      $id: uri,
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      type: ["object", "boolean"]
    });

    const error = captureError(() =>
      shield.compile({ $schema: `${uri}#unregistered`, $comment: "invalid" })
    );
    expect(error.code).toBe("UNKNOWN_METASCHEMA");
  });

  it("resolves a relative metaschema id against its retrieval URI", () => {
    const shield = new SchemaShield();
    shield.addMetaSchema(
      {
        $schema: DRAFT_2020,
        $id: "domain",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true
        },
        type: ["object", "boolean"]
      },
      { uri: "https://schemas.example/meta/retrieved" }
    );

    expect(
      shield.compile({
        $schema: "https://schemas.example/meta/domain",
        $comment: "valid custom schema"
      })({}).valid
    ).toBe(true);
  });

  it("rejects custom metaschemas with unknown required vocabularies", () => {
    for (const vocabulary of [
      "https://schemas.example/vocab/unknown",
      "https://schemas.example/vocab/core"
    ]) {
      const error = captureError(() =>
        new SchemaShield().addMetaSchema({
          $schema: DRAFT_2020,
          $id: `https://schemas.example/meta/${encodeURIComponent(vocabulary)}`,
          $vocabulary: {
            "https://json-schema.org/draft/2020-12/vocab/core": true,
            [vocabulary]: true
          }
        } as JSONSchema)
      );

      expect(error.code).toBe("UNKNOWN_REQUIRED_VOCABULARY");
    }
  });
});

describe("builtin identity protection", () => {
  it("rejects normalized aliases of builtin identities", () => {
    const error = captureError(() =>
      new SchemaShield().addSchema(
        { type: "string" },
        { uri: "http://JSON-SCHEMA.ORG:80/draft-07/schema" }
      )
    );
    expect(error.code).toBe("BUILTIN_SCHEMA_ID_COLLISION");
  });

  it("rejects nested identities that collide with builtin resources", () => {
    const error = captureError(() =>
      new SchemaShield().addSchema({
        $id: "https://schemas.example/root",
        definitions: {
          collision: {
            $id: "http://JSON-SCHEMA.ORG:80/draft-07/schema",
            type: "string"
          }
        }
      })
    );
    expect(error.code).toBe("BUILTIN_SCHEMA_ID_COLLISION");
  });
});
