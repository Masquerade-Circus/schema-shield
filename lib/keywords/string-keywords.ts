import { ValidationError, deepEqual } from "../utils";

import { ValidatorFunction } from "../index";

export const StringKeywords: Record<string, ValidatorFunction> = {
  minLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return data;
    }

    throw KeywordError;
  },

  maxLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return data;
    }

    throw KeywordError;
  },

  pattern(schema, data, KeywordError) {
    if (typeof data !== "string") {
      return data;
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      throw KeywordError;
    }

    if (patternRegexp.test(data)) {
      return data;
    }

    throw KeywordError;
  },

  format(schema, data, KeywordError, formatInstance) {
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

      throw KeywordError;
    }

    throw KeywordError;
  },

  enum(schema, data, KeywordError) {
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

    throw KeywordError;
  }
};
