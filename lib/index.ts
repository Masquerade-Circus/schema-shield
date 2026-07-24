/****************** Path: lib/index.ts ******************/
import {
  DefineErrorFunction,
  CompactValidationPath,
  ValidationError,
  getDefinedErrorFunctionForKey,
  getNamedFunction,
  resolvePath
} from "./utils/main-utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";
import { deepCloneUnfreeze } from "./utils/deep-freeze";
import { compilePatternMatcher } from "./utils/pattern-matcher";

export { ValidationError } from "./utils/main-utils";
export { deepCloneUnfreeze as deepClone } from "./utils/deep-freeze";

export type Result = void | ValidationError | true;

export interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: DefineErrorFunction,
    instance: SchemaShield
  ): Result;
}

export interface TypeFunction {
  (data: any): boolean;
}

export interface FormatFunction {
  (data: any): boolean;
}

export interface ValidateFunction {
  (data: any): Result;
}

export interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}

export interface Validator {
  (data: any): {
    data: any;
    error: ValidationError | null | true;
    valid: boolean;
  };
  compiledSchema: CompiledSchema;
}

interface ValidatorItem {
  name: string;
  keyword: string;
  iterativeKeyword?: string;
  validate: ValidateFunction;
}

interface PropertyValidationEntry {
  key: string;
  schemaProp: any;
  hasDefault: boolean;
}

interface IterativeWorkspace {
  schemas: CompiledSchema[];
  data: any[];
  validatorIndexes: number[];
  structuralKinds: number[];
  structuralIndexes: number[];
  secondaryIndexes: number[];
  structuralFlags: number[];
  restorePathLengths: number[];
  completionKinds: number[];
  combinatorValidCounts: number[];
  pendingDefaults: Array<PropertyValidationEntry | undefined>;
  pendingDefaultValues: any[];
  stagedDefaults: Array<
    Array<{ entry: PropertyValidationEntry; value: any }> | undefined
  >;
  structuralKeys: Array<string[] | undefined>;
  pathMessages: string[];
  pathKeywords: string[];
  pathSchemas: CompiledSchema[];
  pathItems: Array<string | number | undefined>;
  pathData: any[];
  defaultMutationTargets: any[];
  defaultMutationKeys: string[];
}

interface PatternPropertyEntry {
  schemaProp: any;
  match: (key: string) => boolean;
}

type CombinatorBranchEntry =
  | { kind: "validate"; validate: ValidateFunction }
  | { kind: "alwaysValid" }
  | { kind: "alwaysInvalid" }
  | { kind: "literal"; value: any };

export class SchemaShield {
  private types: Record<string, TypeFunction | false> = {};
  private formats: Record<string, FormatFunction | false> = {};
  private keywords: Record<string, KeywordFunction | false> = {};
  private immutable = false;
  private rootSchema: CompiledSchema | null = null;
  private idRegistry: Map<string, CompiledSchema> = new Map();
  private schemaLocations: WeakSet<object> = new WeakSet();
  private failFast: boolean = true;
  private maxDepth: number;
  private guardedValidationDepth = 0;
  private depthErrorCount = 0;
  private iterativeWorkspaces: IterativeWorkspace[] = [];
  private activeIterativeWorkspaces = 0;

  constructor({
    immutable = false,
    failFast = true,
    maxDepth = 10_000
  }: {
    immutable?: boolean;
    failFast?: boolean;
    maxDepth?: number;
  } = {}) {
    if (
      typeof maxDepth !== "number" ||
      !Number.isFinite(maxDepth) ||
      !Number.isInteger(maxDepth) ||
      maxDepth <= 0
    ) {
      throw new ValidationError("maxDepth must be a positive integer");
    }
    this.immutable = immutable;
    this.failFast = failFast;
    this.maxDepth = maxDepth;

    for (const [type, validator] of Object.entries(Types)) {
      if (validator) {
        this.addType(type, validator);
      }
    }

    for (const [keyword, validator] of Object.entries(keywords)) {
      this.addKeyword(keyword, validator as KeywordFunction);
    }

    for (const [format, validator] of Object.entries(Formats)) {
      if (validator) {
        this.addFormat(format, validator as FormatFunction);
      }
    }
  }

  addType(name: string, validator: TypeFunction, overwrite = false) {
    if (this.types[name] && !overwrite) {
      throw new ValidationError(`Type "${name}" already exists`);
    }
    this.types[name] = validator;
  }

  getType(type: string): TypeFunction | false {
    return this.types[type];
  }

  addFormat(name: string, validator: FormatFunction, overwrite = false) {
    if (this.formats[name] && !overwrite) {
      throw new ValidationError(`Format "${name}" already exists`);
    }
    this.formats[name] = validator;
  }

  getFormat(format: string): FormatFunction | false {
    return this.formats[format];
  }

  isDefaultFormatValidator(format: string, validator: FormatFunction): boolean {
    return (Formats as Record<string, FormatFunction | false>)[format] === validator;
  }

  addKeyword(name: string, validator: KeywordFunction, overwrite = false) {
    if (this.keywords[name] && !overwrite) {
      throw new ValidationError(`Keyword "${name}" already exists`);
    }
    this.keywords[name] = validator;
  }

  getKeyword(keyword: string): KeywordFunction | false {
    return this.keywords[keyword];
  }

  getSchemaRef(path: string): CompiledSchema | undefined {
    if (!this.rootSchema) {
      return;
    }
    return resolvePath(this.rootSchema, path);
  }

  getSchemaById(id: string): CompiledSchema | undefined {
    return this.idRegistry.get(id);
  }

  compile(schema: any): Validator {
    this.idRegistry.clear();
    const compiledSchema = this.compileSchema(schema);
    this.rootSchema = compiledSchema;
    if ((compiledSchema as any)._hasRef === true) {
      this.linkReferences(compiledSchema);
    }

    const cachePending: any[] = [compiledSchema];
    const cacheSeen = new WeakSet<object>();
    while (cachePending.length > 0) {
      const current = cachePending.pop();
      if (!current || typeof current !== "object" || cacheSeen.has(current)) {
        continue;
      }
      cacheSeen.add(current);
      this.prepareObjectKeywordCaches(current);
      this.prepareCombinatorKeywordCaches(current);

      for (const key of Object.keys(current)) {
        const value = current[key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === "object") {
              cachePending.push(value[i]);
            }
          }
        } else if (value && typeof value === "object") {
          cachePending.push(value);
        }
      }
    }

    if (!compiledSchema.$validate) {
      if (schema === false) {
        const defineError = getDefinedErrorFunctionForKey(
          "oneOf",
          compiledSchema,
          this.failFast
        );

        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_False",
          (data) => defineError("Value is not valid", { data })
        );
      } else if (schema === true) {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      } else if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      } else {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      }
    }

    const requiresIterativeValidation = this.requiresIterativeValidation(
      compiledSchema
    );
    if (requiresIterativeValidation) {
      this.guardCompiledValidators(compiledSchema);
    }

    const validate: Validator = (data: any) => {
      this.rootSchema = compiledSchema;

      const clonedData = this.immutable ? deepCloneUnfreeze(data) : data;
      const res = requiresIterativeValidation
        ? this.validateIterative(compiledSchema, clonedData)
        : compiledSchema.$validate!(clonedData);

      if (res) {
        return { data: clonedData, error: res, valid: false };
      }

      return { data: clonedData, error: null, valid: true };
    };

    validate.compiledSchema = compiledSchema;
    return validate;
  }

  private createDepthError(data: any): ValidationError | true {
    this.depthErrorCount++;
    if (this.failFast) {
      return true;
    }

    const error = new ValidationError(
      `Maximum validation depth of ${this.maxDepth} exceeded`
    );
    error.code = "MAX_DEPTH_EXCEEDED";
    error.keyword = "maxDepth";
    error.schema = { maxDepth: this.maxDepth };
    error.data = data;
    return error;
  }

  private guardCompiledValidators(root: CompiledSchema) {
    const stack: any[] = [root];
    const seen = new WeakSet<object>();
    const guardedByValidator = new Map<ValidateFunction, ValidateFunction>();

    while (stack.length > 0) {
      const schema = stack.pop();
      if (!schema || typeof schema !== "object" || seen.has(schema)) {
        continue;
      }
      seen.add(schema);

      if (
        typeof schema.$validate === "function" &&
        (schema as any)._depthGuarded !== true
      ) {
        const directValidate = schema.$validate as ValidateFunction;
        let guardedValidate = guardedByValidator.get(directValidate);
        if (!guardedValidate) {
          guardedValidate = getNamedFunction<ValidateFunction>(
            directValidate.name,
            (data) => {
              this.guardedValidationDepth++;
              try {
                if (this.guardedValidationDepth > this.maxDepth) {
                  return this.createDepthError(data);
                }
                return directValidate(data);
              } catch (error) {
                if (
                  error instanceof RangeError &&
                  error.message.toLowerCase().includes("call stack")
                ) {
                  return this.createDepthError(data);
                }
                throw error;
              } finally {
                this.guardedValidationDepth--;
              }
            }
          );
          guardedByValidator.set(directValidate, guardedValidate);
        }
        schema.$validate = guardedValidate;
        this.defineHiddenValue(schema, "_depthGuarded", true);
      }

      const resolved = (schema as any)._resolvedSchema;
      if (resolved && typeof resolved === "object") {
        stack.push(resolved);
      }

      for (const key of Object.keys(schema)) {
        if (key === "enum" || key === "const" || key === "default" || key === "examples") {
          continue;
        }
        const value = schema[key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === "object") {
              stack.push(value[i]);
            }
          }
        } else if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }
  }

  private requiresIterativeValidation(root: CompiledSchema): boolean {
    const active = new WeakSet<object>();
    const complete = new WeakSet<object>();
    const stack: Array<{
      schema: CompiledSchema;
      depth: number;
      exiting: boolean;
    }> = [{ schema: root, depth: 0, exiting: false }];

    while (stack.length > 0) {
      const frame = stack.pop()!;
      const schema = frame.schema;

      if (frame.exiting) {
        active.delete(schema);
        complete.add(schema);
        continue;
      }

      if (active.has(schema)) {
        return true;
      }
      if (complete.has(schema)) {
        continue;
      }
      if (frame.depth >= Math.min(256, this.maxDepth)) {
        return true;
      }

      active.add(schema);
      stack.push({ schema, depth: frame.depth, exiting: true });

      const children: any[] = [];
      const resolved = (schema as any)._resolvedSchema;
      if (resolved && typeof resolved === "object") {
        children.push(resolved);
      }

      for (const key of [
        "additionalItems",
        "additionalProperties",
        "contains",
        "elements",
        "else",
        "if",
        "items",
        "not",
        "propertyNames",
        "then",
        "values"
      ]) {
        const value = schema[key];
        if (Array.isArray(value)) {
          children.push(...value);
        } else if (value && typeof value === "object") {
          children.push(value);
        }
      }

      for (const key of [
        "allOf",
        "anyOf",
        "oneOf"
      ]) {
        if (Array.isArray(schema[key])) {
          children.push(...schema[key]);
        }
      }

      for (const key of [
        "definitions",
        "dependencies",
        "patternProperties",
        "properties"
      ]) {
        const map = schema[key];
        if (map && typeof map === "object" && !Array.isArray(map)) {
          children.push(...Object.values(map));
        }
      }

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child && typeof child === "object" && !Array.isArray(child)) {
          stack.push({
            schema: child,
            depth: frame.depth + 1,
            exiting: false
          });
        }
      }
    }

    return false;
  }

  private wrapIterativeError(
    leafError: ValidationError,
    messages: string[],
    keywords: string[],
    schemas: CompiledSchema[],
    items: Array<string | number | undefined>,
    data: any[],
    pathLength: number
  ): ValidationError {
    if (pathLength === 0) {
      return leafError;
    }

    if (pathLength <= 64) {
      let error = leafError;
      for (let i = pathLength - 1; i >= 0; i--) {
        error = getDefinedErrorFunctionForKey(keywords[i], schemas[i], false)(
          messages[i],
          { item: items[i], cause: error, data: data[i] }
        ) as ValidationError;
      }
      error.code = leafError.code;
      return error;
    }

    const compactPath: CompactValidationPath = {
      messages: messages.slice(0, pathLength),
      keywords: keywords.slice(0, pathLength),
      schemas: schemas.slice(0, pathLength),
      items: items.slice(0, pathLength),
      data: data.slice(0, pathLength)
    };
    const error = getDefinedErrorFunctionForKey(
      compactPath.keywords[0],
      compactPath.schemas[0],
      false
    )(compactPath.messages[0], {
      item: compactPath.items[0],
      data: compactPath.data[0]
    }) as ValidationError;
    error.setCompactPath(compactPath, leafError);
    error.code = leafError.code;
    return error;
  }

  private validateIterative(root: CompiledSchema, rootData: any): Result {
    const workspaceIndex = this.activeIterativeWorkspaces++;
    let workspace = this.iterativeWorkspaces[workspaceIndex];
    if (!workspace) {
      workspace = {
        schemas: [],
        data: [],
        validatorIndexes: [],
        structuralKinds: [],
        structuralIndexes: [],
        secondaryIndexes: [],
        structuralFlags: [],
        restorePathLengths: [],
        completionKinds: [],
        combinatorValidCounts: [],
        pendingDefaults: [],
        pendingDefaultValues: [],
        stagedDefaults: [],
        structuralKeys: [],
        pathMessages: [],
        pathKeywords: [],
        pathSchemas: [],
        pathItems: [],
        pathData: [],
        defaultMutationTargets: [],
        defaultMutationKeys: []
      };
      this.iterativeWorkspaces[workspaceIndex] = workspace;
    }

    const depthErrorCount = this.depthErrorCount;
    try {
      const result = this.runIterativeValidation(root, rootData, workspace);
      if (this.depthErrorCount !== depthErrorCount) {
        for (
          let i = workspace.defaultMutationTargets.length - 1;
          i >= 0;
          i--
        ) {
          delete workspace.defaultMutationTargets[i][
            workspace.defaultMutationKeys[i]
          ];
        }
      }
      return result;
    } finally {
      workspace.data.fill(undefined);
      workspace.pendingDefaultValues.fill(undefined);
      workspace.stagedDefaults.fill(undefined);
      workspace.structuralKeys.fill(undefined);
      workspace.pathData.fill(undefined);
      workspace.defaultMutationTargets.fill(undefined);
      workspace.defaultMutationTargets.length = 0;
      workspace.defaultMutationKeys.length = 0;
      this.activeIterativeWorkspaces--;
    }
  }

  private runIterativeValidation(
    root: CompiledSchema,
    rootData: any,
    workspace: IterativeWorkspace
  ): Result {
    const {
      schemas,
      data,
      validatorIndexes,
      structuralKinds,
      structuralIndexes,
      secondaryIndexes,
      structuralFlags,
      restorePathLengths,
      completionKinds,
      combinatorValidCounts,
      pendingDefaults,
      pendingDefaultValues,
      stagedDefaults,
      structuralKeys,
      pathMessages,
      pathKeywords,
      pathSchemas,
      pathItems,
      pathData,
      defaultMutationTargets,
      defaultMutationKeys
    } = workspace;
    defaultMutationTargets.length = 0;
    defaultMutationKeys.length = 0;
    schemas[0] = root;
    data[0] = rootData;
    validatorIndexes[0] = 0;
    structuralKinds[0] = 0;
    structuralIndexes[0] = 0;
    secondaryIndexes[0] = 0;
    structuralFlags[0] = 0;
    restorePathLengths[0] = 0;
    completionKinds[0] = 0;
    combinatorValidCounts[0] = 0;
    pendingDefaults[0] = undefined;
    pendingDefaultValues[0] = undefined;
    stagedDefaults[0] = undefined;
    structuralKeys[0] = undefined;
    let frameCount = 1;
    let pathLength = 0;

    const wrapPath = (error: Result): Result => {
      if (error === true || !error) {
        return error;
      }
      return this.wrapIterativeError(
        error,
        pathMessages,
        pathKeywords,
        pathSchemas,
        pathItems,
        pathData,
        pathLength
      );
    };

    const descend = (
      childSchema: CompiledSchema,
      childData: any,
      completionKind: number,
      pathMessage?: string,
      pathKeyword?: string,
      pathSchema?: CompiledSchema,
      pathItem?: string | number
    ) => {
      if (frameCount > this.maxDepth) {
        childSchema = {
          $validate: () => this.createDepthError(childData)
        };
      }
      const restoreLength = pathLength;
      if (pathMessage) {
        pathMessages[pathLength] = pathMessage;
        pathKeywords[pathLength] = pathKeyword!;
        pathSchemas[pathLength] = pathSchema!;
        pathItems[pathLength] = pathItem;
        pathData[pathLength] = childData;
        pathLength++;
      }
      schemas[frameCount] = childSchema;
      data[frameCount] = childData;
      validatorIndexes[frameCount] = 0;
      structuralKinds[frameCount] = 0;
      structuralIndexes[frameCount] = 0;
      secondaryIndexes[frameCount] = 0;
      structuralFlags[frameCount] = 0;
      restorePathLengths[frameCount] = restoreLength;
      completionKinds[frameCount] = completionKind;
      combinatorValidCounts[frameCount] = 0;
      pendingDefaults[frameCount] = undefined;
      pendingDefaultValues[frameCount] = undefined;
      stagedDefaults[frameCount] = undefined;
      structuralKeys[frameCount] = undefined;
      frameCount++;
    };

    let completedResult: Result;
    const completeFrame = (initialError: Result): boolean => {
      let error = initialError;

      while (frameCount > 0) {
        const depth = frameCount - 1;
        const completionKind = completionKinds[depth];
        const restoreLength = restorePathLengths[depth];
        data[depth] = undefined;
        pendingDefaultValues[depth] = undefined;
        stagedDefaults[depth] = undefined;
        structuralKeys[depth] = undefined;
        frameCount--;

        if (completionKind === 0) {
          completedResult = wrapPath(error);
          return true;
        }

        const parentDepth = frameCount - 1;
        if (completionKind === 1 || completionKind === 2) {
          if (error) {
            continue;
          }
          for (let i = restoreLength; i < pathLength; i++) {
            pathData[i] = undefined;
          }
          pathLength = restoreLength;
          return false;
        }

        if (completionKind === 3) {
          if (error) {
            error = getDefinedErrorFunctionForKey(
              "allOf",
              schemas[parentDepth].allOf,
              this.failFast
            )("Value is not valid", { cause: error, data: data[parentDepth] });
            continue;
          }
          return false;
        }

        if (completionKind === 4) {
          pathLength = restoreLength;
          if (error) {
            return false;
          }
          structuralKinds[parentDepth] = 0;
          return false;
        }

        if (completionKind === 5) {
          pathLength = restoreLength;
          if (!error) {
            combinatorValidCounts[parentDepth]++;
            if (combinatorValidCounts[parentDepth] > 1) {
              error = getDefinedErrorFunctionForKey(
                "oneOf",
                schemas[parentDepth].oneOf,
                this.failFast
              )("Value is not valid", { data: data[parentDepth] });
              continue;
            }
          }
          return false;
        }

        if (completionKind === 6) {
          const entry = pendingDefaults[parentDepth]!;
          const defaultValue = pendingDefaultValues[parentDepth];
          pendingDefaults[parentDepth] = undefined;
          pendingDefaultValues[parentDepth] = undefined;

          if (error) {
            pathMessages[pathLength] = "Default property is invalid";
            pathKeywords[pathLength] = "properties";
            pathSchemas[pathLength] = schemas[parentDepth].properties;
            pathItems[pathLength] = entry.key;
            pathData[pathLength] = defaultValue;
            pathLength++;
            continue;
          }

          stagedDefaults[parentDepth]!.push({ entry, value: defaultValue });
          return false;
        }

        if (completionKind === 7) {
          pathLength = restoreLength;
          if (error) {
            return false;
          }
          structuralKinds[parentDepth] = 0;
          return false;
        }

        if (completionKind === 8) {
          pathLength = restoreLength;
          secondaryIndexes[parentDepth] = error ? 2 : 1;
          return false;
        }

        if (completionKind === 9) {
          pathLength = restoreLength;
          if (error) {
            structuralKinds[parentDepth] = 0;
            return false;
          }
          error = getDefinedErrorFunctionForKey(
            "not",
            schemas[parentDepth].not,
            this.failFast
          )("Value is not valid", { data: data[parentDepth] });
          continue;
        }
      }

      completedResult = wrapPath(error);
      return true;
    };

    const failCurrentFrame = (error: Result): Result | null => {
      return completeFrame(error) ? completedResult : null;
    };

    while (frameCount > 0) {
      const depth = frameCount - 1;
      let schema = schemas[depth];
      const value = data[depth];
      const resolved = (schema as any)._resolvedSchema as
        | CompiledSchema
        | undefined;

      if (resolved && resolved !== schema) {
        schemas[depth] = resolved;
        validatorIndexes[depth] = 0;
        structuralKinds[depth] = 0;
        structuralIndexes[depth] = 0;
        secondaryIndexes[depth] = 0;
        structuralFlags[depth] = 0;
        continue;
      }

      if (structuralKinds[depth] === 1) {
        const entries = (schema as any)._propertyValidationEntries as
          | PropertyValidationEntry[]
          | undefined;
        if (
          !entries ||
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          structuralKinds[depth] = 0;
          continue;
        }

        if (secondaryIndexes[depth] === 0) {
          if (structuralIndexes[depth] >= entries.length) {
            const defaults = stagedDefaults[depth]!;
            for (let i = 0; i < defaults.length; i++) {
              const { entry, value: defaultValue } = defaults[i];
              if (entry.key === "__proto__") {
                Object.defineProperty(value, entry.key, {
                  value: defaultValue,
                  enumerable: true,
                  configurable: true,
                  writable: true
                });
              } else {
                value[entry.key] = defaultValue;
              }
              defaultMutationTargets.push(value);
              defaultMutationKeys.push(entry.key);
            }
            secondaryIndexes[depth] = 1;
            structuralIndexes[depth] = 0;
            continue;
          }

          const entry = entries[structuralIndexes[depth]++];
          if (
            !Object.prototype.hasOwnProperty.call(value, entry.key) &&
            entry.hasDefault
          ) {
            const defaultValue = deepCloneUnfreeze(entry.schemaProp.default);
            pendingDefaults[depth] = entry;
            pendingDefaultValues[depth] = defaultValue;
            descend(entry.schemaProp, defaultValue, 6);
          }
          continue;
        }

        if (structuralIndexes[depth] >= entries.length) {
          structuralKinds[depth] = 0;
          continue;
        }

        const entry = entries[structuralIndexes[depth]++];
        if (!Object.prototype.hasOwnProperty.call(value, entry.key)) {
          continue;
        }
        if (
          stagedDefaults[depth]!.some(
            (item) => item.entry.key === entry.key
          )
        ) {
          continue;
        }

        if (typeof entry.schemaProp === "boolean") {
          if (entry.schemaProp === false) {
            const error = getDefinedErrorFunctionForKey(
              "properties",
              schema.properties,
              this.failFast
            )("Property is not allowed", {
              item: entry.key,
              data: value[entry.key]
            });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
          continue;
        }

        if (entry.schemaProp && typeof entry.schemaProp.$validate === "function") {
          descend(
            entry.schemaProp,
            value[entry.key],
            1,
            "Property is invalid",
            "properties",
            schema.properties,
            entry.key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 2) {
        const schemaItems = schema.items;
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        const itemLimit = Array.isArray(schemaItems)
          ? Math.min(schemaItems.length, value.length)
          : value.length;
        if (itemIndex >= itemLimit) {
          structuralKinds[depth] = 0;
          continue;
        }

        const itemSchema = Array.isArray(schemaItems)
          ? schemaItems[itemIndex]
          : schemaItems;
        if (typeof itemSchema === "boolean") {
          if (itemSchema === false && value[itemIndex] !== undefined) {
            const error = getDefinedErrorFunctionForKey(
              "items",
              schemaItems,
              this.failFast
            )("Array item is not allowed", {
              item: itemIndex,
              data: value[itemIndex]
            });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
          continue;
        }

        if (itemSchema && typeof itemSchema.$validate === "function") {
          descend(
            itemSchema,
            value[itemIndex],
            2,
            "Array item is invalid",
            "items",
            schemaItems,
            itemIndex
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 6) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }

        const key = keys[keyIndex];
        if (
          schema.properties &&
          Object.prototype.hasOwnProperty.call(schema.properties, key)
        ) {
          continue;
        }

        const patternEntries = (schema as any)._patternPropertyEntries as
          | PatternPropertyEntry[]
          | undefined;
        let patternMatched = false;
        if (patternEntries) {
          for (let i = 0; i < patternEntries.length; i++) {
            if (patternEntries[i].match(key)) {
              patternMatched = true;
              break;
            }
          }
        }
        if (patternMatched) {
          continue;
        }

        const additionalSchema = schema.additionalProperties;
        if (additionalSchema === false) {
          const error = getDefinedErrorFunctionForKey(
            "additionalProperties",
            additionalSchema,
            this.failFast
          )("Additional properties are not allowed", {
            item: key,
            data: value[key]
          });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (
          additionalSchema &&
          typeof additionalSchema === "object" &&
          typeof additionalSchema.$validate === "function"
        ) {
          descend(
            additionalSchema,
            value[key],
            1,
            "Additional properties are invalid",
            "additionalProperties",
            additionalSchema,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 7) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const entries = (schema as any)._patternPropertyEntries as
          | PatternPropertyEntry[]
          | undefined;
        if (!entries || entries.length === 0) {
          structuralKinds[depth] = 0;
          continue;
        }

        let keyIndex = structuralIndexes[depth];
        let entryIndex = secondaryIndexes[depth];
        let descended = false;
        while (keyIndex < keys.length && !descended) {
          const key = keys[keyIndex];
          while (entryIndex < entries.length) {
            const entry = entries[entryIndex++];
            if (!entry.match(key)) {
              continue;
            }
            structuralFlags[depth] = 1;
            if (entry.schemaProp === false) {
              const error = getDefinedErrorFunctionForKey(
                "patternProperties",
                schema.patternProperties,
                this.failFast
              )("Property is not allowed", { item: key, data: value[key] });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              descended = true;
              break;
            }
            if (
              entry.schemaProp &&
              typeof entry.schemaProp.$validate === "function"
            ) {
              structuralIndexes[depth] = keyIndex;
              secondaryIndexes[depth] = entryIndex;
              descend(
                entry.schemaProp,
                value[key],
                1,
                "Property is invalid",
                "patternProperties",
                schema.patternProperties,
                key
              );
              descended = true;
              break;
            }
          }
          if (!descended) {
            if (
              structuralFlags[depth] === 0 &&
              schema.additionalProperties === false &&
              !(
                schema.properties &&
                Object.prototype.hasOwnProperty.call(schema.properties, key)
              )
            ) {
              const error = getDefinedErrorFunctionForKey(
                "patternProperties",
                schema.patternProperties,
                this.failFast
              )("Additional properties are not allowed", {
                item: key,
                data: value[key]
              });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              descended = true;
              break;
            }
            keyIndex++;
            entryIndex = 0;
            structuralFlags[depth] = 0;
          }
        }

        if (!descended) {
          structuralKinds[depth] = 0;
        } else if (frameCount - 1 === depth) {
          structuralIndexes[depth] = keyIndex + 1;
          secondaryIndexes[depth] = 0;
        }
        continue;
      }

      if (structuralKinds[depth] === 8) {
        if (!Array.isArray(value) || !Array.isArray(schema.items)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const additionalSchema = schema.additionalItems;
        if (additionalSchema === false) {
          const error = getDefinedErrorFunctionForKey(
            "additionalItems",
            additionalSchema,
            this.failFast
          )("Array is too long", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (
          additionalSchema &&
          typeof additionalSchema === "object" &&
          typeof additionalSchema.$validate === "function"
        ) {
          descend(
            additionalSchema,
            value[itemIndex],
            2,
            "Array item is invalid",
            "additionalItems",
            additionalSchema,
            itemIndex
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 9) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          const error = getDefinedErrorFunctionForKey(
            "contains",
            schema.contains,
            this.failFast
          )("Array must contain at least one item", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }
        if (schema.contains === true) {
          structuralKinds[depth] = 0;
        } else if (schema.contains !== false) {
          descend(schema.contains, value[itemIndex], 7);
        }
        continue;
      }

      if (structuralKinds[depth] === 10) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const dependencyIndex = structuralIndexes[depth]++;
        if (dependencyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[dependencyIndex];
        if (!(key in value)) {
          continue;
        }
        const dependency = schema.dependencies[key];
        if (Array.isArray(dependency)) {
          for (let i = 0; i < dependency.length; i++) {
            if (!(dependency[i] in value)) {
              const error = getDefinedErrorFunctionForKey(
                "dependencies",
                schema.dependencies,
                this.failFast
              )("Dependency is not satisfied", {
                item: i,
                data: dependency[i]
              });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              break;
            }
          }
        } else if (dependency === false) {
          const error = getDefinedErrorFunctionForKey(
            "dependencies",
            schema.dependencies,
            this.failFast
          )("Dependency is not satisfied", { data: dependency });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (
          dependency &&
          typeof dependency === "object" &&
          typeof dependency.$validate === "function"
        ) {
          descend(
            dependency,
            value,
            1,
            "Dependency is not satisfied",
            "dependencies",
            schema.dependencies,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 11) {
        const state = secondaryIndexes[depth];
        if (state === 0) {
          if (schema.if === true) {
            secondaryIndexes[depth] = 1;
          } else if (schema.if === false) {
            secondaryIndexes[depth] = 2;
          } else {
            descend(schema.if, value, 8);
            continue;
          }
        }

        const branch = secondaryIndexes[depth] === 1 ? schema.then : schema.else;
        structuralKinds[depth] = 0;
        if (
          branch &&
          typeof branch === "object" &&
          typeof branch.$validate === "function"
        ) {
          descend(branch, value, 1);
        }
        continue;
      }

      if (structuralKinds[depth] === 12) {
        structuralKinds[depth] = 0;
        if (schema.not === true) {
          const error = getDefinedErrorFunctionForKey(
            "not",
            schema.not,
            this.failFast
          )("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (schema.not !== false) {
          descend(schema.not, value, 9);
        }
        continue;
      }

      if (structuralKinds[depth] === 13) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.propertyNames === false) {
          const error = getDefinedErrorFunctionForKey(
            "propertyNames",
            schema.propertyNames,
            this.failFast
          )("Properties are not allowed", { item: key, data: value[key] });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (
          schema.propertyNames &&
          typeof schema.propertyNames.$validate === "function"
        ) {
          descend(
            schema.propertyNames,
            key,
            1,
            "Property name is invalid",
            "propertyNames",
            schema.propertyNames,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 14) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.values && typeof schema.values.$validate === "function") {
          descend(
            schema.values,
            value[key],
            1,
            "Property is invalid",
            "values",
            schema.values,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === 15) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        if (schema.elements && typeof schema.elements.$validate === "function") {
          descend(
            schema.elements,
            value[itemIndex],
            2,
            "Array item is invalid",
            "elements",
            schema.elements,
            itemIndex
          );
        }
        continue;
      }

      if (
        structuralKinds[depth] === 3 ||
        structuralKinds[depth] === 4 ||
        structuralKinds[depth] === 5
      ) {
        const kind = structuralKinds[depth];
        const keyword = kind === 3 ? "allOf" : kind === 4 ? "anyOf" : "oneOf";
        const branches = (schema as any)[`_${keyword}BranchEntries`] as
          | CombinatorBranchEntry[]
          | undefined;
        const branchIndex = structuralIndexes[depth]++;

        if (!branches || branchIndex >= branches.length) {
          if (kind === 3 || (kind === 5 && combinatorValidCounts[depth] === 1)) {
            structuralKinds[depth] = 0;
            continue;
          }

          const error = getDefinedErrorFunctionForKey(
            keyword,
            schema[keyword],
            this.failFast
          )("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }

        const branch = branches[branchIndex];
        if (branch.kind === "validate") {
          const branchSchema = schema[keyword][branchIndex];
          descend(branchSchema, value, kind);
          continue;
        }

        const branchValid =
          branch.kind === "alwaysValid" ||
          (branch.kind === "literal" && branch.value === value);

        if (kind === 3 && !branchValid) {
          const error = getDefinedErrorFunctionForKey(
            "allOf",
            schema.allOf,
            this.failFast
          )("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (kind === 4 && branchValid) {
          structuralKinds[depth] = 0;
        } else if (kind === 5 && branchValid) {
          combinatorValidCounts[depth]++;
          if (combinatorValidCounts[depth] > 1) {
            const error = getDefinedErrorFunctionForKey(
              "oneOf",
              schema.oneOf,
              this.failFast
            )("Value is not valid", { data: value });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
        }
        continue;
      }

      const entries = (schema as any)._iterativeValidatorEntries as
        | ValidatorItem[]
        | undefined;
      if (!entries) {
        const validate = (schema as any)._recursiveValidate || schema.$validate;
        const error = typeof validate === "function" ? validate(value) : undefined;
        if (error) {
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }
        validatorIndexes[depth] = Number.MAX_SAFE_INTEGER;
      } else if (validatorIndexes[depth] < entries.length) {
        const entry = entries[validatorIndexes[depth]++];
        if (entry.iterativeKeyword === "properties") {
          structuralKinds[depth] = 1;
          structuralIndexes[depth] = 0;
          secondaryIndexes[depth] = 0;
          stagedDefaults[depth] = [];
          continue;
        }
        if (entry.iterativeKeyword === "items") {
          structuralKinds[depth] = 2;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "allOf") {
          structuralKinds[depth] = 3;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "anyOf") {
          structuralKinds[depth] = 4;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "oneOf") {
          structuralKinds[depth] = 5;
          structuralIndexes[depth] = 0;
          combinatorValidCounts[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "additionalProperties") {
          structuralKinds[depth] = 6;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] =
            value && typeof value === "object" && !Array.isArray(value)
              ? Object.keys(value)
              : [];
          continue;
        }
        if (entry.iterativeKeyword === "patternProperties") {
          structuralKinds[depth] = 7;
          structuralIndexes[depth] = 0;
          secondaryIndexes[depth] = 0;
          structuralFlags[depth] = 0;
          structuralKeys[depth] =
            value && typeof value === "object" && !Array.isArray(value)
              ? Object.keys(value)
              : [];
          continue;
        }
        if (entry.iterativeKeyword === "additionalItems") {
          structuralKinds[depth] = 8;
          structuralIndexes[depth] = Array.isArray(schema.items)
            ? schema.items.length
            : 0;
          continue;
        }
        if (entry.iterativeKeyword === "contains") {
          structuralKinds[depth] = 9;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "dependencies") {
          structuralKinds[depth] = 10;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] = Object.keys(schema.dependencies || {});
          continue;
        }
        if (entry.iterativeKeyword === "if") {
          structuralKinds[depth] = 11;
          secondaryIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "not") {
          structuralKinds[depth] = 12;
          continue;
        }
        if (entry.iterativeKeyword === "propertyNames") {
          structuralKinds[depth] = 13;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] =
            value && typeof value === "object" && !Array.isArray(value)
              ? Object.keys(value)
              : [];
          continue;
        }
        if (entry.iterativeKeyword === "values") {
          structuralKinds[depth] = 14;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] =
            value && typeof value === "object" && !Array.isArray(value)
              ? Object.keys(value)
              : [];
          continue;
        }
        if (entry.iterativeKeyword === "elements") {
          structuralKinds[depth] = 15;
          structuralIndexes[depth] = 0;
          continue;
        }

        const error = entry.validate(value);
        if (error) {
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        }
        continue;
      }

      if (completeFrame(undefined)) {
        return completedResult;
      }
    }
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private collectSchemaLocations(root: any): WeakSet<object> {
    const locations = new WeakSet<object>();
    const stack = [root];
    const schemaMaps = new Set([
      "definitions",
      "dependencies",
      "patternProperties",
      "properties"
    ]);
    const schemaArrays = new Set(["allOf", "anyOf", "oneOf"]);
    const schemaValues = new Set([
      "additionalItems",
      "additionalProperties",
      "contains",
      "elements",
      "else",
      "if",
      "items",
      "not",
      "propertyNames",
      "then",
      "values"
    ]);

    while (stack.length > 0) {
      const schema = stack.pop();
      if (!this.isPlainObject(schema) || locations.has(schema)) {
        continue;
      }

      locations.add(schema);
      for (const key of Object.keys(schema)) {
        const value = schema[key];
        if (schemaMaps.has(key) && this.isPlainObject(value)) {
          for (const subSchema of Object.values(value)) {
            if (!Array.isArray(subSchema)) {
              stack.push(subSchema);
            }
          }
        } else if (schemaArrays.has(key) && Array.isArray(value)) {
          for (const subSchema of value) {
            stack.push(subSchema);
          }
        } else if (schemaValues.has(key)) {
          if (key === "items" && Array.isArray(value)) {
            for (const subSchema of value) {
              stack.push(subSchema);
            }
          } else {
            stack.push(value);
          }
        }
      }
    }

    return locations;
  }

  private isTrivialAlwaysValidSubschema(value: any): boolean {
    return (
      value === true ||
      (this.isPlainObject(value) && Object.keys(value).length === 0)
    );
  }

  private shallowArrayEquals(a: any[], b: any[]): boolean {
    if (a === b) {
      return true;
    }

    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  private flattenAssociativeBranches(
    key: "allOf" | "anyOf",
    branches: any[]
  ): any[] {
    const out: any[] = [];
    const pending = branches.slice().reverse();

    while (pending.length > 0) {
      const item = pending.pop();
      if (
        this.isPlainObject(item) &&
        Object.keys(item).length === 1 &&
        Array.isArray(item[key])
      ) {
        for (let i = item[key].length - 1; i >= 0; i--) {
          pending.push(item[key][i]);
        }
        continue;
      }
      out.push(item);
    }

    return out;
  }

  private flattenSingleWrapperOneOf(branches: any[]): any[] {
    let current = branches;

    while (current.length === 1) {
      const item = current[0];
      if (
        this.isPlainObject(item) &&
        Object.keys(item).length === 1 &&
        Array.isArray(item.oneOf)
      ) {
        current = item.oneOf;
        continue;
      }
      break;
    }

    return current;
  }

  private normalizeSchemaForCompile(schema: Record<string, any>): Record<string, any> {
    let normalized = schema;
    const schemaKeys = Object.keys(schema);
    const hasOnlyKey = (key: string) =>
      schemaKeys.length === 1 && schemaKeys[0] === key;

    const setNormalized = (key: string, value: any) => {
      if (normalized === schema) {
        normalized = { ...schema };
      }
      normalized[key] = value;
    };

    const deleteNormalized = (key: string) => {
      if (normalized === schema) {
        normalized = { ...schema };
      }
      delete normalized[key];
    };

    if (Array.isArray(schema.allOf)) {
      let flattenedAllOf = this.flattenAssociativeBranches(
        "allOf",
        schema.allOf
      );
      let removedAllOf = false;

      for (let i = 0; i < flattenedAllOf.length; i++) {
        if (flattenedAllOf[i] === false) {
          return { oneOf: [] };
        }
      }

      flattenedAllOf = flattenedAllOf.filter(
        (item) => !this.isTrivialAlwaysValidSubschema(item)
      );

      if (flattenedAllOf.length === 0) {
        if (hasOnlyKey("allOf")) {
          return {};
        }

        deleteNormalized("allOf");
        removedAllOf = true;
      }

      if (!removedAllOf &&
        hasOnlyKey("allOf") &&
        flattenedAllOf.length === 1 &&
        this.isPlainObject(flattenedAllOf[0])
      ) {
        return flattenedAllOf[0];
      }

      if (!removedAllOf && !this.shallowArrayEquals(flattenedAllOf, schema.allOf)) {
        setNormalized("allOf", flattenedAllOf);
      }
    }

    if (Array.isArray(schema.anyOf)) {
      let flattenedAnyOf = this.flattenAssociativeBranches(
        "anyOf",
        schema.anyOf
      );
      let removedAnyOf = false;

      for (let i = 0; i < flattenedAnyOf.length; i++) {
        if (this.isTrivialAlwaysValidSubschema(flattenedAnyOf[i])) {
          if (hasOnlyKey("anyOf")) {
            return {};
          }

          deleteNormalized("anyOf");
          removedAnyOf = true;
          flattenedAnyOf = [];
          break;
        }
      }

      if (flattenedAnyOf.length > 0) {
        flattenedAnyOf = flattenedAnyOf.filter((item) => item !== false);
      }

      if (!removedAnyOf && flattenedAnyOf.length === 0 && Array.isArray((normalized as any).anyOf)) {
        return { oneOf: [] };
      }

      if (!removedAnyOf &&
        hasOnlyKey("anyOf") &&
        flattenedAnyOf.length === 1 &&
        this.isPlainObject(flattenedAnyOf[0])
      ) {
        return flattenedAnyOf[0];
      }

      if (!removedAnyOf && !this.shallowArrayEquals(flattenedAnyOf, schema.anyOf)) {
        setNormalized("anyOf", flattenedAnyOf);
      }
    }

    if (Array.isArray(schema.oneOf)) {
      const flattenedOneOf = this.flattenSingleWrapperOneOf(schema.oneOf);
      let removedOneOf = false;

      if (flattenedOneOf.length === 1) {
        if (this.isTrivialAlwaysValidSubschema(flattenedOneOf[0])) {
          if (hasOnlyKey("oneOf")) {
            return {};
          }

          deleteNormalized("oneOf");
          removedOneOf = true;
        } else if (flattenedOneOf[0] === false) {
          return { oneOf: [] };
        }
      }

      if (!removedOneOf &&
        hasOnlyKey("oneOf") &&
        flattenedOneOf.length === 1 &&
        this.isPlainObject(flattenedOneOf[0])
      ) {
        return flattenedOneOf[0];
      }

      if (!removedOneOf && !this.shallowArrayEquals(flattenedOneOf, schema.oneOf)) {
        setNormalized("oneOf", flattenedOneOf);
      }
    }

    return normalized;
  }

  private defineHiddenValue(target: Record<string, any>, key: string, value: any) {
    Object.defineProperty(target, key, {
      value,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  private prepareObjectKeywordCaches(schema: CompiledSchema) {
    if (this.isPlainObject(schema.properties)) {
      const propKeys = Object.keys(schema.properties);
      this.defineHiddenValue(schema, "_propKeys", propKeys);

      const requiredSet = Array.isArray(schema.required)
        ? new Set<string>(schema.required)
        : null;
      this.defineHiddenValue(schema, "_requiredSet", requiredSet);

      const propertyValidationEntries: Array<{
        key: string;
        schemaProp: any;
        hasDefault: boolean;
      }> = [];

      for (let i = 0; i < propKeys.length; i++) {
        const key = propKeys[i];
        const schemaProp = schema.properties[key];
        const hasDefault =
          !!requiredSet &&
          requiredSet.has(key) &&
          this.isPlainObject(schemaProp) &&
          "default" in schemaProp;

        if (schemaProp === false) {
          propertyValidationEntries.push({ key, schemaProp, hasDefault: false });
          continue;
        }

        if (schemaProp === true) {
          continue;
        }

        if (this.isPlainObject(schemaProp)) {
          const hasValidate = typeof schemaProp.$validate === "function";
          if (hasValidate || hasDefault) {
            propertyValidationEntries.push({ key, schemaProp, hasDefault });
          }
        }
      }

      this.defineHiddenValue(
        schema,
        "_propertyValidationEntries",
        propertyValidationEntries
      );
      this.defineHiddenValue(
        schema,
        "_hasRequiredDefaults",
        propertyValidationEntries.some((entry) => entry.hasDefault)
      );
    }

    if ("additionalProperties" in schema) {
      this.defineHiddenValue(
        schema,
        "_apValidate",
        this.isPlainObject(schema.additionalProperties) &&
          typeof schema.additionalProperties.$validate === "function"
          ? schema.additionalProperties.$validate
          : null
      );
    }

    if (this.isPlainObject(schema.patternProperties)) {
      const entries: PatternPropertyEntry[] = [];
      for (const key of Object.keys(schema.patternProperties)) {
        const compiledMatcher = compilePatternMatcher(key);
        entries.push({
          schemaProp: schema.patternProperties[key],
          match:
            compiledMatcher instanceof RegExp
              ? (value: string) => compiledMatcher.test(value)
              : compiledMatcher
        });
      }
      this.defineHiddenValue(schema, "_patternPropertyEntries", entries);
    }
  }

  private toCombinatorBranchEntry(item: any): CombinatorBranchEntry {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      if (typeof item.$validate === "function") {
        return { kind: "validate", validate: item.$validate };
      }

      return { kind: "alwaysValid" };
    }

    if (typeof item === "boolean") {
      return { kind: item ? "alwaysValid" : "alwaysInvalid" };
    }

    return { kind: "literal", value: item };
  }

  private prepareCombinatorKeywordCaches(schema: CompiledSchema) {
    const keys: Array<"allOf" | "anyOf" | "oneOf"> = ["allOf", "anyOf", "oneOf"];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const branches = schema[key];

      if (!Array.isArray(branches)) {
        continue;
      }

      const entries: CombinatorBranchEntry[] = [];
      for (let j = 0; j < branches.length; j++) {
        entries.push(this.toCombinatorBranchEntry(branches[j]));
      }

      this.defineHiddenValue(schema, `_${key}BranchEntries`, entries);
    }
  }

  private markSchemaHasRef(schema: CompiledSchema) {
    if ((schema as any)._hasRef === true) {
      return;
    }

    Object.defineProperty(schema, "_hasRef", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  private shouldSkipKeyword(schema: Record<string, any>, key: string): boolean {
    const value = schema[key];

    switch (key) {
      case "required":
        return Array.isArray(value) && value.length === 0;
      case "uniqueItems":
        return value === false;
      case "properties":
      case "patternProperties":
      case "dependencies":
        return (
          this.isPlainObject(value) &&
          Object.keys(value).length === 0
        );
      case "propertyNames":
      case "items":
        return value === true;
      case "additionalProperties":
        if (value === true) {
          return true;
        }

        return (
          value === false &&
          this.isPlainObject(schema.patternProperties) &&
          Object.keys(schema.patternProperties).length > 0
        );
      case "additionalItems":
        return value === true || !Array.isArray(schema.items);
      case "allOf": {
        if (!Array.isArray(value)) {
          return false;
        }

        if (value.length === 0) {
          return true;
        }

        for (let i = 0; i < value.length; i++) {
          if (this.isTrivialAlwaysValidSubschema(value[i])) {
            continue;
          }

          return false;
        }

        return true;
      }
      case "anyOf": {
        if (!Array.isArray(value)) {
          return false;
        }

        for (let i = 0; i < value.length; i++) {
          if (this.isTrivialAlwaysValidSubschema(value[i])) {
            return true;
          }
        }

        return false;
      }
      default:
        return false;
    }
  }

  private hasRequiredDefaults(schema: Record<string, any>): boolean {
    const properties = schema.properties;
    if (!this.isPlainObject(properties) || !Array.isArray(schema.required)) {
      return false;
    }

    for (let i = 0; i < schema.required.length; i++) {
      const subSchema = properties[schema.required[i]];
      if (this.isPlainObject(subSchema) && "default" in subSchema) {
        return true;
      }
    }

    return false;
  }

  private isDefaultTypeValidator(type: string, validator: TypeFunction): boolean {
    return (Types as Record<string, TypeFunction | false>)[type] === validator;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any): CompiledSchema {
    const clonedRoot = deepCloneUnfreeze(schema);
    this.schemaLocations = this.collectSchemaLocations(clonedRoot);
    let compiledRoot: CompiledSchema | null = null;
    let schemaHasRef = false;
    const seen = new WeakSet<object>();
    const compiledBySource = new WeakMap<object, CompiledSchema>();
    const pending: Array<{
      schema: any;
      assign: (compiled: CompiledSchema) => void;
    }> = [
      {
        schema: clonedRoot,
        assign: (compiled) => {
          compiledRoot = compiled;
        }
      }
    ];

    while (pending.length > 0) {
      const item = pending.pop()!;
      if (item.schema && typeof item.schema === "object") {
        const existing = compiledBySource.get(item.schema);
        if (existing) {
          item.assign(existing);
          continue;
        }
      }
      const compiled = this.compileSchemaNode(item.schema);
      item.assign(compiled);

      if (item.schema && typeof item.schema === "object") {
        compiledBySource.set(item.schema, compiled);
      }

      if (compiled && typeof compiled === "object") {
        if (seen.has(compiled)) {
          continue;
        }
        seen.add(compiled);
      }

      if ("$ref" in compiled) {
        schemaHasRef = true;
      }

      const literalKeywords = new Set(["enum", "const", "default", "examples"]);
      for (const key of Object.keys(compiled)) {
        if (literalKeywords.has(key)) {
          continue;
        }

        const value = compiled[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          if (key === "properties") {
            for (const subKey of Object.keys(value)) {
              pending.push({
                schema: value[subKey],
                assign: (child) => {
                  value[subKey] = child;
                }
              });
            }
          } else {
            pending.push({
              schema: value,
              assign: (child) => {
                compiled[key] = child;
              }
            });
          }
          continue;
        }

        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (this.isSchemaLike(value[i])) {
              pending.push({
                schema: value[i],
                assign: (child) => {
                  value[i] = child;
                }
              });
            }
          }
        }
      }
    }

    if (!compiledRoot) {
      throw new ValidationError("Invalid schema");
    }

    if (schemaHasRef) {
      this.markSchemaHasRef(compiledRoot);
    }

    return compiledRoot;
  }

  private compileSchemaNode(schema: Partial<CompiledSchema> | any): CompiledSchema {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      if (schema === true) {
        schema = { anyOf: [{}] }; // Always valid
      } else if (schema === false) {
        schema = { oneOf: [] }; // Always invalid
      } else {
        schema = { oneOf: [schema] };
      }
    }

    const sourceSchema = schema;
    schema = this.normalizeSchemaForCompile(schema);

    const compiledSchema = schema as CompiledSchema;

    if (
      this.schemaLocations.has(sourceSchema) &&
      typeof schema.$id === "string"
    ) {
      this.idRegistry.set(schema.$id, compiledSchema);
    }

    if ("$ref" in schema) {
      const refValidator = this.getKeyword("$ref");
      if (refValidator) {
        const defineError = getDefinedErrorFunctionForKey(
          "$ref",
          schema["$ref"],
          this.failFast
        );

        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Reference",
          (data) =>
            (refValidator as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this
            )
        );
      }

      this.markSchemaHasRef(compiledSchema);
      return compiledSchema;
    }

    const validators: ValidatorItem[] = [];
    const activeNames: string[] = [];

    if ("type" in schema) {
      const defineTypeError = getDefinedErrorFunctionForKey(
        "type",
        schema,
        this.failFast
      );
      const types = Array.isArray(schema.type)
        ? schema.type
        : schema.type.split(",").map((t: string) => t.trim());

      const typeFunctions: TypeFunction[] = [];
      const typeNames: string[] = [];
      const defaultTypeNames: string[] = [];
      let allTypesDefault = true;

      for (const type of types) {
        const validator = this.getType(type);
        if (validator) {
          typeFunctions.push(validator);
          typeNames.push(validator.name);
          if (this.isDefaultTypeValidator(type, validator)) {
            defaultTypeNames.push(type);
          } else {
            allTypesDefault = false;
          }
        }
      }

      if (typeFunctions.length === 0) {
        throw getDefinedErrorFunctionForKey(
          "type",
          schema,
          this.failFast
        )("Invalid type for schema", { data: schema.type });
      }

      let combinedTypeValidator: ValidateFunction;
      let typeMethodName = "";

      if (typeFunctions.length === 1 && allTypesDefault) {
        const singleTypeName = defaultTypeNames[0];
        typeMethodName = singleTypeName;

        switch (singleTypeName) {
          case "object":
            combinedTypeValidator = (data) => {
              if (data === null || typeof data !== "object" || Array.isArray(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "array":
            combinedTypeValidator = (data) => {
              if (!Array.isArray(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "string":
            combinedTypeValidator = (data) => {
              if (typeof data !== "string") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "number":
            combinedTypeValidator = (data) => {
              if (typeof data !== "number") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "integer":
            combinedTypeValidator = (data) => {
              if (typeof data !== "number" || !Number.isInteger(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "boolean":
            combinedTypeValidator = (data) => {
              if (typeof data !== "boolean") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "null":
            combinedTypeValidator = (data) => {
              if (data !== null) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          default: {
            const singleTypeFn = typeFunctions[0];
            combinedTypeValidator = (data) => {
              if (!singleTypeFn(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
          }
        }
      } else if (typeFunctions.length > 1 && allTypesDefault) {
        typeMethodName = defaultTypeNames.join("_OR_");

        const allowsObject = defaultTypeNames.includes("object");
        const allowsArray = defaultTypeNames.includes("array");
        const allowsString = defaultTypeNames.includes("string");
        const allowsNumber = defaultTypeNames.includes("number");
        const allowsInteger = defaultTypeNames.includes("integer");
        const allowsBoolean = defaultTypeNames.includes("boolean");
        const allowsNull = defaultTypeNames.includes("null");

        combinedTypeValidator = (data) => {
          const dataType = typeof data;

          if (dataType === "number") {
            if (allowsNumber || (allowsInteger && Number.isInteger(data))) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "string") {
            if (allowsString) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "boolean") {
            if (allowsBoolean) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "object") {
            if (data === null) {
              if (allowsNull) {
                return;
              }

              return defineTypeError("Invalid type", { data });
            }

            if (Array.isArray(data)) {
              if (allowsArray) {
                return;
              }

              return defineTypeError("Invalid type", { data });
            }

            if (allowsObject) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          return defineTypeError("Invalid type", { data });
        };
      } else if (typeFunctions.length === 1) {
        typeMethodName = typeNames[0];
        const singleTypeFn = typeFunctions[0];
        combinedTypeValidator = (data) => {
          if (!singleTypeFn(data)) {
            return defineTypeError("Invalid type", { data });
          }
        };
      } else {
        typeMethodName = typeNames.join("_OR_");
        combinedTypeValidator = (data) => {
          for (let i = 0; i < typeFunctions.length; i++) {
            if (typeFunctions[i](data)) {
              return;
            }
          }
          return defineTypeError("Invalid type", { data });
        };
      }

      const typeValidator = {
        name: typeMethodName,
        keyword: "type",
        validate: getNamedFunction(typeMethodName, combinedTypeValidator)
      };
      validators.push(typeValidator);
      activeNames.push(typeMethodName);
    }

    const { type, $id, $ref, $validate, required, ...otherKeys } = schema; // Exclude handled keys

    const otherKeyOrder = Object.keys(otherKeys);
    const appliesRequiredDefaults =
      required &&
      this.hasRequiredDefaults(schema) &&
      this.getKeyword("properties") === keywords.properties;
    const keyOrder = required
      ? appliesRequiredDefaults
        ? [
            "properties",
            ...otherKeyOrder.filter((key) => key !== "properties"),
            "required"
          ]
        : ["required", ...otherKeyOrder]
      : otherKeyOrder;

    for (const key of keyOrder) {
      const keywordFn = this.getKeyword(key);

      if (!keywordFn) {
        continue;
      }

      if (this.shouldSkipKeyword(schema, key)) {
        continue;
      }

      const defineError = getDefinedErrorFunctionForKey(
        key,
        schema[key],
        this.failFast
      );
      const fnName = keywordFn.name || key;

      const keywordValidator = {
        name: fnName,
        keyword: key,
        iterativeKeyword:
          (keywords as Record<string, KeywordFunction | false>)[key] === keywordFn
            ? key
            : undefined,
        validate: getNamedFunction<ValidateFunction>(fnName, (data) =>
          (keywordFn as KeywordFunction)(compiledSchema, data, defineError, this)
        )
      };
      validators.push(keywordValidator);

      activeNames.push(fnName);
    }

    this.defineHiddenValue(
      compiledSchema,
      "_iterativeValidatorEntries",
      validators
    );

    if (validators.length === 0) {
      return compiledSchema;
    }

    if (validators.length === 1) {
      const v = validators[0];
      compiledSchema.$validate = getNamedFunction(v.name, v.validate);
    } else {
      const compositeName = "Validate_" + activeNames.join("_AND_");

      const masterValidator: ValidateFunction = (data) => {
        for (let i = 0; i < validators.length; i++) {
          const v = validators[i];
          const error = v.validate(data);
          if (error) {
            return error;
          }
        }
        return;
      };

      compiledSchema.$validate = getNamedFunction(
        compositeName,
        masterValidator
      );
    }

    return compiledSchema as CompiledSchema;
  }

  isSchemaLike(subSchema: any): boolean {
    if (
      subSchema &&
      typeof subSchema === "object" &&
      !Array.isArray(subSchema)
    ) {
      if ("type" in subSchema) {
        return true;
      }

      for (let subKey in subSchema) {
        if (subKey in this.keywords) {
          return true;
        }
      }
    }
    return false;
  }

  private linkReferences(root: CompiledSchema) {
    const stack: any[] = [root];
    const seen = new WeakSet<object>();

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node || typeof node !== "object" || seen.has(node)) {
        continue;
      }
      seen.add(node);

      if (
        typeof node.$ref === "string" &&
        typeof node.$validate === "function" &&
        node.$validate.name === "Validate_Reference"
      ) {
        const refPath = node.$ref as string;

        let target: any = this.getSchemaRef(refPath);
        if (typeof target === "undefined") {
          target = this.getSchemaById(refPath);
        }

        if (typeof target === "boolean") {
          if (target === true) {
            node.$validate = getNamedFunction("Validate_Ref_True", () => {});
          } else {
            const defineError = getDefinedErrorFunctionForKey(
              "$ref",
              node as any,
              this.failFast
            );

            node.$validate = getNamedFunction(
              "Validate_Ref_False",
              (_data: any) => defineError("Value is not valid")
            );
          }
          continue;
        }

        if (target && typeof target.$validate === "function") {
          this.defineHiddenValue(node, "_resolvedSchema", target);
          node.$validate = target.$validate;
        } else if (typeof target === "undefined") {
          const defineError = getDefinedErrorFunctionForKey(
            "$ref",
            node as any,
            this.failFast
          );
          node.$validate = getNamedFunction(
            "Validate_Ref_Missing",
            (_data: any) => defineError(`Missing reference: ${refPath}`)
          );
        }
      }

      for (const key in node) {
        const value = node[key];
        if (!value) continue;

        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const v = value[i];
            if (v && typeof v === "object") {
              stack.push(v);
            }
          }
        } else if (typeof value === "object") {
          stack.push(value);
        }
      }
    }
  }
}
