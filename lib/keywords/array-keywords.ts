import { CompiledSchema, KeywordFunction } from "../index";
import { ValidationError, isCompiledSchema, isObject } from "../utils";

export const ArrayKeywords: Record<string, KeywordFunction> = {
  items(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return;
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        return KeywordError;
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
            KeywordError.message = "Array item is not allowed";
            KeywordError.item = i;
            return KeywordError;
          }
          continue;
        }

        if (isCompiledSchema(schemaItem)) {
          const error = schemaItem.$validate(data[i]);
          if (error) {
            KeywordError.item = i;
            KeywordError.cause = error;
            return KeywordError;
          }
        }
      }

      return;
    }

    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const error = schemaItems.$validate(data[i]);
        if (error) {
          KeywordError.item = i;
          KeywordError.cause = error;
          return KeywordError;
        }
      }
    }

    return;
  },

  minItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return;
    }

    return KeywordError;
  },

  maxItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return;
    }

    return KeywordError;
  },

  additionalItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return;
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return KeywordError;
      }
      return;
    }

    if (isObject(schema.additionalItems)) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = schema.items.length; i < data.length; i++) {
          const error = schema.additionalItems.$validate(data[i]);
          if (error) {
            KeywordError.item = i;
            KeywordError.cause = error;
            return KeywordError;
          }
        }
        return;
      }

      return;
    }

    return;
  },

  uniqueItems(schema, data, KeywordError) {
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
        return KeywordError;
      }
      unique.add(itemStr);
    }

    return;
  },

  contains(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          return KeywordError;
        }
        return;
      }

      return KeywordError;
    }

    for (let i = 0; i < data.length; i++) {
      const error = schema.contains.$validate(data[i]);
      if (!error) {
        return;
      }
      continue;
    }

    return KeywordError;
  }
};
