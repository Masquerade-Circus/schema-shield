import { areCloseEnough, ValidationError } from '../utils';
import { ValidatorFunction } from '../index';

export const NumberKeywords: Record<string, ValidatorFunction> = {
  minimum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== 'number') {
      return { valid: true, errors: [], data };
    }

    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === 'number') {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }

    const valid = data >= min;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError('Number is too small', {
              pointer,
              value: data,
              code: 'NUMBER_TOO_SMALL',
            }),
          ],
      data,
    };
  },

  maximum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== 'number') {
      return { valid: true, errors: [], data };
    }

    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === 'number') {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }

    const valid = data <= max;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError('Number is too big', {
              pointer,
              value: data,
              code: 'NUMBER_TOO_BIG',
            }),
          ],
      data,
    };
  },

  multipleOf(schema, data, pointer) {
    if (typeof data !== 'number') {
      return { valid: true, errors: [], data };
    }

    const quotient = data / schema.multipleOf;

    // Detect overflow handling in JS
    if (!isFinite(quotient)) {
      return { valid: true, errors: [], data };
    }

    const areMultiples = areCloseEnough(quotient, Math.round(quotient));

    return {
      valid: areMultiples,
      errors: areMultiples
        ? []
        : [
            new ValidationError('Number is not a multiple of', {
              pointer,
              value: data,
              code: 'NUMBER_NOT_MULTIPLE_OF',
            }),
          ],
      data,
    };
  },

  exclusiveMinimum(schema, data, pointer) {
    if (typeof data !== 'number' || typeof schema.exclusiveMinimum !== 'number' || 'minimum' in schema) {
      return { valid: true, errors: [], data };
    }

    const valid = data > schema.exclusiveMinimum + 1e-15;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError('Number is too small', {
              pointer,
              value: data,
              code: 'NUMBER_TOO_SMALL',
            }),
          ],
      data,
    };
  },

  exclusiveMaximum(schema, data, pointer) {
    if (typeof data !== 'number' || typeof schema.exclusiveMaximum !== 'number' || 'maximum' in schema) {
      return { valid: true, errors: [], data };
    }

    const valid = data < schema.exclusiveMaximum - 1e-15;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError('Number is too big', {
              pointer,
              value: data,
              code: 'NUMBER_TOO_BIG',
            }),
          ],
      data,
    };
  },
};
