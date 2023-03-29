import { before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import { stringifySchema } from "./test-utils";

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
      }
    },
    required: ["foo", "bar", "array"]
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

describe("Scratchpad", () => {
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
        error: valid ? null : expect.any(ValidationError),
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
    if (validationResult.error !== null) {
      expect(validationResult.error.message).toEqual("Property is invalid");
      const errorCause = validationResult.error.getCause();
      expect(errorCause.message).toEqual("Value is less than the minimum");
      expect(errorCause.path).toEqual("#/properties/age/minimum");
      expect(errorCause.data).toEqual(15);
      expect(errorCause.schema).toEqual(18);
      expect(errorCause.keyword).toEqual("minimum");
    }
  });
});
