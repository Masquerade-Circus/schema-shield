import { FormatFunction, KeywordFunction } from "../index";

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

    let patternRegexp = (schema as any)._patternRegexp as RegExp | undefined;
    if (!patternRegexp) {
      try {
        patternRegexp = new RegExp(schema.pattern, "u");
        Object.defineProperty(schema, "_patternRegexp", {
          value: patternRegexp,
          enumerable: false,
          configurable: false,
          writable: false
        });
      } catch (error) {
        return defineError("Invalid regular expression", {
          data,
          cause: error
        });
      }
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

    let formatValidate = (schema as any)._formatValidate as
      | FormatFunction
      | false
      | undefined;

    if (formatValidate === undefined) {
      formatValidate = instance.getFormat(schema.format);
      Object.defineProperty(schema, "_formatValidate", {
        value: formatValidate,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (!formatValidate || formatValidate(data)) {
      return;
    }

    return defineError("Value does not match the format", { data });
  }
};
