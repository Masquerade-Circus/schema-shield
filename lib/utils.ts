import { CompiledSchema } from "./index";

export class ValidationError extends Error {
  name: string;
  pointer: string;
  message: string;
  value: any;
  code: string;
  item: string | number;

  constructor(message: string, pointer?: string) {
    super(message);
    this.pointer = pointer;
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
