import { ValidationError, areCloseEnough } from "../utils";

import { KeywordFunction } from "../index";

export const NumberKeywords: Record<string, KeywordFunction> = {
  minimum(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return;
    }

    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }

    if (data < min) {
      return KeywordError;
    }

    return;
  },

  maximum(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return;
    }

    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }

    if (data > max) {
      return KeywordError;
    }

    return;
  },

  multipleOf(schema, data, KeywordError, instance) {
    if (typeof data !== "number") {
      return;
    }

    const quotient = data / schema.multipleOf;

    if (!isFinite(quotient)) {
      return;
    }

    if (!areCloseEnough(quotient, Math.round(quotient))) {
      return KeywordError;
    }

    return;
  },

  exclusiveMinimum(schema, data, KeywordError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return;
    }

    if (data <= schema.exclusiveMinimum + 1e-15) {
      return KeywordError;
    }

    return;
  },

  exclusiveMaximum(schema, data, KeywordError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMaximum !== "number" ||
      "maximum" in schema
    ) {
      return;
    }

    if (data >= schema.exclusiveMaximum) {
      return KeywordError;
    }

    return;
  }
};
