import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield, ValidationError } from "../lib";

const DRAFT_7 = "http://json-schema.org/draft-07/schema#";
const DRAFT_2019 = "https://json-schema.org/draft/2019-09/schema";
const DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";

function expectControlledDepthFailure(
  result: ReturnType<ReturnType<SchemaShield["compile"]>>
) {
  expect(result.valid).toBe(false);
  expect(result.error).toBeInstanceOf(ValidationError);
  expect(result.error && result.error.getCause().code).toBe(
    "MAX_DEPTH_EXCEEDED"
  );
}

function captureCompileError(action: () => void): ValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error("Expected schema compilation to fail");
}

describe("dialect-aware pre-analysis", () => {
  it("analyzes defaults, unevaluated tracking, and dynamic recursion in dependentSchemas", () => {
    const validate = new SchemaShield({
      failFast: false,
      maxDepth: 5,
      useDefaults: true
    }).compile({
      $schema: DRAFT_2020,
      $dynamicAnchor: "node",
      dependentSchemas: {
        trigger: {
          properties: {
            trigger: true,
            child: { $dynamicRef: "#node" },
            filled: { type: "string", default: "yes" }
          },
          unevaluatedProperties: false
        }
      }
    });

    const validInput: Record<string, any> = {
      trigger: true,
      child: { trigger: true }
    };
    const validResult = validate(validInput);
    expect(validResult.valid).toBe(true);
    expect(validInput).toEqual({
      trigger: true,
      filled: "yes",
      child: { trigger: true, filled: "yes" }
    });
    expect(validate({ trigger: true, extra: true }).valid).toBe(false);

    expectControlledDepthFailure(
      validate({
        trigger: true,
        child: {
          trigger: true,
          child: {
            trigger: true,
            child: { trigger: true, child: { trigger: true } }
          }
        }
      })
    );
  });

  it("analyzes defaults, unevaluated tracking, and dynamic recursion in prefixItems", () => {
    const validate = new SchemaShield({
      failFast: false,
      maxDepth: 5,
      useDefaults: true
    }).compile({
      $schema: DRAFT_2020,
      $dynamicAnchor: "node",
      prefixItems: [
        {
          properties: {
            nested: { $dynamicRef: "#node" },
            filled: { type: "string", default: "yes" }
          },
          unevaluatedProperties: false
        }
      ],
      items: false
    });

    const validInput: Record<string, any>[] = [{ nested: [{}] }];
    const validResult = validate(validInput);
    expect(validResult.valid).toBe(true);
    expect(validInput).toEqual([
      { nested: [{ filled: "yes" }], filled: "yes" }
    ]);
    expect(validate([{ extra: true }]).valid).toBe(false);

    expectControlledDepthFailure(
      validate([{ nested: [{ nested: [{ nested: [{}] }] }] }])
    );
  });
});

describe("speculative mutation rollback", () => {
  it("always discards defaults and custom mutations from not", () => {
    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const shield = new SchemaShield({
          immutable,
          failFast,
          useDefaults: true
        });
        shield.addKeyword(
          "speculativeMutation",
          (_schema, data, _defineError, instance) => {
            instance.setDefault(data, "custom", "discarded");
          }
        );

        for (const innerPasses of [false, true]) {
          const validate = shield.compile({
            not: {
              speculativeMutation: true,
              properties: {
                transient: { default: "discarded" }
              },
              ...(innerPasses ? {} : { required: ["missing"] })
            }
          });
          const input: Record<string, any> = {};
          const result = validate(input);

          expect(result.valid).toBe(!innerPasses);
          expect(result.data).toEqual({});
          expect(input).toEqual({});
        }
      }
    }
  });

  it("rolls back failed contains and keeps mutations only from successful matches", () => {
    for (const immutable of [false, true]) {
      for (const failFast of [false, true]) {
        const shield = new SchemaShield({
          immutable,
          failFast,
          useDefaults: true
        });
        shield.addKeyword(
          "markContainsItem",
          (_schema, data, _defineError, instance) => {
            instance.setDefault(data, "custom", "kept");
          }
        );
        const contains = {
          markContainsItem: true,
          properties: {
            kind: { const: "yes" },
            filled: { default: "kept" }
          },
          required: ["kind"]
        };

        for (const limit of [
          { minContains: 2 },
          { maxContains: 0 }
        ]) {
          const validate = shield.compile({
            $schema: DRAFT_2020,
            contains,
            ...limit
          });
          const input = [{ kind: "yes" }, { kind: "no" }];
          const result = validate(input);

          expect(result.valid).toBe(false);
          expect(result.data).toEqual([{ kind: "yes" }, { kind: "no" }]);
          expect(input).toEqual([{ kind: "yes" }, { kind: "no" }]);
        }

        const validateSuccess = shield.compile({
          $schema: DRAFT_2020,
          contains,
          minContains: 1
        });
        const successfulInput = [{ kind: "yes" }, { kind: "no" }];
        const successfulResult = validateSuccess(successfulInput);

        expect(successfulResult.valid).toBe(true);
        expect(successfulResult.data).toEqual([
          { kind: "yes", filled: "kept", custom: "kept" },
          { kind: "no" }
        ]);
        expect(successfulInput).toEqual(
          immutable
            ? [{ kind: "yes" }, { kind: "no" }]
            : [
                { kind: "yes", filled: "kept", custom: "kept" },
                { kind: "no" }
              ]
        );
      }
    }
  });
});

describe("dialect keyword activation and indexing", () => {
  it("enables compatibility dependencies only for modern metaschemas that define it", () => {
    for (const $schema of [DRAFT_2019, DRAFT_2020]) {
      const validate = new SchemaShield().compile({
        $schema,
        dependencies: { trigger: ["missing"] }
      });
      expect(validate({ trigger: true }).valid).toBe(false);
      expect(validate({ trigger: true, missing: true }).valid).toBe(true);
    }

    const shield = new SchemaShield();
    shield.addMetaSchema(
      {
        $schema: DRAFT_2020,
        $id: "https://example.com/meta/no-compatibility",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true,
          "https://json-schema.org/draft/2020-12/vocab/applicator": true
        }
      },
      { uri: "https://example.com/meta/no-compatibility" }
    );
    const unknownDependency = shield.compile({
      $schema: "https://example.com/meta/no-compatibility",
      dependencies: {
        trigger: { $id: "hidden-dependency", type: "integer" }
      }
    });
    expect(unknownDependency({ trigger: true }).valid).toBe(true);
  });

  it("does not traverse draft-inactive $defs or additionalItems containers", () => {
    const defsError = captureCompileError(() =>
      new SchemaShield().compile({
        $schema: DRAFT_7,
        $defs: { hidden: { $id: "hidden-def", type: "integer" } },
        allOf: [{ $ref: "hidden-def" }]
      })
    );
    expect(defsError.code).toBe("REFERENCE_NOT_FOUND");

    const additionalItemsError = captureCompileError(() =>
      new SchemaShield().compile({
        $schema: DRAFT_2020,
        additionalItems: {
          $id: "hidden-additional-item",
          type: "integer"
        },
        allOf: [{ $ref: "hidden-additional-item" }]
      })
    );
    expect(additionalItemsError.code).toBe("REFERENCE_NOT_FOUND");
  });
});

describe("modern resource vocabularies", () => {
  it("uses only the vocabularies declared by the resource metaschema", () => {
    for (const [draft, customMetaschema, core, applicator] of [
      [
        DRAFT_2019,
        "https://example.com/meta/2019-no-validation",
        "https://json-schema.org/draft/2019-09/vocab/core",
        "https://json-schema.org/draft/2019-09/vocab/applicator"
      ],
      [
        DRAFT_2020,
        "https://example.com/meta/2020-no-validation",
        "https://json-schema.org/draft/2020-12/vocab/core",
        "https://json-schema.org/draft/2020-12/vocab/applicator"
      ]
    ]) {
      const shield = new SchemaShield();
      shield.addMetaSchema(
        {
          $schema: draft,
          $id: customMetaschema,
          $vocabulary: { [core]: true, [applicator]: true }
        },
        { uri: customMetaschema }
      );

      const validate = shield.compile({
        $schema: customMetaschema,
        properties: {
          forbidden: false,
          count: { minimum: 10 }
        }
      });
      expect(validate({ forbidden: true }).valid).toBe(false);
      expect(validate({ count: 1 }).valid).toBe(true);
    }
  });

  it("does not traverse subschemas under keywords from an inactive vocabulary", () => {
    const shield = new SchemaShield();
    shield.addMetaSchema(
      {
        $schema: DRAFT_2020,
        $id: "https://example.com/meta/core-only",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true
        }
      },
      { uri: "https://example.com/meta/core-only" }
    );

    const error = captureCompileError(() =>
      shield.compile({
        $schema: "https://example.com/meta/core-only",
        properties: {
          hidden: { $id: "hidden-applicator-resource", type: "integer" }
        },
        $ref: "hidden-applicator-resource"
      })
    );
    expect(error.code).toBe("REFERENCE_NOT_FOUND");
  });

  it("does not apply defaults or enable evaluated tracking for inactive vocabularies", () => {
    const shield = new SchemaShield({ useDefaults: true });
    shield.addMetaSchema(
      {
        $schema: DRAFT_2020,
        $id: "https://example.com/meta/core-only-runtime",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true
        }
      },
      { uri: "https://example.com/meta/core-only-runtime" }
    );
    const validate = shield.compile({
      $schema: "https://example.com/meta/core-only-runtime",
      properties: {
        filled: { default: "must-not-apply" }
      },
      unevaluatedProperties: false
    });
    const input = { extra: true };

    expect(validate(input)).toEqual({ data: input, error: null, valid: true });
    expect(input).toEqual({ extra: true });
    expect((validate.compiledSchema as any)._defaultKeys).toBeUndefined();
    expect((validate.compiledSchema as any)._propKeys).toBeUndefined();
  });

  it("keeps definitions inactive in modern resources unless their metaschema defines it", () => {
    for (const $schema of [DRAFT_2019, DRAFT_2020]) {
      const hiddenError = captureCompileError(() =>
        new SchemaShield().compile({
          $schema,
          definitions: {
            hidden: { $id: "hidden-modern-definition", type: "integer" }
          },
          $ref: "hidden-modern-definition"
        })
      );
      expect(hiddenError.code).toBe("REFERENCE_NOT_FOUND");
    }

    const shield = new SchemaShield();
    shield.addMetaSchema(
      {
        $schema: DRAFT_2020,
        $id: "https://example.com/meta/definitions-compatibility",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true,
          "https://json-schema.org/draft/2020-12/vocab/validation": true
        },
        properties: { definitions: true }
      },
      { uri: "https://example.com/meta/definitions-compatibility" }
    );
    const validate = shield.compile({
      $schema: "https://example.com/meta/definitions-compatibility",
      definitions: {
        visible: { $id: "visible-modern-definition", type: "integer" }
      },
      $ref: "visible-modern-definition"
    });
    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
  });

  it("ignores local $vocabulary and rejects only required unknown metaschema vocabularies", () => {
    const localVocabulary = new SchemaShield().compile({
      $schema: DRAFT_2020,
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": false
      },
      minimum: 10
    });
    expect(localVocabulary(1).valid).toBe(false);

    for (const required of [false, true]) {
      const shield = new SchemaShield();
      const metaschema = {
        $schema: DRAFT_2020,
        $id: `https://example.com/meta/unknown-${required}`,
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/core": true,
          "https://example.com/vocab/unknown": required
        }
      };

      if (required) {
        const error = captureCompileError(() =>
          shield.addMetaSchema(metaschema, {
            uri: `https://example.com/meta/unknown-${required}`
          })
        );
        expect(error.code).toBe("UNKNOWN_REQUIRED_VOCABULARY");
      } else {
        shield.addMetaSchema(metaschema, {
          uri: `https://example.com/meta/unknown-${required}`
        });
        expect(
          shield.compile({
            $schema: `https://example.com/meta/unknown-${required}`
          })({}).valid
        ).toBe(true);
      }
    }
  });
});
