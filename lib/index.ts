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
import {
  getPatternPropertyEntries,
  prepareObjectKeywordCaches
} from "./keywords/object-keywords";
import {
  getCombinatorBranchEntries,
  prepareCombinatorKeywordCaches
} from "./keywords/other-keywords";

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
  structuralOpcode: StructuralOpcode;
  validate: ValidateFunction;
}

interface PropertyValidationEntry {
  key: string;
  schemaProp: any;
  hasDefault: boolean;
}

const enum StructuralOpcode {
  DirectValidate = 0,
  Properties = 1,
  Items = 2,
  AllOf = 3,
  AnyOf = 4,
  OneOf = 5,
  AdditionalProperties = 6,
  PatternProperties = 7,
  AdditionalItems = 8,
  Contains = 9,
  Dependencies = 10,
  Conditional = 11,
  Not = 12,
  PropertyNames = 13,
  Values = 14,
  Elements = 15
}

const enum CompletionOpcode {
  Root = 0,
  ChildProperty = 1,
  ChildItem = 2,
  AllOfBranch = 3,
  AnyOfBranch = 4,
  OneOfBranch = 5,
  DefaultValue = 6,
  ContainsItem = 7,
  ConditionalTest = 8,
  NotSchema = 9
}

const enum PostLinkCacheKind {
  Object = 1,
  Combinator = 2
}

interface PostLinkCachePlan {
  schema: CompiledSchema;
  kinds: number;
}

const BUILTIN_STRUCTURAL_OPCODES: Readonly<
  Record<string, StructuralOpcode>
> = {
  properties: StructuralOpcode.Properties,
  items: StructuralOpcode.Items,
  allOf: StructuralOpcode.AllOf,
  anyOf: StructuralOpcode.AnyOf,
  oneOf: StructuralOpcode.OneOf,
  additionalProperties: StructuralOpcode.AdditionalProperties,
  patternProperties: StructuralOpcode.PatternProperties,
  additionalItems: StructuralOpcode.AdditionalItems,
  contains: StructuralOpcode.Contains,
  dependencies: StructuralOpcode.Dependencies,
  if: StructuralOpcode.Conditional,
  not: StructuralOpcode.Not,
  propertyNames: StructuralOpcode.PropertyNames,
  values: StructuralOpcode.Values,
  elements: StructuralOpcode.Elements
};

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
  defaultMutationCount: number;
  frameHighWater: number;
  pathHighWater: number;
}

function createIterativeWorkspace(): IterativeWorkspace {
  return {
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
    defaultMutationKeys: [],
    defaultMutationCount: 0,
    frameHighWater: 0,
    pathHighWater: 0
  };
}

function clearIterativeWorkspace(workspace: IterativeWorkspace) {
  const frameHighWater = workspace.frameHighWater;
  const pathHighWater = workspace.pathHighWater;
  const mutationHighWater = workspace.defaultMutationCount;

  workspace.schemas.fill(undefined as any, 0, frameHighWater);
  workspace.data.fill(undefined, 0, frameHighWater);
  workspace.pendingDefaults.fill(undefined, 0, frameHighWater);
  workspace.pendingDefaultValues.fill(undefined, 0, frameHighWater);
  workspace.stagedDefaults.fill(undefined, 0, frameHighWater);
  workspace.structuralKeys.fill(undefined, 0, frameHighWater);
  workspace.pathMessages.fill(undefined as any, 0, pathHighWater);
  workspace.pathKeywords.fill(undefined as any, 0, pathHighWater);
  workspace.pathSchemas.fill(undefined as any, 0, pathHighWater);
  workspace.pathItems.fill(undefined, 0, pathHighWater);
  workspace.pathData.fill(undefined, 0, pathHighWater);
  workspace.defaultMutationTargets.fill(undefined, 0, mutationHighWater);
  workspace.defaultMutationKeys.fill(undefined as any, 0, mutationHighWater);
  workspace.defaultMutationCount = 0;
  workspace.frameHighWater = 0;
  workspace.pathHighWater = 0;
}

type CompileTask =
  | {
      kind: "compile";
      schema: any;
      parent: CompiledSchema | CompiledSchema[] | { root?: CompiledSchema };
      key: string | number;
      schemaLocation: boolean;
    }
  | { kind: "finalize"; schema: CompiledSchema };

const LITERAL_SCHEMA_KEYWORDS = new Set([
  "enum",
  "const",
  "default",
  "examples"
]);
const SCHEMA_MAP_KEYWORDS = new Set([
  "definitions",
  "patternProperties",
  "properties"
]);
const SCHEMA_ARRAY_KEYWORDS = new Set(["allOf", "anyOf", "oneOf"]);
const SCHEMA_VALUE_KEYWORDS = new Set([
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
    const compilation = this.compileSchema(schema);
    const compiledSchema = compilation.root;
    this.rootSchema = compiledSchema;
    if (compilation.references.length > 0) {
      this.linkReferences(compilation.references);
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

    for (let i = 0; i < compilation.postLinkCachePlans.length; i++) {
      const plan = compilation.postLinkCachePlans[i];
      if ((plan.kinds & PostLinkCacheKind.Object) !== 0) {
        prepareObjectKeywordCaches(plan.schema);
      }
      if ((plan.kinds & PostLinkCacheKind.Combinator) !== 0) {
        prepareCombinatorKeywordCaches(plan.schema);
      }
    }

    const iterativePlan = this.requiresIterativeValidation(
      compiledSchema
    );
    const requiresIterativeValidation = iterativePlan.required;
    if (requiresIterativeValidation) {
      this.guardCompiledValidators(iterativePlan.schemas);
    }

    let validate: Validator;
    if (this.immutable) {
      if (requiresIterativeValidation) {
        validate = ((data: any) => {
          this.rootSchema = compiledSchema;
          const clonedData = deepCloneUnfreeze(data);
          const res = this.validateIterative(compiledSchema, clonedData);
          return res
            ? { data: clonedData, error: res, valid: false }
            : { data: clonedData, error: null, valid: true };
        }) as Validator;
      } else {
        validate = ((data: any) => {
          this.rootSchema = compiledSchema;
          const clonedData = deepCloneUnfreeze(data);
          const res = compiledSchema.$validate!(clonedData);
          return res
            ? { data: clonedData, error: res, valid: false }
            : { data: clonedData, error: null, valid: true };
        }) as Validator;
      }
    } else if (requiresIterativeValidation) {
      validate = ((data: any) => {
        this.rootSchema = compiledSchema;
        const res = this.validateIterative(compiledSchema, data);
        return res
          ? { data, error: res, valid: false }
          : { data, error: null, valid: true };
      }) as Validator;
    } else {
      validate = ((data: any) => {
        this.rootSchema = compiledSchema;
        const res = compiledSchema.$validate!(data);
        return res
          ? { data, error: res, valid: false }
          : { data, error: null, valid: true };
      }) as Validator;
    }

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

  private guardCompiledValidators(schemas: CompiledSchema[]) {
    const guardedByValidator = new Map<ValidateFunction, ValidateFunction>();

    for (let schemaIndex = 0; schemaIndex < schemas.length; schemaIndex++) {
      const schema = schemas[schemaIndex];
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
    }
  }

  private requiresIterativeValidation(root: CompiledSchema): {
    required: boolean;
    schemas: CompiledSchema[];
  } {
    const active = new WeakSet<object>();
    const complete = new WeakSet<object>();
    const schemas: CompiledSchema[] = [];
    let required = false;
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
        required = true;
        continue;
      }
      if (complete.has(schema)) {
        continue;
      }
      if (frame.depth >= Math.min(256, this.maxDepth)) {
        required = true;
      }

      active.add(schema);
      schemas.push(schema);
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

    return { required, schemas };
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
      workspace = createIterativeWorkspace();
      this.iterativeWorkspaces[workspaceIndex] = workspace;
    }

    const depthErrorCount = this.depthErrorCount;
    try {
      const result = this.runIterativeValidation(root, rootData, workspace);
      if (this.depthErrorCount !== depthErrorCount) {
        for (
          let i = workspace.defaultMutationCount - 1;
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
      clearIterativeWorkspace(workspace);
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
    workspace.defaultMutationCount = 0;
    workspace.frameHighWater = 1;
    workspace.pathHighWater = 0;
    schemas[0] = root;
    data[0] = rootData;
    validatorIndexes[0] = 0;
    structuralKinds[0] = StructuralOpcode.DirectValidate;
    structuralIndexes[0] = 0;
    secondaryIndexes[0] = 0;
    structuralFlags[0] = 0;
    restorePathLengths[0] = 0;
    completionKinds[0] = CompletionOpcode.Root;
    combinatorValidCounts[0] = 0;
    pendingDefaults[0] = undefined;
    pendingDefaultValues[0] = undefined;
    stagedDefaults[0] = undefined;
    structuralKeys[0] = undefined;
    let frameCount = 1;
    let pathLength = 0;

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
        if (pathLength > workspace.pathHighWater) {
          workspace.pathHighWater = pathLength;
        }
      }
      schemas[frameCount] = childSchema;
      data[frameCount] = childData;
      validatorIndexes[frameCount] = 0;
      structuralKinds[frameCount] = StructuralOpcode.DirectValidate;
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
      if (frameCount > workspace.frameHighWater) {
        workspace.frameHighWater = frameCount;
      }
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

        const parentDepth = frameCount - 1;
        switch (completionKind) {
          case CompletionOpcode.Root:
            break;
          case CompletionOpcode.ChildProperty:
          case CompletionOpcode.ChildItem:
            if (error) {
              continue;
            }
            for (let i = restoreLength; i < pathLength; i++) {
              pathData[i] = undefined;
            }
            pathLength = restoreLength;
            return false;
          case CompletionOpcode.AllOfBranch:
            if (error) {
              error = getDefinedErrorFunctionForKey(
                "allOf",
                schemas[parentDepth].allOf,
                this.failFast
              )("Value is not valid", {
                cause: error,
                data: data[parentDepth]
              });
              continue;
            }
            return false;
          case CompletionOpcode.AnyOfBranch:
            pathLength = restoreLength;
            if (error) {
              return false;
            }
            structuralKinds[parentDepth] = StructuralOpcode.DirectValidate;
            return false;
          case CompletionOpcode.OneOfBranch:
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
          case CompletionOpcode.DefaultValue: {
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
              if (pathLength > workspace.pathHighWater) {
                workspace.pathHighWater = pathLength;
              }
              continue;
            }
            stagedDefaults[parentDepth]!.push({ entry, value: defaultValue });
            return false;
          }
          case CompletionOpcode.ContainsItem:
            pathLength = restoreLength;
            if (error) {
              return false;
            }
            structuralKinds[parentDepth] = StructuralOpcode.DirectValidate;
            return false;
          case CompletionOpcode.ConditionalTest:
            pathLength = restoreLength;
            secondaryIndexes[parentDepth] = error ? 2 : 1;
            return false;
          case CompletionOpcode.NotSchema:
            pathLength = restoreLength;
            if (error) {
              structuralKinds[parentDepth] = StructuralOpcode.DirectValidate;
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

      if (error === true || !error) {
        completedResult = error;
      } else {
        completedResult = this.wrapIterativeError(
          error,
          pathMessages,
          pathKeywords,
          pathSchemas,
          pathItems,
          pathData,
          pathLength
        );
      }
      return true;
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
        structuralKinds[depth] = StructuralOpcode.DirectValidate;
        structuralIndexes[depth] = 0;
        secondaryIndexes[depth] = 0;
        structuralFlags[depth] = 0;
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.DirectValidate) {
        const entries = (schema as any)._iterativeValidatorEntries as
          | ValidatorItem[]
          | undefined;
        if (!entries) {
          const error =
            typeof schema.$validate === "function"
              ? schema.$validate(value)
              : undefined;
          if (error) {
            if (completeFrame(error)) {
              return completedResult;
            }
            continue;
          }
          validatorIndexes[depth] = Number.MAX_SAFE_INTEGER;
        } else if (validatorIndexes[depth] < entries.length) {
          const entry = entries[validatorIndexes[depth]++];
          const structuralOpcode = entry.structuralOpcode;
          if (structuralOpcode !== StructuralOpcode.DirectValidate) {
            structuralKinds[depth] = structuralOpcode;
            structuralIndexes[depth] = 0;

            switch (structuralOpcode) {
              case StructuralOpcode.Properties:
                if ((schema as any)._hasRequiredDefaults === true) {
                  secondaryIndexes[depth] = 0;
                  stagedDefaults[depth] = [];
                } else {
                  secondaryIndexes[depth] = 1;
                }
                break;
              case StructuralOpcode.AdditionalProperties:
              case StructuralOpcode.PropertyNames:
              case StructuralOpcode.Values:
                structuralKeys[depth] =
                  value && typeof value === "object" && !Array.isArray(value)
                    ? Object.keys(value)
                    : [];
                break;
              case StructuralOpcode.PatternProperties:
                secondaryIndexes[depth] = 0;
                structuralFlags[depth] = 0;
                structuralKeys[depth] =
                  value && typeof value === "object" && !Array.isArray(value)
                    ? Object.keys(value)
                    : [];
                break;
              case StructuralOpcode.OneOf:
                combinatorValidCounts[depth] = 0;
                break;
              case StructuralOpcode.AdditionalItems:
                structuralIndexes[depth] = Array.isArray(schema.items)
                  ? schema.items.length
                  : 0;
                break;
              case StructuralOpcode.Dependencies:
                structuralKeys[depth] = Object.keys(schema.dependencies || {});
                break;
              case StructuralOpcode.Conditional:
                secondaryIndexes[depth] = 0;
                break;
            }
            continue;
          }

          const error = entry.validate(value);
          if (error) {
            if (completeFrame(error)) {
              return completedResult;
            }
          }
          continue;
        }

        if (completeFrame(undefined)) {
          return completedResult;
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Properties) {
        const entries = (schema as any)._propertyValidationEntries as
          | PropertyValidationEntry[]
          | undefined;
        if (
          !entries ||
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
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
              const mutationIndex = workspace.defaultMutationCount++;
              defaultMutationTargets[mutationIndex] = value;
              defaultMutationKeys[mutationIndex] = entry.key;
            }
            secondaryIndexes[depth] = 1;
            structuralIndexes[depth] = 0;
            structuralFlags[depth] = 0;
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
            descend(
              entry.schemaProp,
              defaultValue,
              CompletionOpcode.DefaultValue
            );
          }
          continue;
        }

        if (structuralIndexes[depth] >= entries.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const entry = entries[structuralIndexes[depth]++];
        if (!Object.prototype.hasOwnProperty.call(value, entry.key)) {
          continue;
        }
        const stagedDefault =
          stagedDefaults[depth]?.[structuralFlags[depth]];
        if (stagedDefault?.entry.key === entry.key) {
          structuralFlags[depth]++;
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
            if (completeFrame(error)) {
              return completedResult;
            }
          }
          continue;
        }

        if (entry.schemaProp && typeof entry.schemaProp.$validate === "function") {
          descend(
            entry.schemaProp,
            value[entry.key],
            CompletionOpcode.ChildProperty,
            "Property is invalid",
            "properties",
            schema.properties,
            entry.key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Items) {
        const schemaItems = schema.items;
        if (!Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        const itemLimit = Array.isArray(schemaItems)
          ? Math.min(schemaItems.length, value.length)
          : value.length;
        if (itemIndex >= itemLimit) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
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
            if (completeFrame(error)) {
              return completedResult;
            }
          }
          continue;
        }

        if (itemSchema && typeof itemSchema.$validate === "function") {
          descend(
            itemSchema,
            value[itemIndex],
            CompletionOpcode.ChildItem,
            "Array item is invalid",
            "items",
            schemaItems,
            itemIndex
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.AdditionalProperties) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const key = keys[keyIndex];
        if (
          schema.properties &&
          Object.prototype.hasOwnProperty.call(schema.properties, key)
        ) {
          continue;
        }

        const patternEntries = getPatternPropertyEntries(schema);
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
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (
          additionalSchema &&
          typeof additionalSchema === "object" &&
          typeof additionalSchema.$validate === "function"
        ) {
          descend(
            additionalSchema,
            value[key],
            CompletionOpcode.ChildProperty,
            "Additional properties are invalid",
            "additionalProperties",
            additionalSchema,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.PatternProperties) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const entries = getPatternPropertyEntries(schema);
        if (!entries || entries.length === 0) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
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
              if (completeFrame(error)) {
                return completedResult;
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
                CompletionOpcode.ChildProperty,
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
              if (completeFrame(error)) {
                return completedResult;
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
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
        } else if (frameCount - 1 === depth) {
          structuralIndexes[depth] = keyIndex + 1;
          secondaryIndexes[depth] = 0;
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.AdditionalItems) {
        if (!Array.isArray(value) || !Array.isArray(schema.items)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const additionalSchema = schema.additionalItems;
        if (additionalSchema === false) {
          const error = getDefinedErrorFunctionForKey(
            "additionalItems",
            additionalSchema,
            this.failFast
          )("Array is too long", { data: value });
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (
          additionalSchema &&
          typeof additionalSchema === "object" &&
          typeof additionalSchema.$validate === "function"
        ) {
          descend(
            additionalSchema,
            value[itemIndex],
            CompletionOpcode.ChildItem,
            "Array item is invalid",
            "additionalItems",
            additionalSchema,
            itemIndex
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Contains) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          const error = getDefinedErrorFunctionForKey(
            "contains",
            schema.contains,
            this.failFast
          )("Array must contain at least one item", { data: value });
          if (completeFrame(error)) {
            return completedResult;
          }
          continue;
        }
        if (schema.contains === true) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
        } else if (schema.contains !== false) {
          descend(
            schema.contains,
            value[itemIndex],
            CompletionOpcode.ContainsItem
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Dependencies) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }

        const keys = structuralKeys[depth]!;
        const dependencyIndex = structuralIndexes[depth]++;
        if (dependencyIndex >= keys.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
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
              if (completeFrame(error)) {
                return completedResult;
              }
              break;
            }
          }
        } else if (typeof dependency === "string") {
          if (!(dependency in value)) {
            const error = getDefinedErrorFunctionForKey(
              "dependencies",
              schema.dependencies,
              this.failFast
            )("Dependency is not satisfied", { data: dependency });
            if (completeFrame(error)) {
              return completedResult;
            }
          }
        } else if (dependency === false) {
          const error = getDefinedErrorFunctionForKey(
            "dependencies",
            schema.dependencies,
            this.failFast
          )("Dependency is not satisfied", { data: dependency });
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (
          dependency &&
          typeof dependency === "object" &&
          typeof dependency.$validate === "function"
        ) {
          descend(
            dependency,
            value,
            CompletionOpcode.ChildProperty,
            "Dependency is not satisfied",
            "dependencies",
            schema.dependencies,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Conditional) {
        const state = secondaryIndexes[depth];
        if (state === 0) {
          if (schema.if === true) {
            secondaryIndexes[depth] = 1;
          } else if (schema.if === false) {
            secondaryIndexes[depth] = 2;
          } else {
            descend(schema.if, value, CompletionOpcode.ConditionalTest);
            continue;
          }
        }

        const branch = secondaryIndexes[depth] === 1 ? schema.then : schema.else;
        structuralKinds[depth] = StructuralOpcode.DirectValidate;
        if (
          branch &&
          typeof branch === "object" &&
          typeof branch.$validate === "function"
        ) {
          descend(branch, value, CompletionOpcode.ChildProperty);
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Not) {
        structuralKinds[depth] = StructuralOpcode.DirectValidate;
        if (schema.not === true) {
          const error = getDefinedErrorFunctionForKey(
            "not",
            schema.not,
            this.failFast
          )("Value is not valid", { data: value });
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (schema.not !== false) {
          descend(schema.not, value, CompletionOpcode.NotSchema);
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.PropertyNames) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.propertyNames === false) {
          const error = getDefinedErrorFunctionForKey(
            "propertyNames",
            schema.propertyNames,
            this.failFast
          )("Properties are not allowed", { item: key, data: value[key] });
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (
          schema.propertyNames &&
          typeof schema.propertyNames.$validate === "function"
        ) {
          descend(
            schema.propertyNames,
            key,
            CompletionOpcode.ChildProperty,
            "Property name is invalid",
            "propertyNames",
            schema.propertyNames,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Values) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const keys = structuralKeys[depth]!;
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.values && typeof schema.values.$validate === "function") {
          descend(
            schema.values,
            value[key],
            CompletionOpcode.ChildProperty,
            "Property is invalid",
            "values",
            schema.values,
            key
          );
        }
        continue;
      }

      if (structuralKinds[depth] === StructuralOpcode.Elements) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
          continue;
        }
        if (schema.elements && typeof schema.elements.$validate === "function") {
          descend(
            schema.elements,
            value[itemIndex],
            CompletionOpcode.ChildItem,
            "Array item is invalid",
            "elements",
            schema.elements,
            itemIndex
          );
        }
        continue;
      }

      if (
        structuralKinds[depth] === StructuralOpcode.AllOf ||
        structuralKinds[depth] === StructuralOpcode.AnyOf ||
        structuralKinds[depth] === StructuralOpcode.OneOf
      ) {
        const kind = structuralKinds[depth];
        const keyword =
          kind === StructuralOpcode.AllOf
            ? "allOf"
            : kind === StructuralOpcode.AnyOf
              ? "anyOf"
              : "oneOf";
        const branches = getCombinatorBranchEntries(schema, keyword);
        const branchIndex = structuralIndexes[depth]++;

        if (!branches || branchIndex >= branches.length) {
          if (
            kind === StructuralOpcode.AllOf ||
            (kind === StructuralOpcode.OneOf &&
              combinatorValidCounts[depth] === 1)
          ) {
            structuralKinds[depth] = StructuralOpcode.DirectValidate;
            continue;
          }

          const error = getDefinedErrorFunctionForKey(
            keyword,
            schema[keyword],
            this.failFast
          )("Value is not valid", { data: value });
          if (completeFrame(error)) {
            return completedResult;
          }
          continue;
        }

        const branch = branches[branchIndex];
        if (branch.kind === "validate") {
          const branchSchema = schema[keyword][branchIndex];
          const completionKind =
            kind === StructuralOpcode.AllOf
              ? CompletionOpcode.AllOfBranch
              : kind === StructuralOpcode.AnyOf
                ? CompletionOpcode.AnyOfBranch
                : CompletionOpcode.OneOfBranch;
          descend(branchSchema, value, completionKind);
          continue;
        }

        const branchValid =
          branch.kind === "alwaysValid" ||
          (branch.kind === "literal" && branch.value === value);

        if (kind === StructuralOpcode.AllOf && !branchValid) {
          const error = getDefinedErrorFunctionForKey(
            "allOf",
            schema.allOf,
            this.failFast
          )("Value is not valid", { data: value });
          if (completeFrame(error)) {
            return completedResult;
          }
        } else if (kind === StructuralOpcode.AnyOf && branchValid) {
          structuralKinds[depth] = StructuralOpcode.DirectValidate;
        } else if (kind === StructuralOpcode.OneOf && branchValid) {
          combinatorValidCounts[depth]++;
          if (combinatorValidCounts[depth] > 1) {
            const error = getDefinedErrorFunctionForKey(
              "oneOf",
              schema.oneOf,
              this.failFast
            )("Value is not valid", { data: value });
            if (completeFrame(error)) {
              return completedResult;
            }
          }
        }
        continue;
      }

    }
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value);
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

    if (
      Array.isArray(schema.allOf) &&
      this.getKeyword("allOf") === keywords.allOf
    ) {
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

    if (
      Array.isArray(schema.anyOf) &&
      this.getKeyword("anyOf") === keywords.anyOf
    ) {
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

    if (
      Array.isArray(schema.oneOf) &&
      this.getKeyword("oneOf") === keywords.oneOf
    ) {
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

  private shouldSkipKeyword(schema: Record<string, any>, key: string): boolean {
    const builtinKeyword = (
      keywords as Record<string, KeywordFunction | false>
    )[key];
    if (this.getKeyword(key) !== builtinKeyword) {
      return false;
    }

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

  private compileSchema(
    schema: Partial<CompiledSchema> | any
  ): {
    root: CompiledSchema;
    references: CompiledSchema[];
    postLinkCachePlans: PostLinkCachePlan[];
  } {
    const clonedRoot = deepCloneUnfreeze(schema);
    this.schemaLocations = new WeakSet<object>();
    const rootHolder: { root?: CompiledSchema } = {};
    const references: CompiledSchema[] = [];
    const postLinkCachePlans: PostLinkCachePlan[] = [];
    const seen = new WeakSet<object>();
    const compiledBySource = new WeakMap<object, CompiledSchema>();
    const pending: CompileTask[] = [
      {
        kind: "compile",
        schema: clonedRoot,
        parent: rootHolder,
        key: "root",
        schemaLocation: true
      }
    ];

    while (pending.length > 0) {
      const item = pending.pop()!;
      if (item.kind === "finalize") {
        const compiled = item.schema;
        let postLinkCacheKinds = 0;
        if (
          "properties" in compiled ||
          "additionalProperties" in compiled ||
          "patternProperties" in compiled
        ) {
          const additionalSchema = compiled.additionalProperties;
          if (
            additionalSchema &&
            typeof additionalSchema === "object" &&
            !Array.isArray(additionalSchema) &&
            "$ref" in additionalSchema
          ) {
            postLinkCacheKinds |= PostLinkCacheKind.Object;
          } else {
            prepareObjectKeywordCaches(compiled);
          }
        }

        let hasCombinators = false;
        let combinatorCacheNeedsLink = false;
        for (const key of SCHEMA_ARRAY_KEYWORDS) {
          const branches = compiled[key];
          if (!Array.isArray(branches)) {
            continue;
          }
          hasCombinators = true;
          for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            if (
              branch &&
              typeof branch === "object" &&
              !Array.isArray(branch) &&
              "$ref" in branch
            ) {
              combinatorCacheNeedsLink = true;
              break;
            }
          }
          if (combinatorCacheNeedsLink) {
            break;
          }
        }
        if (hasCombinators) {
          if (combinatorCacheNeedsLink) {
            postLinkCacheKinds |= PostLinkCacheKind.Combinator;
          } else {
            prepareCombinatorKeywordCaches(compiled);
          }
        }

        if (postLinkCacheKinds !== 0) {
          postLinkCachePlans.push({
            schema: compiled,
            kinds: postLinkCacheKinds
          });
        }
        continue;
      }

      if (item.schemaLocation && item.schema && typeof item.schema === "object") {
        this.schemaLocations.add(item.schema);
      }

      if (item.schema && typeof item.schema === "object") {
        const existing = compiledBySource.get(item.schema);
        if (existing) {
          (item.parent as any)[item.key] = existing;
          if (
            item.schemaLocation &&
            typeof item.schema.$id === "string"
          ) {
            this.idRegistry.set(item.schema.$id, existing);
          }
          continue;
        }
      }
      const compiled = this.compileSchemaNode(item.schema);
      (item.parent as any)[item.key] = compiled;

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
        references.push(compiled);
      }

      pending.push({
        kind: "finalize",
        schema: compiled
      });

      for (const key of Object.keys(compiled)) {
        if (LITERAL_SCHEMA_KEYWORDS.has(key)) {
          continue;
        }

        const value = compiled[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          if (key === "dependencies") {
            for (const subKey of Object.keys(value)) {
              const dependency = value[subKey];
              if (!this.isPlainObject(dependency)) {
                continue;
              }
              pending.push({
                kind: "compile",
                schema: dependency,
                parent: value,
                key: subKey,
                schemaLocation: true
              });
            }
          } else if (SCHEMA_MAP_KEYWORDS.has(key)) {
            for (const subKey of Object.keys(value)) {
              if (Array.isArray(value[subKey])) {
                continue;
              }
              pending.push({
                kind: "compile",
                schema: value[subKey],
                parent: value,
                key: subKey,
                schemaLocation: true
              });
            }
          } else {
            pending.push({
              kind: "compile",
              schema: value,
              parent: compiled,
              key,
              schemaLocation: SCHEMA_VALUE_KEYWORDS.has(key)
            });
          }
          continue;
        }

        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (this.isSchemaLike(value[i])) {
              pending.push({
                kind: "compile",
                schema: value[i],
                parent: value,
                key: i,
                schemaLocation: SCHEMA_ARRAY_KEYWORDS.has(key)
              });
            }
          }
        }
      }
    }

    if (!rootHolder.root) {
      throw new ValidationError("Invalid schema");
    }

    return {
      root: rootHolder.root,
      references,
      postLinkCachePlans
    };
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
          if (
            (Types as Record<string, TypeFunction | false>)[type] === validator
          ) {
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
        structuralOpcode: StructuralOpcode.DirectValidate,
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
        structuralOpcode:
          (keywords as Record<string, KeywordFunction | false>)[key] === keywordFn
            ? BUILTIN_STRUCTURAL_OPCODES[key] ?? StructuralOpcode.DirectValidate
            : StructuralOpcode.DirectValidate,
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

  private linkReferences(references: CompiledSchema[]) {
    type ReferenceResolution =
      | { kind: "target"; target: CompiledSchema }
      | { kind: "alwaysValid" }
      | { kind: "alwaysInvalid" }
      | { kind: "missing"; ref: string }
      | { kind: "cycle" };

    const resolved = new WeakMap<CompiledSchema, ReferenceResolution>();

    for (
      let referenceIndex = 0;
      referenceIndex < references.length;
      referenceIndex++
    ) {
      const node = references[referenceIndex];
      if (typeof node.$ref !== "string") {
        continue;
      }

      if (!resolved.has(node)) {
        const chain: CompiledSchema[] = [];
        const chainIndexes = new Map<CompiledSchema, number>();
        let current: any = node;
        let resolution: ReferenceResolution;

        while (true) {
          const known = resolved.get(current);
          if (known) {
            resolution = known;
            break;
          }

          if (!current || typeof current !== "object") {
            resolution = current === true
              ? { kind: "alwaysValid" }
              : current === false
                ? { kind: "alwaysInvalid" }
                : {
                    kind: "missing",
                    ref: chain[chain.length - 1].$ref
                  };
            break;
          }

          if (typeof current.$ref !== "string") {
            resolution = typeof current.$validate === "function"
              ? { kind: "target", target: current }
              : { kind: "alwaysValid" };
            break;
          }

          if (chainIndexes.has(current)) {
            resolution = { kind: "cycle" };
            break;
          }

          chainIndexes.set(current, chain.length);
          chain.push(current);
          current = this.getSchemaRef(current.$ref);
          if (typeof current === "undefined") {
            const refOwner = chain[chain.length - 1];
            current = this.getSchemaById(refOwner.$ref);
          }
        }

        for (let i = 0; i < chain.length; i++) {
          resolved.set(chain[i], resolution);
        }
      }

      const resolution = resolved.get(node)!;
      if (resolution.kind === "target") {
        this.defineHiddenValue(node, "_resolvedSchema", resolution.target);
        node.$validate = resolution.target.$validate;
        continue;
      }

      if (resolution.kind === "alwaysValid") {
        node.$validate = getNamedFunction("Validate_Ref_True", () => {});
        continue;
      }

      const defineError = getDefinedErrorFunctionForKey(
        "$ref",
        node as any,
        this.failFast
      );
      const message = resolution.kind === "missing"
        ? `Missing reference: ${resolution.ref}`
        : resolution.kind === "cycle"
          ? `Cyclic reference: ${node.$ref}`
          : "Value is not valid";
      const name = resolution.kind === "missing"
        ? "Validate_Ref_Missing"
        : resolution.kind === "cycle"
          ? "Validate_Ref_Cycle"
          : "Validate_Ref_False";
      node.$validate = getNamedFunction(name, (_data: any) =>
        defineError(message)
      );
    }
  }
}
