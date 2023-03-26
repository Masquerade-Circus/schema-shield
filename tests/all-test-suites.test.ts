import { describe, it } from 'mocha';

import { SchemaShield } from '../lib';
import expect from 'expect';
import { stringifySchema } from './test-utils';
import { deepClone } from '../lib/utils';

const jsonTests = require('./all-test-suites.test.json');

const logData = true;
const logSchema = true;

const jsonTestsToSkip = {
  'invalid definition schema': 'Not implemented',
  'invalid definition': 'Not implemented',
  'evaluating the same schema location against the same data location twice is not a sign of an infinite loop': 'Not implemented',
  'items and subitems': 'Not implemented',
  'maxLength validation': {
    'two supplementary Unicode code points is long enough': 'Not supported',
  },
  'minLength validation': {
    'one supplementary Unicode code point is not long enough': 'Not supported',
  },
  'validation of string-encoded content based on media type': 'Not implemented',
  'validation of binary string-encoding': 'Not implemented',
  'validation of binary-encoded media type documents': 'Not implemented',
  'ECMA 262 \\s matches whitespace': {
    'paragraph separator matches (line terminator)': 'Needs investigation',
  },
  'invalid instance should not raise error when float division = inf': {
    'always invalid, but naive implementations may raise an overflow error': 'Needs investigation',
  },
  'validation of an internationalized e-mail addresses': 'Not implemented',
  'validation of internationalized host names': 'Not implemented',
  'validation of IPv6 addresses': {
    'zone id is not a part of ipv6 address': 'Needs investigation',
  },
  'validation of IRI References': 'Not implemented',
  'validation of IRIs': 'Not implemented',
  'validation of URI References': 'Needs investigation',
  'format: uri-template': 'Needs investigation',

  // Refs
  'root pointer ref': 'Not implemented',
  'relative pointer ref to object': 'Not implemented',
  'relative pointer ref to array': 'Not implemented',
  'escaped pointer ref': 'Not implemented',
  'nested refs': 'Not implemented',
  'ref overrides any sibling keywords': 'Not implemented',
  'remote ref, containing refs itself': 'Not implemented',
  'property named $ref, containing an actual $ref': 'Not implemented',
  '$ref to boolean schema false': 'Not implemented',
  'Recursive references between schemas': 'Not implemented',
  'refs with quote': 'Not implemented',
  'Location-independent identifier': 'Not implemented',
  'Location-independent identifier with absolute URI': 'Not implemented',
  'Location-independent identifier with base URI change in subschema': 'Not implemented',
  'remote ref': 'Not implemented',
  'fragment within remote ref': 'Not implemented',
  'ref within remote ref': 'Not implemented',
  'base URI change': 'Not implemented',
  'base URI change - change folder': 'Not implemented',
  'base URI change - change folder in subschema': 'Not implemented',
  'root ref in remote ref': 'Not implemented',
};

const schemaShield = new SchemaShield();

for (let i = 0; i < jsonTests.length; i++) {
  const { description: groupDescription, schema, tests } = jsonTests[i];

  if (typeof jsonTestsToSkip[groupDescription] === 'string') {
    describe.skip(groupDescription, () => {
      it(jsonTestsToSkip[groupDescription], () => {});
    });
    continue;
  }

  describe.only(groupDescription, () => {
    for (let j = 0; j < tests.length; j++) {
      const { description, data, valid } = tests[j];

      if (typeof jsonTestsToSkip[groupDescription] === 'object' && typeof jsonTestsToSkip[groupDescription][description] === 'string') {
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
            errors: valid ? [] : expect.any(Array),
            data: data === null ? null : expect.anything(),
          });
          expect(clonedSchema).toEqual(schema);
        } catch (e) {
          console.log('schema', JSON.stringify(schema, null, 2));
          console.log('compiledSchema', stringifySchema(validate));
          console.log('data', data);
          console.log('valid', valid);

          throw e;
        }
      });
    }
  });
}
