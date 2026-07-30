import {
  definePropertyOrThrow,
  isCompiledSchema
} from "../utils/main-utils";

import { KeywordFunction } from "../index";
import { hasChanged } from "../utils/has-changed";

function isUniquePrimitive(value: any) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function getArrayBucketKey(value: any[]): string {
  const length = value.length;
  if (length === 0) {
    return "0";
  }

  const first = value[0];
  const last = value[length - 1];
  const firstType = first === null ? "null" : typeof first;
  const lastType = last === null ? "null" : typeof last;

  let firstArrayMarker = "";
  if (Array.isArray(first)) {
    const firstSignature = getPrimitiveArraySignature(first);
    firstArrayMarker = firstSignature === null ? `a:${first.length}` : firstSignature;
  }

  let lastArrayMarker = "";
  if (Array.isArray(last)) {
    const lastSignature = getPrimitiveArraySignature(last);
    lastArrayMarker = lastSignature === null ? `a:${last.length}` : lastSignature;
  }

  return `${length}:${firstType}:${firstArrayMarker}:${lastType}:${lastArrayMarker}`;
}

function getObjectShapeKey(value: Record<string, any>): string {
  const keys = Object.keys(value).sort();
  return `${keys.length}:${keys.join("\u0001")}`;
}

function getPrimitiveArraySignature(value: any[]): string | null {
  const length = value.length;

  if (length === 0) {
    return "a:0";
  }

  if (!isUniquePrimitive(value[0]) || !isUniquePrimitive(value[length - 1])) {
    return null;
  }

  let signature = `a:${length}:`;

  for (let i = 0; i < length; i++) {
    const item = value[i];

    if (item === null) {
      signature += "l;";
      continue;
    }

    if (typeof item === "string") {
      signature += `s${item.length}:${item};`;
      continue;
    }

    if (typeof item === "number") {
      if (Number.isNaN(item)) {
        signature += "n:NaN;";
        continue;
      }

      if (Object.is(item, -0)) {
        signature += "n:-0;";
        continue;
      }

      signature += `n:${item};`;
      continue;
    }

    if (typeof item === "boolean") {
      signature += item ? "b:1;" : "b:0;";
      continue;
    }

    return null;
  }

  return signature;
}

export const ArrayKeywords: Record<string, KeywordFunction> = {
  // lib/keywords/array-keywords.ts
  items(schema, data, defineError, _instance, validateSubschema) {
    if (!Array.isArray(data)) {
      return;
    }

    const schemaItems = schema.items;
    const dataLength = data.length;
    const startIndex =
      (schema as any)._dialect === "2020-12" &&
      Array.isArray(schema.prefixItems)
        ? schema.prefixItems.length
        : 0;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > startIndex) {
        return defineError("Array items are not allowed", { data });
      }
      if (validateSubschema) {
        for (let i = startIndex; i < dataLength; i++) {
          validateSubschema(true, data[i], { item: i });
        }
      }
      return;
    }

    if (Array.isArray(schemaItems)) {
      if ((schema as any)._dialect === "2020-12") {
        return;
      }
      const schemaItemsLength = schemaItems.length;
      const itemsLength =
        schemaItemsLength < dataLength ? schemaItemsLength : dataLength;

      for (let i = 0; i < itemsLength; i++) {
        const schemaItem = schemaItems[i];

        if (validateSubschema) {
          const error = validateSubschema(schemaItem, data[i], { item: i });
          if (error) {
            return defineError("Array item is invalid", {
              item: i,
              cause: error,
              data: data[i]
            });
          }
          continue;
        }

        if (typeof schemaItem === "boolean") {
          if (schemaItem === false && data[i] !== undefined) {
            return defineError("Array item is not allowed", {
              item: i,
              data: data[i]
            });
          }
          continue;
        }

        const validate = schemaItem && schemaItem.$validate;
        if (typeof validate === "function") {
          const error = validate(data[i]);
          if (error) {
            return defineError("Array item is invalid", {
              item: i,
              cause: error,
              data: data[i]
            });
          }
        }
      }

      return;
    }

    const validate = schemaItems && schemaItems.$validate;
    if (typeof validate !== "function") {
      return;
    }

    for (let i = startIndex; i < dataLength; i++) {
      const error = validateSubschema
        ? validateSubschema(schemaItems, data[i], { item: i })
        : validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }
  },

  elements(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }

    const elementsSchema = schema.elements;
    const validate = elementsSchema && elementsSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const error = validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }
  },

  minItems(schema, data, defineError) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return;
    }

    return defineError("Array is too short", { data });
  },

  maxItems(schema, data, defineError) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return;
    }

    return defineError("Array is too long", { data });
  },

  additionalItems(schema, data, defineError, _instance, validateSubschema) {
    if (!Array.isArray(data) || !Array.isArray(schema.items)) {
      return;
    }

    let tupleLength = (schema as any)._tupleItemsLength as number | undefined;
    if (tupleLength === undefined) {
      tupleLength = schema.items.length;
      definePropertyOrThrow(schema, "_tupleItemsLength", {
        value: tupleLength,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (data.length <= tupleLength) {
      return;
    }

    if (schema.additionalItems === false) {
      return defineError("Array is too long", { data });
    }

    if (validateSubschema) {
      for (let i = tupleLength; i < data.length; i++) {
        const error = validateSubschema(schema.additionalItems, data[i], {
          item: i
        });
        if (error) {
          return defineError("Array item is invalid", {
            item: i,
            cause: error,
            data: data[i]
          });
        }
      }
      return;
    }

    if (
      schema.additionalItems &&
      typeof schema.additionalItems === "object" &&
      !Array.isArray(schema.additionalItems)
    ) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = tupleLength; i < data.length; i++) {
          const error = schema.additionalItems.$validate(data[i]);
          if (error) {
            return defineError("Array item is invalid", {
              item: i,
              cause: error,
              data: data[i]
            });
          }
        }
        return;
      }

      return;
    }

    return;
  },

  prefixItems(schema, data, defineError, _instance, validateSubschema) {
    if (!Array.isArray(data) || !Array.isArray(schema.prefixItems)) {
      return;
    }

    const limit = Math.min(data.length, schema.prefixItems.length);
    for (let index = 0; index < limit; index++) {
      const prefixSchema = schema.prefixItems[index];
      if (validateSubschema) {
        const error = validateSubschema(prefixSchema, data[index], {
          item: index
        });
        if (error) {
          return defineError("Array item is invalid", {
            item: index,
            cause: error,
            data: data[index]
          });
        }
        continue;
      }
      if (prefixSchema === false) {
        return defineError("Array item is not allowed", {
          item: index,
          data: data[index]
        });
      }
      if (!isCompiledSchema(prefixSchema)) {
        continue;
      }
      const error = prefixSchema.$validate(data[index]);
      if (error) {
        return defineError("Array item is invalid", {
          item: index,
          cause: error,
          data: data[index]
        });
      }
    }
  },

  uniqueItems(schema, data, defineError) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return;
    }

    const len = data.length;
    if (len <= 1) {
      return;
    }

    if (len <= 8) {
      for (let i = 0; i < len; i++) {
        const left = data[i];

        for (let j = i + 1; j < len; j++) {
          const right = data[j];

          if (left === right) {
            return defineError("Array items are not unique", { data: right });
          }

          if (
            typeof left === "number" &&
            typeof right === "number" &&
            Number.isNaN(left) &&
            Number.isNaN(right)
          ) {
            return defineError("Array items are not unique", { data: right });
          }

          if (
            left &&
            right &&
            typeof left === "object" &&
            typeof right === "object" &&
            !hasChanged(left, right)
          ) {
            return defineError("Array items are not unique", { data: right });
          }
        }
      }

      return;
    }

    let hasFirstPrimitive = false;
    let firstPrimitive: any;
    let primitiveSeen: Set<any> | undefined;
    let primitiveArraySignatures: Set<string> | undefined;
    let arrayBuckets: Map<string, any[]> | undefined;
    let objectBuckets: Map<string, any[]> | undefined;

    for (let i = 0; i < len; i++) {
      const item = data[i];

      if (isUniquePrimitive(item)) {
        if (!hasFirstPrimitive) {
          hasFirstPrimitive = true;
          firstPrimitive = item;
          continue;
        }

        if (!primitiveSeen) {
          primitiveSeen = new Set<any>([firstPrimitive]);
        }

        if (primitiveSeen.has(item)) {
          return defineError("Array items are not unique", { data: item });
        }
        primitiveSeen.add(item);
        continue;
      }

      if (!item || typeof item !== "object") {
        continue;
      }

      if (Array.isArray(item)) {
        const signature = getPrimitiveArraySignature(item);
        if (signature !== null) {
          if (!primitiveArraySignatures) {
            primitiveArraySignatures = new Set<string>();
          }

          if (primitiveArraySignatures.has(signature)) {
            return defineError("Array items are not unique", { data: item });
          }

          primitiveArraySignatures.add(signature);
          continue;
        }

        if (!arrayBuckets) {
          arrayBuckets = new Map<string, any[]>();
        }

        const bucketKey = getArrayBucketKey(item);
        let candidates = arrayBuckets.get(bucketKey);

        if (!candidates) {
          candidates = [];
          arrayBuckets.set(bucketKey, candidates);
        }

        for (let j = 0; j < candidates.length; j++) {
          if (!hasChanged(candidates[j], item)) {
            return defineError("Array items are not unique", { data: item });
          }
        }

        candidates.push(item);
        continue;
      }

      if (!objectBuckets) {
        objectBuckets = new Map<string, any[]>();
      }

      const bucketKey = getObjectShapeKey(item);
      let candidates = objectBuckets.get(bucketKey);

      if (!candidates) {
        candidates = [];
        objectBuckets.set(bucketKey, candidates);
      }

      for (let j = 0; j < candidates.length; j++) {
        if (!hasChanged(candidates[j], item)) {
          return defineError("Array items are not unique", { data: item });
        }
      }

      candidates.push(item);
    }
  },

  contains(schema, data, defineError, _instance, validateSubschema) {
    if (!Array.isArray(data)) {
      return;
    }
    const modern =
      (schema as any)._dialect === "2019-09" ||
      (schema as any)._dialect === "2020-12";
    const configuredMinimum = schema.minContains;
    const configuredMaximum = schema.maxContains;
    const minimum =
      modern && Number.isInteger(configuredMinimum) && configuredMinimum >= 0
        ? configuredMinimum
        : 1;
    const maximum =
      modern && Number.isInteger(configuredMaximum) && configuredMaximum >= 0
        ? configuredMaximum
        : Number.POSITIVE_INFINITY;
    let matches = 0;
    const savepoint = validateSubschema?.savepoint?.();

    try {
      if (typeof schema.contains === "boolean") {
        matches = schema.contains ? data.length : 0;
        if (schema.contains && validateSubschema) {
          for (let i = 0; i < data.length; i++) {
            validateSubschema(true, data[i], { item: i });
          }
        }
      } else if (isCompiledSchema(schema.contains)) {
        for (let i = 0; i < data.length; i++) {
          const error = validateSubschema
            ? validateSubschema(schema.contains, data[i], { item: i })
            : schema.contains.$validate(data[i]);
          if (!error) {
            matches++;
            if (matches > maximum) {
              break;
            }
          }
        }
      }

      if (matches >= minimum && matches <= maximum) {
        return;
      }
      if (typeof savepoint === "number") {
        validateSubschema?.rollback?.(savepoint);
      }
      return defineError("Array contains an invalid number of matching items", {
        data
      });
    } catch (error) {
      if (typeof savepoint === "number") {
        validateSubschema?.rollback?.(savepoint);
      }
      throw error;
    }
  },

  minContains() {
    return;
  },

  maxContains() {
    return;
  },

  unevaluatedItems(schema, data, defineError, _instance, validateSubschema) {
    if (!Array.isArray(data) || !validateSubschema) {
      return;
    }
    for (let index = 0; index < data.length; index++) {
      const error = validateSubschema(schema.unevaluatedItems, data[index], {
        item: index,
        unevaluated: true
      });
      if (error) {
        return defineError("Unevaluated array item is invalid", {
          item: index,
          cause: error,
          data: data[index]
        });
      }
    }
  }
};
