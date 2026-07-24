import { describe, it } from "mocha";

import expect from "expect";
import { SchemaShield } from "../lib";
import type { CompiledSchema } from "../lib";

const DEPTHS = [1_000, 10_000, 50_000];

function nestedObjectSchema(depth: number) {
  let schema: any = { type: "deep-leaf", format: "deep-format", deep: true };

  for (let i = 0; i < depth; i++) {
    schema = {
      type: "object",
      properties: { next: schema },
      required: ["next"]
    };
  }

  return schema;
}

function nestedArraySchema(depth: number) {
  let schema: any = { type: "deep-leaf", format: "deep-format", deep: true };

  for (let i = 0; i < depth; i++) {
    schema = { type: "array", items: schema };
  }

  return schema;
}

function assertCompiledDepth(compiledSchema: CompiledSchema, depth: number) {
  let current = compiledSchema;

  for (let i = 0; i < depth; i++) {
    expect(typeof current.$validate).toBe("function");
    current = current.properties.next;
  }

  expect(typeof current.$validate).toBe("function");
  expect(current.type).toBe("deep-leaf");
  expect(current.format).toBe("deep-format");
  expect(current.deep).toBe(true);
}

function assertCompiledArrayDepth(compiledSchema: CompiledSchema, depth: number) {
  let current = compiledSchema;

  for (let i = 0; i < depth; i++) {
    expect(typeof current.$validate).toBe("function");
    current = current.items;
  }

  expect(typeof current.$validate).toBe("function");
  expect(current.type).toBe("deep-leaf");
  expect(current.format).toBe("deep-format");
  expect(current.deep).toBe(true);
}

function configuredShield() {
  const shield = new SchemaShield();
  shield.addType("deep-leaf", (data) => typeof data === "string");
  shield.addFormat("deep-format", (data) => data === "leaf");
  shield.addKeyword("deep", () => {});
  return shield;
}

describe("deep schema compilation", () => {
  for (const depth of DEPTHS) {
    it(`compiles ${depth.toLocaleString("en-US")} nested object and array schemas without truncation`, () => {
      const objectValidate = configuredShield().compile(
        nestedObjectSchema(depth)
      );
      const arrayValidate = configuredShield().compile(
        nestedArraySchema(depth)
      );

      assertCompiledDepth(objectValidate.compiledSchema, depth);
      assertCompiledArrayDepth(arrayValidate.compiledSchema, depth);
    });
  }

  it("compiles 50,000 nested allOf wrappers", () => {
    let schema: any = { type: "string" };

    for (let i = 0; i < 50_000; i++) {
      schema = { allOf: [schema] };
    }

    const validate = new SchemaShield().compile(schema);

    expect(validate.compiledSchema.type).toBe("string");
    expect(validate.compiledSchema.$validate?.name).toBe("string");
  });

  it("preserves local references in a 50,000-link chain", () => {
    const definitions: Record<string, any> = {
      leaf: { type: "string" }
    };

    for (let i = 49_999; i >= 0; i--) {
      definitions[`ref${i}`] = {
        $ref:
          i === 49_999
            ? "#/definitions/leaf"
            : `#/definitions/ref${i + 1}`
      };
    }

    const shield = new SchemaShield();
    const validate = shield.compile({
      definitions,
      $ref: "#/definitions/ref0"
    });
    const compiled = validate.compiledSchema;

    expect(typeof compiled.$validate).toBe("function");
    expect(shield.getSchemaRef("#/definitions/ref0")).toBe(
      compiled.definitions.ref0
    );
    expect(compiled.definitions.ref49999.$validate).toBe(
      compiled.definitions.leaf.$validate
    );
  });
});
