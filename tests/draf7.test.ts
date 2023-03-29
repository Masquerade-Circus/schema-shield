import { ValidationError, deepClone } from "../lib/utils";
import { describe, it } from "mocha";

import { SchemaShield } from "../lib";
import expect from "expect";
import fs from "fs";
import { stringifySchema } from "./test-utils";

const files = fs.readdirSync(
  "./node_modules/json-schema-test-suite/tests/draft6"
);

const jsonTestFiles = files.reduce((acc, file) => {
  if (!file.endsWith(".json")) {
    return acc;
  }
  acc[
    file.replace(".json", "")
  ] = require(`json-schema-test-suite/tests/draft7/${file}`);
  return acc;
}, {});

const jsonTestsToSkip = {
  "validate definition against metaschema": "Not implemented",
  "maxLength validation": {
    "two supplementary Unicode code points is long enough":
      "No one supports this"
  },
  "minLength validation": {
    "one supplementary Unicode code point is not long enough":
      "No one supports this"
  },

  // Sub items
  "items and subitems": "Not implemented",

  // Ref
  "$id inside an unknown keyword is not a real identifier": "Not implemented",

  // Needs investigation
  "evaluating the same schema location against the same data location twice is not a sign of an infinite loop":
    "Needs investigation",
  "float division = inf": {
    "always invalid, but naive implementations may raise an overflow error":
      "Needs investigation"
  }
};

const filesToSkip: string[] = [
  // References
  "refRemote",
  "id",
  "ref"
];

const schemaShield = new SchemaShield();

for (let file in jsonTestFiles) {
  if (filesToSkip.includes(file)) {
    describe.skip(file, () => {
      it("Not implemented", () => {});
    });
    continue;
  }

  const jsonTests = jsonTestFiles[file];

  for (let i = 0; i < jsonTests.length; i++) {
    const { description: groupDescription, schema, tests } = jsonTests[i];

    if (typeof jsonTestsToSkip[groupDescription] === "string") {
      describe.skip(groupDescription, () => {
        it(jsonTestsToSkip[groupDescription], () => {});
      });
      continue;
    }

    describe(groupDescription, () => {
      for (let j = 0; j < tests.length; j++) {
        const { description, data, valid } = tests[j];

        if (
          typeof jsonTestsToSkip[groupDescription] === "object" &&
          typeof jsonTestsToSkip[groupDescription][description] === "string"
        ) {
          it.skip(`${description} - ${jsonTestsToSkip[groupDescription][description]}`, () => {});
          continue;
        }

        it(description, () => {
          let validate;
          let result;
          try {
            let clonedSchema = deepClone(schema);
            validate = schemaShield.compile(schema);
            result = validate(data);

            expect(result).toEqual({
              valid,
              error: valid ? null : expect.any(ValidationError),
              data: data === null ? null : expect.anything()
            });

            expect(clonedSchema).toEqual(schema);
          } catch (e) {
            console.log("schema", JSON.stringify(schema, null, 2));
            console.log("compiledSchema", stringifySchema(validate));
            console.log("data", data);
            console.log("valid", valid);
            console.log("result", result);
            console.log(
              "e",
              result.error?.getCause ? result.error.getCause() : e
            );
            console.log("file", file);

            throw e;
          }
        });
      }
    });
  }
}
