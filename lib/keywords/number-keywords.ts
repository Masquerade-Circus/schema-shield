import { ValidationError, areCloseEnough } from "../utils";

import { ValidatorFunction } from "../index";

export const NumberKeywords: Record<string, ValidatorFunction> = {
  minimum(schema, data, KeywordError) {
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
      throw KeywordError;
    }

    return data;
  },

  maximum(schema, data, KeywordError) {
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
      throw KeywordError;
    }

    return data;
  },

  multipleOf(schema, data, KeywordError) {
    if (typeof data !== "number") {
      return data;
    }

    const quotient = data / schema.multipleOf;

    if (!isFinite(quotient)) {
      return data;
    }

    if (!areCloseEnough(quotient, Math.round(quotient))) {
      throw KeywordError;
    }

    return data;
  },

  exclusiveMinimum(schema, data, KeywordError) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return data;
    }

    if (data <= schema.exclusiveMinimum + 1e-15) {
      throw KeywordError;
    }

    return data;
  },

  exclusiveMaximum(schema, data, KeywordError) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMaximum !== "number" ||
      "maximum" in schema
    ) {
      return data;
    }

    if (data >= schema.exclusiveMaximum - 1e-15) {
      throw KeywordError;
    }

    return data;
  }
};
