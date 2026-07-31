import {
  definePropertyOrThrow,
  hasOwn,
  isCompiledSchema
} from "../utils/main-utils";

import type { KeywordFunction, SchemaShield } from "../index";
import { deepCloneUnfreeze } from "../utils/deep-freeze";
import { compilePatternMatcher } from "../utils/pattern-matcher";

const PATTERN_KEY_CACHE_LIMIT = 512;

type PatternPropertyEntry = {
  schemaProp: any;
  match: (key: string) => boolean;
};

interface ApplyPropertyDefaultsFunction {
  (schema: Record<string, any>, data: any, instance: SchemaShield): void;
}

function createApplyPropertyDefaults(
  replaceEmpty: boolean
): ApplyPropertyDefaultsFunction {
  return function applyPropertyDefaults(schema, data, instance) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const defaultKeys = (schema as any)._defaultKeys as string[];
    for (let i = 0; i < defaultKeys.length; i++) {
      const key = defaultKeys[i];
      const hasOwnValue = hasOwn(data, key);
      const value = hasOwnValue ? data[key] : undefined;
      if (
        hasOwnValue &&
        value !== undefined &&
        (!replaceEmpty || (value !== null && value !== ""))
      ) {
        continue;
      }

      instance.setDefault(
        data,
        key,
        deepCloneUnfreeze(schema.properties[key].default)
      );
    }
  };
}

export const applyPropertyDefaults = createApplyPropertyDefaults(false);
export const applyEmptyPropertyDefaults = createApplyPropertyDefaults(true);

function getPatternPropertyEntries(schema: Record<string, any>) {
  let entries = (schema as any)._patternPropertyEntries as
    | PatternPropertyEntry[]
    | undefined;

  if (entries) {
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

  definePropertyOrThrow(schema, "_patternPropertyEntries", {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return entries;
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
    definePropertyOrThrow(schema, "_patternKeyMatchIndexCache", {
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

function decodeBase64(data: string): string | null {
  if (
    data.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      data
    )
  ) {
    return null;
  }

  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const first = alphabet.indexOf(data[index]);
    const second = alphabet.indexOf(data[index + 1]);
    const third = data[index + 2] === "=" ? 0 : alphabet.indexOf(data[index + 2]);
    const fourth = data[index + 3] === "=" ? 0 : alphabet.indexOf(data[index + 3]);
    const value = (first << 18) | (second << 12) | (third << 6) | fourth;
    bytes.push((value >> 16) & 255);
    if (data[index + 2] !== "=") {
      bytes.push((value >> 8) & 255);
    }
    if (data[index + 3] !== "=") {
      bytes.push(value & 255);
    }
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      new Uint8Array(bytes)
    );
  } catch {
    return null;
  }
}

export const ObjectKeywords: Record<string, KeywordFunction | false> = {
  required(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!hasOwn(data, key)) {
        return defineError("Required property is missing", {
          item: key,
          data: data[key]
        });
      }
    }

    return;
  },

  properties(schema, data, defineError, _instance, validateSubschema) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const propKeys = (schema as any)._propKeys as string[];

    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i];
      const schemaProp = schema.properties[key];

      if (!hasOwn(data, key)) {
        continue;
      }

      if (validateSubschema) {
        const error = validateSubschema(schemaProp, data[key], { property: key });
        if (error) {
          return defineError("Property is invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const valueSchema = schema.values;
    const validate = valueSchema && valueSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }

    for (const key in data) {
      if (!hasOwn(data, key)) {
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
      if (!hasOwn(data, key)) {
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
      if (!hasOwn(data, key)) {
        continue;
      }
      count++;
      if (count >= schema.minProperties) {
        return;
      }
    }

    return defineError("Too few properties", { data });
  },

  additionalProperties(schema, data, defineError, _instance, validateSubschema) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    let apValidate = (schema as any)._apValidate as
      | ((data: any) => any)
      | null
      | undefined;
    if (apValidate === undefined) {
      apValidate = isCompiledSchema(schema.additionalProperties)
        ? schema.additionalProperties.$validate
        : null;
      definePropertyOrThrow(schema, "_apValidate", {
        value: apValidate,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    const patternEntries = getPatternPropertyEntries(schema);

    for (const key in data) {
      if (!hasOwn(data, key)) {
        continue;
      }

      if (
        schema.properties &&
        hasOwn(schema.properties, key)
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

      if (validateSubschema) {
        const error = validateSubschema(schema.additionalProperties, data[key], {
          property: key
        });
        if (error) {
          return defineError("Additional properties are invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
        }
        continue;
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
  patternProperties(schema, data, defineError, _instance, validateSubschema) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const patternEntries = getPatternPropertyEntries(schema);
    if (!patternEntries || patternEntries.length === 0) {
      return;
    }

    for (const key in data) {
      if (!hasOwn(data, key)) {
        continue;
      }

      const matchingIndexes = getPatternKeyMatchIndexes(schema, key, patternEntries);

      if (matchingIndexes.length === 0) {
        if (
          schema.additionalProperties === false &&
          !(schema.properties && hasOwn(schema.properties, key))
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

        if (validateSubschema) {
          const error = validateSubschema(schemaProp, data[key], { property: key });
          if (error) {
            return defineError("Property is invalid", {
              item: key,
              cause: error,
              data: data[key]
            });
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
          if (hasOwn(data, key)) {
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
      if (!hasOwn(data, key)) {
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

  dependencies(schema, data, defineError, _instance, validateSubschema) {
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
      const error = validateSubschema
        ? validateSubschema(dependency, data)
        : dependency.$validate(data);
      if (error) {
        return defineError("Dependency is not satisfied", {
          cause: error,
          data
        });
      }
    }

    return;
  },

  dependentRequired(schema, data, defineError) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !schema.dependentRequired ||
      typeof schema.dependentRequired !== "object" ||
      Array.isArray(schema.dependentRequired)
    ) {
      return;
    }

    for (const key of Object.keys(schema.dependentRequired)) {
      if (!hasOwn(data, key)) {
        continue;
      }
      const required = schema.dependentRequired[key];
      if (!Array.isArray(required)) {
        continue;
      }
      for (let index = 0; index < required.length; index++) {
        if (typeof required[index] !== "string" || hasOwn(data, required[index])) {
          continue;
        }
        return defineError("Dependent property is missing", {
          item: required[index],
          data
        });
      }
    }
  },

  dependentSchemas(schema, data, defineError, _instance, validateSubschema) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !schema.dependentSchemas ||
      typeof schema.dependentSchemas !== "object" ||
      Array.isArray(schema.dependentSchemas)
    ) {
      return;
    }

    for (const key of Object.keys(schema.dependentSchemas)) {
      if (!hasOwn(data, key)) {
        continue;
      }
      const dependentSchema = schema.dependentSchemas[key];
      if (dependentSchema === false) {
        return defineError("Dependent schema is not satisfied", { data });
      }
      if (!isCompiledSchema(dependentSchema)) {
        continue;
      }
      const error = validateSubschema
        ? validateSubschema(dependentSchema, data)
        : dependentSchema.$validate(data);
      if (error) {
        return defineError("Dependent schema is not satisfied", {
          cause: error,
          data
        });
      }
    }
  },

  contentEncoding(schema, data, defineError) {
    if (
      typeof data !== "string" ||
      schema.contentEncoding !== "base64"
    ) {
      return;
    }
    if (decodeBase64(data) !== null) {
      return;
    }
    return defineError("String content encoding is invalid", { data });
  },

  contentMediaType(schema, data, defineError) {
    if (
      typeof data !== "string" ||
      schema.contentMediaType !== "application/json"
    ) {
      return;
    }

    const content =
      schema.contentEncoding === "base64" ? decodeBase64(data) : data;
    if (content === null) {
      return defineError("String content encoding is invalid", { data });
    }
    try {
      JSON.parse(content);
      return;
    } catch {
      return defineError("String content does not match its media type", {
        data
      });
    }
  },

  unevaluatedProperties(
    schema,
    data,
    defineError,
    _instance,
    validateSubschema
  ) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !validateSubschema
    ) {
      return;
    }
    for (const key of Object.keys(data)) {
      const error = validateSubschema(schema.unevaluatedProperties, data[key], {
        property: key,
        unevaluated: true
      });
      if (error) {
        return defineError("Unevaluated property is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
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
  contentSchema: false,

  // Not supported Open API keywords
  discriminator: false,
  nullable: false
};
