import { before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";
import { stringifySchema } from "./test-utils";

const testGroup = {
  description: "integer type matches integers",
  schema: {
    type: "integer"
  },
  tests: [
    {
      description: "a float is not an integer",
      data: 1.1,
      valid: false
    },
    {
      description: "an integer is an integer",
      data: 1,
      valid: true
    }
  ]
};

const count = 100000;

describe.only("Scratchpad", () => {
  let validate;

  before(() => {
    const schemaShield = new SchemaShield();
    validate = schemaShield.compile(testGroup.schema);
    console.log(stringifySchema(validate));
  });

  for (const test of testGroup.tests) {
    it(test.description, () => {
      if (test.valid) {
        expect(validate(test.data)).toEqual(test.data);
      } else {
        // expect(() => validate(test.data)).toThrow();
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
