import { ValidationError, areCloseEnough } from "../utils";

import { KeywordFunction } from "../index";

export const NumberKeywords: Record<string, KeywordFunction> = {
  minimum(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return [true, null];
    }

    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }

    if (data < min) {
      return [false, KeywordError];
    }

    return [true, null];
  },

  maximum(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return [true, null];
    }

    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }

    if (data > max) {
      return [false, KeywordError];
    }

    return [true, null];
  },

  multipleOf(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return [true, null];
    }

    const quotient = data / schema.multipleOf;

    if (!isFinite(quotient)) {
      return [true, null];
    }

    if (!areCloseEnough(quotient, Math.round(quotient))) {
      return [false, KeywordError];
    }

    return [true, null];
  },

  exclusiveMinimum(schema, data, KeywordError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return [true, null];
    }

    if (data <= schema.exclusiveMinimum + 1e-15) {
      return [false, KeywordError];
    }

    return [true, null];
  },

  exclusiveMaximum(schema, data, KeywordError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMaximum !== "number" ||
      "maximum" in schema
    ) {
      return [true, null];
    }

    if (data >= schema.exclusiveMaximum) {
      return [false, KeywordError];
    }

    return [true, null];
  }
};
