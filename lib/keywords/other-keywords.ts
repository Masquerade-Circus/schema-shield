import { CompiledSchema, ValidatorFunction } from '../index';
import { ValidationError, isObject, deepEqual } from '../utils';

export const OtherKeywords: Record<string, ValidatorFunction> = {
  nullable(schema, data, pointer) {
    if (schema.nullable && data !== null) {
      return {
        valid: false,
        errors: [
          new ValidationError('Value must be null to be empty', {
            pointer,
            value: data,
            code: 'VALUE_NOT_NULL',
          }),
        ],
        data,
      };
    }

    return { valid: true, errors: [], data };
  },

  allOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let finalData = data;
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        const validatorResult = schemaShieldInstance.validate(schema.allOf[i], finalData);

        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }

        finalData = validatorResult.data;
      } else {
        if (typeof schema.allOf[i] === 'boolean') {
          if (Boolean(data) !== schema.allOf[i]) {
            errors.push(
              new ValidationError(`Value must match all schemas in allOf`, {
                pointer,
                value: data,
                code: 'VALUE_DOES_NOT_MATCH_ALL_OF',
              })
            );
          }
          continue;
        }

        if (data !== schema.allOf[i]) {
          errors.push(
            new ValidationError(`Value must match all schemas in allOf`, {
              pointer,
              value: data,
              code: 'VALUE_DOES_NOT_MATCH_ALL_OF',
            })
          );
        }
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  anyOf(schema, data, pointer, schemaShieldInstance) {
    let finalData = data;

    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        const validationResult = schemaShieldInstance.validate(schema.anyOf[i], finalData);
        finalData = validationResult.data;
        if (validationResult.valid) {
          return { valid: true, errors: [], data: finalData };
        }
      } else {
        if (typeof schema.anyOf[i] === 'boolean') {
          if (Boolean(data) === schema.anyOf[i]) {
            return { valid: true, errors: [], data: finalData };
          }
        }

        if (data === schema.anyOf[i]) {
          return { valid: true, errors: [], data: finalData };
        }
      }
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must match at least one schema in anyOf`, {
          pointer,
          value: data,
          code: 'VALUE_DOES_NOT_MATCH_ANY_OF',
        }),
      ],
      data,
    };
  },

  oneOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let validCount = 0;
    let finalData = data;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        const validationResult = schemaShieldInstance.validate(schema.oneOf[i], finalData);
        if (validationResult.valid) {
          validCount++;
        } else {
          errors.push(...validationResult.errors);
        }
        finalData = validationResult.data;
      } else {
        if (typeof schema.oneOf[i] === 'boolean') {
          if (Boolean(data) === schema.oneOf[i]) {
            validCount++;
          }
          continue;
        }

        if (data === schema.oneOf[i]) {
          validCount++;
        }
      }
    }

    if (validCount === 1) {
      return { valid: true, errors: [], data: finalData };
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must match exactly one schema in oneOf`, {
          pointer,
          value: data,
          code: 'VALUE_DOES_NOT_MATCH_ONE_OF',
        }),
      ],
      data: finalData,
    };
  },

  dependencies(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }

    const errors = [];
    let finalData = data;
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }

      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            errors.push(
              new ValidationError(`Dependency ${dependency[i]} is missing`, {
                pointer,
                value: data,
                code: 'DEPENDENCY_MISSING',
              })
            );
          }
        }
        continue;
      }

      if (typeof dependency === 'boolean') {
        if (dependency) {
          continue;
        }
        errors.push(
          new ValidationError(`Dependency ${key} is missing`, {
            pointer,
            value: data,
            code: 'DEPENDENCY_MISSING',
          })
        );
        continue;
      }

      if (typeof dependency === 'string') {
        if (dependency in data) {
          continue;
        }
        errors.push(
          new ValidationError(`Dependency ${dependency} is missing`, {
            pointer,
            value: data,
            code: 'DEPENDENCY_MISSING',
          })
        );
        continue;
      }

      const validatorResult = schemaShieldInstance.validate(dependency, finalData);
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
      finalData = validatorResult.data;
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  const(schema, data, pointer) {
    if (
      data === schema.const ||
      (isObject(data) && isObject(schema.const) && deepEqual(data, schema.const)) ||
      (Array.isArray(data) && Array.isArray(schema.const) && deepEqual(data, schema.const))
    ) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must be equal to const`, {
          pointer,
          value: data,
          code: 'VALUE_NOT_EQUAL_TO_CONST',
        }),
      ],
      data,
    };
  },

  contains(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, errors: [], data };
    }

    if (typeof schema.contains === 'boolean') {
      if (schema.contains) {
        const valid = data.length > 0;
        return {
          valid,
          errors: valid
            ? []
            : [
                new ValidationError(`Value must contain at least one item`, {
                  pointer,
                  value: data,
                  code: 'VALUE_DOES_NOT_CONTAIN_ITEM',
                }),
              ],
          data,
        };
      }

      return {
        valid: false,
        errors: [
          new ValidationError(`Value must not contain any items`, {
            pointer,
            value: data,
            code: 'VALUE_CONTAINS_ITEM',
          }),
        ],
        data,
      };
    }

    for (let i = 0; i < data.length; i++) {
      const validatorResult = schemaShieldInstance.validate(schema.contains, data[i]);
      if (validatorResult.valid) {
        return { valid: true, errors: [], data };
      }
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must contain at least one item that matches the contains schema`, {
          pointer,
          value: data,
          code: 'VALUE_DOES_NOT_CONTAIN_MATCHING_ITEM',
        }),
      ],
      data,
    };
  },

  if(schema, data, pointer, schemaShieldInstance) {
    if ('then' in schema === false && 'else' in schema === false) {
      return { valid: true, errors: [], data };
    }

    if (typeof schema.if === 'boolean') {
      if (schema.if) {
        if (schema.then) {
          const thenResult = schemaShieldInstance.validate(schema.then, data);
          if (!thenResult.valid) {
            return thenResult;
          }
        }
      } else if (schema.else) {
        const elseResult = schemaShieldInstance.validate(schema.else, data);
        if (!elseResult.valid) {
          return elseResult;
        }
      }
      return { valid: true, errors: [], data };
    }

    const ifResult = schemaShieldInstance.validate(schema.if, data);
    if (ifResult.valid) {
      if (schema.then) {
        const thenResult = schemaShieldInstance.validate(schema.then, data);
        if (!thenResult.valid) {
          return thenResult;
        }
      }
    } else if (schema.else) {
      const elseResult = schemaShieldInstance.validate(schema.else, data);
      if (!elseResult.valid) {
        return elseResult;
      }
    }

    return { valid: true, errors: [], data };
  },

  not(schema, data, pointer, schemaShieldInstance) {
    if (typeof schema.not === 'boolean') {
      if (schema.not) {
        return {
          valid: false,
          errors: [
            new ValidationError(`Value must not be valid`, {
              pointer,
              value: data,
              code: 'VALUE_IS_VALID',
            }),
          ],
          data,
        };
      }
      return { valid: true, errors: [], data };
    }

    const validatorResult = schemaShieldInstance.validate(schema.not, data);
    if (validatorResult.valid) {
      return {
        valid: false,
        errors: [
          new ValidationError(`Value must not be valid`, {
            pointer,
            value: data,
            code: 'VALUE_IS_VALID',
          }),
        ],
        data,
      };
    }

    return { valid: true, errors: [], data };
  },
};
