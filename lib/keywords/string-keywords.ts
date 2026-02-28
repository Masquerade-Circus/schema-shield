import { FormatFunction, KeywordFunction } from "../index";
import { compilePatternMatcher } from "../utils/pattern-matcher";

const PATTERN_MATCH_CACHE_LIMIT = 512;

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

    let patternMatch = (schema as any)._patternMatch as
      | ((value: string) => boolean)
      | undefined;

    let patternMatchCache = (schema as any)._patternMatchCache as
      | Map<string, boolean>
      | undefined;

    if (!patternMatch) {
      try {
        const compiled = compilePatternMatcher(schema.pattern);
        patternMatch =
          compiled instanceof RegExp
            ? (value: string) => compiled.test(value)
            : compiled;

        Object.defineProperty(schema, "_patternMatch", {
          value: patternMatch,
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

    if (!patternMatchCache) {
      patternMatchCache = new Map<string, boolean>();
      Object.defineProperty(schema, "_patternMatchCache", {
        value: patternMatchCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (patternMatchCache.has(data)) {
      if (patternMatchCache.get(data)) {
        return;
      }

      return defineError("Value does not match the pattern", { data });
    }

    const isMatch = patternMatch(data);
    if (patternMatchCache.size < PATTERN_MATCH_CACHE_LIMIT) {
      patternMatchCache.set(data, isMatch);
    }

    if (isMatch) {
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
