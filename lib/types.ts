import { isObject, ValidationError } from './utils';
import { ValidatorFunction } from './index';

export const Types: Record<string, ValidatorFunction> = {
  object(schema, data, pointer) {
    if (isObject(data)) {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not an object', {
          pointer,
          value: data,
          code: 'NOT_AN_OBJECT',
        }),
      ],
      data,
    };
  },
  array(schema, data, pointer) {
    if (Array.isArray(data)) {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    if (typeof data === 'object' && data !== null && 'length' in data) {
      // Check if the first key is a number and the length is the same as the number of keys - 1 (length)
      const keys = Object.keys(data);
      if (keys.length > 0 && (keys[0] !== '0' || keys.length !== data.length)) {
        return {
          valid: false,
          errors: [
            new ValidationError('Data is not an array', {
              pointer,
              value: data,
              code: 'NOT_AN_ARRAY',
            }),
          ],
          data,
        };
      }

      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not an array', {
          pointer,
          value: data,
          code: 'NOT_AN_ARRAY',
        }),
      ],
      data,
    };
  },
  string(schema, data, pointer) {
    if (typeof data === 'string') {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not a string', {
          pointer,
          value: data,
          code: 'NOT_A_STRING',
        }),
      ],
      data,
    };
  },
  number(schema, data, pointer) {
    if (typeof data === 'number') {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not a number', {
          pointer,
          value: data,
          code: 'NOT_A_NUMBER',
        }),
      ],
      data,
    };
  },
  integer(schema, data, pointer) {
    if (typeof data === 'number' && Number.isInteger(data)) {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not an integer', {
          pointer,
          value: data,
          code: 'NOT_AN_INTEGER',
        }),
      ],
      data,
    };
  },
  boolean(schema, data, pointer) {
    // Check if data is a boolean like value
    if (typeof data === 'boolean') {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not a boolean', {
          pointer,
          value: data,
          code: 'NOT_A_BOOLEAN',
        }),
      ],
      data,
    };
  },
  null(schema, data, pointer) {
    if (data === null) {
      return {
        valid: true,
        errors: [],
        data,
      };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Data is not null', {
          pointer,
          value: data,
          code: 'NOT_NULL',
        }),
      ],
      data,
    };
  },
};
