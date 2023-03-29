import { CompiledSchema, KeywordFunction } from "../index";
import { ValidationError, isCompiledSchema, isObject } from "../utils";

export const ObjectKeywords: Record<string, KeywordFunction | false> = {
  // Object
  required(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        return defineError("Required property is missing", { item: key });
      }
    }

    return;
  },

  properties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
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
          return defineError("Property is not allowed", { item: key });
        }
        continue;
      }

      if ("$validate" in schema.properties[key]) {
        const error = schema.properties[key].$validate(data[key]);
        if (error) {
          return defineError("Property is invalid", {
            item: key,
            cause: error
          });
        }
      }
    }

    return;
  },

  values(schema, data, defineError) {
    if (!isObject(data) || !isCompiledSchema(schema.values)) {
      return;
    }

    const keys = Object.keys(data);
    for (const key of keys) {
      const error = schema.values.$validate(data[key]);
      if (error) {
        return defineError("Property is invalid", { item: key, cause: error });
      }
    }

    return;
  },

  maxProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return;
    }

    return defineError("Too many properties");
  },

  minProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return;
    }

    return defineError("Too few properties");
  },

  additionalProperties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
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
        return defineError("Additional properties are not allowed", {
          item: key
        });
      }

      if (isCompiled) {
        const error = schema.additionalProperties.$validate(data[key]);
        if (error) {
          return defineError("Additional properties are invalid", {
            item: key,
            cause: error
          });
        }
      }
    }

    return;
  },

  patternProperties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in data) {
            if (regex.test(key)) {
              return defineError("Property is not allowed", { item: key });
            }
          }
        }
        continue;
      }

      const keys = Object.keys(data);
      for (const key of keys) {
        if (regex.test(key)) {
          if ("$validate" in schema.patternProperties[pattern]) {
            const error = schema.patternProperties[pattern].$validate(
              data[key]
            );
            if (error) {
              return defineError("Property is invalid", {
                item: key,
                cause: error
              });
            }
          }
        }
      }
    }

    return;
  },

  propertyNames(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        return defineError("Properties are not allowed");
      }
    }
    if (isCompiledSchema(schema.propertyNames)) {
      for (let key in data) {
        const error = schema.propertyNames.$validate(key);
        if (error) {
          return defineError("Property name is invalid", {
            item: key,
            cause: error
          });
        }
      }
    }

    return;
  },

  dependencies(schema, data, defineError) {
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
            return defineError("Dependency is not satisfied", { item: i });
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return defineError("Dependency is not satisfied");
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return defineError("Dependency is not satisfied");
      }
      const error = dependency.$validate(data);
      if (error) {
        return defineError("Dependency is not satisfied", { cause: error });
      }
    }

    return;
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

  // Metadata keywords (not used as a function)
  title: false,
  description: false,
  $comment: false,
  examples: false,
  contentMediaType: false,
  contentEncoding: false,

  // Not supported Open API keywords
  discriminator: false,
  nullable: false
};
