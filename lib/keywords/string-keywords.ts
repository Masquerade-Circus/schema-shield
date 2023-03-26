import { ValidationError, deepEqual } from '../utils';

import { ValidatorFunction } from '../index';

export const StringKeywords: Record<string, ValidatorFunction> = {
  minLength(schema, data, pointer) {
    if (typeof data !== 'string' || data.length >= schema.minLength) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('String is too short', pointer),
      data,
    };
  },

  maxLength(schema, data, pointer) {
    if (typeof data !== 'string' || data.length <= schema.maxLength) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('String is too long', pointer),
      data,
    };
  },

  pattern(schema, data, pointer) {
    if (typeof data !== 'string') {
      return { valid: true, error: null, data };
    }

    const patternRegexp = new RegExp(schema.pattern, 'u');

    if (patternRegexp instanceof RegExp === false) {
      return {
        valid: false,
        error: new ValidationError('Pattern is not a valid regular expression', pointer),
        data,
      };
    }

    const valid = patternRegexp.test(data);

    return {
      valid,
      error: valid ? null : new ValidationError('String does not match pattern', pointer),
      data,
    };
  },

  format(schema, data, pointer, formatInstance) {
    if (typeof data !== 'string') {
      return { valid: true, error: null, data };
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return { valid: true, error: null, data };
    }

    if (typeof formatValidate === 'function') {
      const valid = formatValidate(data);

      return {
        valid,
        error: valid ? null : new ValidationError(`String does not match format ${schema.format}`, pointer),
        data,
      };
    }

    return {
      valid: false,
      error: new ValidationError(`Unknown format ${schema.format}`, pointer),
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
        return { valid: true, error: null, data };
      }

      // If data is an array or an object, check for deep equality
      if ((isArray && Array.isArray(enumItem)) || (isObject && typeof enumItem === 'object' && enumItem !== null)) {
        if (deepEqual(enumItem, data)) {
          return { valid: true, error: null, data };
        }
      }
    }

    return {
      valid: false,
      error: new ValidationError(`Value must be one of ${schema.enum.join(', ')}`, pointer),
      data,
    };
  },
};
