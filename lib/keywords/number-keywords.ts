import { KeywordFunction } from "../index";
import { areCloseEnough } from "../utils/index";

export const NumberKeywords: Record<string, KeywordFunction> = {
  minimum(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }
    if (!Number.isFinite(data)) {
      return defineError("Value must be finite", { data });
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
    if (!Number.isFinite(data)) {
      return defineError("Value must be finite", { data });
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

    if (
      !Number.isFinite(data) ||
      !Number.isFinite(schema.multipleOf) ||
      schema.multipleOf <= 0
    ) {
      return defineError("Value must use a finite positive multipleOf", {
        data
      });
    }

    const quotient = data / schema.multipleOf;
    const valid = Number.isFinite(quotient)
      ? areCloseEnough(quotient, Math.round(quotient))
      : data % schema.multipleOf === 0;
    if (!valid) {
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
