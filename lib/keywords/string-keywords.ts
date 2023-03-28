import { ValidationError, deepEqual } from "../utils";

import { KeywordFunction } from "../index";

export const StringKeywords: Record<string, KeywordFunction> = {
  minLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return;
    }

    return KeywordError;
  },

  maxLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return;
    }

    return KeywordError;
  },

  pattern(schema, data, KeywordError) {
    if (typeof data !== "string") {
      return;
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      return KeywordError;
    }

    if (patternRegexp.test(data)) {
      return;
    }

    return KeywordError;
  },

  format(schema, data, KeywordError, formatInstance) {
    if (typeof data !== "string") {
      return;
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return;
    }

    if (typeof formatValidate === "function") {
      if (formatValidate(data)) {
        return;
      }

      return KeywordError;
    }

    return KeywordError;
  },

  enum(schema, data, KeywordError) {
    // Check if data is an array or an object
    const isArray = Array.isArray(data);
    const isObject = typeof data === "object" && data !== null;

    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];

      // Simple equality check
      if (enumItem === data) {
        return;
      }

      // If data is an array or an object, check for deep equality
      if (
        (isArray && Array.isArray(enumItem)) ||
        (isObject && typeof enumItem === "object" && enumItem !== null)
      ) {
        if (deepEqual(enumItem, data)) {
          return;
        }
      }
    }

    return KeywordError;
  }
};
