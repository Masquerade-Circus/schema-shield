import { CompiledSchema, KeywordFunction } from "../index";
import { ValidationError, isCompiledSchema, isObject } from "../utils";

export const ArrayKeywords: Record<string, KeywordFunction> = {
  items(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return [true, null];
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        return [false, KeywordError];
      }

      return [true, null];
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
            return [false, KeywordError];
          }
          continue;
        }

        if (isCompiledSchema(schemaItem)) {
          const [valid, error] = schemaItem.$validate(data[i]);
          if (!valid) {
            KeywordError.message = error.message;
            KeywordError.item = i;
            return [false, KeywordError];
          }
        }
      }

      return [true, null];
    }

    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const [valid, error] = schemaItems.$validate(data[i]);
        if (!valid) {
          KeywordError.message = error.message;
          KeywordError.item = i;
          return [false, KeywordError];
        }
      }
    }

    return [true, null];
  },

  minItems(schema, data, KeywordError, _) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  maxItems(schema, data, KeywordError, _) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return [true, null];
    }

    return [false, KeywordError];
  },

  additionalItems(schema, data, KeywordError, _) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return [true, null];
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return [false, KeywordError];
      }
      return [true, null];
    }

    if (isObject(schema.additionalItems)) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = schema.items.length; i < data.length; i++) {
          const [valid, error] = schema.additionalItems.$validate(data[i]);
          if (!valid) {
            KeywordError.message = error.message;
            KeywordError.item = i;
            return [false, KeywordError];
          }
        }
        return [true, null];
      }

      return [true, null];
    }

    return [true, null];
  },

  uniqueItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return [true, null];
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
        return [false, KeywordError];
      }
      unique.add(itemStr);
    }

    return [true, null];
  },

  contains(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return [true, null];
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          return [false, KeywordError];
        }
        return [true, null];
      }

      return [false, KeywordError];
    }

    for (let i = 0; i < data.length; i++) {
      const [valid, error] = schema.contains.$validate(data[i]);
      if (valid) {
        return [true, null];
      }
      continue;
    }

    return [false, KeywordError];
  }
};
