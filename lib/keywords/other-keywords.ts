import { CompiledSchema, KeywordFunction } from "../index";
import {
  ValidationError,
  deepEqual,
  isCompiledSchema,
  isObject
} from "../utils";

export const OtherKeywords: Record<string, KeywordFunction> = {
  nullable(schema, data, KeywordError) {
    if (schema.nullable && data !== null) {
      return KeywordError;
    }

    return;
  },

  allOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          const error = schema.allOf[i].$validate(data);
          if (error) {
            return error;
          }
        }
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          return KeywordError;
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        return KeywordError;
      }
    }

    return;
  },

  anyOf(schema, data, KeywordError) {
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

    return KeywordError;
  },

  oneOf(schema, data, KeywordError) {
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

    return KeywordError;
  },

  dependencies(schema, data, KeywordError) {
    if (!isObject(data)) {
      return;
    }

    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }

      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            KeywordError.item = i;
            return KeywordError;
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return KeywordError;
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return KeywordError;
      }
      const error = dependency.$validate(data);
      if (error) {
        return error;
      }
    }

    return;
  },

  const(schema, data, KeywordError) {
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
    return KeywordError;
  },

  if(schema, data, KeywordError) {
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

  not(schema, data, KeywordError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return KeywordError;
      }
      return;
    }

    if (isObject(schema.not)) {
      if ("$validate" in schema.not) {
        const error = schema.not.$validate(data);
        if (!error) {
          return KeywordError;
        }
        return;
      }
      return KeywordError;
    }

    return KeywordError;
  }
};
