import { ValidationError, ValidatorFunction } from "../utils";

export const NumberKeywords: Record<string, ValidatorFunction> = {
  minimum(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }

    const min = schema.exclusiveMinimum
      ? schema.minimum + 1e-15
      : schema.minimum;

    const valid = data >= min;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError("Number is too small", {
              pointer,
              value: data,
              code: "NUMBER_TOO_SMALL"
            })
          ],
      data
    };
  },

  maximum(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }

    const max = schema.exclusiveMaximum
      ? schema.maximum - 1e-15
      : schema.maximum;

    const valid = data <= max;

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError("Number is too large", {
              pointer,
              value: data,
              code: "NUMBER_TOO_LARGE"
            })
          ],
      data
    };
  },

  multipleOf(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }

    const quotient = data / schema.multipleOf;
    const areMultiples = Math.abs(quotient - Math.round(quotient)) < 1e-15;

    return {
      valid: areMultiples,
      errors: areMultiples
        ? []
        : [
            new ValidationError("Number is not a multiple of", {
              pointer,
              value: data,
              code: "NUMBER_NOT_MULTIPLE_OF"
            })
          ],
      data
    };
  }
};
