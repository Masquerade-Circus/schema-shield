import { ValidationError, isObject } from "./utils";

import { ValidatorFunction } from "./index";

export const Types: Record<string, ValidatorFunction> = {
  object(schema, data, pointer) {
    if (isObject(data)) {
      return data;
    }

    throw new ValidationError("Data is not an object", pointer);
  },
  array(schema, data, pointer) {
    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === "object" && data !== null && "length" in data) {
      // Check if the first key is a number and the length is the same as the number of keys - 1 (length)
      const keys = Object.keys(data);
      if (keys.length > 0 && (keys[0] !== "0" || keys.length !== data.length)) {
        throw new ValidationError("Data is not an array", pointer);
      }

      return data;
    }

    throw new ValidationError("Data is not an array", pointer);
  },
  string(schema, data, pointer) {
    if (typeof data === "string") {
      return data;
    }

    throw new ValidationError("Data is not a string", pointer);
  },
  number(schema, data, pointer) {
    if (typeof data === "number") {
      return data;
    }

    throw new ValidationError("Data is not a number", pointer);
  },
  integer(schema, data, pointer) {
    if (typeof data === "number" && Number.isInteger(data)) {
      return data;
    }

    throw new ValidationError("Data is not an integer", pointer);
  },
  boolean(schema, data, pointer) {
    if (typeof data === "boolean") {
      return data;
    }

    throw new ValidationError("Data is not a boolean", pointer);
  },
  null(schema, data, pointer) {
    if (data === null) {
      return data;
    }

    throw new ValidationError("Data is not null", pointer);
  }
};
