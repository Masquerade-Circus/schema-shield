import { after, before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import schemasafe from "@exodus/schemasafe";
import { stringifySchema } from "./test-utils";

import fs from "fs";
import path from "path";

describe("SchemaShield instance", () => {
  it("Should create a SchemaShield instance and validate", () => {
    let schema = {
      type: "object",
      properties: {
        foo: {
          type: "string"
        },
        bar: {
          type: "integer"
        },
        array: {
          type: "array",
          items: {
            type: "string"
          }
        },
        hello: {
          type: "string",
          default: "world"
        },
        world: {
          type: "string",
          default: "hello"
        }
      },
      required: ["foo", "bar", "array", "hello"]
    };

    let data = {
      foo: "hello",
      bar: 42,
      array: ["hello", "world"]
    };

    let schemaShield = new SchemaShield();
    let validate = schemaShield.compile(schema);

    expect(validate(data)).toEqual({
      data: { ...data, hello: "world" },
      error: null,
      valid: true
    });
  });
});

describe("Scratchpad", () => {
  // const testGroup = {
  //   description: "integer type matches integers",
  //   schema: {
  //     type: "integer"
  //   },
  //   tests: [
  //     {
  //       description: "a float is not an integer",
  //       data: 1.1,
  //       valid: false
  //     },
  //     {
  //       description: "an integer is an integer",
  //       data: 1,
  //       valid: true
  //     }
  //   ]
  // };

  const testGroup = {
    description: "nested items",
    schema: {
      type: "array",
      items: {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "number"
            }
          }
        }
      }
    },
    tests: [
      {
        description: "valid nested array",
        data: [[[[1]], [[2], [3]]], [[[4], [5], [6]]]],
        valid: true
      },
      {
        description: "nested array with invalid type",
        data: [[[["1"]], [[2], [3]]], [[[4], [5], [6]]]],
        valid: false
      },
      {
        description: "not deep enough",
        data: [
          [[1], [2], [3]],
          [[4], [5], [6]]
        ],
        valid: false
      }
    ]
  };

  const count = 100000;

  let validate;

  before(() => {
    const schemaShield = new SchemaShield();
    schemaShield.addFormat("hex", (value) => /^0x[0-9A-Fa-f]*$/.test(value));

    validate = schemaShield.compile(testGroup.schema);
    // console.log(JSON.stringify(testGroup.schema, null, 2));
    // console.log(stringifySchema(validate, false));
  });

  for (const { valid, data, description } of testGroup.tests) {
    it(description, () => {
      expect(validate(data)).toEqual({
        valid,
        error: valid ? null : expect.anything(),
        data: data === null ? null : expect.anything()
      });
    });
  }

  for (const test of testGroup.tests) {
    it(`Benchmark ${test.description}`, () => {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        try {
          validate(test.data);
        } catch (error) {
          // Ignore
        }
      }
      const diff = process.hrtime(initTime);
      // Log time in seconds
      console.log(`    Time: ${(diff[0] * 1e9 + diff[1]) / 1e9} seconds`);
    });
  }
});

describe("ValidationError", () => {
  it("should get the correct properties within an error", () => {
    const schemaShield = new SchemaShield({ immutable: true });

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: {
          type: "number",
          minimum: 18
        }
      }
    };

    const validator = schemaShield.compile(schema);

    const invalidData = {
      name: "John Doe",
      age: 15
    };

    const validationResult = validator(invalidData);

    expect(validationResult.valid).toEqual(false);
    expect(validationResult.error).not.toBeNull();

    // Validating error property again just to make TS happy in the next lines
    if (validationResult.error instanceof ValidationError) {
      expect(validationResult.error.message).toEqual("Property is invalid");
      const errorCause = validationResult.error.getCause();
      expect(errorCause.message).toEqual("Value is less than the minimum");
      expect(errorCause.schemaPath).toEqual("#/properties/age/minimum");
      expect(errorCause.instancePath).toEqual("#/age");
      expect(errorCause.data).toEqual(15);
      expect(errorCause.schema).toEqual(18);
      expect(errorCause.keyword).toEqual("minimum");
    }
  });

  it("should get the correct path within an error", () => {
    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        shouldLoadDb: { type: "boolean" },
        enableNetConnectFor: { type: "array", items: { type: "string" } },
        params: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              description: { type: "string" },
              default: { type: "string" }
            },
            required: ["description"]
          }
        },
        run: { type: "string" }
      },
      required: [
        "description",
        "shouldLoadDb",
        "enableNetConnectFor",
        "params",
        "run"
      ]
    };

    const schemaShield = new SchemaShield({ immutable: true });
    schemaShield.addType("function", (value) => typeof value === "function");

    const schemaShieldValidate = schemaShield.compile(schema);

    const command = {
      description: "Say hello to the bot.",
      shouldLoadDb: false,
      enableNetConnectFor: [],
      params: {
        color: {
          type: "string",
          // description: "The color of the text", // Missing description on purpose
          default: "red"
        }
      },
      run: "run"
    };

    const result = schemaShieldValidate(command);

    expect(result).toHaveProperty("valid", false);
    expect(result).toHaveProperty("error", expect.anything());

    // Validate if just to make TS happy
    if (result.error instanceof ValidationError) {
      // Test the methods of the error
      expect(result.error).toHaveProperty("getCause", expect.any(Function));
      expect(result.error).toHaveProperty("getTree", expect.any(Function));
      expect(result.error).toHaveProperty("getPath", expect.any(Function));

      // Test the cause
      const cause = result.error.getCause();
      expect(cause).toBeInstanceOf(ValidationError);
      expect(cause).toHaveProperty("message", "Required property is missing");
      expect(cause).toHaveProperty("keyword", "required");
      expect(cause).toHaveProperty("item", "description");
      expect(cause).toHaveProperty(
        "schemaPath",
        "#/properties/params/additionalProperties/required"
      );
      expect(cause).toHaveProperty(
        "instancePath",
        "#/params/color/description"
      );
      expect(cause).toHaveProperty("schema", ["description"]);
      expect(cause).toHaveProperty("data"); // undefined

      // Test the tree
      const tree = result.error.getTree();
      expect(tree).toEqual({
        message: "Property is invalid",
        keyword: "properties",
        item: "params",
        schemaPath: "#/properties/params",
        instancePath: "#/params",
        data: { color: { type: "string", default: "red" } },
        cause: {
          message: "Additional properties are invalid",
          keyword: "additionalProperties",
          item: "color",
          schemaPath: "#/properties/params/additionalProperties",
          instancePath: "#/params/color",
          data: { type: "string", default: "red" },
          cause: {
            message: "Required property is missing",
            keyword: "required",
            item: "description",
            schemaPath: "#/properties/params/additionalProperties/required",
            instancePath: "#/params/color/description",
            data: undefined
          }
        }
      });

      // Test the path
      const path = result.error.getPath();
      expect(path).toEqual({
        schemaPath: "#/properties/params/additionalProperties/required",
        instancePath: "#/params/color/description"
      });
    }
  });

  it('should test the "getPath" README.md example', () => {
    const schemaShield = new SchemaShield();

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        shouldLoadDb: { type: "boolean" },
        enableNetConnectFor: { type: "array", items: { type: "string" } },
        params: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              description: { type: "string" },
              default: { type: "string" }
            },
            required: ["description"]
          }
        },
        run: { type: "string" }
      }
    };

    const validator = schemaShield.compile(schema);

    const invalidData = {
      description: "Say hello to the bot.",
      shouldLoadDb: false,
      enableNetConnectFor: [],
      params: {
        color: {
          type: "string",
          // description: "The color of the text", // Missing description on purpose
          default: "red"
        }
      },
      run: "run"
    };

    const validationResult = validator(invalidData);

    if (validationResult.error instanceof ValidationError) {
      console.error("Validation error:", validationResult.error.message); // "Property is invalid"

      // Get the full error chain as a tree
      const errorTree = validationResult.error.getTree();
      console.error(errorTree);

      /*
    {
      message: "Property is invalid",
      keyword: "properties",
      item: "params",
      schemaPath: "#/properties/params",
      instancePath: "#/params",
      data: { color: { type: "string", default: "red" } },
      cause: {
        message: "Additional properties are invalid",
        keyword: "additionalProperties",
        item: "color",
        schemaPath: "#/properties/params/additionalProperties",
        instancePath: "#/params/color",
        data: { type: "string", default: "red" },
        cause: {
          message: "Required property is missing",
          keyword: "required",
          item: "description",
          schemaPath: "#/properties/params/additionalProperties/required",
          instancePath: "#/params/color/description",
          data: undefined
        }
      }
    }
  */
    }
  });
});

describe("Vs schemasafe", () => {
  const testGroups = [
    {
      description: "format: uri-template",
      schema: { format: "uri-template" },
      tests: [
        {
          description: "all string formats ignore integers",
          data: 12,
          valid: true
        },
        {
          description: "all string formats ignore floats",
          data: 13.7,
          valid: true
        },
        {
          description: "all string formats ignore objects",
          data: {},
          valid: true
        },
        {
          description: "all string formats ignore arrays",
          data: [],
          valid: true
        },
        {
          description: "all string formats ignore booleans",
          data: false,
          valid: true
        },
        {
          description: "all string formats ignore nulls",
          data: null,
          valid: true
        },
        {
          description: "a valid uri-template",
          data: "http://example.com/dictionary/{term:1}/{term}",
          valid: true
        },
        {
          description: "an invalid uri-template",
          data: "http://example.com/dictionary/{term:1}/{term",
          valid: false
        },
        {
          description: "a valid uri-template without variables",
          data: "http://example.com/dictionary",
          valid: true
        },
        {
          description: "a valid relative uri-template",
          data: "dictionary/{term:1}/{term}",
          valid: true
        }
      ]
    }
  ];
  const testGroup = testGroups[0];

  const count = 100000;
  const times: any = [];

  before(() => {
    for (let test of testGroup.tests) {
      console.log(
        JSON.stringify({ data: test.data }),
        "is",
        test.valid ? "valid" : "invalid"
      );
    }
  });

  after(() => {
    for (let key in times) {
      times[key].winner =
        times[key].schemaShield < times[key].schemaSafe
          ? "SchemaShield"
          : "SchemaSafe";
      times[key].ratio = times[key].schemaShield / times[key].schemaSafe;
    }

    const sumOfRatios = Object.values(times).reduce(
      (sum: any, time: any) => sum + time.ratio,
      0
    );

    const timesSortedByRatio = Object.values(times)
      .sort((a: any, b: any) => b.ratio - a.ratio)
      .reverse();

    console.log("Times:", timesSortedByRatio);
    console.log("Sum of ratios:", sumOfRatios);
  });

  it("SchemaShield", () => {
    const schemaShield = new SchemaShield();
    const validate = schemaShield.compile(testGroup.schema);
    console.log(stringifySchema(validate, true));
    for (let test of testGroup.tests) {
      try {
        const result = validate(test.data);
        if (result.valid !== test.valid) {
          console.log(
            result.error?.getCause() || result.error,
            "\nThe Input data:",
            test.data,
            "Must be",
            test.valid ? "valid" : "invalid"
          );
        }

        expect(result).toHaveProperty("valid", test.valid);
        times.push({
          group: testGroup.description,
          description: test.description,
          schema: JSON.stringify(testGroup.schema),
          data: JSON.stringify({ data: test.data }),
          valid: test.valid,
          schemaShield: 0,
          schemaSafe: 0
        });
      } catch (error) {
        console.log(error.message);
        process.exit();
        return;
      }
    }

    // return;
    for (let idx = 0, len = testGroup.tests.length; idx < len; idx++) {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        validate(testGroup.tests[idx].data);
      }
      const diff = process.hrtime(initTime);
      const seconds = (diff[0] * 1e9 + diff[1]) / 1e9;
      times[idx].schemaShield = seconds;
    }
  });

  it("SchemaSafe", () => {
    const validate = schemasafe.validator(testGroup.schema, {
      allowUnusedKeywords: true,
      includeErrors: true,
      $schemaDefault: "https://json-schema.org/draft-06/schema"
    });

    console.log(validate.toString());
    for (let test of testGroup.tests) {
      expect(validate(test.data)).toEqual(test.valid);
    }

    for (let idx = 0, len = testGroup.tests.length; idx < len; idx++) {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        validate(testGroup.tests[idx].data);
      }
      const diff = process.hrtime(initTime);
      const seconds = (diff[0] * 1e9 + diff[1]) / 1e9;
      times[idx].schemaSafe = seconds;
    }
  });
});
