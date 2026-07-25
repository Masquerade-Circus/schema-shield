import type { KeywordFunction } from "../index";
import { deepCloneUnfreeze } from "../utils/deep-freeze";
import { compilePatternMatcher } from "../utils/pattern-matcher";

const PATTERN_KEY_CACHE_LIMIT = 512;

type PatternPropertyEntry = {
  schemaProp: any;
  match: (key: string) => boolean;
};

type PropertyValidationEntry = {
  key: string;
  schemaProp: any;
  hasDefault: boolean;
};

export function getPatternPropertyEntries(
  schema: Record<string, any>,
  rebuild = false
) {
  let entries = (schema as any)._patternPropertyEntries as
    | PatternPropertyEntry[]
    | undefined;

  if (!rebuild && entries) {
    return entries;
  }

  if (
    !schema.patternProperties ||
    typeof schema.patternProperties !== "object" ||
    Array.isArray(schema.patternProperties)
  ) {
    return undefined;
  }

  const patternKeys = Object.keys(schema.patternProperties);
  entries = new Array(patternKeys.length);

  for (let i = 0; i < patternKeys.length; i++) {
    const key = patternKeys[i];
    const compiledMatcher = compilePatternMatcher(key);
    const match =
      compiledMatcher instanceof RegExp
        ? (value: string) => compiledMatcher.test(value)
        : compiledMatcher;

    entries[i] = {
      schemaProp: schema.patternProperties[key],
      match
    };
  }

  Object.defineProperty(schema, "_patternPropertyEntries", {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return entries;
}

function getPropertyValidationEntries(
  schema: Record<string, any>,
  rebuild = false
) {
  let entries = (schema as any)._propertyValidationEntries as
    | PropertyValidationEntry[]
    | undefined;
  if (!rebuild && entries) {
    return entries;
  }

  const requiredSet = Array.isArray(schema.required)
    ? new Set<string>(schema.required)
    : null;
  const propKeys = Object.keys(schema.properties || {});
  entries = [];

  for (let i = 0; i < propKeys.length; i++) {
    const key = propKeys[i];
    const schemaProp = schema.properties[key];
    const hasDefault =
      requiredSet !== null &&
      requiredSet.has(key) &&
      schemaProp &&
      typeof schemaProp === "object" &&
      !Array.isArray(schemaProp) &&
      "default" in schemaProp;

    if (schemaProp === false) {
      entries.push({ key, schemaProp, hasDefault: false });
      continue;
    }
    if (schemaProp === true) {
      continue;
    }
    if (
      schemaProp &&
      typeof schemaProp === "object" &&
      !Array.isArray(schemaProp) &&
      (typeof schemaProp.$validate === "function" || hasDefault)
    ) {
      entries.push({ key, schemaProp, hasDefault });
    }
  }

  Object.defineProperty(schema, "_propertyValidationEntries", {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });
  Object.defineProperty(schema, "_hasRequiredDefaults", {
    value: entries.some((entry) => entry.hasDefault),
    enumerable: false,
    configurable: false,
    writable: false
  });
  return entries;
}

function getAdditionalPropertiesValidate(
  schema: Record<string, any>,
  rebuild = false
) {
  let validate = (schema as any)._apValidate as
    | ((data: any) => any)
    | null
    | undefined;
  if (rebuild || !("_apValidate" in schema)) {
    const additionalSchema = schema.additionalProperties;
    validate =
      additionalSchema &&
      typeof additionalSchema === "object" &&
      !Array.isArray(additionalSchema) &&
      typeof additionalSchema.$validate === "function"
        ? additionalSchema.$validate
        : null;
    Object.defineProperty(schema, "_apValidate", {
      value: validate,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return validate;
}

export function prepareObjectKeywordCaches(schema: Record<string, any>) {
  if (
    schema.properties &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
  ) {
    getPropertyValidationEntries(schema, true);
  }
  if ("additionalProperties" in schema) {
    getAdditionalPropertiesValidate(schema, true);
  }
  if (
    schema.patternProperties &&
    typeof schema.patternProperties === "object" &&
    !Array.isArray(schema.patternProperties)
  ) {
    getPatternPropertyEntries(schema, true);
    Object.defineProperty(schema, "_patternKeyMatchIndexCache", {
      value: new Map<string, number[]>(),
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
}

function getPatternKeyMatchIndexes(
  schema: Record<string, any>,
  key: string,
  entries: PatternPropertyEntry[]
) {
  let cache = (schema as any)._patternKeyMatchIndexCache as
    | Map<string, number[]>
    | undefined;

  if (cache) {
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
  } else {
    cache = new Map<string, number[]>();
    Object.defineProperty(schema, "_patternKeyMatchIndexCache", {
      value: cache,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  const indexes: number[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (entries[i].match(key)) {
      indexes.push(i);
    }
  }

  if (cache.size < PATTERN_KEY_CACHE_LIMIT) {
    cache.set(key, indexes);
  }

  return indexes;
}

export const ObjectKeywords: Record<string, KeywordFunction | false> = {
  required(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        return defineError("Required property is missing", {
          item: key,
          data: data[key]
        });
      }
    }

    return;
  },

  properties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const validationEntries = getPropertyValidationEntries(schema);

    if ((schema as any)._hasRequiredDefaults !== true) {
      for (let i = 0; i < validationEntries.length; i++) {
        const { key, schemaProp } = validationEntries[i];
        if (!Object.prototype.hasOwnProperty.call(data, key)) {
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
    }

    const stagedDefaults: Array<{ key: string; value: any }> = [];
    for (let i = 0; i < validationEntries.length; i++) {
      const { key, schemaProp, hasDefault } = validationEntries[i];
      if (Object.prototype.hasOwnProperty.call(data, key) || !hasDefault) {
        continue;
      }
      const defaultValue = deepCloneUnfreeze(schemaProp.default);
      const validate = (schemaProp as any).$validate;
      const error = typeof validate === "function" ? validate(defaultValue) : undefined;
      if (error) {
        return defineError("Default property is invalid", {
          item: key,
          cause: error,
          data: defaultValue
        });
      }
      stagedDefaults.push({ key, value: defaultValue });
    }

    for (let i = 0; i < stagedDefaults.length; i++) {
      const { key, value } = stagedDefaults[i];
      if (key === "__proto__") {
        Object.defineProperty(data, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        data[key] = value;
      }
    }

    let stagedDefaultIndex = 0;
    for (let i = 0; i < validationEntries.length; i++) {
      const { key, schemaProp } = validationEntries[i];

      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      if (
        stagedDefaultIndex < stagedDefaults.length &&
        stagedDefaults[stagedDefaultIndex].key === key
      ) {
        stagedDefaultIndex++;
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const valueSchema = schema.values;
    const validate = valueSchema && valueSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }

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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    let count = 0;
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      count++;
      if (count > schema.maxProperties) {
        return defineError("Too many properties", { data });
      }
    }

    return;
  },

  minProperties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    let count = 0;
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      count++;
      if (count >= schema.minProperties) {
        return;
      }
    }

    return defineError("Too few properties", { data });
  },

  additionalProperties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const apValidate = getAdditionalPropertiesValidate(schema);

    const patternEntries = getPatternPropertyEntries(schema);

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }

      if (
        schema.properties &&
        Object.prototype.hasOwnProperty.call(schema.properties, key)
      ) {
        continue;
      }

      if (patternEntries && patternEntries.length) {
        if (getPatternKeyMatchIndexes(schema, key, patternEntries).length > 0) {
          continue;
        }
      }

      if (schema.additionalProperties === false) {
        return defineError("Additional properties are not allowed", {
          item: key,
          data: data[key]
        });
      }

      if (apValidate) {
        const error = apValidate(data[key]);
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const patternEntries = getPatternPropertyEntries(schema);
    if (!patternEntries || patternEntries.length === 0) {
      return;
    }

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }

      const matchingIndexes = getPatternKeyMatchIndexes(schema, key, patternEntries);

      if (matchingIndexes.length === 0) {
        if (
          schema.additionalProperties === false &&
          !(schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key))
        ) {
          return defineError("Additional properties are not allowed", {
            item: key,
            data: data[key]
          });
        }

        continue;
      }

      for (let j = 0; j < matchingIndexes.length; j++) {
        const schemaProp = patternEntries[matchingIndexes[j]].schemaProp;

        if (typeof schemaProp === "boolean") {
          if (schemaProp === false) {
            return defineError("Property is not allowed", {
              item: key,
              data: data[key]
            });
          }

          continue;
        }

        if ("$validate" in schemaProp) {
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

    return;
  },
  propertyNames(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const pn = schema.propertyNames;

    if (typeof pn === "boolean") {
      if (pn === false) {
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            return defineError("Properties are not allowed", { data });
          }
        }
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
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
