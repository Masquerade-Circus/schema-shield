import { CompiledSchema, ValidatorFunction } from '../index';
import { ValidationError, isObject } from '../utils';

export const ArrayKeywords: Record<string, ValidatorFunction> = {
  items(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, error: null, data };
    }

    const schemaItems = schema.items;
    const dataLength = data.length;

    if (typeof schemaItems === 'boolean') {
      if (schemaItems === false && dataLength > 0) {
        return {
          valid: false,
          error: new ValidationError('Array is not allowed', pointer),
          data,
        };
      }

      return { valid: true, error: null, data };
    }

    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const finalData = [...data];
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === 'boolean') {
          if (schemaItems[i] === false && typeof finalData[i] !== 'undefined') {
            return {
              valid: false,
              error: new ValidationError('Array item is not allowed', `${pointer}/${i}`),
              data: finalData,
            };
          }
          continue;
        }

        const validatorResult = schemaShieldInstance.validate(schemaItems[i], finalData[i]);

        finalData[i] = validatorResult.data;

        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }

      return { valid: true, error: null, data: finalData };
    }

    if (schemaShieldInstance.isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const validatorErrors = schemaShieldInstance.validate(schemaItems, data[i]);

        data[i] = validatorErrors.data;

        if (!validatorErrors.valid) {
          return { valid: false, error: validatorErrors.error, data };
        }
      }
    }

    return { valid: true, error: null, data };
  },

  minItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('Array is too short', pointer),
      data,
    };
  },

  maxItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('Array is too long', pointer),
      data,
    };
  },

  additionalItems(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return { valid: true, error: null, data };
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return {
          valid: false,
          error: new ValidationError('Array has too many items', pointer),
          data,
        };
      }

      return { valid: true, error: null, data };
    }

    if (schemaShieldInstance.isCompiledSchema(schema.additionalItems)) {
      const finalData = [...data];
      for (let i = schema.items.length; i < finalData.length; i++) {
        const validatorResult = schemaShieldInstance.validate(schema.additionalItems, finalData[i]);
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
        finalData[i] = validatorResult.data;
      }
      return { valid: true, error: null, data: finalData };
    }

    return { valid: true, error: null, data };
  },

  uniqueItems(schema, data, pointer) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return { valid: true, error: null, data };
    }

    const unique = new Set();

    for (const item of data) {
      let itemStr;

      // Change string to "string" to avoid false positives
      if (typeof item === 'string') {
        itemStr = `s:${item}`;

        // Sort object keys to avoid false positives
      } else if (isObject(item)) {
        itemStr = `o:${JSON.stringify(Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))))}`;
      } else {
        itemStr = JSON.stringify(item);
      }

      if (unique.has(itemStr)) {
        return {
          valid: false,
          error: new ValidationError('Array items are not unique', pointer),
          data,
        };
      } else {
        unique.add(itemStr);
      }
    }

    return { valid: true, error: null, data };
  },
};
