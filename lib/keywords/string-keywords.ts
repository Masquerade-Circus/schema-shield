import { ValidationError, ValidatorFunction, deepEqual } from "../utils"

export const StringKeywords: Record<string, ValidatorFunction> = {
  minLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError("String is too short", {
          pointer,
          value: data,
          code: "STRING_TOO_SHORT"
        })
      ],
      data
    };
  },

  maxLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError("String is too long", {
          pointer,
          value: data,
          code: "STRING_TOO_LONG"
        })
      ],
      data
    };
  },

  pattern(schema, data, pointer) {
    if (typeof data !== "string") {
      return { valid: true, errors: [], data };
    }

    const patternRegexp =
      typeof schema.pattern === "string"
        ? new RegExp(schema.pattern)
        : schema.pattern;

    if (patternRegexp instanceof RegExp === false) {
      return {
        valid: false,
        errors: [
          new ValidationError("Pattern is not a valid regular expression", {
            pointer,
            value: data,
            code: "PATTERN_IS_NOT_REGEXP"
          })
        ],
        data
      };
    }

    const valid = patternRegexp.test(data);

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError("String does not match pattern", {
              pointer,
              value: data,
              code: "STRING_DOES_NOT_MATCH_PATTERN"
            })
          ],
      data
    };
  },

  format(schema, data, pointer, formatInstance) {
    if (typeof data !== "string") {
      return { valid: true, errors: [], data };
    }

    const formatValidate = formatInstance.formats.get(schema.format);
    if (!formatValidate) {
      return {
        valid: false,
        errors: [
          new ValidationError(`Unknown format ${schema.format}`, {
            pointer,
            value: data,
            code: "UNKNOWN_FORMAT"
          })
        ],
        data
      };
    }

    const valid = formatValidate(data);

    return {
      valid,
      errors: valid
        ? []
        : [
            new ValidationError(
              `String does not match format ${schema.format}`,
              {
                pointer,
                value: data,
                code: "STRING_DOES_NOT_MATCH_FORMAT"
              }
            )
          ],
      data
    };
  },

  enum(schema, data, pointer) {
    // Simple equality check
    for (let i = 0; i < schema.enum.length; i++) {
      if (schema.enum[i] === data) {
        return { valid: true, errors: [], data };
      }
    }

    // If is an array check for a deep equality
    if (Array.isArray(data)) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (Array.isArray(schema.enum[i])) {
          if (deepEqual(schema.enum[i], data)) {
            return { valid: true, errors: [], data };
          }
        }
      }
    }

    // If is an object check for a deep equality
    if (typeof data === "object" && data !== null) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (typeof schema.enum[i] === "object" && schema.enum[i] !== null) {
          if (deepEqual(schema.enum[i], data)) {
            return { valid: true, errors: [], data };
          }
        }
      }
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must be one of ${schema.enum.join(", ")}`, {
          pointer,
          value: data,
          code: "VALUE_NOT_IN_ENUM"
        })
      ],
      data
    };
  }
};
