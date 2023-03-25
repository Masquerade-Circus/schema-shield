import { describe, it } from 'mocha';

import { SchemaShield } from '../lib';
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
  // Failed tests
  definitions: 'Not implemented',
  id: 'Not implemented',
  'infinite-loop-detection': 'Not implemented',
  not: 'Not implemented',
  ref: 'Not implemented',
  refRemote: 'Not implemented',
  // Passed tests
  // Object
  properties: false,
  maxProperties: false,
  minProperties: false,
  additionalProperties: false,
  patternProperties: false,
  // // Array
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
  // // String
  format: false,
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
  // // Number & Integer
  maximum: false,
  minimum: false,
  multipleOf: {
    'float division = inf': {
      'invalid, but naive implementations may raise an overflow error': 'Needs investigation',
    },
  },
  // // All
  required: false,
  type: false,
  enum: false,
  oneOf: false,
  anyOf: false,
  allOf: false,
  dependencies: false,
  default: false,
};

const logData = true;
const logSchema = true;

const schemaShield = new SchemaShield();

for (let testGroup in jsonTests) {
  if (
    typeof jsonTestsToSkip[testGroup] === 'string' ||
    jsonTestsToSkip[testGroup] === true ||
    jsonTestsToSkip[testGroup]?.skip ||
    testGroup in jsonTestsToSkip === false
  ) {
    let message = `Skipping test group "${testGroup}" because`;
    if (testGroup in jsonTestsToSkip === false) {
      message += ' it is not in jsonTestsToSkip';
    } else if (jsonTestsToSkip[testGroup] === true) {
      message += ' it is marked as true in jsonTestsToSkip';
    } else if (typeof jsonTestsToSkip[testGroup] === 'string') {
      message += ` it is marked as "${jsonTestsToSkip[testGroup]}" in jsonTestsToSkip`;
    } else if (jsonTestsToSkip[testGroup]?.skip) {
      message += ' it is marked as skip in jsonTestsToSkip';
    }

    describe.skip(message, () => {
      it('should be skipped', () => {});
    });
    continue;
  }

  for (let i = 0; i < jsonTests[testGroup].length; i++) {
    const { description: groupDescription, schema, tests } = jsonTests[testGroup][i];

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

    if (jsonTestsToSkip[testGroup][groupDescription] === true) {
      describe.skip(`Skipping test group  "${testGroup}/${groupDescription}" because it is marked as true in jsonTestsToSkip`, () => {
        it('should be skipped', () => {});
      });
      continue;
    }

    if (typeof jsonTestsToSkip[testGroup][groupDescription] === 'string') {
      console.log('Skipping test group', groupDescription, 'because', jsonTestsToSkip[testGroup][groupDescription]);
      describe.skip(`Skipping test group "${testGroup}/${groupDescription}" because it is marked as "${jsonTestsToSkip[testGroup][groupDescription]}" in jsonTestsToSkip`, () => {
        it('should be skipped', () => {});
      });
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
          it.skip(`Skipping test "${description}" because it is marked as "${jsonTestsToSkip[testGroup][groupDescription][description]}" in jsonTestsToSkip`, () => {});
          continue;
        }

        it(description, () => {
          const { validate } = setup();
          if (logData) {
            console.log('data', data);
          }

          const result = validate(data);

          try {
            expect(result).toEqual(
              expect.objectContaining({
                valid,
                errors: valid ? [] : expect.any(Array),
              })
            );
          } catch (error) {
            console.log({
              [testGroup]: {
                [groupDescription]: {
                  [description]: 'FAILED',
                },
              },
            });
            throw error;
          }
        });
      }
    });
  }
}
