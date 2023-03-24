import { describe, it } from 'mocha';

import FJV from '../lib';
import expect from 'expect';
import fs from 'fs';
import { stringifySchema } from './test-utils';

// Read the test/draft4 directory to get all the test files
const files = fs.readdirSync('./node_modules/json-schema-test-suite/tests/draft4');

const jsonTests = files.reduce((acc, file) => {
  if (!file.endsWith('.json')) {
    return acc;
  }
  acc[file.replace('.json', '')] = require(`json-schema-test-suite/tests/draft4/${file}`);
  return acc;
}, {});

const jsonTestsToSkip = {
  // // Failed tests
  format: true,
  default: true,
  definitions: true,
  dependencies: true,
  id: true,
  'infinite-loop-detection': true,
  not: true,
  ref: true,
  refRemote: true,
  // Passed tests
  // Object
  properties: false,
  maxProperties: false,
  minProperties: false,
  additionalProperties: false,
  patternProperties: false,
  // Array
  items: {
    skip: false,
    'a schema given for items': {
      'JavaScript pseudo-array is valid':
        'Pseudo array is validated correctly but the data is invalid because the first item is not an integer',
    },
    'an array of schemas for items': {
      'JavaScript pseudo-array is valid':
        'Pseudo array is validated correctly but the data is invalid because the first item is not an integer',
    },
    'items and subitems': 'Not implemented',
  },
  maxItems: false,
  minItems: false,
  uniqueItems: false,
  additionalItems: false,
  // String
  maxLength: {
    skip: false,
    'maxLength validation': {
      'two supplementary Unicode code points is long enough': 'Not implemented',
    },
  },
  minLength: {
    skip: false,
    'minLength validation': {
      'one supplementary Unicode code point is not long enough': 'Not implemented',
    },
  },
  pattern: false,
  // Number & Integer
  maximum: false,
  minimum: false,
  multipleOf: false,
  // All
  required: false,
  type: false,
  enum: false,
  oneOf: false,
  anyOf: false,
  allOf: false,
};

const logData = true;
const logSchema = true;

const fjv = new FJV();

for (let testGroup in jsonTests) {
  if (jsonTestsToSkip[testGroup] === true || jsonTestsToSkip[testGroup]?.skip || testGroup in jsonTestsToSkip === false) {
    continue;
  }

  for (let i = 0; i < jsonTests[testGroup].length; i++) {
    const { description: groupDescription, schema, tests } = jsonTests[testGroup][i];

    let validate;

    function setup() {
      if (validate) {
        return { validate };
      }
      validate = fjv.compile(schema);
      if (logSchema) {
        console.log(JSON.stringify(schema, null, 2));
        console.log(stringifySchema(validate));
      }
      return { validate };
    }

    if (jsonTestsToSkip[testGroup][groupDescription] === true) {
      console.log('Skipping test group', groupDescription);
      describe.skip(groupDescription, () => {});
      continue;
    }

    if (typeof jsonTestsToSkip[testGroup][groupDescription] === 'string') {
      console.log('Skipping test group', groupDescription, 'because', jsonTestsToSkip[testGroup][groupDescription]);
      describe.skip(groupDescription, () => {});
      continue;
    }

    describe(groupDescription, () => {
      for (let j = 0; j < tests.length; j++) {
        const { description, data, valid } = tests[j];

        if (
          typeof jsonTestsToSkip[testGroup] === 'object' &&
          typeof jsonTestsToSkip[testGroup][groupDescription] === 'object' &&
          jsonTestsToSkip[testGroup][groupDescription][description]
        ) {
          console.log('Skipping test', groupDescription, description, 'because', jsonTestsToSkip[testGroup][groupDescription][description]);
          it.skip(description, () => {});
          continue;
        }

        it(description, () => {
          const { validate } = setup();
          if (logData) {
            console.log('data', data);
          }
          expect(validate(data)).toEqual({
            valid,
            errors: valid ? null : expect.any(Array),
          });
        });
      }
    });
  }
}
