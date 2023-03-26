import { areCloseEnough, ValidationError } from '../utils';
import { ValidatorFunction } from '../index';

export const NumberKeywords: Record<string, ValidatorFunction> = {
  minimum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== 'number') {
      return { valid: true, error: null, data };
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
      error: valid ? null : new ValidationError('Number is too small', pointer),
      data,
    };
  },

  maximum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== 'number') {
      return { valid: true, error: null, data };
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
      error: valid ? null : new ValidationError('Number is too big', pointer),
      data,
    };
  },

  multipleOf(schema, data, pointer) {
    if (typeof data !== 'number') {
      return { valid: true, error: null, data };
    }

    const quotient = data / schema.multipleOf;

    // Detect overflow handling in JS
    if (!isFinite(quotient)) {
      return { valid: true, error: null, data };
    }

    const areMultiples = areCloseEnough(quotient, Math.round(quotient));

    return {
      valid: areMultiples,
      error: areMultiples ? null : new ValidationError('Number is not a multiple of', pointer),
      data,
    };
  },

  exclusiveMinimum(schema, data, pointer) {
    if (typeof data !== 'number' || typeof schema.exclusiveMinimum !== 'number' || 'minimum' in schema) {
      return { valid: true, error: null, data };
    }

    const valid = data > schema.exclusiveMinimum + 1e-15;

    return {
      valid,
      error: valid ? null : new ValidationError('Number is too small', pointer),
      data,
    };
  },

  exclusiveMaximum(schema, data, pointer) {
    if (typeof data !== 'number' || typeof schema.exclusiveMaximum !== 'number' || 'maximum' in schema) {
      return { valid: true, error: null, data };
    }

    const valid = data < schema.exclusiveMaximum - 1e-15;

    return {
      valid,
      error: valid ? null : new ValidationError('Number is too big', pointer),
      data,
    };
  },
};
