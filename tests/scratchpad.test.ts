import { before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";
import { stringifySchema } from "./test-utils";

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

describe.only("Scratchpad", () => {
  let validate;

  before(() => {
    const schemaShield = new SchemaShield();
    schemaShield.addFormat("hex", (value) => /^0x[0-9A-Fa-f]*$/.test(value));
    console.log(
      stringifySchema(
        schemaShield.compile({
          type: "string",
          format: "hex"
        }),
        true
      )
    );

    validate = schemaShield.compile(testGroup.schema);
    console.log(stringifySchema(validate, true));
  });

  for (const test of testGroup.tests) {
    it(test.description, () => {
      if (test.valid) {
        expect(validate(test.data)).toEqual([true, null]);
      } else {
        expect(validate(test.data)).toEqual([false, expect.anything()]);
        console.log(validate(test.data));
      }
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
