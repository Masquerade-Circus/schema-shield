import { CompiledSchema, ValidatorFunction } from "../index";
import { ValidationError, isCompiledSchema, isObject } from "../utils";

export const ArrayKeywords: Record<string, ValidatorFunction> = {
  items(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return data;
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        throw KeywordError;
      }

      return data;
    }

    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === "boolean") {
          if (schemaItems[i] === false && typeof data[i] !== "undefined") {
            KeywordError.message = "Array item is not allowed";
            KeywordError.item = i;
            throw KeywordError;
          }
          continue;
        }

        if (isCompiledSchema(schemaItems[i])) {
          data[i] = schemaItems[i].$validate(data[i]);
        }
      }

      return data;
    }

    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        data[i] = schemaItems.$validate(data[i]);
      }
    }

    return data;
  },

  minItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return data;
    }

    throw KeywordError;
  },

  maxItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return data;
    }

    throw KeywordError;
  },

  additionalItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return data;
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        throw KeywordError;
      }
      return data;
    }

    if (isCompiledSchema(schema.additionalItems)) {
      for (let i = schema.items.length; i < data.length; i++) {
        data[i] = schema.additionalItems.$validate(data[i]);
      }
      return data;
    }

    return data;
  },

  uniqueItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return data;
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
        throw KeywordError;
      } else {
        unique.add(itemStr);
      }
    }

    return data;
  },

  contains(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return data;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          throw KeywordError;
        }
        return data;
      }

      throw KeywordError;
    }

    for (let i = 0; i < data.length; i++) {
      try {
        data[i] = schema.contains.$validate(data[i]);
        return data;
      } catch (error) {
        continue;
      }
    }

    throw KeywordError;
  }
};
