import { isCompiledSchema, isObject } from "../utils";

import { KeywordFunction } from "../index";

export const ArrayKeywords: Record<string, KeywordFunction> = {
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
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        const schemaItem = schemaItems[i];
        if (typeof schemaItem === "boolean") {
          if (schemaItem === false && typeof data[i] !== "undefined") {
            return defineError("Array item is not allowed", {
              item: i,
              data: data[i]
            });
          }
          continue;
        }

        if (isCompiledSchema(schemaItem)) {
          const error = schemaItem.$validate(data[i]);
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

    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const error = schemaItems.$validate(data[i]);
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
  },

  elements(schema, data, defineError) {
    if (!Array.isArray(data) || !isCompiledSchema(schema.elements)) {
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const error = schema.elements.$validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }

    return;
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

    const unique = new Set();

    for (const item of data) {
      let itemStr;

      // Change string to "string" to avoid false positives
      if (typeof item === "string") {
        itemStr = `s:${item}`;
        // Sort object keys to avoid false positives
      } else if (isObject(item)) {
        itemStr = `o:${JSON.stringify(
          Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
          )
        )}`;
      } else if (Array.isArray(item)) {
        itemStr = JSON.stringify(item);
      } else {
        itemStr = String(item);
      }

      if (unique.has(itemStr)) {
        return defineError("Array items are not unique", { data: item });
      }
      unique.add(itemStr);
    }

    return;
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
