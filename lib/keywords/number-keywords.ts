import { KeywordFunction } from "../index";
import { areCloseEnough } from "../utils";

export const NumberKeywords: Record<string, KeywordFunction> = {
  minimum(schema, data, defineError, instance) {
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
      return defineError("Value is less than the minimum", { data });
    }

    return;
  },

  maximum(schema, data, defineError, instance) {
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
      return defineError("Value is greater than the maximum", { data });
    }

    return;
  },

  multipleOf(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }

    const quotient = data / schema.multipleOf;

    if (!isFinite(quotient)) {
      return;
    }

    if (!areCloseEnough(quotient, Math.round(quotient))) {
      return defineError("Value is not a multiple of the multipleOf", { data });
    }

    return;
  },

  exclusiveMinimum(schema, data, defineError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return;
    }

    if (data <= schema.exclusiveMinimum + 1e-15) {
      return defineError("Value is less than or equal to the exclusiveMinimum");
    }

    return;
  },

  exclusiveMaximum(schema, data, defineError, instance) {
    if (
      typeof data !== "number" ||
      typeof schema.exclusiveMaximum !== "number" ||
      "maximum" in schema
    ) {
      return;
    }

    if (data >= schema.exclusiveMaximum) {
      return defineError(
        "Value is greater than or equal to the exclusiveMaximum",
        { data }
      );
    }

    return;
  }
};
