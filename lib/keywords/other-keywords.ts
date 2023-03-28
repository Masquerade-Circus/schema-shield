import { CompiledSchema, ValidatorFunction } from "../index";
import {
  ValidationError,
  deepEqual,
  isCompiledSchema,
  isObject
} from "../utils";

export const OtherKeywords: Record<string, ValidatorFunction> = {
  nullable(schema, data, KeywordError) {
    if (schema.nullable && data !== null) {
      throw KeywordError;
    }

    return data;
  },

  allOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          data = schema.allOf[i].$validate(data);
        }
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          throw KeywordError;
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        throw KeywordError;
      }
    }

    return data;
  },

  anyOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        try {
          if ("$validate" in schema.anyOf[i]) {
            data = schema.anyOf[i].$validate(data);
          }
          return data;
        } catch (error) {
          continue;
        }
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return data;
          }
        }

        if (data === schema.anyOf[i]) {
          return data;
        }
      }
    }

    throw KeywordError;
  },

  oneOf(schema, data, KeywordError) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        if ("$validate" in schema.oneOf[i] === false) {
          validCount++;
          continue;
        }
        try {
          data = schema.oneOf[i].$validate(data);
          validCount++;
        } catch (error) {
          continue;
        }
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
      return data;
    }

    throw KeywordError;
  },

  dependencies(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
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
            throw KeywordError;
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        throw KeywordError;
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        throw KeywordError;
      }

      data = dependency.$validate(data);
    }

    return data;
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
      return data;
    }
    throw KeywordError;
  },

  if(schema, data, KeywordError) {
    if ("then" in schema === false && "else" in schema === false) {
      return data;
    }

    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          return schema.then.$validate(data);
        }
      } else if (schema.else) {
        return schema.else.$validate(data);
      }
      return data;
    }

    try {
      data = schema.if.$validate(data);
      if (schema.then) {
        try {
          return schema.then.$validate(data);
        } catch (error) {
          KeywordError.message = `Value must match then schema if it matches if schema`;
          throw KeywordError;
        }
      }
    } catch (error) {
      if (
        error instanceof ValidationError === false ||
        error.message === "Value must match then schema if it matches if schema"
      ) {
        throw error;
      }
      if (schema.else) {
        try {
          return schema.else.$validate(data);
        } catch (error) {
          KeywordError.message = `Value must match else schema if it does not match if schema`;
          throw KeywordError;
        }
      }
    }

    return data;
  },

  not(schema, data, KeywordError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        throw KeywordError;
      }
      return data;
    }

    try {
      data = schema.not.$validate(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        return data;
      }
    }

    throw KeywordError;
  }
};
