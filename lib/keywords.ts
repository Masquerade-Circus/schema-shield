import { CompiledSchema, ValidationError, ValidatorFunction, deepEqual, defaultValidator } from './utils';

export function validateKeywords(schema: CompiledSchema, data, pointer) {
  const errors = [];

  if ('keywords' in schema) {
    for (let keyword in schema.keywords) {
      const keywordValidator: ValidatorFunction = schema.keywords[keyword];
      const keywordErrors = keywordValidator(schema, data, pointer);
      if (keywordErrors) {
        errors.push(...keywordErrors);
      }
    }
  }

  if (errors.length > 0) {
    return errors;
  }
}

export const keywords: Record<string, ValidatorFunction> = {
  // Object
  required(schema, data, pointer) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return;
    }
    const errors = [];

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        errors.push(
          new ValidationError('Missing required property', {
            pointer: `${pointer}/${key}`,
            value: data,
            code: 'MISSING_REQUIRED_PROPERTY',
          })
        );
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },
  properties(schema, data, pointer) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return;
    }

    const errors = [];
    for (let key in schema.properties) {
      const { validator } = schema.properties[key];
      if (!validator) {
        continue;
      }

      if (!data.hasOwnProperty(key)) {
        continue;
      }

      const validatorErrors = validator(schema.properties[key], data[key], `${pointer}/${key}`);

      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  maxProperties(schema, data, pointer) {
    if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > schema.maxProperties) {
      return [
        new ValidationError('Object has too many properties', {
          pointer,
          value: data,
          code: 'OBJECT_TOO_MANY_PROPERTIES',
        }),
      ];
    }
  },

  minProperties(schema, data, pointer) {
    if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length < schema.minProperties) {
      return [
        new ValidationError('Object has too few properties', {
          pointer,
          value: data,
          code: 'OBJECT_TOO_FEW_PROPERTIES',
        }),
      ];
    }
  },

  additionalProperties(schema, data, pointer) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return;
    }

    const errors = [];
    for (let key in data) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }

      if (schema.patternProperties) {
        let match = false;
        for (let pattern in schema.patternProperties) {
          if (new RegExp(pattern).test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }

      if (schema.additionalProperties === false) {
        errors.push(
          new ValidationError('Additional property not allowed', {
            pointer: `${pointer}/${key}`,
            value: data,
            code: 'ADDITIONAL_PROPERTY_NOT_ALLOWED',
          })
        );
        continue;
      }

      const { validator } = schema.additionalProperties;
      if (!validator) {
        continue;
      }

      const validatorErrors = validator(schema.additionalProperties, data[key], `${pointer}/${key}`);

      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  patternProperties(schema, data, pointer) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return;
    }

    const errors = [];
    for (let pattern in schema.patternProperties) {
      const { validator } = schema.patternProperties[pattern];
      if (!validator) {
        continue;
      }

      for (let key in data) {
        if (new RegExp(pattern).test(key)) {
          const validatorErrors = validator(schema.patternProperties[pattern], data[key], `${pointer}/${key}`);

          if (validatorErrors) {
            errors.push(...validatorErrors);
          }
        }
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  // Array
  items(schema, data, pointer) {
    if (!Array.isArray(data)) {
      return;
    }

    const errors = [];

    if (!Array.isArray(schema.items)) {
      const { validator } = schema.items;
      if (!validator) {
        return;
      }

      for (let i = 0; i < data.length; i++) {
        const validatorErrors = validator(schema.items, data[i], `${pointer}/${i}`);
        if (validatorErrors) {
          errors.push(...validatorErrors);
        }
      }

      if (errors.length > 0) {
        return errors;
      }
    }

    for (let i = 0; i < schema.items.length; i++) {
      const { validator } = schema.items[i];
      if (!validator) {
        continue;
      }
      const validatorErrors = validator(schema.items[i], data[i], `${pointer}/${i}`);
      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  minItems(schema, data, pointer) {
    if (Array.isArray(data) && data.length < schema.minItems) {
      return [
        new ValidationError('Array is too short', {
          pointer,
          value: data,
          code: 'ARRAY_TOO_SHORT',
        }),
      ];
    }
  },

  maxItems(schema, data, pointer) {
    if (Array.isArray(data) && data.length > schema.maxItems) {
      return [
        new ValidationError('Array is too long', {
          pointer,
          value: data,
          code: 'ARRAY_TOO_LONG',
        }),
      ];
    }
  },

  additionalItems(schema, data, pointer) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return;
    }

    if (schema.additionalItems === false && data.length > schema.items.length) {
      return [
        new ValidationError('Array has too many items', {
          pointer,
          value: data,
          code: 'ARRAY_TOO_MANY_ITEMS',
        }),
      ];
    }

    const errors = [];

    if (typeof schema.additionalItems === 'object') {
      for (let i = schema.items.length; i < data.length; i++) {
        const { validator } = schema.additionalItems;
        const validatorErrors = validator(schema.additionalItems, data[i], `${pointer}/${i}`);
        if (validatorErrors) {
          errors.push(...validatorErrors);
        }
      }

      if (errors.length > 0) {
        return errors;
      }
    }
  },

  uniqueItems(schema, data, pointer) {
    if (Array.isArray(data) && schema.uniqueItems) {
      const unique = new Set(
        data.map((item) => {
          if (typeof item !== 'object' || item === null) {
            if (typeof item === 'string') {
              return `"${item}"`;
            }
            return item;
          }
          const keys = Object.keys(item).sort();
          const sorted = {};
          for (let i = 0; i < keys.length; i++) {
            sorted[keys[i]] = item[keys[i]];
          }
          return JSON.stringify(sorted);
        })
      );

      if (unique.size !== data.length) {
        return [
          new ValidationError('Array items are not unique', {
            pointer,
            value: data,
            code: 'ARRAY_ITEMS_NOT_UNIQUE',
          }),
        ];
      }
    }
  },

  // String
  minLength(schema, data, pointer) {
    if (data.length < schema.minLength) {
      return [
        new ValidationError('String is too short', {
          pointer,
          value: data,
          code: 'STRING_TOO_SHORT',
        }),
      ];
    }
  },
  maxLength(schema, data, pointer) {
    if (typeof data === 'string' && data.length > schema.maxLength) {
      return [
        new ValidationError('String is too long', {
          pointer,
          value: data,
          code: 'STRING_TOO_LONG',
        }),
      ];
    }
  },
  pattern(schema, data, pointer) {
    if (typeof data !== 'string') {
      return;
    }

    const patternRegexp = typeof schema.pattern === 'string' ? new RegExp(schema.pattern) : schema.pattern;

    if (!patternRegexp.test(data)) {
      return [
        new ValidationError('String does not match pattern', {
          pointer,
          value: data,
          code: 'STRING_DOES_NOT_MATCH_PATTERN',
        }),
      ];
    }
  },
  format: defaultValidator,
  enum(schema, data, pointer) {
    // Simple equality check
    for (let i = 0; i < schema.enum.length; i++) {
      if (schema.enum[i] === data) {
        return;
      }
    }

    // If is an array check for a deep equality
    if (Array.isArray(data)) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (Array.isArray(schema.enum[i])) {
          if (deepEqual(schema.enum[i], data)) {
            return;
          }
        }
      }
    }

    // If is an object check for a deep equality
    if (typeof data === 'object' && data !== null) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (typeof schema.enum[i] === 'object' && schema.enum[i] !== null) {
          if (deepEqual(schema.enum[i], data)) {
            return;
          }
        }
      }
    }

    return [
      new ValidationError(`Value must be one of ${schema.enum.join(', ')}`, {
        pointer,
        value: data,
        code: 'VALUE_NOT_IN_ENUM',
      }),
    ];
  },

  // Number / Integer
  minimum(schema, data, pointer) {
    if (typeof data !== 'number') {
      return;
    }

    const min = schema.exclusiveMinimum ? schema.minimum + 1e-15 : schema.minimum;

    if (data < min) {
      return [
        new ValidationError('Number is too small', {
          pointer,
          value: data,
          code: 'NUMBER_TOO_SMALL',
        }),
      ];
    }
  },
  maximum(schema, data, pointer) {
    if (typeof data !== 'number') {
      return;
    }

    const max = schema.exclusiveMaximum ? schema.maximum - 1e-15 : schema.maximum;

    if (data > max) {
      return [
        new ValidationError('Number is too large', {
          pointer,
          value: data,
          code: 'NUMBER_TOO_LARGE',
        }),
      ];
    }
  },

  multipleOf(schema, data, pointer) {
    if (typeof data !== 'number') {
      return;
    }

    const quotient = data / schema.multipleOf;
    const areMultiples = Math.abs(quotient - Math.round(quotient)) < 1e-15;
    if (!areMultiples) {
      return [
        new ValidationError('Number is not a multiple of', {
          pointer,
          value: data,
          code: 'NUMBER_NOT_MULTIPLE_OF',
        }),
      ];
    }
  },

  // All
  nullable(schema, data, pointer) {
    if (data !== null) {
      return [
        new ValidationError('Value must be null to be empty', {
          pointer,
          value: data,
          code: 'VALUE_NOT_NULL',
        }),
      ];
    }
  },

  oneOf(schema, data, pointer) {
    const errors = [];
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      const { validator } = schema.oneOf[i];
      if (!validator) {
        validCount++;
        continue;
      }
      const validatorErrors = validator(schema.oneOf[i], data, pointer);
      if (!validatorErrors) {
        validCount++;
      } else {
        errors.push(...validatorErrors);
      }
    }

    if (validCount === 1) {
      return;
    }

    return [
      new ValidationError(`Value must match exactly one schema in oneOf`, {
        pointer,
        value: data,
        code: 'VALUE_DOES_NOT_MATCH_ONE_OF',
      }),
    ];
  },

  allOf(schema, data, pointer) {
    const errors = [];
    for (let i = 0; i < schema.allOf.length; i++) {
      const { validator } = schema.allOf[i];
      if (!validator) {
        continue;
      }
      const validatorErrors = validator(schema.allOf[i], data, pointer);
      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  anyOf(schema, data, pointer) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      const { validator } = schema.anyOf[i];
      if (!validator) {
        return;
      }
      const validatorErrors = validator(schema.anyOf[i], data, pointer);
      if (!validatorErrors) {
        return;
      }
    }

    return [
      new ValidationError(`Value must match at least one schema in anyOf`, {
        pointer,
        value: data,
        code: 'VALUE_DOES_NOT_MATCH_ANY_OF',
      }),
    ];
  },

  dependencies(schema, data, pointer) {
    if (typeof data !== 'object' || data === null) {
      return;
    }

    const errors = [];
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

      const { validator } = dependency;
      if (!validator) {
        continue;
      }

      const validatorErrors = validator(dependency, data, pointer);
      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },
};
