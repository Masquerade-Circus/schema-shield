import { isCompiledSchema } from "../utils/main-utils";

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
  items(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        return defineError("Array items are not allowed", { data });
      }
      return;
    }

    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const itemsLength =
        schemaItemsLength < dataLength ? schemaItemsLength : dataLength;

      for (let i = 0; i < itemsLength; i++) {
        const schemaItem = schemaItems[i];

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

    for (let i = 0; i < dataLength; i++) {
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

  additionalItems(schema, data, defineError) {
    if (!Array.isArray(data) || !Array.isArray(schema.items)) {
      return;
    }

    let tupleLength = (schema as any)._tupleItemsLength as number | undefined;
    if (tupleLength === undefined) {
      tupleLength = schema.items.length;
      Object.defineProperty(schema, "_tupleItemsLength", {
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

    const primitiveSeen = new Set<any>();
    let primitiveArraySignatures: Set<string> | undefined;
    let arrayBuckets: Map<string, any[]> | undefined;
    let objectBuckets: Map<string, any[]> | undefined;

    for (let i = 0; i < len; i++) {
      const item = data[i];

      if (isUniquePrimitive(item)) {
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

  contains(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          return defineError("Array must contain at least one item", { data });
        }
        return;
      }

      return defineError("Array must not contain any items", { data });
    }

    const containsValidate = schema.contains.$validate;
    for (let i = 0; i < data.length; i++) {
      const error = containsValidate(data[i]);
      if (!error) {
        return;
      }
      continue;
    }

    return defineError("Array must contain at least one item", { data });
  }
};
