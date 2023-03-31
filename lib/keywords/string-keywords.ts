import { KeywordFunction } from "../index";

export const StringKeywords: Record<string, KeywordFunction> = {
  minLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return;
    }

    return defineError("Value is shorter than the minimum length", { data });
  },

  maxLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return;
    }

    return defineError("Value is longer than the maximum length", { data });
  },

  pattern(schema, data, defineError) {
    if (typeof data !== "string") {
      return;
    }

    const patternRegexp = new RegExp(schema.pattern, "u");

    if (patternRegexp instanceof RegExp === false) {
      return defineError("Invalid regular expression", { data });
    }

    if (patternRegexp.test(data)) {
      return;
    }

    return defineError("Value does not match the pattern", { data });
  },

  // Take into account that if we receive a format that is not defined, we
  // will not throw an error, we just ignore it.
  format(schema, data, defineError, instance) {
    if (typeof data !== "string") {
      return;
    }

    const formatValidate = instance.getFormat(schema.format);
    if (!formatValidate || formatValidate(data)) {
      return;
    }

    return defineError("Value does not match the format", { data });
  }
};
