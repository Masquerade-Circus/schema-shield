import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield, ValidationError } from "../lib";

const DRAFT_2019 = "https://json-schema.org/draft/2019-09/schema";
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

describe("SchemaShield linking phase contracts", () => {
  describe("invalid linking input", () => {
    it("rejects invalid and duplicate modern anchors with controlled errors", () => {
      const invalidCases = [
        { $schema: DRAFT_2019, $anchor: "_invalid" },
        { $schema: DRAFT_2020, $anchor: "invalid:name" },
        { $schema: DRAFT_2020, $dynamicAnchor: "9invalid" }
      ];

      for (const schema of invalidCases) {
        const error = captureError(() => new SchemaShield().compile(schema));
        expect(error.code).toBe("INVALID_ANCHOR");
      }

      const duplicate = captureError(() =>
        new SchemaShield().compile({
          $schema: DRAFT_2020,
          $defs: {
            first: { $anchor: "same", type: "string" },
            second: { $anchor: "same", type: "number" }
          }
        })
      );
      expect(duplicate.code).toBe("DUPLICATE_ANCHOR");
    });

    it("does not index schema-looking objects inside enum, const, or default", () => {
      for (const keyword of ["enum", "const", "default"]) {
        const value = { $anchor: "hidden", $id: "hidden.json", $ref: "#missing" };
        const schema = {
          $schema: DRAFT_2020,
          [keyword]: keyword === "enum" ? [value] : value,
          allOf: [{ $ref: "#hidden" }]
        };
        const error = captureError(() => new SchemaShield().compile(schema));
        expect(error.code).toBe("REFERENCE_NOT_FOUND");
      }
    });
  });

  describe("dialect-aware $id and $ref", () => {
    it("ignores a sibling $id beside $ref in draft-06, draft-07, and the legacy default", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#",
        null
      ]) {
        const schema: Record<string, any> = {
          $id: "http://localhost:1234/sibling/base/",
          definitions: {
            direct: {
              $id: "http://localhost:1234/sibling/foo.json",
              type: "string"
            },
            inherited: { $id: "foo.json", type: "number" }
          },
          allOf: [
            {
              $id: "http://localhost:1234/sibling/",
              $ref: "foo.json"
            }
          ]
        };
        if ($schema !== null) {
          schema.$schema = $schema;
        }

        const validate = new SchemaShield().compile(schema);
        expect(validate(1).valid).toBe(true);
        expect(validate("wrong target").valid).toBe(false);
      }
    });

    it("does not expose nested ids from draft6 and draft7 reference siblings", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const shield = new SchemaShield();
        shield.addSchema(
          {
            $schema,
            $ref: "#/definitions/target",
            definitions: {
              target: { type: "string" },
              hidden: { $id: "hidden-sibling.json", type: "integer" }
            }
          },
          { uri: "https://schemas.example/reference-object.json" }
        );

        const validate = shield.compile({
          $ref: "https://schemas.example/reference-object.json"
        });
        expect(validate("ok").valid).toBe(true);
        expect(validate(1).valid).toBe(false);
        expect(
          captureError(() =>
            shield.compile({
              $ref: "https://schemas.example/hidden-sibling.json"
            })
          ).code
        ).toBe("REFERENCE_NOT_FOUND");
      }
    });

    it("links legacy reference objects reached through a local JSON Pointer", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const shield = new SchemaShield();
        const validate = shield.compile({
          $schema,
          $ref: "#/definitions/step",
          definitions: {
            step: {
              $id: "ignored-pointer-target.json",
              $ref: "#/definitions/final"
            },
            final: { type: "integer" }
          }
        });

        expect(validate(1).valid).toBe(true);
        expect(validate("wrong final target").valid).toBe(false);
        expect(
          captureError(() =>
            shield.compile({
              $schema,
              $ref: "schema-shield://local/ignored-pointer-target.json"
            })
          ).code
        ).toBe("REFERENCE_NOT_FOUND");
      }
    });

    it("links legacy reference objects reached through an external JSON Pointer", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const shield = new SchemaShield();
        shield.addSchema(
          {
            $schema,
            $ref: "#/definitions/unused",
            definitions: {
              step: {
                $id: "ignored-pointer-target.json",
                $ref: "#/definitions/final"
              },
              final: { type: "integer" },
              unused: true
            }
          },
          { uri: "https://schemas.example/legacy-reference.json" }
        );

        const validate = shield.compile({
          $schema,
          $ref: "https://schemas.example/legacy-reference.json#/definitions/step"
        });
        expect(validate(1).valid).toBe(true);
        expect(validate("wrong final target").valid).toBe(false);
        expect(
          captureError(() =>
            shield.compile({
              $schema,
              $ref: "https://schemas.example/ignored-pointer-target.json"
            })
          ).code
        ).toBe("REFERENCE_NOT_FOUND");
      }
    });

    it("guards a legacy reference cycle reached through a JSON Pointer", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const validate = new SchemaShield({ maxDepth: 3, failFast: false }).compile(
          {
            $schema,
            $ref: "#/definitions/cycle",
            definitions: {
              cycle: { $ref: "#/definitions/cycle" }
            }
          }
        );

        const result = validate("cycle");
        expect(result.valid).toBe(false);
        expect((result.error as ValidationError).getCause().code).toBe(
          "MAX_DEPTH_EXCEEDED"
        );
      }
    });

    it("links refs below properties in a legacy pointer target", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const shield = new SchemaShield();
        const validate = shield.compile({
          $schema,
          $ref: "#/definitions/target",
          definitions: {
            target: {
              type: "object",
              properties: {
                value: {
                  $ref: "#/definitions/final",
                  definitions: {
                    hidden: {
                      $id: "hidden-reference-sibling.json",
                      type: "string"
                    }
                  }
                }
              },
              required: ["value"]
            },
            final: { type: "integer" }
          }
        });

        expect(validate({ value: 1 }).valid).toBe(true);
        expect(validate({ value: "wrong final target" }).valid).toBe(false);
        expect(
          captureError(() =>
            shield.compile({
              $schema,
              $ref: "schema-shield://local/hidden-reference-sibling.json"
            })
          ).code
        ).toBe("REFERENCE_NOT_FOUND");
      }
    });

    it("links refs below legacy tuple items and schema dependencies", () => {
      for (const $schema of [
        "http://json-schema.org/draft-06/schema#",
        "http://json-schema.org/draft-07/schema#"
      ]) {
        const shield = new SchemaShield();
        shield.addSchema(
          {
            $schema,
            $ref: "#/definitions/unused",
            definitions: {
              target: {
                type: "object",
                properties: {
                  values: {
                    type: "array",
                    items: [{ $ref: "#/definitions/final" }],
                    additionalItems: false
                  }
                },
                dependencies: {
                  trigger: {
                    properties: {
                      dependent: { $ref: "#/definitions/final" }
                    },
                    required: ["dependent"]
                  }
                }
              },
              final: { type: "integer" },
              unused: true,
              hidden: { $id: "hidden-origin-sibling.json", type: "string" }
            }
          },
          { uri: "https://schemas.example/legacy-subtree.json" }
        );

        const validate = shield.compile({
          $schema,
          $ref: "https://schemas.example/legacy-subtree.json#/definitions/target"
        });
        expect(validate({ values: [1], trigger: true, dependent: 2 }).valid).toBe(
          true
        );
        expect(validate({ values: ["wrong tuple target"] }).valid).toBe(false);
        expect(validate({ trigger: true, dependent: "wrong dependency" }).valid).toBe(
          false
        );
        expect(
          captureError(() =>
            shield.compile({
              $schema,
              $ref: "https://schemas.example/hidden-origin-sibling.json"
            })
          ).code
        ).toBe("REFERENCE_NOT_FOUND");
      }
    });

    it("processes $id before $ref and keeps other siblings active in modern drafts", () => {
      for (const $schema of [DRAFT_2019, DRAFT_2020]) {
        const validate = new SchemaShield().compile({
          $schema,
          $id: "https://example.com/root/base.json",
          $ref: "nested/value.json",
          minimum: 3,
          $defs: {
            value: {
              $id: "nested/value.json",
              type: "number",
              maximum: 10
            }
          }
        });

        expect(validate(5).valid).toBe(true);
        expect(validate(2).valid).toBe(false);
        expect(validate(20).valid).toBe(false);
      }
    });

    it("lets a nested resource declare a legacy dialect inside a modern document", () => {
      const validate = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $id: "https://example.com/root/",
        $defs: {
          direct: { $id: "target.json", type: "number" },
          nested: {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "legacy/",
            $ref: "target.json"
          }
        },
        $ref: "#/$defs/nested"
      });

      expect(validate(1).valid).toBe(true);
      expect(validate("1").valid).toBe(false);
    });
  });

  describe("modern anchors and resources", () => {
    it("resolves local, nested, same-name, URN, and static dynamic anchors", () => {
      const local = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $ref: "#foo",
        $defs: { value: { $anchor: "foo", type: "integer" } }
      });
      expect(local(1).valid).toBe(true);
      expect(local("1").valid).toBe(false);

      const nested = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $id: "https://example.com/root",
        $ref: "nested.json#foo",
        $defs: {
          resource: {
            $id: "nested.json",
            $defs: { value: { $anchor: "foo", type: "integer" } }
          }
        }
      });
      expect(nested(1).valid).toBe(true);
      expect(nested("1").valid).toBe(false);

      const sameName = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $id: "https://example.com/root/",
        $ref: "string#same",
        $defs: {
          number: { $id: "number", $anchor: "same", type: "number" },
          string: { $id: "string", $anchor: "same", type: "string" }
        }
      });
      expect(sameName("ok").valid).toBe(true);
      expect(sameName(1).valid).toBe(false);

      const urn = new SchemaShield().compile({
        $schema: DRAFT_2019,
        $id: "urn:uuid:deadbeef-1234-ff00-00ff-4321feebdaed",
        $ref: "#something",
        $defs: { value: { $anchor: "something", type: "string" } }
      });
      expect(urn("ok").valid).toBe(true);
      expect(urn(1).valid).toBe(false);

      const dynamic = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $ref: "#items",
        $defs: {
          value: { $dynamicAnchor: "items", type: "string" }
        }
      });
      expect(dynamic("ok").valid).toBe(true);
      expect(dynamic(1).valid).toBe(false);
    });

    it("resolves remote and detached anchors from locally registered resources", () => {
      const shield = new SchemaShield();
      shield.addSchema(
        {
          $schema: DRAFT_2020,
          $defs: {
            direct: { $anchor: "foo", type: "integer" },
            detached: {
              $id: "detached.json",
              $anchor: "detached",
              type: "number"
            },
            viaRef: { $ref: "detached.json#detached" }
          }
        },
        { uri: "https://retrieval.example/remote.json" }
      );

      const remote = shield.compile({
        $schema: DRAFT_2020,
        $ref: "https://retrieval.example/remote.json#foo"
      });
      expect(remote(1).valid).toBe(true);
      expect(remote("1").valid).toBe(false);

      const detached = shield.compile({
        $schema: DRAFT_2020,
        $ref: "https://retrieval.example/remote.json#/$defs/viaRef"
      });
      expect(detached(1).valid).toBe(true);
      expect(detached("1").valid).toBe(false);
    });

    it("inherits the referring modern dialect for registered resources without $schema", () => {
      for (const $schema of [DRAFT_2019, DRAFT_2020]) {
        const draftPath = $schema === DRAFT_2019 ? "draft2019-09" : "draft2020-12";
        const retrievalUri = `http://localhost:1234/${draftPath}/nested-absolute-ref-to-string.json`;
        const nestedId = `http://localhost:1234/${draftPath}/the-nested-id.json`;
        const shield = new SchemaShield();
        shield.addSchema(
          {
            $defs: {
              bar: { $id: nestedId, type: "string" }
            },
            $ref: nestedId
          },
          { uri: retrievalUri }
        );

        const validate = shield.compile({ $schema, $ref: retrievalUri });
        expect(validate(1).valid).toBe(false);
        expect(validate("valid").valid).toBe(true);
      }
    });

    it("resolves a root anchor through retrieval, canonical, and alias identities", () => {
      const shield = new SchemaShield();
      shield.addSchema(
        {
          $schema: DRAFT_2020,
          $id: "canonical.json",
          $defs: { value: { $anchor: "value", type: "integer" } }
        },
        {
          uri: "https://retrieval.example/root.json",
          aliases: ["https://schemas.example/root"]
        }
      );

      for (const ref of [
        "https://retrieval.example/root.json#value",
        "https://retrieval.example/canonical.json#value",
        "https://schemas.example/root#value"
      ]) {
        const validate = shield.compile({ $schema: DRAFT_2020, $ref: ref });
        expect(validate(1).valid).toBe(true);
        expect(validate("1").valid).toBe(false);
      }
    });

    it("resolves relative remote refs against retrieval and canonical resource bases", () => {
      const shield = new SchemaShield();
      shield.addSchema(
        { $schema: DRAFT_2020, type: "integer" },
        { uri: "https://retrieval.example/base/integer.json" }
      );
      shield.addSchema(
        {
          $schema: DRAFT_2020,
          $id: "canonical/root.json",
          $defs: {
            nested: {
              $id: "nested/value.json",
              $ref: "../../integer.json"
            }
          },
          $ref: "nested/value.json"
        },
        { uri: "https://retrieval.example/base/source.json" }
      );

      const validate = shield.compile({
        $schema: DRAFT_2020,
        $ref: "https://retrieval.example/base/canonical/nested/value.json"
      });
      expect(validate(1).valid).toBe(true);
      expect(validate("1").valid).toBe(false);
    });

    it("resolves modern nested resources, nearest-parent bases, and canonical pointers", () => {
      const relative = new SchemaShield().compile({
        $schema: DRAFT_2020,
        $id: "http://example.com/schema-relative-uri-defs1.json",
        properties: {
          foo: {
            $id: "schema-relative-uri-defs2.json",
            $defs: {
              inner: { properties: { bar: { type: "string" } } }
            },
            $ref: "#/$defs/inner"
          }
        },
        $ref: "schema-relative-uri-defs2.json"
      });
      expect(relative({ foo: { bar: "a" }, bar: "a" }).valid).toBe(true);
      expect(relative({ foo: { bar: 1 }, bar: "a" }).valid).toBe(false);
      expect(relative({ foo: { bar: "a" }, bar: 1 }).valid).toBe(false);

      const nearestParent = new SchemaShield().compile({
        $schema: DRAFT_2019,
        $id: "http://example.com/a.json",
        $defs: {
          outer: {
            $id: "http://example.com/b/c.json",
            not: {
              $defs: {
                target: { $id: "d.json", type: "number" }
              }
            }
          }
        },
        allOf: [{ $ref: "http://example.com/b/d.json" }]
      });
      expect(nearestParent(1).valid).toBe(true);
      expect(nearestParent("1").valid).toBe(false);

      const shield = new SchemaShield();
      shield.addSchema(
        {
          $schema: DRAFT_2020,
          $id: "canonical.json",
          $defs: { value: { type: "integer" } }
        },
        { uri: "https://retrieval.example/document.json" }
      );
      for (const ref of [
        "https://retrieval.example/document.json#/$defs/value",
        "https://retrieval.example/canonical.json#/$defs/value"
      ]) {
        const validate = shield.compile({ $schema: DRAFT_2020, $ref: ref });
        expect(validate(1).valid).toBe(true);
        expect(validate("1").valid).toBe(false);
      }
    });
  });
});
