import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import { stringifySchema } from "./test-utils";

const jsonTests = require("./format.test.json");

const logData = false;
const logSchema = false;

const schemaShield = new SchemaShield();

for (let i = 0; i < jsonTests.length; i++) {
  const { description: groupDescription, schema, tests } = jsonTests[i];

  let validate;

  function setup() {
    if (validate) {
      return { validate };
    }
    validate = schemaShield.compile(schema);
    if (logSchema) {
      console.log(JSON.stringify(schema, null, 2));
      console.log(stringifySchema(validate));
    }
    return { validate };
  }

  describe(groupDescription, () => {
    for (let j = 0; j < tests.length; j++) {
      const { description, data, valid } = tests[j];

      it(description, () => {
        const { validate } = setup();
        if (logData) {
          console.log("data", data);
        }
        expect(validate(data)).toEqual({
          valid,
          error: valid ? null : expect.any(ValidationError),
          data: data === null ? null : expect.anything()
        });
      });
    }
  });
}
