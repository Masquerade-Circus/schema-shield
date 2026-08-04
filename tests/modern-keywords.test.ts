import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";

type OfficialGroup = {
  description: string;
  schema: any;
  tests: Array<{ description: string; data: any; valid: boolean }>;
};

const officialSuites = [
  ["draft7", "if-then-else.json"],
  ["draft2019-09", "if-then-else.json"],
  ["draft2019-09", "dependentRequired.json"],
  ["draft2019-09", "dependentSchemas.json"],
  ["draft2019-09", "minContains.json"],
  ["draft2019-09", "maxContains.json"],
  ["draft2019-09", "not.json"],
  ["draft2019-09", "unevaluatedItems.json"],
  ["draft2019-09", "unevaluatedProperties.json"],
  ["draft2019-09", "optional/dependencies-compatibility.json"],
  ["draft2020-12", "if-then-else.json"],
  ["draft2020-12", "dependentRequired.json"],
  ["draft2020-12", "dependentSchemas.json"],
  ["draft2020-12", "minContains.json"],
  ["draft2020-12", "maxContains.json"],
  ["draft2020-12", "items.json"],
  ["draft2020-12", "prefixItems.json"],
  ["draft2020-12", "not.json"],
  ["draft2020-12", "unevaluatedItems.json"],
  ["draft2020-12", "unevaluatedProperties.json"],
  ["draft2020-12", "optional/dependencies-compatibility.json"],
  ["draft7", "optional/content.json"],
  ["draft6", "optional/format/uri.json"],
  ["draft6", "optional/format/uri-reference.json"],
  ["draft7", "optional/format/uri.json"],
  ["draft7", "optional/format/uri-reference.json"],
  ["draft7", "optional/format/time.json"],
  ["draft7", "optional/format/iri.json"],
  ["draft2019-09", "optional/format/duration.json"],
  ["draft2019-09", "optional/format/uri.json"],
  ["draft2019-09", "optional/format/uri-reference.json"],
  ["draft2019-09", "optional/format/time.json"],
  ["draft2019-09", "optional/format/iri.json"],
  ["draft2020-12", "optional/format/duration.json"],
  ["draft2020-12", "optional/format/email.json"],
  ["draft2020-12", "optional/format/uri.json"],
  ["draft2020-12", "optional/format/uri-reference.json"],
  ["draft2020-12", "optional/format/time.json"],
  ["draft2020-12", "optional/format/iri.json"]
] as const;

describe("official modern keyword and bounded format cases", () => {
  for (const [draft, relativePath] of officialSuites) {
    const groups = require(
      `json-schema-test-suite/tests/${draft}/${relativePath}`
    ) as OfficialGroup[];

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      for (let testIndex = 0; testIndex < group.tests.length; testIndex++) {
        const test = group.tests[testIndex];
        const id = `${draft}:${relativePath}#/groups/${groupIndex}/tests/${testIndex}`;

        it(`${id} ${test.description}`, () => {
          const result = new SchemaShield().compile(group.schema)(test.data);
          expect(result.valid).toBe(test.valid);
        });
      }
    }
  }
});

describe("official modern vocabulary cases", () => {
  for (const draft of ["draft2019-09", "draft2020-12"] as const) {
    const groups = require(
      `json-schema-test-suite/tests/${draft}/vocabulary.json`
    ) as OfficialGroup[];
    const version = draft === "draft2019-09" ? "2019-09" : "2020-12";
    const dialect = `https://json-schema.org/draft/${version}/schema`;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      for (let testIndex = 0; testIndex < group.tests.length; testIndex++) {
        const test = group.tests[testIndex];
        const id = `${draft}:vocabulary.json#/groups/${groupIndex}/tests/${testIndex}`;

        it(`${id} ${test.description}`, () => {
          const shield = new SchemaShield();
          const metaschemaUri = group.schema.$schema;
          shield.addMetaSchema(
            {
              $schema: dialect,
              $id: metaschemaUri,
              $vocabulary:
                groupIndex === 0
                  ? {
                      [`https://json-schema.org/draft/${version}/vocab/applicator`]: true,
                      [`https://json-schema.org/draft/${version}/vocab/core`]: true
                    }
                  : {
                      [`https://json-schema.org/draft/${version}/vocab/validation`]: true,
                      [`https://json-schema.org/draft/${version}/vocab/core`]: true,
                      "https://example.com/vocab/optional-unknown": false
                    }
            },
            { uri: metaschemaUri }
          );
          expect(shield.compile(group.schema)(test.data).valid).toBe(test.valid);
        });
      }
    }
  }
});

describe("modern keyword dialect boundaries and invalid configurations", () => {
  it("ignores post-draft6 applicators in draft6", () => {
    const validate = new SchemaShield().compile({
      $schema: "http://json-schema.org/draft-06/schema#",
      if: true,
      then: false,
      dependentRequired: { credit_card: ["billing_address"] },
      prefixItems: [false]
    });

    expect(validate({ credit_card: 1 }).valid).toBe(true);
    expect(validate([1]).valid).toBe(true);
  });

  it("keeps tuple items semantics before draft2020-12", () => {
    for (const schemaUri of [
      "http://json-schema.org/draft-07/schema#",
      "https://json-schema.org/draft/2019-09/schema"
    ]) {
      const validate = new SchemaShield().compile({
        $schema: schemaUri,
        items: [{ type: "integer" }],
        additionalItems: false
      });

      expect(validate([1]).valid).toBe(true);
      expect(validate([1, 2]).valid).toBe(false);
    }
  });

  it("ignores malformed keyword values outside their applicable contracts", () => {
    const validate = new SchemaShield().compile(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        dependentRequired: [],
        dependentSchemas: [],
        prefixItems: {},
        minContains: "one",
        maxContains: -1
      },
      { validateSchema: false }
    );

    expect(validate({ value: true }).valid).toBe(true);
  });

  it("indexes subschemas under dependentSchemas and contentSchema", () => {
    const dependent = new SchemaShield().compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: { positive: { type: "integer", minimum: 1 } },
      dependentSchemas: {
        enabled: {
          properties: { count: { $ref: "#/$defs/positive" } },
          required: ["count"]
        }
      }
    });
    expect(dependent({ enabled: true, count: 1 }).valid).toBe(true);
    expect(dependent({ enabled: true, count: 0 }).valid).toBe(false);

    const contentTarget = new SchemaShield().compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      contentSchema: {
        $id: "content-target",
        type: "integer"
      },
      allOf: [{ $ref: "content-target" }]
    });
    expect(contentTarget(1).valid).toBe(true);
    expect(contentTarget("1").valid).toBe(false);
  });
});
