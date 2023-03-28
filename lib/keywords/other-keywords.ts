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
      return [false, KeywordError];
    }

    return [true, null];
  },

  allOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          const [isValid, error] = schema.allOf[i].$validate(data);
          if (!isValid) {
            return [false, KeywordError];
          }
        }
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          return [false, KeywordError];
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        return [false, KeywordError];
      }
    }

    return [true, null];
  },

  anyOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        if ("$validate" in schema.anyOf[i]) {
          const [isValid, error] = schema.anyOf[i].$validate(data);
          if (isValid) {
            return [true, null];
          }
          continue;
        }
        return [true, null];
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return [true, null];
          }
        }

        if (data === schema.anyOf[i]) {
          return [true, null];
        }
      }
    }

    return [false, KeywordError];
  },

  oneOf(schema, data, KeywordError) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        if ("$validate" in schema.oneOf[i]) {
          const [isValid, error] = schema.oneOf[i].$validate(data);
          if (isValid) {
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
      return [true, null];
    }

    return [false, KeywordError];
  },

  dependencies(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
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
            return [false, KeywordError];
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return [false, KeywordError];
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return [false, KeywordError];
      }
      const [isValid, error] = dependency.$validate(data);
      if (!isValid) {
        return [false, error];
      }
    }

    return [true, null];
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
      return [true, null];
    }
    return [false, KeywordError];
  },

  if(schema, data, KeywordError) {
    if ("then" in schema === false && "else" in schema === false) {
      return [true, null];
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          return schema.then.$validate(data);
        }
      } else if (schema.else) {
        return schema.else.$validate(data);
      }
      return [true, null];
    }

    const [isValid, error] = schema.if.$validate(data);
    if (isValid) {
      if (schema.then) {
        return schema.then.$validate(data);
      }
      return [true, null];
    } else {
      if (schema.else) {
        return schema.else.$validate(data);
      }
      return [true, null];
    }
  },

  not(schema, data, KeywordError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return [false, KeywordError];
      }
      return [true, null];
    }

    if (isObject(schema.not)) {
      if ("$validate" in schema.not) {
        const [valid, error] = schema.not.$validate(data);
        if (valid) {
          return [false, KeywordError];
        }
        return [true, null];
      }
      return [false, KeywordError];
    }

    return [false, KeywordError];
  }
};
