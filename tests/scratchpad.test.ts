import { after, before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import { stringifySchema } from "./test-utils";

const schemasafe = require("@exodus/schemasafe");

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

describe.only("Vs schemasafe", () => {
  const testGroups = [
    {
      description: "additionalItems as schema",
      schema: {
        items: [{}],
        additionalItems: { type: "integer" }
      },
      tests: [
        {
          description: "additional items match schema",
          data: [null, 2, 3, 4],
          valid: true
        },
        {
          description: "additional items do not match schema",
          data: [null, 2, 3, "foo"],
          valid: false
        }
      ]
    },
    {
      description: "when items is schema, additionalItems does nothing",
      schema: {
        items: {
          type: "integer"
        },
        additionalItems: {
          type: "string"
        }
      },
      tests: [
        {
          description: "valid with a array of type integers",
          data: [1, 2, 3],
          valid: true
        },
        {
          description: "invalid with a array of mixed types",
          data: [1, "2", "3"],
          valid: false
        }
      ]
    },
    {
      description: "when items is schema, boolean additionalItems does nothing",
      schema: {
        items: {},
        additionalItems: false
      },
      tests: [
        {
          description: "all items match schema",
          data: [1, 2, 3, 4, 5],
          valid: true
        }
      ]
    },
    {
      description: "array of items with no additionalItems permitted",
      schema: {
        items: [{}, {}, {}],
        additionalItems: false
      },
      tests: [
        {
          description: "empty array",
          data: [],
          valid: true
        },
        {
          description: "fewer number of items present (1)",
          data: [1],
          valid: true
        },
        {
          description: "fewer number of items present (2)",
          data: [1, 2],
          valid: true
        },
        {
          description: "equal number of items present",
          data: [1, 2, 3],
          valid: true
        },
        {
          description: "additional items are not permitted",
          data: [1, 2, 3, 4],
          valid: false
        }
      ]
    },
    {
      description: "additionalItems as false without items",
      schema: { additionalItems: false },
      tests: [
        {
          description: "items defaults to empty schema so everything is valid",
          data: [1, 2, 3, 4, 5],
          valid: true
        },
        {
          description: "ignores non-arrays",
          data: { foo: "bar" },
          valid: true
        }
      ]
    },
    {
      description: "additionalItems are allowed by default",
      schema: { items: [{ type: "integer" }] },
      tests: [
        {
          description: "only the first item is validated",
          data: [1, "foo", false],
          valid: true
        }
      ]
    },
    {
      description: "additionalItems does not look in applicators, valid case",
      schema: {
        allOf: [{ items: [{ type: "integer" }] }],
        additionalItems: { type: "boolean" }
      },
      tests: [
        {
          description: "items defined in allOf are not examined",
          data: [1, null],
          valid: true
        }
      ]
    },
    {
      description: "additionalItems does not look in applicators, invalid case",
      schema: {
        allOf: [{ items: [{ type: "integer" }, { type: "string" }] }],
        items: [{ type: "integer" }],
        additionalItems: { type: "boolean" }
      },
      tests: [
        {
          description: "items defined in allOf are not examined",
          data: [1, "hello"],
          valid: false
        }
      ]
    },
    {
      description:
        "items validation adjusts the starting index for additionalItems",
      schema: {
        items: [{ type: "string" }],
        additionalItems: { type: "integer" }
      },
      tests: [
        {
          description: "valid items",
          data: ["x", 2, 3],
          valid: true
        },
        {
          description: "wrong type of second item",
          data: ["x", "y"],
          valid: false
        }
      ]
    },
    {
      description: "additionalItems with null instance elements",
      schema: {
        additionalItems: {
          type: "null"
        }
      },
      tests: [
        {
          description: "allows null elements",
          data: [null],
          valid: true
        }
      ]
    }
  ];
  const testGroup = testGroups[8];

  const count = 10000000;
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
