import { ValidationError, deepEqual } from "../utils";

import { KeywordFunction } from "../index";

export const StringKeywords: Record<string, KeywordFunction> = {
  minLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return;
    }

    return defineError("Value is shorter than the minimum length");
  },

  maxLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return;
    }

    return defineError("Value is longer than the maximum length");
  },

  pattern(schema, data, defineError) {
    if (typeof data !== "string") {
      return;
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      return defineError("Invalid regular expression");
    }

    if (patternRegexp.test(data)) {
      return;
    }

    return defineError("Value does not match the pattern");
  },

  format(schema, data, defineError, formatInstance) {
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

      return defineError("Value does not match the format");
    }

    return defineError("Format is not supported");
  }
};
