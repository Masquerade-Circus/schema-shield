import { CompiledSchema } from "./index";

interface ErrorTree {
  message: string;
  keyword: string;
  item?: string | number;
  schemaPath: string;
  instancePath: string;
  data?: any;
  cause?: ErrorTree;
}

export class ValidationError extends Error {
  message: string;
  item?: string | number;
  keyword: string;
  cause?: ValidationError;
  schemaPath: string = "";
  instancePath: string = "";
  data?: any;
  schema?: CompiledSchema;

  private _getCause(pointer = "#", instancePointer = "#"): ValidationError {
    let schemaPath = `${pointer}/${this.keyword}`;
    let instancePath = `${instancePointer}`;
    if (typeof this.item !== "undefined") {
      if (typeof this.item === "string" && this.item in this.schema) {
        schemaPath += `/${this.item}`;
      }
      instancePath += `/${this.item}`;
    }

    this.instancePath = instancePath;
    this.schemaPath = schemaPath;

    // If there is no cause or the cause is not a ValidationError, return this
    if (!this.cause || !(this.cause instanceof ValidationError)) {
      return this;
    }

    return this.cause._getCause(schemaPath, instancePath);
  }

  getCause(): ValidationError {
    return this._getCause();
  }

  private _getTree(): ErrorTree {
    const tree: ErrorTree = {
      message: this.message,
      keyword: this.keyword,
      item: this.item,
      schemaPath: this.schemaPath,
      instancePath: this.instancePath,
      data: this.data
    };

    if (this.cause) {
      tree.cause = this.cause._getTree();
    }

    return tree;
  }

  getTree(): ErrorTree {
    this.getCause();
    return this._getTree();
  }

  getPath() {
    const cause = this.getCause();
    return {
      schemaPath: cause.schemaPath,
      instancePath: cause.instancePath
    };
  }
}

export interface DefineErrorOptions {
  item?: any; // Final item in the schemaPath
  cause?: ValidationError; // Cause of the error
  data?: any; // Data that caused the error
}

export interface DefineErrorFunction {
  (message: string, options?: DefineErrorOptions): ValidationError;
}

export function getDefinedErrorFunctionForKey(
  key: string,
  schema: CompiledSchema
) {
  const KeywordError = new ValidationError(`Invalid ${key}`);
  KeywordError.keyword = key;
  KeywordError.schema = schema;

  const defineError: DefineErrorFunction = (message, options = {}) => {
    KeywordError.message = message;
    KeywordError.item = options.item;
    KeywordError.cause = options.cause;
    KeywordError.data = options.data;
    return KeywordError;
  };

  return getNamedFunction<DefineErrorFunction>(
    `defineError_${key}`,
    defineError
  );
}

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

export function areCloseEnough(a, b, epsilon = 1e-15) {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}

export function getUTF16Length(str) {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i);
    if (codePoint > 0xffff) {
      i++;
    }
    length++;
  }
  return length;
}

export function deepClone(obj: any): any {
  if (Array.isArray(obj)) {
    const result = [];
    for (let i = 0; i < obj.length; i++) {
      result[i] = deepClone(obj[i]);
    }
    return result;
  }

  // Is class instance of any kind
  if (obj && obj.constructor && obj.constructor.name !== "Object") {
    return obj;
  }

  if (isObject(obj)) {
    const result = {
      ...obj
    };
    for (const key in obj) {
      result[key] = deepClone(obj[key]);
    }
    return result;
  }

  return obj;
}

export function isCompiledSchema(subSchema: any): subSchema is CompiledSchema {
  return isObject(subSchema) && "$validate" in subSchema;
}

export function getNamedFunction<T>(name: string, fn: T): T {
  return Object.defineProperty(fn, "name", { value: name });
}
