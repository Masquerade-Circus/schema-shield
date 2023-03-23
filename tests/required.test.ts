import { describe, it } from "mocha";

import requiredJsonTests from "json-schema-test-suite/tests/draft4/required.json";

for (let i = 0; i < requiredJsonTests.length; i++) {
  const { description, schema, tests } = requiredJsonTests[i];
  describe(description, () => {
    for (let j = 0; j < tests.length; j++) {
      const { description, data, valid } = tests[j];
      it(description, () => {});
      break;
    }
  });
  break;
}
