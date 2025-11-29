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
  ] = require(`json-schema-test-suite/tests/draft6/${file}`);
  return acc;
}, {});

const jsonTestsToSkip = {
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
  "validate definition against metaschema": "Not implemented",
  "remote ref, containing refs itself": "Not supported",
  "Location-independent identifier with base URI change in subschema":
    "Not supported",
  "refs with relative uris and defs": "Not supported",
  "relative refs with absolute uris and defs": "Not supported",
  "RN base URI with URN and JSON pointer ref": "Not supported",
  "URN base URI with URN and JSON pointer ref": "Not supported",
  "URN base URI with URN and anchor ref": "Not supported",
  "ref with absolute-path-reference": "Not supported",

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
  "id"
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
              error: valid ? null : expect.anything(),
              data: data === null ? null : expect.anything()
            });

            expect(clonedSchema).toEqual(schema);
          } catch (e) {
            console.log("schema", JSON.stringify(schema, null, 2));
            console.log("compiledSchema", stringifySchema(validate));
            console.log("data", data);
            console.log("valid", valid);

            if (result) {
              console.log("result valid:", result.valid);
              console.log(
                "e from result:",
                result.error?.getCause ? result.error.getCause() : result.error
              );
            } else {
              console.log(
                "CRITICAL ERROR: 'result' is undefined. Validate threw an exception."
              );
              console.log("Exception:", e);
            }

            console.log("file", file);
            throw e;
          }
        });
      }
    });
  }
}
