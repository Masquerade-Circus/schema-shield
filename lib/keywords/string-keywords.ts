import { ValidationError, deepEqual } from "../utils";

import { ValidatorFunction } from "../index";

export const StringKeywords: Record<string, ValidatorFunction> = {
  minLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return data;
    }

    throw new ValidationError("String is too short", pointer);
  },

  maxLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return data;
    }

    throw new ValidationError("String is too long", pointer);
  },

  pattern(schema, data, pointer) {
    if (typeof data !== "string") {
      return data;
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      throw new ValidationError(
        "Pattern is not a valid regular expression",
        pointer
      );
    }

    if (patternRegexp.test(data)) {
      return data;
    }

    throw new ValidationError("String does not match pattern", pointer);
  },

  format(schema, data, pointer, formatInstance) {
    if (typeof data !== "string") {
      return data;
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return data;
    }

    if (typeof formatValidate === "function") {
      if (formatValidate(data)) {
        return data;
      }

      throw new ValidationError(
        `String does not match format ${schema.format}`,
        pointer
      );
    }

    throw new ValidationError(`Unknown format ${schema.format}`, pointer);
  },

  enum(schema, data, pointer) {
    // Check if data is an array or an object
    const isArray = Array.isArray(data);
    const isObject = typeof data === "object" && data !== null;

    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];

      // Simple equality check
      if (enumItem === data) {
        return data;
      }

      // If data is an array or an object, check for deep equality
      if (
        (isArray && Array.isArray(enumItem)) ||
        (isObject && typeof enumItem === "object" && enumItem !== null)
      ) {
        if (deepEqual(enumItem, data)) {
          return data;
        }
      }
    }

    throw new ValidationError(
      `Value must be one of ${schema.enum.join(", ")}`,
      pointer
    );
  }
};
