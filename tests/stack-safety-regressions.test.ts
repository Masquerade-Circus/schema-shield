import { describe, it } from "mocha";

import expect from "expect";
import { SchemaShield, ValidationError } from "../lib";

const DEPTHS = [1_000, 10_000, 50_000];

function nestedObjectCase(depth: number, invalid = false) {
  let schema: any = { type: "string", format: "deep-leaf" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: { next: schema },
      required: ["next"]
    };
    data = { next: data };
  }

  return { schema, data };
}

function nestedArrayCase(depth: number, invalid = false) {
  let schema: any = { type: "deep-string", deepKeyword: true };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = { type: "array", items: schema };
    data = [data];
  }

  return { schema, data };
}

function referenceChainCase(depth: number, invalid = false) {
  const definitions: Record<string, any> = {
    leaf: { type: "string" }
  };

  for (let i = depth - 1; i >= 0; i--) {
    definitions[`ref${i}`] = {
      $ref:
        i === depth - 1
          ? "#/definitions/leaf"
          : `#/definitions/ref${i + 1}`
    };
  }

  return {
    schema: { definitions, $ref: "#/definitions/ref0" },
    data: invalid ? 1 : "leaf"
  };
}

function nestedAllOfCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  for (let i = 0; i < depth; i++) {
    schema = { allOf: [schema] };
  }
  return { schema, data: invalid ? 1 : "leaf" };
}

function recursiveReferenceCase(depth: number, invalid = false) {
  const schema = {
    type: "object",
    properties: {
      next: { $ref: "#" }
    },
    additionalProperties: false
  };
  let data: any = invalid ? { unexpected: true } : {};

  for (let i = 0; i < depth; i++) {
    data = { next: data };
  }

  return { schema, data };
}

function branchedObjectCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: {
        next: schema,
        marker: { type: "number" }
      },
      required: ["next", "marker"]
    };
    data = { next: data, marker: i };
  }

  return { schema, data };
}

function multiItemArrayCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "array",
      items: [schema, { type: "number" }],
      additionalItems: false
    };
    data = [data, i];
  }

  return { schema, data };
}

function recursiveBranchedReferenceCase(depth: number, invalid = false) {
  const schema = {
    type: "object",
    properties: {
      next: { $ref: "#" },
      marker: { type: "number" }
    },
    additionalProperties: false
  };
  let data: any = invalid ? { unexpected: true } : {};

  for (let i = 0; i < depth; i++) {
    data = { next: data, marker: i };
  }

  return { schema, data };
}

function requiredDefaultCase(depth: number) {
  let schema: any = { type: "object", properties: {
    value: { type: "string", default: "leaf" }
  }, required: ["value"] };
  let data: any = {};

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: { next: schema },
      required: ["next"]
    };
    data = { next: data };
  }

  return { schema, data };
}

function nestedCombinatorCase(
  keyword: "allOf" | "anyOf" | "oneOf",
  depth: number,
  invalid = false
) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    const branch = {
      type: "object",
      properties: { next: schema },
      required: ["next"]
    };
    schema =
      keyword === "allOf"
        ? { allOf: [branch, { type: "object" }] }
        : keyword === "anyOf"
          ? { anyOf: [false, branch] }
          : { oneOf: [false, branch] };
    data = { next: data };
  }

  return { schema, data };
}

function nestedRequiredDefaultCase(depth: number, invalidDefault = false) {
  let schema: any = {
    type: "object",
    properties: {
      value: {
        type: "string",
        default: invalidDefault ? 1 : "leaf"
      }
    },
    required: ["value"]
  };

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: {
        next: {
          ...schema,
          default: {}
        }
      },
      required: ["next"]
    };
  }

  return { schema, data: {} };
}

function nestedAdditionalPropertiesCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = { type: "object", additionalProperties: schema };
    data = { value: data };
  }

  return { schema, data };
}

function nestedContainsCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = { type: "array", contains: schema };
    data = [data];
  }

  return { schema, data };
}

function nestedConditionalCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  const data = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = { if: true, then: schema };
  }

  return { schema, data };
}

function nestedPatternPropertiesCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      patternProperties: { "^value$": schema },
      additionalProperties: false
    };
    data = { value: data };
  }

  return { schema, data };
}

function nestedAdditionalItemsCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  let data: any = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "array",
      items: [{ type: "number" }],
      additionalItems: schema
    };
    data = [i, data];
  }

  return { schema, data };
}

function nestedNotCase(depth: number, invalid = false) {
  let schema: any = { type: "string" };
  const data = invalid ? 1 : "leaf";

  for (let i = 0; i < depth; i++) {
    schema = { not: schema };
  }

  return { schema, data };
}

function configuredShield(failFast: boolean) {
  const shield = new SchemaShield({ failFast, maxDepth: 50_000 });
  shield.addType("deep-string", (data) => typeof data === "string");
  shield.addFormat("deep-leaf", (data) => data === "leaf");
  shield.addKeyword("deepKeyword", (_schema, data, defineError) => {
    if (data !== "leaf") {
      return defineError("Value must be the deep leaf", { data });
    }
  });
  return shield;
}

describe("stack safety regressions", () => {
  it("preserves shallow result and error semantics", () => {
    const cases = [
      nestedObjectCase(2, true),
      nestedArrayCase(2, true),
      referenceChainCase(2, true)
    ];

    for (const failFast of [true, false]) {
      for (const testCase of cases) {
        const validate = configuredShield(failFast).compile(testCase.schema);
        const result = validate(testCase.data);

        expect(result.data).toBe(testCase.data);
        expect(result.valid).toBe(false);
        if (failFast) {
          expect(result.error).toBe(true);
        } else {
          expect(result.error).toBeInstanceOf(ValidationError);
          const path = (result.error as ValidationError).getPath();
          expect(path.schemaPath.startsWith("#/")).toBe(true);
          expect(path.instancePath.startsWith("#")).toBe(true);
        }
      }
    }
  });

  for (const depth of DEPTHS) {
    it(`compiles and validates ${depth.toLocaleString("en-US")} nested objects`, () => {
      for (const failFast of [true, false]) {
        const validCase = nestedObjectCase(depth);
        const invalidCase = nestedObjectCase(depth, true);
        const validate = configuredShield(failFast).compile(validCase.schema);

        expect(validate(validCase.data).valid).toBe(true);

        const result = validate(invalidCase.data);
        expect(result.valid).toBe(false);
        if (failFast) {
          expect(result.error).toBe(true);
        } else {
          expect(result.error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it(`compiles and validates ${depth.toLocaleString("en-US")} nested arrays`, () => {
      for (const failFast of [true, false]) {
        const validCase = nestedArrayCase(depth);
        const invalidCase = nestedArrayCase(depth, true);
        const validate = configuredShield(failFast).compile(validCase.schema);

        expect(validate(validCase.data).valid).toBe(true);

        const result = validate(invalidCase.data);
        expect(result.valid).toBe(false);
        if (failFast) {
          expect(result.error).toBe(true);
        } else {
          expect(result.error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it(`compiles and validates a ${depth.toLocaleString("en-US")}-link local $ref chain`, () => {
      for (const failFast of [true, false]) {
        const validCase = referenceChainCase(depth);
        const invalidCase = referenceChainCase(depth, true);
        const validate = configuredShield(failFast).compile(validCase.schema);

        expect(validate(validCase.data).valid).toBe(true);

        const result = validate(invalidCase.data);
        expect(result.valid).toBe(false);
        if (failFast) {
          expect(result.error).toBe(true);
        } else {
          expect(result.error).toBeInstanceOf(ValidationError);
        }
      }
    });
  }

  it("compiles and validates 50,000 nested compile-time wrappers", () => {
    for (const failFast of [true, false]) {
      const validCase = nestedAllOfCase(50_000);
      const invalidCase = nestedAllOfCase(50_000, true);
      const validate = configuredShield(failFast).compile(validCase.schema);

      expect(validate(validCase.data).valid).toBe(true);
      expect(validate(invalidCase.data).valid).toBe(false);
    }
  });

  it("validates a 50,000-level recursive root reference", () => {
    for (const failFast of [true, false]) {
      const validCase = recursiveReferenceCase(50_000);
      const invalidCase = recursiveReferenceCase(50_000, true);
      const validate = configuredShield(failFast).compile(validCase.schema);

      expect(validate(validCase.data).valid).toBe(true);

      const result = validate(invalidCase.data);
      expect(result.valid).toBe(false);
      if (failFast) {
        expect(result.error).toBe(true);
      } else {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    }
  });

  it("validates 50,000 branched object levels", () => {
    for (const failFast of [true, false]) {
      const validCase = branchedObjectCase(50_000);
      const invalidCase = branchedObjectCase(50_000, true);
      const validate = configuredShield(failFast).compile(validCase.schema);

      expect(validate(validCase.data).valid).toBe(true);
      expect(validate(invalidCase.data).valid).toBe(false);
    }
  });

  it("validates 50,000 array levels with multiple items", () => {
    for (const failFast of [true, false]) {
      const validCase = multiItemArrayCase(50_000);
      const invalidCase = multiItemArrayCase(50_000, true);
      const validate = configuredShield(failFast).compile(validCase.schema);

      expect(validate(validCase.data).valid).toBe(true);
      expect(validate(invalidCase.data).valid).toBe(false);
    }
  });

  it("validates a 50,000-level branched recursive root reference", () => {
    for (const failFast of [true, false]) {
      const validCase = recursiveBranchedReferenceCase(50_000);
      const invalidCase = recursiveBranchedReferenceCase(50_000, true);
      const validate = configuredShield(failFast).compile(validCase.schema);

      expect(validate(validCase.data).valid).toBe(true);
      expect(validate(invalidCase.data).valid).toBe(false);
    }
  });

  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    it(`validates 10,000 branched ${keyword} levels`, () => {
      for (const failFast of [true, false]) {
        const validCase = nestedCombinatorCase(keyword, 10_000);
        const invalidCase = nestedCombinatorCase(keyword, 10_000, true);
        const validate = configuredShield(failFast).compile(validCase.schema);

        expect(validate(validCase.data).valid).toBe(true);
        expect(validate(invalidCase.data).valid).toBe(false);
      }
    });
  }

  it("validates 10,000 additionalProperties levels", () => {
    const validCase = nestedAdditionalPropertiesCase(10_000);
    const invalidCase = nestedAdditionalPropertiesCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("validates 10,000 contains levels", () => {
    const validCase = nestedContainsCase(10_000);
    const invalidCase = nestedContainsCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("validates 10,000 conditional levels", () => {
    const validCase = nestedConditionalCase(10_000);
    const invalidCase = nestedConditionalCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("validates 10,000 patternProperties levels", () => {
    const validCase = nestedPatternPropertiesCase(10_000);
    const invalidCase = nestedPatternPropertiesCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("validates 10,000 additionalItems levels", () => {
    const validCase = nestedAdditionalItemsCase(10_000);
    const invalidCase = nestedAdditionalItemsCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("validates 10,000 not levels", () => {
    const validCase = nestedNotCase(10_000);
    const invalidCase = nestedNotCase(10_000, true);
    const validate = configuredShield(false).compile(validCase.schema);

    expect(validate(validCase.data).valid).toBe(true);
    expect(validate(invalidCase.data).valid).toBe(false);
  });

  it("rejects an invalid required default before insertion on a deep path", () => {
    const testCase = nestedRequiredDefaultCase(10_000, true);
    const result = configuredShield(false).compile(testCase.schema)(testCase.data);

    expect(result.valid).toBe(false);
    expect(result.data).toEqual({});
    expect(result.error).toBeInstanceOf(ValidationError);
  });

  it("applies a required default before required fails on a deep path", () => {
    const testCase = requiredDefaultCase(1_000);
    const result = configuredShield(false).compile(testCase.schema)(testCase.data);
    let leaf = result.data;

    for (let i = 0; i < 1_000; i++) {
      leaf = leaf.next;
    }

    expect(result.valid).toBe(true);
    expect(leaf.value).toBe("leaf");
  });

  it("applies nested required defaults in immutable mode without mutating input", () => {
    const testCase = nestedRequiredDefaultCase(10_000);
    const result = new SchemaShield({
      immutable: true,
      failFast: false,
      maxDepth: 20_000
    })
      .compile(testCase.schema)(testCase.data);
    let leaf = result.data;

    for (let i = 0; i < 10_000; i++) {
      leaf = leaf.next;
    }

    expect(result.valid).toBe(true);
    expect(leaf.value).toBe("leaf");
    expect(testCase.data).toEqual({});
  });

  it("clones immutable input iteratively at 50,000 levels", () => {
    const testCase = branchedObjectCase(50_000);
    const validate = new SchemaShield({ immutable: true, maxDepth: 50_000 }).compile(testCase.schema);
    const result = validate(testCase.data);

    expect(result.valid).toBe(true);
    expect(result.data).not.toBe(testCase.data);
    expect(result.data.next).not.toBe(testCase.data.next);
  });

  it("keeps rich error paths stack-safe", () => {
    const { schema, data } = nestedObjectCase(10_000, true);
    const result = configuredShield(false).compile(schema)(data);

    expect(result.valid).toBe(false);
    expect(result.error).toBeInstanceOf(ValidationError);
    expect((result.error as ValidationError).getPath().instancePath.endsWith("/next"))
      .toBe(true);

    let materializedErrors = 0;
    let error = result.error as ValidationError | undefined;
    while (error) {
      materializedErrors++;
      error = error.cause;
    }
    expect(materializedErrors).toBeLessThan(10);
  });
});
