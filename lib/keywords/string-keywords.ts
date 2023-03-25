import { ValidationError, deepEqual } from '../utils';

import { ValidatorFunction } from '../index';

export const StringKeywords: Record<string, ValidatorFunction> = {
  minLength(schema, data, pointer) {
    if (typeof data !== 'string' || data.length >= schema.minLength) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('String is too short', {
          pointer,
          value: data,
          code: 'STRING_TOO_SHORT',
        }),
      ],
      data,
    };
  },

  maxLength(schema, data, pointer) {
    if (typeof data !== 'string' || data.length <= schema.maxLength) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('String is too long', {
          pointer,
          value: data,
          code: 'STRING_TOO_LONG',
        }),
      ],
      data,
    };
  },

  pattern(schema, data, pointer) {
    if (typeof data !== 'string') {
      return { valid: true, errors: [], data };
    }

    const patternRegexp = new RegExp(schema.pattern, 'u');

    if (patternRegexp instanceof RegExp === false) {
      return {
        valid: false,
        errors: [
          new ValidationError('Pattern is not a valid regular expression', {
            pointer,
            value: data,
            code: 'PATTERN_IS_NOT_REGEXP',
          }),
        ],
        data,
      };
    }

    const valid = patternRegexp.test(data);

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError('String does not match pattern', {
              pointer,
              value: data,
              code: 'STRING_DOES_NOT_MATCH_PATTERN',
            }),
          ],
      data,
    };
  },

  format(schema, data, pointer, formatInstance) {
    if (typeof data !== 'string') {
      return { valid: true, errors: [], data };
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (!formatValidate) {
      return {
        valid: false,
        errors: [
          new ValidationError(`Unknown format ${schema.format}`, {
            pointer,
            value: data,
            code: 'UNKNOWN_FORMAT',
          }),
        ],
        data,
      };
    }

    const valid = formatValidate(data);

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError(`String does not match format ${schema.format}`, {
              pointer,
              value: data,
              code: 'STRING_DOES_NOT_MATCH_FORMAT',
            }),
          ],
      data,
    };
  },

  enum(schema, data, pointer) {
    // Check if data is an array or an object
    const isArray = Array.isArray(data);
    const isObject = typeof data === 'object' && data !== null;

    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];

      // Simple equality check
      if (enumItem === data) {
        return { valid: true, errors: [], data };
      }

      // If data is an array or an object, check for deep equality
      if ((isArray && Array.isArray(enumItem)) || (isObject && typeof enumItem === 'object' && enumItem !== null)) {
        if (deepEqual(enumItem, data)) {
          return { valid: true, errors: [], data };
        }
      }
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must be one of ${schema.enum.join(', ')}`, {
          pointer,
          value: data,
          code: 'VALUE_NOT_IN_ENUM',
        }),
      ],
      data,
    };
  },
};
