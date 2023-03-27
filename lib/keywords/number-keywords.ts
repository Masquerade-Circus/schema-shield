import { ValidationError, areCloseEnough } from "../utils";

import { ValidatorFunction } from "../index";

export const NumberKeywords: Record<string, ValidatorFunction> = {
  minimum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== "number") {
      return data;
    }

    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }

    if (data < min) {
      throw new ValidationError("Number is too small", pointer);
    }

    return data;
  },

  maximum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== "number") {
      return data;
    }

    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }

    if (data > max) {
      throw new ValidationError("Number is too big", pointer);
    }

    return data;
  },

  multipleOf(schema, data, pointer) {
    if (typeof data !== "number") {
      return data;
    }

    const quotient = data / schema.multipleOf;

    if (!isFinite(quotient)) {
      return data;
    }

    if (!areCloseEnough(quotient, Math.round(quotient))) {
      throw new ValidationError("Number is not a multiple of", pointer);
    }

    return data;
  },

  exclusiveMinimum(schema, data, pointer) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return data;
    }

    if (data <= schema.exclusiveMinimum + 1e-15) {
      throw new ValidationError("Number is too small", pointer);
    }

    return data;
  },

  exclusiveMaximum(schema, data, pointer) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMaximum !== "number" ||
      "maximum" in schema
    ) {
      return data;
    }

    if (data >= schema.exclusiveMaximum - 1e-15) {
      throw new ValidationError("Number is too big", pointer);
    }

    return data;
  }
};
