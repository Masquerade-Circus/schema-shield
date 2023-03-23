import { ValidationError, ValidatorFunction } from "./utils";

export const Types: Record<string, ValidatorFunction> = {
  object(schema, data, pointer) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return [
        new ValidationError("Data is not an object", {
          pointer,
          value: data,
          code: "NOT_AN_OBJECT"
        })
      ];
    }
  },
  array(schema, data, pointer) {
    if (Array.isArray(data)) {
      return;
    }

    if (typeof data === "object" && data !== null && "length" in data) {
      // Check if the first key is a number and the length is the same as the number of keys - 1 (length)
      const keys = Object.keys(data);
      if (keys.length > 0 && (keys[0] !== "0" || keys.length !== data.length)) {
        return [
          new ValidationError("Data is not an array", {
            pointer,
            value: data,
            code: "NOT_AN_ARRAY"
          })
        ];
      }

      return;
    }

    return [
      new ValidationError("Data is not an array", {
        pointer,
        value: data,
        code: "NOT_AN_ARRAY"
      })
    ];
  },
  string(schema, data, pointer) {
    if (typeof data !== "string") {
      return [
        new ValidationError("Data is not a string", {
          pointer,
          value: data,
          code: "NOT_A_STRING"
        })
      ];
    }
  },
  number(schema, data, pointer) {
    if (typeof data !== "number") {
      return [
        new ValidationError("Data is not a number", {
          pointer,
          value: data,
          code: "NOT_A_NUMBER"
        })
      ];
    }
  },
  integer(schema, data, pointer) {
    if (typeof data !== "number" || !Number.isInteger(data)) {
      return [
        new ValidationError("Data is not an integer", {
          pointer,
          value: data,
          code: "NOT_AN_INTEGER"
        })
      ];
    }
  },
  boolean(schema, data, pointer) {
    if (typeof data !== "boolean") {
      return [
        new ValidationError("Data is not a boolean", {
          pointer,
          value: data,
          code: "NOT_A_BOOLEAN"
        })
      ];
    }
  },
  null(schema, data, pointer) {
    if (data !== null) {
      return [
        new ValidationError("Data is not null", {
          pointer,
          value: data,
          code: "NOT_NULL"
        })
      ];
    }
  }
};
