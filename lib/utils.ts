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
  cause?: ValidationError | true; // Cause of the error
  data?: any; // Data that caused the error
}

export interface DefineErrorFunction {
  (message: string, options?: DefineErrorOptions):
    | ValidationError
    | void
    | true;
}
const FAIL_FAST_DEFINE_ERROR: DefineErrorFunction = () => true;

export function getDefinedErrorFunctionForKey(
  key: string,
  schema: CompiledSchema,
  failFast: boolean
) {
  if (failFast) {
    return FAIL_FAST_DEFINE_ERROR;
  }

  const KeywordError = new ValidationError(`Invalid ${key}`);
  KeywordError.keyword = key;
  KeywordError.schema = schema;

  const defineError: DefineErrorFunction = (message, options = {}) => {
    KeywordError.message = message;
    KeywordError.item = options.item;
    KeywordError.cause =
      options.cause && options.cause !== true ? options.cause : undefined;
    KeywordError.data = options.data;
    return KeywordError;
  };

  return getNamedFunction<DefineErrorFunction>(
    `defineError_${key}`,
    defineError
  );
}

export function hasChanged(prev: any, current: any) {
  if (Array.isArray(prev)) {
    if (Array.isArray(current) === false) {
      return true;
    }

    if (prev.length !== current.length) {
      return true;
    }

    for (let i = 0; i < current.length; i++) {
      if (hasChanged(prev[i], current[i])) {
        return true;
      }
    }

    return false;
  }

  if (typeof prev === "object" && prev !== null) {
    if (typeof current !== "object" || current === null) {
      return true;
    }

    for (const key in current) {
      if (hasChanged(prev[key], current[key])) {
        return true;
      }
    }

    for (const key in prev) {
      if (hasChanged(prev[key], current[key])) {
        return true;
      }
    }

    return false;
  }

  return Object.is(prev, current) === false;
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

export function deepClone<T>(
  obj: T,
  cloneClassInstances = false,
  seen = new WeakMap()
): T {
  if (typeof obj === "undefined" || obj === null || typeof obj !== "object") {
    return obj;
  }

  if (seen.has(obj)) {
    return seen.get(obj);
  }

  let clone: any;

  if (typeof structuredClone === "function") {
    clone = structuredClone(obj);
    seen.set(obj, clone);
    return clone;
  }

  switch (true) {
    case Array.isArray(obj): {
      clone = [];
      seen.set(obj, clone);
      for (let i = 0, l = obj.length; i < l; i++) {
        clone[i] = deepClone(obj[i], cloneClassInstances, seen);
      }
      return clone;
    }
    case obj instanceof Date: {
      clone = new Date(obj.getTime());
      seen.set(obj, clone);
      return clone;
    }
    case obj instanceof RegExp: {
      clone = new RegExp(obj.source, obj.flags);
      seen.set(obj, clone);
      return clone;
    }
    case obj instanceof Map: {
      clone = new Map();
      seen.set(obj, clone);
      for (const [key, value] of obj.entries()) {
        clone.set(
          deepClone(key, cloneClassInstances, seen),
          deepClone(value, cloneClassInstances, seen)
        );
      }
      return clone;
    }
    case obj instanceof Set: {
      clone = new Set();
      seen.set(obj, clone);
      for (const value of obj.values()) {
        clone.add(deepClone(value, cloneClassInstances, seen));
      }
      return clone;
    }
    case obj instanceof ArrayBuffer: {
      clone = obj.slice(0);
      seen.set(obj, clone);
      return clone;
    }
    // TypedArrays and DataView
    case ArrayBuffer.isView(obj): {
      clone = new (obj as any).constructor(obj.buffer.slice(0));
      seen.set(obj, clone);
      return clone;
    }
    // Node.js Buffer
    case typeof Buffer !== "undefined" && obj instanceof Buffer: {
      clone = Buffer.from(obj as any);
      seen.set(obj, clone);
      return clone;
    }
    case obj instanceof Error: {
      clone = new (obj as any).constructor(obj.message);
      seen.set(obj, clone);
      break;
    }
    // Non clonable objects
    case obj instanceof Promise ||
      obj instanceof WeakMap ||
      obj instanceof WeakSet: {
      clone = obj;
      seen.set(obj, clone);
      return clone;
    }
    // Instance of a class
    case obj.constructor && obj.constructor !== Object: {
      if (!cloneClassInstances) {
        clone = obj;
        seen.set(obj, clone);
        return clone;
      }
      clone = Object.create(Object.getPrototypeOf(obj));
      seen.set(obj, clone);
      break;
    }

    // Plain objects
    default: {
      clone = {};
      seen.set(obj, clone);

      const keys = Reflect.ownKeys(obj);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        clone[key as string] = deepClone(
          (obj as any)[key as string],
          cloneClassInstances,
          seen
        );
      }
      return clone;
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as string];
    if ("value" in descriptor) {
      descriptor.value = deepClone(descriptor.value, cloneClassInstances, seen);
    }
    Object.defineProperty(clone, key, descriptor);
  }

  return clone;
}

export function isCompiledSchema(subSchema: any): subSchema is CompiledSchema {
  return isObject(subSchema) && "$validate" in subSchema;
}

export function getNamedFunction<T>(name: string, fn: T): T {
  return Object.defineProperty(fn, "name", { value: name });
}

export function resolvePath(root: any, path: string): any {
  if (!path || path === "#") {
    return root;
  }

  // JSON Pointer
  if (path.startsWith("#/")) {
    const parts = path.split("/").slice(1);
    let current = root;

    for (const part of parts) {
      const decodedUriPart = decodeURIComponent(part);
      const key = decodedUriPart.replace(/~1/g, "/").replace(/~0/g, "~");

      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return;
      }
    }
    return current;
  }

  // Simple lookup by definition name (non-standard, but useful)
  if (!path.includes("#")) {
    if (root.definitions && root.definitions[path]) {
      return root.definitions[path];
    }
    if (root.defs && root.defs[path]) {
      return root.defs[path];
    }

    if (root.$id && typeof root.$id === "string") {
      if (root.$id === path || root.$id.endsWith("/" + path)) {
        return root;
      }
    }
  }

  return;
}
