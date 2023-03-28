import { CompiledSchema } from "./index";

function getError(error, pointer = "#") {
  const path =
    pointer + "/" + error.keyword + ("item" in error ? "/" + error.item : "");

  if (!error.cause) {
    error.path = path;
    return error;
  }

  return getError(error.cause, path);
}

export class ValidationError extends Error {
  message: string;
  item: string | number;
  keyword: string;
  cause: ValidationError;
  path: string = "";

  private _getCause(pointer = "#") {
    const path =
      pointer + "/" + this.keyword + ("item" in this ? "/" + this.item : "");

    if (!this.cause) {
      this.path = path;
      return this;
    }

    return this.cause._getCause(path);
  }

  getCause() {
    return this._getCause();
  }
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

  if (isObject(obj)) {
    const result = {};
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
