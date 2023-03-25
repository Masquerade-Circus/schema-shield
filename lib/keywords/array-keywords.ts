import { CompiledSchema, ValidatorFunction } from '../index';
import { ValidationError, isObject } from '../utils';

export const ArrayKeywords: Record<string, ValidatorFunction> = {
  items(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, errors: [], data };
    }

    const errors = [];
    const finalData = [...data];
    const schemaItems = schema.items;
    const schemaItemsLength = Array.isArray(schemaItems) ? schemaItems.length : 0;
    const dataLength = data.length;

    if (Array.isArray(schemaItems)) {
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === 'boolean') {
          if (schemaItems[i] === false && typeof data[i] !== 'undefined') {
            errors.push(
              new ValidationError('Array item is not allowed', {
                pointer: `${pointer}/${i}`,
                value: data[i],
                code: 'ARRAY_ITEM_NOT_ALLOWED',
              })
            );
          }
          continue;
        }

        const { validator } = schemaItems[i] as CompiledSchema;
        if (!validator) {
          continue;
        }
        const validatorResult = validator(schemaItems[i], finalData[i], `${pointer}/${i}`, schemaShieldInstance);

        finalData[i] = validatorResult.data;

        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }
      }
    } else if (typeof schemaItems === 'boolean') {
      if (schemaItems === false && dataLength > 0) {
        errors.push(
          new ValidationError('Array is not allowed', {
            pointer,
            value: data,
            code: 'ARRAY_NOT_ALLOWED',
          })
        );
      }
    } else {
      const { validator } = schemaItems as CompiledSchema;
      if (!validator) {
        return { valid: true, errors: [], data };
      }

      for (let i = 0; i < dataLength; i++) {
        const validatorErrors = validator(schemaItems, finalData[i], `${pointer}/${i}`, schemaShieldInstance);

        finalData[i] = validatorErrors.data;

        if (!validatorErrors.valid) {
          errors.push(...validatorErrors.errors);
        }
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  minItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Array is too short', {
          pointer,
          value: data,
          code: 'ARRAY_TOO_SHORT',
        }),
      ],
      data,
    };
  },

  maxItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError('Array is too long', {
          pointer,
          value: data,
          code: 'ARRAY_TOO_LONG',
        }),
      ],
      data,
    };
  },

  additionalItems(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return { valid: true, errors: [], data };
    }

    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return {
          valid: false,
          errors: [
            new ValidationError('Array has too many items', {
              pointer,
              value: data,
              code: 'ARRAY_TOO_MANY_ITEMS',
            }),
          ],
          data,
        };
      }

      return { valid: true, errors: [], data };
    }

    const errors = [];
    let finalData = [...data];
    if (typeof schema.additionalItems === 'object') {
      for (let i = schema.items.length; i < finalData.length; i++) {
        const { validator } = schema.additionalItems as CompiledSchema;
        const validatorResult = validator(schema.additionalItems, finalData[i], `${pointer}/${i}`, schemaShieldInstance);
        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }
        finalData[i] = validatorResult.data;
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  uniqueItems(schema, data, pointer) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return { valid: true, errors: [], data };
    }

    const unique = new Map();

    for (const item of data) {
      let itemStr;

      // Change string to "string" to avoid false positives
      if (typeof item === 'string') {
        itemStr = `"${item}"`;

        // Sort object keys to avoid false positives
      } else if (isObject(item)) {
        const sorted = Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
        itemStr = JSON.stringify(sorted);
      } else if (Array.isArray(item)) {
        itemStr = JSON.stringify(item);
      } else {
        itemStr = item;
      }

      if (unique.has(itemStr)) {
        return {
          valid: false,
          errors: [
            new ValidationError('Array items are not unique', {
              pointer,
              value: data,
              code: 'ARRAY_ITEMS_NOT_UNIQUE',
            }),
          ],
          data,
        };
      } else {
        unique.set(itemStr, true);
      }
    }

    return { valid: true, errors: [], data };
  },
};
