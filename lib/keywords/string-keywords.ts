import { ValidationError, deepEqual } from "../utils";

import { KeywordFunction } from "../index";

export const StringKeywords: Record<string, KeywordFunction> = {
  minLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  maxLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  pattern(schema, data, KeywordError) {
    if (typeof data !== "string") {
      return [true, null];
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      return [false, KeywordError];
    }

    if (patternRegexp.test(data)) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  format(schema, data, KeywordError, formatInstance) {
    if (typeof data !== "string") {
      return [true, null];
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return [true, null];
    }

    if (typeof formatValidate === "function") {
      if (formatValidate(data)) {
        return [true, null];
      }

      return [false, KeywordError];
    }

    return [false, KeywordError];
  },

  enum(schema, data, KeywordError) {
    // Check if data is an array or an object
    const isArray = Array.isArray(data);
    const isObject = typeof data === "object" && data !== null;

    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];

      // Simple equality check
      if (enumItem === data) {
        return [true, null];
      }

      // If data is an array or an object, check for deep equality
      if (
        (isArray && Array.isArray(enumItem)) ||
        (isObject && typeof enumItem === "object" && enumItem !== null)
      ) {
        if (deepEqual(enumItem, data)) {
          return [true, null];
        }
      }
    }

    return [false, KeywordError];
  }
};
