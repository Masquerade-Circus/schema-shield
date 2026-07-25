/****************** Path: lib/index.ts ******************/
import {
  DefineErrorFunction,
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
  createCombinatorValidator,
  prepareCombinatorEntries
} from "./keywords/other-keywords";

export { ValidationError } from "./utils/main-utils";
export { deepCloneUnfreeze as deepClone } from "./utils/deep-freeze";

export type Result = void | ValidationError | true;

export interface ValidateSubschemaFunction {
  (schema: CompiledSchema, data: any): Result;
}

export interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: DefineErrorFunction,
    instance: SchemaShield,
    validateSubschema?: ValidateSubschemaFunction
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
  validate: ValidateFunction;
}

interface PendingCombinator {
  item: ValidatorItem;
  key: "allOf" | "anyOf" | "oneOf";
  defineError: DefineErrorFunction;
}

interface ValidationContext {
  active: boolean;
  depth: number;
  depthExceeded: boolean;
  depthError?: ValidationError | true;
  defaults: Array<{ target: Record<string, any>; key: string }>;
}

interface SchemaAnalysis {
  requiresDepthGuard: boolean;
  requiresMutationJournal: boolean;
  mutableSchemas: WeakSet<object>;
}

interface DefaultMutation {
  target: Record<string, any>;
  key: string;
  value: any;
}

interface DepthGuardState {
  context: ValidationContext | null;
}

const MAX_COMPILE_DEPTH = 128;

const FAIL_FAST_TYPE_VALIDATORS: Record<string, ValidateFunction> = {
  object: (data) =>
    data !== null && typeof data === "object" && !Array.isArray(data)
      ? undefined
      : true,
  array: (data) => (Array.isArray(data) ? undefined : true),
  string: (data) => (typeof data === "string" ? undefined : true),
  number: (data) =>
    typeof data === "number" && Number.isFinite(data) ? undefined : true,
  integer: (data) =>
    typeof data === "number" && Number.isFinite(data) && Number.isInteger(data)
      ? undefined
      : true,
  boolean: (data) => (typeof data === "boolean" ? undefined : true),
  null: (data) => (data === null ? undefined : true)
};

function createBuiltinTypeValidator(
  _type: string,
  defineError: DefineErrorFunction,
  fallback: TypeFunction
): ValidateFunction {
  return (data) => {
    if (!fallback(data)) {
      return defineError("Invalid type", { data });
    }
  };
}

export class SchemaShield {
  private types: Record<string, TypeFunction | false> = {};
  private formats: Record<string, FormatFunction | false> = {};
  private keywords: Record<string, KeywordFunction | false> = {};
  private immutable = false;
  private rootSchema: CompiledSchema | null = null;
  private idRegistry: Map<string, CompiledSchema> = new Map();
  private failFast: boolean = true;
  private maxDepth: number;
  private validationContexts: ValidationContext[] = [];
  private compileCache: WeakMap<object, CompiledSchema> = new WeakMap();
  private compilingRequiresContext = false;
  private compilingMutableSchemas: WeakSet<object> = new WeakSet();

  constructor({
    immutable = false,
    failFast = true,
    maxDepth = 128
  }: {
    immutable?: boolean;
    failFast?: boolean;
    maxDepth?: number;
  } = {}) {
    if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 256) {
      const error = new ValidationError("maxDepth must be an integer from 1 to 256");
      error.code = "INVALID_MAX_DEPTH";
      error.keyword = "maxDepth";
      throw error;
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

  setDefault(target: Record<string, any>, key: string, value: any) {
    const context = this.validationContexts[this.validationContexts.length - 1];
    if (context) {
      context.defaults.push({ target, key });
    }
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  #defaultSavepoint() {
    const context = this.validationContexts[this.validationContexts.length - 1];
    return context ? context.defaults.length : 0;
  }

  #rollbackDefaultSavepoint(savepoint: number) {
    const context = this.validationContexts[this.validationContexts.length - 1];
    if (context) {
      this.rollbackDefaults(context, savepoint);
    }
  }

  #captureDefaultSavepoint(savepoint: number): DefaultMutation[] {
    const context = this.validationContexts[this.validationContexts.length - 1];
    if (!context || context.defaults.length === savepoint) {
      return [];
    }

    const mutations = context.defaults.slice(savepoint).map((entry) => ({
      ...entry,
      value: entry.target[entry.key]
    }));
    this.rollbackDefaults(context, savepoint);
    return mutations;
  }

  #restoreDefaults(mutations: DefaultMutation[]) {
    for (let index = 0; index < mutations.length; index++) {
      const mutation = mutations[index];
      this.setDefault(mutation.target, mutation.key, mutation.value);
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

  private depthError(message = "Maximum schema depth exceeded") {
    if (this.failFast) {
      return true as const;
    }
    const error = new ValidationError(message);
    error.code = "MAX_DEPTH_EXCEEDED";
    error.keyword = "maxDepth";
    return error;
  }

  private schemaChildren(schema: Record<string, any>): object[] {
    const children: object[] = [];
    const mapKeys = [
      "properties",
      "patternProperties",
      "definitions",
      "$defs",
      "dependencies"
    ];
    const arrayKeys = ["allOf", "anyOf", "oneOf", "items"];
    const singleKeys = [
      "items",
      "additionalItems",
      "additionalProperties",
      "contains",
      "propertyNames",
      "values",
      "elements",
      "not",
      "if",
      "then",
      "else"
    ];

    for (const key of mapKeys) {
      const value = schema[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      for (const childKey of Object.keys(value)) {
        const child = value[childKey];
        if (child && typeof child === "object") {
          children.push(child);
        }
      }
    }

    for (const key of arrayKeys) {
      const value = schema[key];
      if (!Array.isArray(value)) {
        continue;
      }
      for (const child of value) {
        if (child && typeof child === "object") {
          children.push(child);
        }
      }
    }

    for (const key of singleKeys) {
      const value = schema[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        children.push(value);
      }
    }

    for (const key of Object.keys(schema)) {
      if (
        key === "enum" ||
        key === "const" ||
        key === "default" ||
        key === "examples" ||
        mapKeys.includes(key) ||
        arrayKeys.includes(key) ||
        singleKeys.includes(key)
      ) {
        continue;
      }
      const keyword = this.getKeyword(key);
      const value = schema[key];
      if (
        keyword &&
        keyword !== keywords[key] &&
        value &&
        typeof value === "object"
      ) {
        children.push(value);
      }
    }

    return children;
  }

  private analyzeSchema(schema: any): SchemaAnalysis {
    if (!schema || typeof schema !== "object") {
      return {
        requiresDepthGuard: false,
        requiresMutationJournal: false,
        mutableSchemas: new WeakSet()
      };
    }

    const visiting = new WeakSet<object>();
    const visited = new WeakSet<object>();
    const stack: Array<{
      value: Record<string, any>;
      depth: number;
      exit: boolean;
    }> = [{ value: schema, depth: 0, exit: false }];
    let requiresDepthGuard = false;
    let requiresMutationJournal = false;
    const idTargets = new Map<string, Record<string, any>>();

    while (stack.length > 0) {
      const entry = stack.pop()!;
      if (entry.exit) {
        visiting.delete(entry.value);
        visited.add(entry.value);
        continue;
      }
      if (visited.has(entry.value)) {
        continue;
      }
      if (visiting.has(entry.value)) {
        const error = new ValidationError("Cyclic schema graph is not supported");
        error.code = "CYCLIC_SCHEMA_GRAPH";
        error.keyword = "compile";
        throw error;
      }
      if (entry.depth > MAX_COMPILE_DEPTH) {
        const error = new ValidationError("Maximum compile depth exceeded");
        error.code = "MAX_COMPILE_DEPTH_EXCEEDED";
        error.keyword = "compile";
        throw error;
      }
      if (entry.depth > this.maxDepth) {
        requiresDepthGuard = true;
      }

      visiting.add(entry.value);
      stack.push({ ...entry, exit: true });

      if (this.hasRequiredDefaults(entry.value)) {
        requiresMutationJournal = true;
      }

      for (const key of Object.keys(entry.value)) {
        const keyword = this.getKeyword(key);
        if (key === "$id" && typeof entry.value[key] === "string") {
          idTargets.set(entry.value[key], entry.value);
        }
        if (keyword && keyword !== keywords[key]) {
          requiresDepthGuard = true;
          requiresMutationJournal = true;
        }
      }

      const children = this.schemaChildren(entry.value);
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({
          value: children[index] as Record<string, any>,
          depth: entry.depth + 1,
          exit: false
        });
      }
    }

    const semanticState = new WeakMap<object, 1 | 2>();
    const semanticStack: Array<{
      value: Record<string, any>;
      exit: boolean;
    }> = [{ value: schema, exit: false }];
    while (semanticStack.length > 0 && !requiresDepthGuard) {
      const entry = semanticStack.pop()!;
      if (entry.exit) {
        semanticState.set(entry.value, 2);
        continue;
      }
      const state = semanticState.get(entry.value);
      if (state === 1) {
        requiresDepthGuard = true;
        break;
      }
      if (state === 2) {
        continue;
      }
      semanticState.set(entry.value, 1);
      semanticStack.push({ value: entry.value, exit: true });
      const children = this.schemaChildren(entry.value);
      if (
        typeof entry.value.$ref === "string" &&
        this.getKeyword("$ref") === keywords.$ref
      ) {
        const target = entry.value.$ref.startsWith("#")
          ? resolvePath(schema, entry.value.$ref)
          : idTargets.get(entry.value.$ref);
        if (target && typeof target === "object") {
          children.push(target);
        }
      }
      for (let index = children.length - 1; index >= 0; index--) {
        semanticStack.push({
          value: children[index] as Record<string, any>,
          exit: false
        });
      }
    }

    const mutableSchemas = new WeakSet<object>();
    if (requiresMutationJournal) {
      const mutationStack: Array<{
        value: Record<string, any>;
        exit: boolean;
      }> = [{ value: schema, exit: false }];
      const mutationVisited = new WeakSet<object>();
      while (mutationStack.length > 0) {
        const entry = mutationStack.pop()!;
        if (entry.exit) {
          const children = this.schemaChildren(entry.value);
          const hasCustomKeyword = Object.keys(entry.value).some((key) => {
            const keyword = this.getKeyword(key);
            return !!keyword && keyword !== keywords[key];
          });
          if (
            this.hasRequiredDefaults(entry.value) ||
            hasCustomKeyword ||
            typeof entry.value.$ref === "string" ||
            children.some((child) => mutableSchemas.has(child))
          ) {
            mutableSchemas.add(entry.value);
          }
          continue;
        }
        if (mutationVisited.has(entry.value)) {
          continue;
        }
        mutationVisited.add(entry.value);
        mutationStack.push({ value: entry.value, exit: true });
        const children = this.schemaChildren(entry.value);
        for (let index = children.length - 1; index >= 0; index--) {
          mutationStack.push({
            value: children[index] as Record<string, any>,
            exit: false
          });
        }
      }
    }

    return { requiresDepthGuard, requiresMutationJournal, mutableSchemas };
  }

  compile(schema: any): Validator {
    const prepared = this.prepareSchema(schema);
    const compiledSchema = prepared.compiledSchema;
    if (!prepared.requiresDepthGuard && !prepared.requiresMutationJournal) {
      const directValidate = compiledSchema.$validate!;
      const validate = (this.immutable
        ? ((data: any) => {
            const clonedData = deepCloneUnfreeze(data);
            const error = directValidate(clonedData);
            return error
              ? { data: clonedData, error, valid: false }
              : { data: clonedData, error: null, valid: true };
          })
        : ((data: any) => {
            const error = directValidate(data);
            return error
              ? { data, error, valid: false }
              : { data, error: null, valid: true };
          })) as Validator;
      validate.compiledSchema = compiledSchema;
      return validate;
    }
    return this.createGuardedValidator(compiledSchema, prepared.depthGuardState!);
  }

  private prepareSchema(schema: any) {
    const analysis = this.analyzeSchema(schema);
    this.idRegistry.clear();
    this.compileCache = new WeakMap();
    this.compilingRequiresContext =
      analysis.requiresDepthGuard || analysis.requiresMutationJournal;
    this.compilingMutableSchemas = analysis.mutableSchemas;
    const compiledSchema = this.compileSchema(schema);
    this.rootSchema = compiledSchema;
    if ((compiledSchema as any)._hasRef === true) {
      this.linkReferences(compiledSchema);
    }

    let depthGuardState: DepthGuardState | null = null;
    if (analysis.requiresDepthGuard) {
      depthGuardState = this.installDepthGuards(compiledSchema);
      Object.defineProperty(compiledSchema, "_requiresDepthGuard", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (analysis.requiresMutationJournal) {
      depthGuardState = { context: null };
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

    return {
      compiledSchema,
      requiresDepthGuard: analysis.requiresDepthGuard,
      requiresMutationJournal: analysis.requiresMutationJournal,
      depthGuardState
    };
  }

  private createGuardedValidator(
    compiledSchema: CompiledSchema,
    depthGuardState: DepthGuardState
  ): Validator {
    const reusableContext: ValidationContext = {
      active: false,
      depth: -1,
      depthExceeded: false,
      defaults: []
    };
    const validate = ((data: any) => {
      this.rootSchema = compiledSchema;
      const context = reusableContext.active
        ? {
            active: false,
            depth: -1,
            depthExceeded: false,
            defaults: []
          }
        : reusableContext;
      context.active = true;
      context.depth = -1;
      context.depthExceeded = false;
      delete context.depthError;
      context.defaults.length = 0;
      this.validationContexts.push(context);
      const priorContext = depthGuardState.context;
      depthGuardState.context = context;
      let clonedData = data;
      try {
        clonedData = this.immutable ? deepCloneUnfreeze(data) : data;
        let error = compiledSchema.$validate!(clonedData);
        if (this.isDepthError(error)) {
          this.rollbackDefaults(context, 0);
          error = context.depthError || this.depthError();
        }
        return error
          ? { data: clonedData, error, valid: false }
          : { data: clonedData, error: null, valid: true };
      } catch (error) {
        this.rollbackDefaults(context, 0);
        throw error;
      } finally {
        depthGuardState.context = priorContext;
        this.validationContexts.pop();
        context.active = false;
      }
    }) as Validator;
    validate.compiledSchema = compiledSchema;
    return validate;
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

    for (let i = 0; i < branches.length; i++) {
      const item = branches[i];
      if (
        this.isPlainObject(item) &&
        Object.keys(item).length === 1 &&
        Array.isArray(item[key])
      ) {
        const nested = this.flattenAssociativeBranches(key, item[key]);
        for (let j = 0; j < nested.length; j++) {
          out.push(nested[j]);
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

    if (Array.isArray(schema.allOf)) {
      const flattenedAllOf = this.flattenAssociativeBranches(
        "allOf",
        schema.allOf
      ).filter(
        (item) =>
          !(
            this.isPlainObject(item) && Object.keys(item).length === 0
          )
      );

      if (
        hasOnlyKey("allOf") &&
        flattenedAllOf.length === 1 &&
        this.isPlainObject(flattenedAllOf[0])
      ) {
        return flattenedAllOf[0];
      }

      if (!this.shallowArrayEquals(flattenedAllOf, schema.allOf)) {
        setNormalized("allOf", flattenedAllOf);
      }
    }

    if (Array.isArray(schema.anyOf)) {
      const flattenedAnyOf = this.flattenAssociativeBranches(
        "anyOf",
        schema.anyOf
      );

      if (
        hasOnlyKey("anyOf") &&
        flattenedAnyOf.length === 1 &&
        this.isPlainObject(flattenedAnyOf[0])
      ) {
        return flattenedAnyOf[0];
      }

      if (!this.shallowArrayEquals(flattenedAnyOf, schema.anyOf)) {
        setNormalized("anyOf", flattenedAnyOf);
      }
    }

    if (Array.isArray(schema.oneOf)) {
      const flattenedOneOf = this.flattenSingleWrapperOneOf(schema.oneOf);

      if (
        hasOnlyKey("oneOf") &&
        flattenedOneOf.length === 1 &&
        this.isPlainObject(flattenedOneOf[0])
      ) {
        return flattenedOneOf[0];
      }

      if (!this.shallowArrayEquals(flattenedOneOf, schema.oneOf)) {
        setNormalized("oneOf", flattenedOneOf);
      }
    }

    return normalized;
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

  private rollbackDefaults(context: ValidationContext, start: number) {
    for (let index = context.defaults.length - 1; index >= start; index--) {
      const entry = context.defaults[index];
      delete entry.target[entry.key];
    }
    context.defaults.length = start;
  }

  private isDepthError(error: Result): boolean {
    const context = this.validationContexts[this.validationContexts.length - 1];
    if (context?.depthExceeded) {
      return true;
    }
    if (!(error instanceof ValidationError)) {
      return false;
    }
    return error.getCause().code === "MAX_DEPTH_EXCEEDED";
  }

  private validateSubschema(schema: CompiledSchema, data: any): Result {
    if (!schema || typeof schema.$validate !== "function") {
      return;
    }
    const context = this.validationContexts[this.validationContexts.length - 1];
    const savepoint = context?.defaults.length || 0;
    try {
      const error = schema.$validate(data);
      if (error && context) {
        this.rollbackDefaults(context, savepoint);
      }
      return error;
    } catch (error) {
      if (context) {
        this.rollbackDefaults(context, savepoint);
      }
      throw error;
    }
  }

  private installDepthGuards(root: CompiledSchema): DepthGuardState {
    const state: DepthGuardState = { context: null };
    const stack: CompiledSchema[] = [root];
    const seen = new WeakSet<object>();

    while (stack.length > 0) {
      const schema = stack.pop()!;
      if (!schema || typeof schema !== "object" || seen.has(schema)) {
        continue;
      }
      seen.add(schema);

      if (typeof schema.$validate === "function") {
        const directValidate = schema.$validate;
        schema.$validate = getNamedFunction(directValidate.name, (data: any) => {
          const context = state.context;
          if (!context) {
            return directValidate(data);
          }
          const nextDepth = context.depth + 1;
          if (nextDepth > this.maxDepth) {
            context.depthExceeded = true;
            if (!context.depthError) {
              context.depthError = this.depthError();
            }
            return context.depthError;
          }
          context.depth = nextDepth;
          try {
            return directValidate(data);
          } finally {
            context.depth--;
          }
        });
      }

      const children = this.schemaChildren(schema);
      for (const child of children) {
        stack.push(child as CompiledSchema);
      }
    }
    return state;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any): CompiledSchema {
    if (schema === true) {
      return {
        $validate: getNamedFunction<ValidateFunction>("Validate_True", () => {})
      };
    }
    if (schema === false) {
      const compiledFalse: CompiledSchema = {};
      const defineError = getDefinedErrorFunctionForKey(
        "oneOf",
        compiledFalse,
        this.failFast
      );
      compiledFalse.$validate = getNamedFunction<ValidateFunction>(
        "Validate_False",
        (data) => defineError("Value is not valid", { data })
      );
      return compiledFalse;
    }
    const sourceSchema =
      schema && typeof schema === "object" && !Array.isArray(schema)
        ? schema
        : null;
    const schemaCanApplyDefaults =
      sourceSchema !== null && this.compilingMutableSchemas.has(sourceSchema);
    if (sourceSchema) {
      const cached = this.compileCache.get(sourceSchema);
      if (cached) {
        return cached;
      }
    }
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      schema = { oneOf: [schema] };
    }

    schema = this.normalizeSchemaForCompile(schema);

    const compiledSchema: CompiledSchema = deepCloneUnfreeze(
      schema
    ) as CompiledSchema;
    if (sourceSchema) {
      this.compileCache.set(sourceSchema, compiledSchema);
    }
    if (schemaCanApplyDefaults) {
      Object.defineProperty(compiledSchema, "_canApplyDefaults", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    const validateSubschema = this.compilingRequiresContext
      ? this.validateSubschema.bind(this)
      : undefined;

    let schemaHasRef = false;

    if (typeof schema.$id === "string") {
      this.idRegistry.set(schema.$id, compiledSchema);
    }

    if ("$ref" in schema) {
      schemaHasRef = true;
      const refValidator = this.getKeyword("$ref");
      if (refValidator) {
        const defineError = getDefinedErrorFunctionForKey(
          "$ref",
          schema["$ref"],
          this.failFast
        );

        const isBuiltinRef = refValidator === keywords.$ref;
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          isBuiltinRef ? "Validate_Reference" : refValidator.name || "$ref",
          (data) =>
            (refValidator as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this,
               validateSubschema
            )
        );
        if (!isBuiltinRef) {
          schemaHasRef = false;
        }
      }

      for (const key of ["definitions", "$defs"]) {
        const definitions = schema[key];
        if (!definitions || typeof definitions !== "object") {
          continue;
        }
        const compiledDefinitions: Record<string, any> = {};
        for (const definitionKey of Object.keys(definitions)) {
          compiledDefinitions[definitionKey] = this.compileSchema(
            definitions[definitionKey]
          );
        }
        compiledSchema[key] = compiledDefinitions;
      }
      if (schemaHasRef) {
        this.markSchemaHasRef(compiledSchema);
      }
      return compiledSchema;
    }

    const validators: ValidatorItem[] = [];
    const activeNames: string[] = [];
    const pendingCombinators: PendingCombinator[] = [];

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
        combinedTypeValidator =
          this.failFast && FAIL_FAST_TYPE_VALIDATORS[singleTypeName]
            ? FAIL_FAST_TYPE_VALIDATORS[singleTypeName]
            : createBuiltinTypeValidator(
                singleTypeName,
                defineTypeError,
                typeFunctions[0]
              );
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
            if (!Number.isFinite(data)) {
              return defineTypeError("Invalid type", { data });
            }
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

      validators.push({
        name: typeMethodName,
        validate: getNamedFunction(typeMethodName, combinedTypeValidator)
      });
      activeNames.push(typeMethodName);
    }

    const { type, $id, $ref, $validate, required, ...otherKeys } = schema; // Exclude handled keys

    // In here we create an array of keys putting the require keyword last
    // This is to ensure required properties are checked after defaults are applied
    const otherKeyNames = Object.keys(otherKeys);
    const keyOrder = required
      ? this.hasRequiredDefaults(schema)
        ? [
            ...(otherKeyNames.includes("properties") ? ["properties"] : []),
            ...otherKeyNames.filter((key) => key !== "properties"),
            "required"
          ]
        : ["required", ...otherKeyNames]
      : otherKeyNames;

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
      if (
        (key === "allOf" || key === "anyOf" || key === "oneOf") &&
        keywordFn === keywords[key]
      ) {
        const item: ValidatorItem = {
          name: fnName,
          validate: () => {
            throw new ValidationError("Combinator validator was not prepared");
          }
        };
        validators.push(item);
        pendingCombinators.push({ item, key, defineError });
        activeNames.push(fnName);
        continue;
      }

      const keywordValidate = validateSubschema
        ? (data: any) =>
            (keywordFn as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this,
              validateSubschema
            )
        : (data: any) =>
            (keywordFn as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this
            );
      validators.push({
        name: fnName,
        validate: getNamedFunction<ValidateFunction>(fnName, keywordValidate)
      });

      activeNames.push(fnName);
    }

    const literalKeywords = ["enum", "const", "default", "examples"];
    for (const key of keyOrder) {
      if (literalKeywords.includes(key)) {
        continue;
      }

      if (
        schema[key] &&
        typeof schema[key] === "object" &&
        !Array.isArray(schema[key])
      ) {
        if (key === "properties") {
          for (const subKey of Object.keys(schema[key])) {
            const compiledSubSchema = this.compileSchema(
              schema[key][subKey]
            );

            if ((compiledSubSchema as any)._hasRef === true) {
              schemaHasRef = true;
            }

            compiledSchema[key][subKey] = compiledSubSchema;
          }
          continue;
        }
        const compiledSubSchema = this.compileSchema(schema[key]);
        if ((compiledSubSchema as any)._hasRef === true) {
          schemaHasRef = true;
        }

        compiledSchema[key] = compiledSubSchema;
        continue;
      }

      if (Array.isArray(schema[key])) {
        for (let i = 0; i < schema[key].length; i++) {
          if (this.isSchemaLike(schema[key][i])) {
            const compiledSubSchema = this.compileSchema(schema[key][i]);
            if ((compiledSubSchema as any)._hasRef === true) {
              schemaHasRef = true;
            }

            compiledSchema[key][i] = compiledSubSchema;
          }
        }
        continue;
      }
    }

    if (this.isPlainObject(schema.properties)) {
      Object.defineProperty(compiledSchema, "_propKeys", {
        value: Object.keys(schema.properties),
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (this.isPlainObject(schema.properties) && Array.isArray(schema.required)) {
      const requiredDefaultKeys = schema.required.filter((key: string) => {
        const property = schema.properties[key];
        return (
          property &&
          typeof property === "object" &&
          !Array.isArray(property) &&
          Object.prototype.hasOwnProperty.call(property, "default")
        );
      });
      if (requiredDefaultKeys.length > 0) {
        Object.defineProperty(compiledSchema, "_requiredDefaultKeys", {
          value: requiredDefaultKeys,
          enumerable: false,
          configurable: false,
          writable: false
        });
      }
    }

    prepareCombinatorEntries(compiledSchema);

    for (let index = 0; index < pendingCombinators.length; index++) {
      const pending = pendingCombinators[index];
      const transactions =
        (compiledSchema as any)._canApplyDefaults === true
          ? {
              savepoint: () => this.#defaultSavepoint(),
              rollback: (savepoint: number) =>
                this.#rollbackDefaultSavepoint(savepoint),
              capture: (savepoint: number) =>
                this.#captureDefaultSavepoint(savepoint),
              restore: (mutations: DefaultMutation[]) =>
                this.#restoreDefaults(mutations)
            }
          : undefined;
      pending.item.validate = getNamedFunction(
        pending.item.name,
        createCombinatorValidator(
          pending.key,
          compiledSchema,
          pending.defineError,
          validateSubschema,
          transactions
        )
      );
    }

    if (schemaHasRef) {
      this.markSchemaHasRef(compiledSchema);
    }

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

        if (typeof target === "undefined") {
          if (/^https?:\/\//i.test(refPath)) {
            continue;
          }
          const error = new ValidationError(`Reference not found: ${refPath}`);
          error.code = "REFERENCE_NOT_FOUND";
          error.keyword = "$ref";
          throw error;
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
          node.$validate = target.$validate;
        } else {
          const error = new ValidationError(`Reference not found: ${refPath}`);
          error.code = "REFERENCE_NOT_FOUND";
          error.keyword = "$ref";
          throw error;
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
