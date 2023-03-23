import { describe, it } from 'mocha';

import FJV from '../lib';
import expect from 'expect';

describe.only('Fjv', () => {
  it('Should create a fjv instance', () => {
    let schema = {
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          type: 'integer',
        },
        array: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
      required: ['foo', 'bar', 'array'],
    };

    let data = {
      foo: 'hello',
      bar: 42,
      array: ['hello', 'world'],
    };

    let fjv = new FJV();
    let validate = fjv.compile(schema);

    console.log(JSON.stringify(validate.compiledSchema, (key, value) => (typeof value === 'function' ? `func ${value.name}` : value), 2));

    console.log(validate(data));
    expect(validate(data)).toEqual({ valid: true, errors: [] });
  });
});
