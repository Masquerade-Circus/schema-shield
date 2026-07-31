import type { CompiledSchema } from "../index";

const hasOwnPropertyIntrinsic = Object.prototype.hasOwnProperty;
const hasOwnPropertyCall = Function.prototype.call.bind(
  hasOwnPropertyIntrinsic
) as (target: any, key: PropertyKey) => boolean;

export function definePropertyOrThrow<T extends object>(
  target: T,
  key: PropertyKey,
  descriptor: PropertyDescriptor
): T {
  if (!Reflect.defineProperty(target, key, descriptor)) {
    throw new TypeError(`Cannot define property "${String(key)}"`);
  }
  return target;
}

export function hasOwn(target: any, key: PropertyKey): boolean {
  return hasOwnPropertyCall(target, key);
}

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
  code?: string;
  message: string;
  item?: string | number;
  keyword: string;
  cause?: ValidationError;
  schemaPath: string = "";
  instancePath: string = "";
  data?: any;
  schema?: CompiledSchema;

  constructor(message: string) {
    super(message);
    this.message = message;
  }

  getCause(): ValidationError {
    let current: ValidationError = this;
    let schemaPointer = "#";
    let instancePointer = "#";
    const seen = new Set<ValidationError>();

    while (!seen.has(current)) {
      seen.add(current);
      let schemaPath = `${schemaPointer}/${current.keyword}`;
      let instancePath = instancePointer;
      if (typeof current.item !== "undefined") {
        if (
          typeof current.item === "string" &&
          current.schema &&
          typeof current.schema === "object" &&
          current.item in current.schema
        ) {
          schemaPath += `/${escapeJsonPointerToken(current.item)}`;
        }
        instancePath += `/${escapeJsonPointerToken(current.item)}`;
      }
      current.schemaPath = schemaPath;
      current.instancePath = instancePath;

      if (
        !(current.cause instanceof ValidationError) ||
        seen.has(current.cause)
      ) {
        return current;
      }
      schemaPointer = schemaPath;
      instancePointer = instancePath;
      current = current.cause;
    }
    return current;
  }

  getTree(): ErrorTree {
    this.getCause();
    let current: ValidationError | undefined = this;
    let root: ErrorTree | undefined;
    let target: ErrorTree | undefined;
    const seen = new Set<ValidationError>();

    while (current && !seen.has(current)) {
      seen.add(current);
      const node: ErrorTree = {
        message: current.message,
        keyword: current.keyword,
        item: current.item,
        schemaPath: current.schemaPath,
        instancePath: current.instancePath,
        data: current.data
      };
      if (!root) {
        root = node;
      } else if (target) {
        target.cause = node;
      }
      target = node;
      current =
        current.cause instanceof ValidationError ? current.cause : undefined;
    }

    return root!;
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
  code?: string;
  item?: any; // Final item in the schemaPath
  cause?: ValidationError | true; // Cause of the error
  data?: any; // Data that caused the error
}

export interface DefineErrorFunction {
  (
    message: string,
    options?: DefineErrorOptions
  ): ValidationError | void | true;
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
    KeywordError.code = options.code;
    KeywordError.item = options.item;
    if (options.cause !== KeywordError) {
      KeywordError.cause =
        options.cause && options.cause !== true ? options.cause : undefined;
    }
    KeywordError.data = options.data;
    return KeywordError;
  };

  return getNamedFunction<DefineErrorFunction>(
    `defineError_${key}`,
    defineError
  );
}

export function escapeJsonPointerToken(value: string | number): string {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
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

export function isCompiledSchema(subSchema: any): subSchema is CompiledSchema {
  return (
    !!subSchema &&
    typeof subSchema === "object" &&
    !Array.isArray(subSchema) &&
    "$validate" in subSchema
  );
}

export function getNamedFunction<T extends object>(name: string, fn: T): T {
  return definePropertyOrThrow(fn, "name", { value: name });
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
      if (/~(?:[^01]|$)/.test(decodedUriPart)) {
        throw new URIError("Invalid JSON Pointer escape");
      }
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

export function areCloseEnough(a: number, b: number, epsilon = 1e-15): boolean {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}
