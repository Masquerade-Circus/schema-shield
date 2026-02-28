import { CompiledSchema } from "../index";
import { isObject } from "./validators";

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
