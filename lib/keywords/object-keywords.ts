import { CompiledSchema, ValidatorFunction } from '../index';
import { ValidationError, isObject } from '../utils';

export const ObjectKeywords: Record<string, ValidatorFunction | false> = {
  // Object
  required(schema, data, pointer) {
    if (!isObject(data)) {
      return {
        valid: true,
        error: null,
        data,
      };
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        return {
          valid: false,
          error: new ValidationError('Property is required', `${pointer}/${key}`),
          data,
        };
      }
    }

    return { valid: true, error: null, data };
  },

  properties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }

    let finalData = { ...data };
    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      const prop = data[key];
      if (typeof prop === 'undefined') {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && 'default' in schemaProp) {
          finalData[key] = schemaProp.default;
        }
        continue;
      }

      if (typeof schema.properties[key] === 'boolean') {
        if (schema.properties[key] === false) {
          return {
            valid: false,
            error: new ValidationError('Property is not allowed', `${pointer}/${key}`),
            data,
          };
        }
        continue;
      }

      const validatorResult = schemaShieldInstance.validate(schema.properties[key], prop);

      finalData[key] = validatorResult.data;

      if (!validatorResult.valid) {
        return { valid: false, error: validatorResult.error, data: finalData };
      }
    }

    return { valid: true, error: null, data: finalData };
  },

  maxProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('Object has too many properties', pointer),
      data,
    };
  },

  minProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return { valid: true, error: null, data };
    }

    return {
      valid: false,
      error: new ValidationError('Object has too few properties', pointer),
      data,
    };
  },

  additionalProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }

    let finalData = { ...data };
    const keys = Object.keys(data);
    const isCompiledSchema = schemaShieldInstance.isCompiledSchema(schema.additionalProperties);
    for (const key of keys) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }

      if (schema.patternProperties) {
        let match = false;
        for (const pattern in schema.patternProperties) {
          if (new RegExp(pattern, 'u').test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }

      if (schema.additionalProperties === false) {
        return {
          valid: false,
          error: new ValidationError('Property is not allowed', `${pointer}/${key}`),
          data,
        };
        continue;
      }

      if (isCompiledSchema) {
        const validatorResult = schemaShieldInstance.validate(schema.additionalProperties, finalData[key]);

        finalData[key] = validatorResult.data;

        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }
    }

    return { valid: true, error: null, data: finalData };
  },

  patternProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }

    let finalData = { ...data };
    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'u');

      if (typeof schema.patternProperties[pattern] === 'boolean') {
        if (schema.patternProperties[pattern] === false) {
          for (const key in finalData) {
            if (regex.test(key)) {
              return {
                valid: false,
                error: new ValidationError('Property is not allowed', `${pointer}/${key}`),
                data: finalData,
              };
            }
          }
        }
        continue;
      }

      const keys = Object.keys(finalData);
      for (const key of keys) {
        if (regex.test(key)) {
          const validatorResult = schemaShieldInstance.validate(schema.patternProperties[pattern], finalData[key]);

          finalData[key] = validatorResult.data;

          if (!validatorResult.valid) {
            return { valid: false, error: validatorResult.error, data: finalData };
          }
        }
      }
    }

    return { valid: true, error: null, data: finalData };
  },

  propertyNames(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }

    if (typeof schema.propertyNames === 'boolean') {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        return {
          valid: false,
          error: new ValidationError('Property names are not allowed', pointer),
          data,
        };
      }
    }

    let finalData = { ...data };

    if (schemaShieldInstance.isCompiledSchema(schema.propertyNames)) {
      for (let key in finalData) {
        const validatorResult = schemaShieldInstance.validate(schema.propertyNames, key);

        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }
    }

    return { valid: true, error: null, data: finalData };
  },

  default: false,
  $ref: false,
  definitions: false,
  $id: false,
  $schema: false,
  title: false,
  $comment: false,
};
