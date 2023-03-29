import { CompiledSchema, KeywordFunction } from "../index";
import {
  ValidationError,
  deepEqual,
  isCompiledSchema,
  isObject
} from "../utils";

export const OtherKeywords: Record<string, KeywordFunction> = {
  enum(schema, data, defineError) {
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

    return defineError("Value is not one of the allowed values", { data });
  },

  allOf(schema, data, defineError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          const error = schema.allOf[i].$validate(data);
          if (error) {
            return defineError("Value is not valid", { cause: error, data });
          }
        }
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          return defineError("Value is not valid", { data });
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        return defineError("Value is not valid", { data });
      }
    }

    return;
  },

  anyOf(schema, data, defineError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        if ("$validate" in schema.anyOf[i]) {
          const error = schema.anyOf[i].$validate(data);
          if (!error) {
            return;
          }
          continue;
        }
        return;
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return;
          }
        }

        if (data === schema.anyOf[i]) {
          return;
        }
      }
    }

    return defineError("Value is not valid", { data });
  },

  oneOf(schema, data, defineError) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        if ("$validate" in schema.oneOf[i]) {
          const error = schema.oneOf[i].$validate(data);
          if (!error) {
            validCount++;
          }
          continue;
        }
        validCount++;
        continue;
      } else {
        if (typeof schema.oneOf[i] === "boolean") {
          if (Boolean(data) === schema.oneOf[i]) {
            validCount++;
          }
          continue;
        }

        if (data === schema.oneOf[i]) {
          validCount++;
        }
      }
    }

    if (validCount === 1) {
      return;
    }

    return defineError("Value is not valid", { data });
  },

  const(schema, data, defineError) {
    if (
      data === schema.const ||
      (isObject(data) &&
        isObject(schema.const) &&
        deepEqual(data, schema.const)) ||
      (Array.isArray(data) &&
        Array.isArray(schema.const) &&
        deepEqual(data, schema.const))
    ) {
      return;
    }
    return defineError("Value is not valid", { data });
  },

  if(schema, data, defineError) {
    if ("then" in schema === false && "else" in schema === false) {
      return;
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          return schema.then.$validate(data);
        }
      } else if (schema.else) {
        return schema.else.$validate(data);
      }
      return;
    }

    const error = schema.if.$validate(data);
    if (!error) {
      if (schema.then) {
        return schema.then.$validate(data);
      }
      return;
    } else {
      if (schema.else) {
        return schema.else.$validate(data);
      }
      return;
    }
  },

  not(schema, data, defineError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return defineError("Value is not valid", { data });
      }
      return;
    }

    if (isObject(schema.not)) {
      if ("$validate" in schema.not) {
        const error = schema.not.$validate(data);
        if (!error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        return;
      }
      return defineError("Value is not valid", { data });
    }

    return defineError("Value is not valid", { data });
  }
};
