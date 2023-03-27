import { CompiledSchema, ValidatorFunction } from "../index";
import { ValidationError, deepEqual, isObject } from "../utils";

export const OtherKeywords: Record<string, ValidatorFunction> = {
  nullable(schema, data, pointer) {
    if (schema.nullable && data !== null) {
      throw new ValidationError("Value must be null to be empty", pointer);
    }

    return data;
  },

  allOf(schema, data, pointer, schemaShieldInstance) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        data = schemaShieldInstance.validate(schema.allOf[i], data);
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          throw new ValidationError(
            `Value must match all schemas in allOf`,
            pointer
          );
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        throw new ValidationError(
          `Value must match all schemas in allOf`,
          pointer
        );
      }
    }

    return data;
  },

  anyOf(schema, data, pointer, schemaShieldInstance) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        try {
          data = schemaShieldInstance.validate(schema.anyOf[i], data);
          return data;
        } catch (error) {
          continue;
        }
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return data;
          }
        }

        if (data === schema.anyOf[i]) {
          return data;
        }
      }
    }

    throw new ValidationError(
      `Value must match at least one schema in anyOf`,
      pointer
    );
  },

  oneOf(schema, data, pointer, schemaShieldInstance) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        try {
          data = schemaShieldInstance.validate(schema.oneOf[i], data);
          validCount++;
        } catch (error) {
          continue;
        }
      } else {
        if (typeof schema.oneOf[i] === "boolean") {
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
      return data;
    }

    throw new ValidationError(
      `Value must match exactly one schema in oneOf`,
      pointer
    );
  },

  dependencies(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return data;
    }

    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }

      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            throw new ValidationError(
              `Dependency ${dependency[i]} is missing`,
              pointer
            );
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        throw new ValidationError(`Dependency ${key} is missing`, pointer);
      }

      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        throw new ValidationError(
          `Dependency ${dependency} is missing`,
          pointer
        );
      }

      data = schemaShieldInstance.validate(dependency, data);
    }

    return data;
  },

  const(schema, data, pointer) {
    if (
      data === schema.const ||
      (isObject(data) &&
        isObject(schema.const) &&
        deepEqual(data, schema.const)) ||
      (Array.isArray(data) &&
        Array.isArray(schema.const) &&
        deepEqual(data, schema.const))
    ) {
      return data;
    }
    throw new ValidationError(`Value must be equal to const`, pointer);
  },

  contains(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return data;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          throw new ValidationError(
            `Value must contain at least one item`,
            pointer
          );
        }
        return data;
      }

      throw new ValidationError(`Value must not contain any items`, pointer);
    }

    for (let i = 0; i < data.length; i++) {
      try {
        data[i] = schemaShieldInstance.validate(schema.contains, data[i]);
        return data;
      } catch (error) {
        continue;
      }
    }

    throw new ValidationError(
      `Value must contain at least one item that matches the contains schema`,
      pointer
    );
  },

  if(schema, data, pointer, schemaShieldInstance) {
    if ("then" in schema === false && "else" in schema === false) {
      return data;
    }

    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          data = schemaShieldInstance.validate(schema.then, data);
        }
      } else if (schema.else) {
        data = schemaShieldInstance.validate(schema.else, data);
      }
      return data;
    }

    try {
      data = schemaShieldInstance.validate(schema.if, data);
      if (schema.then) {
        try {
          data = schemaShieldInstance.validate(schema.then, data);
        } catch (error) {
          throw new ValidationError(
            `Value must match then schema if it matches if schema`,
            pointer
          );
        }
      }
    } catch (error) {
      if (
        error instanceof ValidationError === false ||
        error.message === "Value must match then schema if it matches if schema"
      ) {
        throw error;
      }
      if (schema.else) {
        try {
          data = schemaShieldInstance.validate(schema.else, data);
        } catch (error) {
          throw new ValidationError(
            `Value must match else schema if it does not match if schema`,
            pointer
          );
        }
      }
    }

    return data;
  },

  not(schema, data, pointer, schemaShieldInstance) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        throw new ValidationError("Value must not be valid", pointer);
      }
      return data;
    }

    try {
      data = schemaShieldInstance.validate(schema.not, data);
    } catch (error) {
      if (error instanceof ValidationError) {
        return data;
      }
      throw error;
    }

    throw new ValidationError("Value must not be valid", pointer);
  }
};
