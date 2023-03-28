import { CompiledSchema, KeywordFunction } from "../index";
import { ValidationError, isCompiledSchema, isObject } from "../utils";

export const ObjectKeywords: Record<string, KeywordFunction | false> = {
  // Object
  required(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        KeywordError.item = key;
        return [false, KeywordError];
      }
    }

    return [true, null];
  },

  properties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
    }

    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      if (typeof data[key] === "undefined") {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && "default" in schemaProp) {
          data[key] = schemaProp.default;
        }
        continue;
      }

      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          KeywordError.item = key;
          return [false, KeywordError];
        }
        continue;
      }

      if ("$validate" in schema.properties[key]) {
        const [valid, error] = schema.properties[key].$validate(data[key]);
        if (!valid) {
          KeywordError.item = key;
          return [false, KeywordError];
        }
      }
    }

    return [true, null];
  },

  maxProperties(schema, data, KeywordError) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  minProperties(schema, data, KeywordError) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  additionalProperties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
    }

    const keys = Object.keys(data);
    const isCompiled = isCompiledSchema(schema.additionalProperties);
    for (const key of keys) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }

      if (schema.patternProperties) {
        let match = false;
        for (const pattern in schema.patternProperties) {
          if (new RegExp(pattern, "u").test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }

      if (schema.additionalProperties === false) {
        KeywordError.item = key;
        return [false, KeywordError];
      }

      if (isCompiled) {
        const [valid, error] = schema.additionalProperties.$validate(data[key]);
        if (!valid) {
          KeywordError.item = key;
          return [false, KeywordError];
        }
      }
    }

    return [true, null];
  },

  patternProperties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
    }

    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in data) {
            if (regex.test(key)) {
              KeywordError.item = key;
              return [false, KeywordError];
            }
          }
        }
        continue;
      }

      const keys = Object.keys(data);
      for (const key of keys) {
        if (regex.test(key)) {
          if ("$validate" in schema.patternProperties[pattern]) {
            const [valid, error] = schema.patternProperties[pattern].$validate(
              data[key]
            );
            if (!valid) {
              KeywordError.item = key;
              return [false, KeywordError];
            }
          }
        }
      }
    }

    return [true, null];
  },

  propertyNames(schema, data, KeywordError) {
    if (!isObject(data)) {
      return [true, null];
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        return [false, KeywordError];
      }
    }
    if (isCompiledSchema(schema.propertyNames)) {
      for (let key in data) {
        const [valid, error] = schema.propertyNames.$validate(key);
        if (!valid) {
          KeywordError.item = key;
          return [false, KeywordError];
        }
      }
    }

    return [true, null];
  },

  // Required by other keywords but not used as a function itself
  then: false,
  else: false,
  default: false,

  // Not implemented yet
  $ref: false,
  definitions: false,
  $id: false,
  $schema: false,
  title: false,
  $comment: false,
  contentMediaType: false,
  contentEncoding: false
};
