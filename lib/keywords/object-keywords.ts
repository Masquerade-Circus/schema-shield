import { deepClone, isCompiledSchema, isObject } from "../utils";

import { KeywordFunction } from "../index";

export const ObjectKeywords: Record<string, KeywordFunction | false> = {
  required(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        return defineError("Required property is missing", {
          item: key,
          data: data[key]
        });
      }
    }

    return;
  },

  properties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    let propKeys = (schema as any)._propKeys as string[] | undefined;
    if (!propKeys) {
      propKeys = Object.keys(schema.properties || {});
      Object.defineProperty(schema, "_propKeys", {
        value: propKeys,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    let requiredKeys = (schema as any)._requiredKeys as
      | string[]
      | null
      | undefined;
    if (requiredKeys === undefined) {
      requiredKeys = Array.isArray(schema.required) ? schema.required : null;
      Object.defineProperty(schema, "_requiredKeys", {
        value: requiredKeys,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    const required = requiredKeys || [];

    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i];
      const schemaProp = schema.properties[key];

      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        if (
          required.length &&
          required.indexOf(key) !== -1 &&
          isObject(schemaProp) &&
          "default" in schemaProp
        ) {
          const error = schemaProp.$validate(schemaProp.default);
          if (error) {
            return defineError("Default property is invalid", {
              item: key,
              cause: error,
              data: schemaProp.default
            });
          }
          data[key] = deepClone(schemaProp.default);
        }
        continue;
      }

      if (typeof schemaProp === "boolean") {
        if (schemaProp === false) {
          return defineError("Property is not allowed", {
            item: key,
            data: data[key]
          });
        }
        continue;
      }

      if (schemaProp && "$validate" in schemaProp) {
        const error = schemaProp.$validate(data[key]);
        if (error) {
          return defineError("Property is invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
        }
      }
    }

    return;
  },
  values(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    const valueSchema = schema.values;
    const validate = valueSchema && valueSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const error = validate(data[key]);
      if (error) {
        return defineError("Property is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
  },

  maxProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return;
    }

    return defineError("Too many properties", { data });
  },

  minProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return;
    }

    return defineError("Too few properties", { data });
  },

  additionalProperties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }

    const keys = Object.keys(data);

    let apIsCompiled = (schema as any)._apIsCompiled as boolean | undefined;
    if (apIsCompiled === undefined) {
      apIsCompiled = isCompiledSchema(schema.additionalProperties);
      Object.defineProperty(schema, "_apIsCompiled", {
        value: apIsCompiled,
        enumerable: false
      });
    }

    let patternList = (schema as any)._patternPropertiesList as
      | { regex: RegExp; key: string }[]
      | undefined;

    if (schema.patternProperties && !patternList) {
      patternList = [];
      for (const pattern in schema.patternProperties) {
        patternList.push({
          regex: new RegExp(pattern, "u"),
          key: pattern
        });
      }
      Object.defineProperty(schema, "_patternPropertiesList", {
        value: patternList,
        enumerable: false
      });
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }

      if (patternList && patternList.length) {
        let match = false;
        for (let j = 0; j < patternList.length; j++) {
          if (patternList[j].regex.test(key)) {
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
          item: key,
          data: data[key]
        });
      }

      if (apIsCompiled && isCompiledSchema(schema.additionalProperties)) {
        const error = schema.additionalProperties.$validate(data[key]);
        if (error) {
          return defineError("Additional properties are invalid", {
            item: key,
            cause: error,
            data: data[key]
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

    let patternList = (schema as any)._patternPropertiesList as
      | { regex: RegExp; key: string }[]
      | undefined;

    if (!patternList) {
      patternList = [];
      const patterns = Object.keys(schema.patternProperties || {});
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        patternList.push({
          regex: new RegExp(pattern, "u"),
          key: pattern
        });
      }
      Object.defineProperty(schema, "_patternPropertiesList", {
        value: patternList,
        enumerable: false
      });
    }

    const dataKeys = Object.keys(data);

    for (let p = 0; p < patternList.length; p++) {
      const { regex, key: patternKey } = patternList[p];
      const schemaProp = schema.patternProperties[patternKey];

      if (typeof schemaProp === "boolean") {
        if (schemaProp === false) {
          for (let i = 0; i < dataKeys.length; i++) {
            const key = dataKeys[i];
            if (regex.test(key)) {
              return defineError("Property is not allowed", {
                item: key,
                data: data[key]
              });
            }
          }
        }
        continue;
      }

      if ("$validate" in schemaProp) {
        for (let i = 0; i < dataKeys.length; i++) {
          const key = dataKeys[i];
          if (regex.test(key)) {
            const error = schemaProp.$validate(data[key]);
            if (error) {
              return defineError("Property is invalid", {
                item: key,
                cause: error,
                data: data[key]
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

    const pn = schema.propertyNames;

    if (typeof pn === "boolean") {
      if (pn === false && Object.keys(data).length > 0) {
        return defineError("Properties are not allowed", { data });
      }
      return;
    }

    const validate = pn && pn.$validate;
    if (typeof validate !== "function") {
      return;
    }

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      const error = validate(key);
      if (error) {
        return defineError("Property name is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
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
            return defineError("Dependency is not satisfied", {
              item: i,
              data: dependency[i]
            });
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return defineError("Dependency is not satisfied", { data: dependency });
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return defineError("Dependency is not satisfied", { data: dependency });
      }
      const error = dependency.$validate(data);
      if (error) {
        return defineError("Dependency is not satisfied", {
          cause: error,
          data
        });
      }
    }

    return;
  },

  // Required by other keywords but not used as a function itself
  then: false,
  else: false,
  default: false,

  // Not implemented yet
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
