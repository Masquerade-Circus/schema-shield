import { CompiledSchema } from "../index";

interface ErrorTree {
  message: string;
  keyword: string;
  item?: string | number;
  schemaPath: string;
  instancePath: string;
  data?: any;
  cause?: ErrorTree;
}

export interface CompactValidationPath {
  messages: string[];
  keywords: string[];
  schemas: CompiledSchema[];
  items: Array<string | number | undefined>;
  data: any[];
}

export class ValidationError extends Error {
  message: string;
  code?: string;
  item?: string | number;
  keyword: string;
  cause?: ValidationError;
  schemaPath: string = "";
  instancePath: string = "";
  data?: any;
  schema?: CompiledSchema;
  private compactPath?: CompactValidationPath;
  private compactLeaf?: ValidationError;

  constructor(message: string) {
    super(message);
    this.message = message;
  }

  setCompactPath(path: CompactValidationPath, leaf: ValidationError) {
    this.compactPath = path;
    this.compactLeaf = leaf;
    this.cause = leaf;
  }

  private visitPath(
    visitor: (error: ValidationError) => void
  ): ValidationError {
    let pointer = "#";
    let instancePointer = "#";
    const compactPath = this.compactPath;

    if (compactPath) {
      for (let i = 0; i < compactPath.keywords.length; i++) {
        const item = compactPath.items[i];
        let schemaPath = `${pointer}/${compactPath.keywords[i]}`;
        let instancePath = instancePointer;

        if (typeof item !== "undefined") {
          const escapedItem = String(item)
            .replace(/~/g, "~0")
            .replace(/\//g, "~1");
          const frameSchema = compactPath.schemas[i];
          if (
            typeof item === "string" &&
            frameSchema &&
            typeof frameSchema === "object" &&
            item in frameSchema
          ) {
            schemaPath += `/${escapedItem}`;
          }
          instancePath += `/${escapedItem}`;
        }

        const frameError = i === 0 ? this : new ValidationError(compactPath.messages[i]);
        frameError.message = compactPath.messages[i];
        frameError.keyword = compactPath.keywords[i];
        frameError.schema = compactPath.schemas[i];
        frameError.item = item;
        frameError.data = compactPath.data[i];
        frameError.schemaPath = schemaPath;
        frameError.instancePath = instancePath;
        visitor(frameError);
        pointer = schemaPath;
        instancePointer = instancePath;
      }

      let current = this.compactLeaf!;
      while (true) {
        let schemaPath = `${pointer}/${current.keyword}`;
        let instancePath = instancePointer;
        if (typeof current.item !== "undefined") {
          const escapedItem = String(current.item)
            .replace(/~/g, "~0")
            .replace(/\//g, "~1");
          if (
            typeof current.item === "string" &&
            current.schema &&
            typeof current.schema === "object" &&
            current.item in current.schema
          ) {
            schemaPath += `/${escapedItem}`;
          }
          instancePath += `/${escapedItem}`;
        }

        current.schemaPath = schemaPath;
        current.instancePath = instancePath;
        visitor(current);
        if (!current.cause || !(current.cause instanceof ValidationError)) {
          return current;
        }
        pointer = schemaPath;
        instancePointer = instancePath;
        current = current.cause;
      }
    }

    let current: ValidationError = this;
    while (true) {
      let schemaPath = `${pointer}/${current.keyword}`;
      let instancePath = instancePointer;
      if (typeof current.item !== "undefined") {
        const escapedItem = String(current.item)
          .replace(/~/g, "~0")
          .replace(/\//g, "~1");
        if (
          typeof current.item === "string" &&
          current.schema &&
          typeof current.schema === "object" &&
          current.item in current.schema
        ) {
          schemaPath += `/${escapedItem}`;
        }
        instancePath += `/${escapedItem}`;
      }

      current.instancePath = instancePath;
      current.schemaPath = schemaPath;
      visitor(current);
      if (!current.cause || !(current.cause instanceof ValidationError)) {
        return current;
      }
      pointer = schemaPath;
      instancePointer = instancePath;
      current = current.cause;
    }
  }

  getCause(): ValidationError {
    return this.visitPath(() => {});
  }

  getTree(): ErrorTree {
    let root: ErrorTree | undefined;
    let previous: ErrorTree | undefined;
    this.visitPath((current) => {
      const tree: ErrorTree = {
        message: current.message,
        keyword: current.keyword,
        item: current.item,
        schemaPath: current.schemaPath,
        instancePath: current.instancePath,
        data: current.data
      };
      if (!root) {
        root = tree;
      }
      if (previous) {
        previous.cause = tree;
      }
      previous = tree;
    });

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

  const defineError: DefineErrorFunction = (message, options = {}) => {
    const KeywordError = new ValidationError(message);
    KeywordError.keyword = key;
    KeywordError.schema = schema;
    KeywordError.message = message;
    KeywordError.item = options.item;
    KeywordError.cause =
      options.cause && options.cause !== true ? options.cause : undefined;
    KeywordError.code = KeywordError.cause?.code;
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
  return (
    !!subSchema &&
    typeof subSchema === "object" &&
    !Array.isArray(subSchema) &&
    "$validate" in subSchema
  );
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

export function areCloseEnough(a: number, b: number, epsilon = 1e-15): boolean {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}
