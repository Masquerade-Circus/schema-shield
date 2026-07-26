import { FormatFunction, KeywordFunction } from "../index";
import { compilePatternMatcher } from "../utils/pattern-matcher";
import { definePropertyOrThrow } from "../utils/main-utils";

const PATTERN_MATCH_CACHE_LIMIT = 512;
const FORMAT_RESULT_CACHE_LIMIT = 512;

function hasAtLeastCodePoints(value: string, limit: number): boolean {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (
      unit >= 0xd800 &&
      unit <= 0xdbff &&
      index + 1 < value.length
    ) {
      const nextUnit = value.charCodeAt(index + 1);
      if (nextUnit >= 0xdc00 && nextUnit <= 0xdfff) {
        index++;
      }
    }

    count++;
    if (count >= limit) {
      return true;
    }
  }

  return count >= limit;
}

export const StringKeywords: Record<string, KeywordFunction> = {
  minLength(schema, data, defineError) {
    if (typeof data !== "string") {
      return;
    }

    const units = data.length;
    const limit = schema.minLength;
    if (units < limit) {
      return defineError("Value is shorter than the minimum length", { data });
    }
    if (units - limit >= limit || hasAtLeastCodePoints(data, limit)) {
      return;
    }

    return defineError("Value is shorter than the minimum length", { data });
  },

  maxLength(schema, data, defineError) {
    if (typeof data !== "string") {
      return;
    }

    const units = data.length;
    const limit = schema.maxLength;
    if (units <= limit) {
      return;
    }
    if (units - limit > limit || hasAtLeastCodePoints(data, limit + 1)) {
      return defineError("Value is longer than the maximum length", { data });
    }

    return;
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

        definePropertyOrThrow(schema, "_patternMatch", {
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
      definePropertyOrThrow(schema, "_patternMatchCache", {
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
    let formatResultCacheEnabled = (schema as any)._formatResultCacheEnabled as
      | boolean
      | undefined;
    let formatResultCache = (schema as any)._formatResultCache as
      | Map<string, boolean>
      | undefined;

    if (formatValidate === undefined) {
      formatValidate = instance.getFormat(schema.format);
      definePropertyOrThrow(schema, "_formatValidate", {
        value: formatValidate,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (!formatValidate) {
      return;
    }

    if (formatResultCacheEnabled === undefined) {
      formatResultCacheEnabled = instance.isDefaultFormatValidator(
        schema.format,
        formatValidate
      );

      definePropertyOrThrow(schema, "_formatResultCacheEnabled", {
        value: formatResultCacheEnabled,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (!formatResultCacheEnabled) {
      if (formatValidate(data)) {
        return;
      }

      return defineError("Value does not match the format", { data });
    }

    if (!formatResultCache) {
      formatResultCache = new Map<string, boolean>();
      definePropertyOrThrow(schema, "_formatResultCache", {
        value: formatResultCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (formatResultCache.has(data)) {
      if (formatResultCache.get(data)) {
        return;
      }

      return defineError("Value does not match the format", { data });
    }

    const isValid = formatValidate(data);
    if (formatResultCache.size < FORMAT_RESULT_CACHE_LIMIT) {
      formatResultCache.set(data, isValid);
    }

    if (isValid) {
      return;
    }

    return defineError("Value does not match the format", { data });
  }
};
