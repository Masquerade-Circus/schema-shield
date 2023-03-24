import SchemaShield from "./index";

export interface ValidationErrorProps {
  pointer: string;
  value: any;
  code: string;
}

export interface Result {
  valid: boolean;
  errors: ValidationError[];
  data: any;
}

export interface ValidatorFunction {
  (
    schema: CompiledSchema,
    data: any,
    pointer: string,
    schemaShieldInstance: SchemaShield
  ): Result;
}

export interface FormatFunction {
  (data: any): boolean;
}

export interface CompiledSchema {
  pointer: string;
  validator?: ValidatorFunction;
  type?: string;
  validators?: ValidatorFunction[];
  keywords?: Record<string, ValidatorFunction>;
  [key: string]: any;
}

export interface Validator {
  (data: any): Result;
  compiledSchema: CompiledSchema;
}

export class ValidationError extends Error {
  name: string;
  pointer: string;
  message: string;
  value: any;
  code: string;

  constructor(
    message: string,
    options: ValidationErrorProps = {
      pointer: "",
      value: null,
      code: ""
    }
  ) {
    super(message);
    this.name = "ValidationError";
    this.pointer = options.pointer;
    this.message = message;
    this.value = options.value;
    this.code = options.code;
  }
}

export const defaultValidator = (schema, data, pointer) => {
  return [
    new ValidationError("No validator for this schema", {
      pointer,
      value: data,
      code: "NO_VALIDATOR"
    })
  ];
};

export function deepEqual(
  obj: Array<any> | Record<string, any>,
  other: Array<any> | Record<string, any>
) {
  if (Array.isArray(obj) && Array.isArray(other)) {
    if (obj.length !== other.length) {
      return false;
    }

    for (let i = 0; i < obj.length; i++) {
      if (!deepEqual(obj[i], other[i])) {
        return false;
      }
    }

    return true;
  }

  if (typeof obj === "object" && typeof other === "object") {
    if (obj === null || other === null) {
      return obj === other;
    }

    const keys = Object.keys(obj);
    if (keys.length !== Object.keys(other).length) {
      return false;
    }

    for (const key of keys) {
      if (!deepEqual(obj[key], other[key])) {
        return false;
      }
    }

    return true;
  }

  return obj === other;
}

export function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
