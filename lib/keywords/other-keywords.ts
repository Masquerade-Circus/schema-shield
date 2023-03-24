import {
  CompiledSchema,
  ValidationError,
  ValidatorFunction,
  isObject
} from "../utils";

export const OtherKeywords: Record<string, ValidatorFunction> = {
  nullable(schema, data, pointer) {
    if (schema.nullable && data !== null) {
      return {
        valid: false,
        errors: [
          new ValidationError("Value must be null to be empty", {
            pointer,
            value: data,
            code: "VALUE_NOT_NULL"
          })
        ],
        data
      };
    }

    return { valid: true, errors: [], data };
  },

  oneOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let validCount = 0;
    let finalData = data;
    for (let i = 0; i < schema.oneOf.length; i++) {
      const { validator } = schema.oneOf[i] as CompiledSchema;
      if (!validator) {
        validCount++;
        continue;
      }
      const validationResult = validator(
        schema.oneOf[i],
        finalData,
        pointer,
        schemaShieldInstance
      );
      if (validationResult.valid) {
        validCount++;
      } else {
        errors.push(...validationResult.errors);
      }
      finalData = validationResult.data;
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
          code: "VALUE_DOES_NOT_MATCH_ONE_OF"
        })
      ],
      data: finalData
    };
  },

  allOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let finalData = data;
    for (let i = 0; i < schema.allOf.length; i++) {
      const { validator } = schema.allOf[i] as CompiledSchema;
      if (!validator) {
        continue;
      }

      const validatorResult = validator(
        schema.allOf[i],
        finalData,
        pointer,
        schemaShieldInstance
      );
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
      finalData = validatorResult.data;
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  anyOf(schema, data, pointer, schemaShieldInstance) {
    let finalData = data;

    for (let i = 0; i < schema.anyOf.length; i++) {
      const { validator } = schema.anyOf[i] as CompiledSchema;
      if (!validator) {
        return { valid: true, errors: [], data };
      }
      const validationResult = validator(
        schema.anyOf[i],
        finalData,
        pointer,
        schemaShieldInstance
      );
      finalData = validationResult.data;
      if (validationResult.valid) {
        return { valid: true, errors: [], data: finalData };
      }
    }

    return {
      valid: false,
      errors: [
        new ValidationError(`Value must match at least one schema in anyOf`, {
          pointer,
          value: data,
          code: "VALUE_DOES_NOT_MATCH_ANY_OF"
        })
      ],
      data
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
                code: "DEPENDENCY_MISSING"
              })
            );
          }
        }
        continue;
      }

      const { validator } = dependency as CompiledSchema;
      if (!validator) {
        continue;
      }

      const validatorResult = validator(
        dependency,
        finalData,
        pointer,
        schemaShieldInstance
      );
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
      finalData = validatorResult.data;
    }

    return { valid: errors.length === 0, errors, data: finalData };
  }
};
