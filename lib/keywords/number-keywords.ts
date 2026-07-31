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

    if (
      (schema as any)._dialect !== "draft4" &&
      typeof schema.exclusiveMinimum === "number"
    ) {
      if (data <= schema.exclusiveMinimum) {
        return defineError("Value is less than or equal to the exclusiveMinimum", {
          data
        });
      }
    } else if (schema.exclusiveMinimum === true) {
      if (data <= schema.minimum) {
        return defineError("Value is less than or equal to the minimum", { data });
      }
    } else if (data < schema.minimum) {
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

    if (
      (schema as any)._dialect !== "draft4" &&
      typeof schema.exclusiveMaximum === "number"
    ) {
      if (data >= schema.exclusiveMaximum) {
        return defineError(
          "Value is greater than or equal to the exclusiveMaximum",
          { data }
        );
      }
    } else if (schema.exclusiveMaximum === true) {
      if (data >= schema.maximum) {
        return defineError("Value is greater than or equal to the maximum", {
          data
        });
      }
    } else if (data > schema.maximum) {
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
      (schema as any)._dialect === "draft4" ||
      typeof schema.exclusiveMinimum !== "number" ||
      "minimum" in schema
    ) {
      return;
    }

    if (data <= schema.exclusiveMinimum) {
      return defineError("Value is less than or equal to the exclusiveMinimum");
    }

    return;
  },

  exclusiveMaximum(schema, data, defineError, instance) {
    if (
      typeof data !== "number" ||
      (schema as any)._dialect === "draft4" ||
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
