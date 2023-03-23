export interface ValidationErrorProps {
  pointer: string;
  value: any;
  code: string;
}

export interface ValidatorFunction {
  (schema: CompiledSchema, data, pointer): ValidationError[] | void;
}

export interface CompiledSchema {
  validator: ValidatorFunction;
  pointer: string;
  type?: string;
  types: string[];
  keywords?: Record<string, ValidatorFunction>;
  properties?: Record<string, CompiledSchema>;
  items?: CompiledSchema;
  [key: string]: any;
}

export interface Validator {
  (data: any): { valid: boolean; errors: ValidationError[] | void };
  compiledSchema: CompiledSchema;
}

export interface Keyword {
  validator: ValidatorFunction;
  schemaType: string;
}

export class ValidationError extends Error {
  name: string;
  pointer: string;
  message: string;
  value: any;
  code: string;

  constructor(message: string, options: ValidationErrorProps) {
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

export function deepEqual(obj: Array<any> | Record<string, any>, other: Array<any> | Record<string, any>) {
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