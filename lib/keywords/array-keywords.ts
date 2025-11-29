import { hasChanged, isCompiledSchema, isObject } from "../utils";

import { KeywordFunction } from "../index";

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
    if (!schema.items || isObject(schema.items)) {
      return;
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return defineError("Array is too long", { data });
      }
      return;
    }

    if (isObject(schema.additionalItems)) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = schema.items.length; i < data.length; i++) {
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

    const primitiveSeen = new Set<any>();

    for (let i = 0; i < len; i++) {
      const item = data[i];
      const type = typeof item;

      if (
        item === null ||
        type === "string" ||
        type === "number" ||
        type === "boolean"
      ) {
        if (primitiveSeen.has(item)) {
          return defineError("Array items are not unique", { data: item });
        }
        primitiveSeen.add(item);
        continue;
      }

      if (item && typeof item === "object") {
        for (let j = 0; j < i; j++) {
          const prev = data[j];
          if (prev && typeof prev === "object" && !hasChanged(prev, item)) {
            return defineError("Array items are not unique", { data: item });
          }
        }
      }
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

    for (let i = 0; i < data.length; i++) {
      const error = schema.contains.$validate(data[i]);
      if (!error) {
        return;
      }
      continue;
    }

    return defineError("Array must contain at least one item", { data });
  }
};
