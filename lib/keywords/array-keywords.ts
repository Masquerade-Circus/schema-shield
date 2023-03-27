import { CompiledSchema, ValidatorFunction } from "../index";
import { ValidationError, isObject } from "../utils";

export const ArrayKeywords: Record<string, ValidatorFunction> = {
  items(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return data;
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        throw new ValidationError("Array is not allowed", pointer);
      }

      return data;
    }

    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === "boolean") {
          if (schemaItems[i] === false && typeof data[i] !== "undefined") {
            throw new ValidationError(
              "Array item is not allowed",
              `${pointer}/${i}`
            );
          }
          continue;
        }

        data[i] = schemaShieldInstance.validate(schemaItems[i], data[i]);
      }

      return data;
    }

    if (schemaShieldInstance.isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        data[i] = schemaShieldInstance.validate(schemaItems, data[i]);
      }
    }

    return data;
  },

  minItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return data;
    }

    throw new ValidationError("Array is too short", pointer);
  },

  maxItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return data;
    }

    throw new ValidationError("Array is too long", pointer);
  },

  additionalItems(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return data;
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        throw new ValidationError("Array has too many items", pointer);
      }
      return data;
    }

    if (schemaShieldInstance.isCompiledSchema(schema.additionalItems)) {
      for (let i = schema.items.length; i < data.length; i++) {
        data[i] = schemaShieldInstance.validate(
          schema.additionalItems,
          data[i]
        );
      }
      return data;
    }

    return data;
  },

  uniqueItems(schema, data, pointer) {
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
        throw new ValidationError("Array items are not unique", pointer);
      } else {
        unique.add(itemStr);
      }
    }

    return data;
  }
};
