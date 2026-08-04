import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield, ValidationError } from "../lib";

const DRAFT_4 = "http://json-schema.org/draft-04/schema#";
const DRAFT_6 = "http://json-schema.org/draft-06/schema#";
const DRAFT_7 = "http://json-schema.org/draft-07/schema#";
const DRAFT_2019 = "https://json-schema.org/draft/2019-09/schema";
const DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";
const CUSTOM_ASSERTION = "https://schemas.example/meta/format-assertion";
const CUSTOM_ANNOTATION = "https://schemas.example/meta/format-annotation";

type FormatOptions = { format?: boolean };

const modes: Array<{
  label: string;
  options: FormatOptions;
  value: "omitted" | boolean;
}> = [
  { label: "omitted", options: {}, value: "omitted" },
  { label: "true", options: { format: true }, value: true },
  { label: "false", options: { format: false }, value: false }
];

const contexts = [
  { label: "native", schema: {}, validatesByDefault: true, assertion: false },
  {
    label: "draft-04",
    schema: { $schema: DRAFT_4 },
    validatesByDefault: false,
    assertion: false
  },
  {
    label: "draft-06",
    schema: { $schema: DRAFT_6 },
    validatesByDefault: false,
    assertion: false
  },
  {
    label: "draft-07",
    schema: { $schema: DRAFT_7 },
    validatesByDefault: false,
    assertion: false
  },
  {
    label: "2019-09 general",
    schema: { $schema: DRAFT_2019 },
    validatesByDefault: false,
    assertion: false
  },
  {
    label: "2020-12 general",
    schema: { $schema: DRAFT_2020 },
    validatesByDefault: false,
    assertion: false
  },
  {
    label: "custom assertion",
    schema: { $schema: CUSTOM_ASSERTION },
    validatesByDefault: true,
    assertion: true
  },
  {
    label: "custom without assertion",
    schema: { $schema: CUSTOM_ANNOTATION },
    validatesByDefault: false,
    assertion: false
  }
] as const;

function addCustomDialects(shield: SchemaShield) {
  shield.addMetaSchema({
    $schema: DRAFT_2020,
    $id: CUSTOM_ASSERTION,
    $vocabulary: {
      "https://json-schema.org/draft/2020-12/vocab/core": true,
      "https://json-schema.org/draft/2020-12/vocab/format-assertion": true
    },
    type: ["object", "boolean"],
    properties: { format: { type: "string" } }
  });
  shield.addMetaSchema({
    $schema: DRAFT_2020,
    $id: CUSTOM_ANNOTATION,
    $vocabulary: {
      "https://json-schema.org/draft/2020-12/vocab/core": true
    },
    type: ["object", "boolean"],
    properties: { format: { type: "string" } }
  });
}

function createShield(options: FormatOptions, customFormat = false) {
  const shield = new SchemaShield(options);
  if (customFormat) {
    shield.addFormat("accepted", (value) => value === "accepted");
  }
  addCustomDialects(shield);
  return shield;
}

function captureError(action: () => void) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error("Expected SchemaShield to throw");
}

describe("format constructor option", () => {
  it("rejects values outside the tri-state contract", () => {
    for (const value of [null, 0, 1, "true", {}, []]) {
      const error = captureError(
        () => new SchemaShield({ format: value } as any)
      );
      expect(error.code).toBe("INVALID_FORMAT");
      expect(error.keyword).toBe("format");
    }
  });

  for (const knownFormat of [
    { label: "builtin", name: "email", invalid: "not-an-email" },
    { label: "custom", name: "accepted", invalid: "rejected" }
  ]) {
    it(`implements the known ${knownFormat.label} format matrix`, () => {
      for (const context of contexts) {
        for (const mode of modes) {
          const shield = createShield(
            mode.options,
            knownFormat.label === "custom"
          );
          const schema = { ...context.schema, format: knownFormat.name };

          if (context.assertion && mode.value === false) {
            const error = captureError(() => shield.compile(schema));
            expect(error.code).toBe("FORMAT_ASSERTION_REQUIRED");
            continue;
          }

          const validate = shield.compile(schema);
          const expectedValidation =
            mode.value === true ||
            (mode.value === "omitted" && context.validatesByDefault);
          expect(validate(knownFormat.invalid).valid).toBe(!expectedValidation);
        }
      }
    });
  }

  it("implements the unknown format matrix", () => {
    for (const context of contexts) {
      for (const mode of modes) {
        const shield = createShield(mode.options);
        const schema = { ...context.schema, format: "unknown-format" };

        if (context.assertion) {
          const error = captureError(() => shield.compile(schema));
          expect(error.code).toBe(
            mode.value === false
              ? "FORMAT_ASSERTION_REQUIRED"
              : "UNKNOWN_FORMAT"
          );
          continue;
        }

        expect(() => shield.compile(schema)).not.toThrow();
      }
    }
  });

  it("applies each resource format policy in a mixed graph", () => {
    const annotatedResource = {
      $schema: DRAFT_2020,
      $id: "https://schemas.example/annotated",
      format: "email"
    };
    const nativeRoot = {
      type: "object",
      properties: {
        native: { format: "email" },
        annotated: { $ref: annotatedResource.$id }
      }
    };

    const defaultShield = new SchemaShield();
    defaultShield.addSchema(annotatedResource);
    const defaultValidate = defaultShield.compile(nativeRoot);
    expect(
      defaultValidate({ native: "person@example.com", annotated: "invalid" })
        .valid
    ).toBe(true);
    expect(
      defaultValidate({ native: "invalid", annotated: "person@example.com" })
        .valid
    ).toBe(false);

    const enabledShield = new SchemaShield({ format: true });
    enabledShield.addSchema(annotatedResource);
    expect(
      enabledShield.compile(nativeRoot)({
        native: "person@example.com",
        annotated: "invalid"
      }).valid
    ).toBe(false);
  });

  it("rejects assertion conflicts and unknown formats in referenced resources", () => {
    const assertionResource = {
      $schema: CUSTOM_ASSERTION,
      $id: "https://schemas.example/assertion-resource",
      format: "unknown-format"
    };

    for (const mode of modes) {
      const shield = createShield(mode.options);
      shield.addSchema(assertionResource);
      const error = captureError(() =>
        shield.compile({ $ref: assertionResource.$id })
      );
      expect(error.code).toBe(
        mode.value === false ? "FORMAT_ASSERTION_REQUIRED" : "UNKNOWN_FORMAT"
      );
    }
  });
});
