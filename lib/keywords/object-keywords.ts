import {
  CompiledSchema,
  ValidationError,
  ValidatorFunction,
  isObject
} from "../utils";

export const ObjectKeywords: Record<string, ValidatorFunction> = {
  // Object
  required(schema, data, pointer) {
    if (!isObject(data)) {
      return {
        valid: true,
        errors: [],
        data
      };
    }

    const errors = [];
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        errors.push(
          new ValidationError("Missing required property", {
            pointer: `${pointer}/${key}`,
            value: data,
            code: "MISSING_REQUIRED_PROPERTY"
          })
        );
      }
    }

    return { valid: errors.length === 0, errors, data };
  },

  properties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }

    const errors = [];
    let finalData = { ...data };
    for (let key in schema.properties) {
      if (!data.hasOwnProperty(key) || typeof data[key] === "undefined") {
        if (
          isObject(schema.properties[key]) &&
          "default" in schema.properties[key]
        ) {
          finalData[key] = schema.properties[key].default;
        }

        continue;
      }

      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          errors.push(
            new ValidationError("Property is not allowed", {
              pointer: `${pointer}/${key}`,
              value: data[key],
              code: "PROPERTY_NOT_ALLOWED"
            })
          );
        }
        continue;
      }

      const { validator } = schema.properties[key] as CompiledSchema;
      if (!validator) {
        continue;
      }

      const validatorResult = validator(
        schema.properties[key],
        finalData[key],
        `${pointer}/${key}`,
        schemaShieldInstance
      );

      finalData[key] = validatorResult.data;

      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  maxProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError("Object has too many properties", {
          pointer,
          value: data,
          code: "OBJECT_TOO_MANY_PROPERTIES"
        })
      ],
      data
    };
  },

  minProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return { valid: true, errors: [], data };
    }

    return {
      valid: false,
      errors: [
        new ValidationError("Object has too few properties", {
          pointer,
          value: data,
          code: "OBJECT_TOO_FEW_PROPERTIES"
        })
      ],
      data
    };
  },

  additionalProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }

    const errors = [];
    let finalData = { ...data };
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
          new ValidationError("Additional property not allowed", {
            pointer: `${pointer}/${key}`,
            value: data,
            code: "ADDITIONAL_PROPERTY_NOT_ALLOWED"
          })
        );
        continue;
      }

      const { validator } = schema.additionalProperties as CompiledSchema;
      if (!validator) {
        continue;
      }

      const validatorResult = validator(
        schema.additionalProperties,
        finalData[key],
        `${pointer}/${key}`,
        schemaShieldInstance
      );

      finalData[key] = validatorResult.data;

      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  },

  patternProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }

    const errors = [];
    let finalData = { ...data };
    for (let pattern in schema.patternProperties) {
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (let key in finalData) {
            if (new RegExp(pattern).test(key)) {
              errors.push(
                new ValidationError("Property is not allowed", {
                  pointer: `${pointer}/${key}`,
                  value: data[key],
                  code: "PROPERTY_NOT_ALLOWED"
                })
              );
            }
          }
        }
        continue;
      }

      const { validator } = schema.patternProperties[pattern] as CompiledSchema;
      if (!validator) {
        continue;
      }

      for (let key in finalData) {
        if (new RegExp(pattern).test(key)) {
          const validatorResult = validator(
            schema.patternProperties[pattern],
            finalData[key],
            `${pointer}/${key}`,
            schemaShieldInstance
          );

          finalData[key] = validatorResult.data;

          if (!validatorResult.valid) {
            errors.push(...validatorResult.errors);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, data: finalData };
  }
};
