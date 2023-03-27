import { CompiledSchema, ValidatorFunction } from "../index";
import { ValidationError, isObject } from "../utils";

export const ObjectKeywords: Record<string, ValidatorFunction | false> = {
  // Object
  required(schema, data, pointer) {
    if (!isObject(data)) {
      return data;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        throw new ValidationError("Property is required", `${pointer}/${key}`);
      }
    }

    return data;
  },

  properties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return data;
    }

    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      if (typeof data[key] === "undefined") {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && "default" in schemaProp) {
          data[key] = schemaProp.default;
        }
        continue;
      }

      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          throw new ValidationError(
            "Property is not allowed",
            `${pointer}/${key}`
          );
        }
        continue;
      }

      data[key] = schemaShieldInstance.validate(
        schema.properties[key],
        data[key]
      );
    }

    return data;
  },

  maxProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return data;
    }

    throw new ValidationError("Object has too many properties", pointer);
  },

  minProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return data;
    }

    throw new ValidationError("Object has too few properties", pointer);
  },

  additionalProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return data;
    }

    const keys = Object.keys(data);
    const isCompiledSchema = schemaShieldInstance.isCompiledSchema(
      schema.additionalProperties
    );
    for (const key of keys) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }

      if (schema.patternProperties) {
        let match = false;
        for (const pattern in schema.patternProperties) {
          if (new RegExp(pattern, "u").test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }

      if (schema.additionalProperties === false) {
        throw new ValidationError(
          "Property is not allowed",
          `${pointer}/${key}`
        );
      }

      if (isCompiledSchema) {
        data[key] = schemaShieldInstance.validate(
          schema.additionalProperties,
          data[key]
        );
      }
    }

    return data;
  },

  patternProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return data;
    }

    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in data) {
            if (regex.test(key)) {
              throw new ValidationError(
                "Property is not allowed",
                `${pointer}/${key}`
              );
            }
          }
        }
        continue;
      }

      const keys = Object.keys(data);
      for (const key of keys) {
        if (regex.test(key)) {
          data[key] = schemaShieldInstance.validate(
            schema.patternProperties[pattern],
            data[key]
          );
        }
      }
    }

    return data;
  },

  propertyNames(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return data;
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        throw new ValidationError("Property names are not allowed", pointer);
      }
    }

    if (schemaShieldInstance.isCompiledSchema(schema.propertyNames)) {
      for (let key in data) {
        schemaShieldInstance.validate(schema.propertyNames, key);
      }
    }

    return data;
  },

  default: false,
  $ref: false,
  definitions: false,
  $id: false,
  $schema: false,
  title: false,
  $comment: false
};
