/****************** Path: lib/index.ts ******************/
import {
  DefineErrorFunction,
  ValidationError,
  definePropertyOrThrow,
  getDefinedErrorFunctionForKey,
  getNamedFunction,
  hasOwn,
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
import {
  applyPropertyDefaults,
  applyEmptyPropertyDefaults
} from "./keywords/object-keywords";
import {
  BUILTIN_DIALECT_BY_URI,
  BUILTIN_META_SCHEMA_BY_URI,
  BUILTIN_META_SCHEMAS
} from "./meta-schemas";

export { ValidationError } from "./utils/main-utils";
export { deepCloneUnfreeze as deepClone } from "./utils/deep-freeze";

export type Result = void | ValidationError | true;

export type JSONSchema = boolean | Record<string, any>;

export interface AddSchemaOptions {
  uri?: string;
  aliases?: readonly string[];
}

export interface CompileOptions {
  validateSchema?: boolean;
}

export interface ValidationResult {
  data: any;
  error: ValidationError | null | true;
  valid: boolean;
}

export interface ValidateSubschemaFunction {
  (
    schema: CompiledSchema | boolean,
    data: any,
    evaluated?: {
      property?: string;
      item?: number;
      unevaluated?: boolean;
      discardAnnotations?: boolean;
    }
  ): Result;
  savepoint?(): number;
  rollback?(savepoint: number): void;
  tracksEvaluated?: boolean;
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
  (data: any): ValidationResult;
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
  defaults: DefaultJournalEntry[];
  resources: EvaluationResource[];
  evaluations: EvaluatedState[];
  completedEvaluation?: EvaluatedState;
}

interface SchemaAnalysis {
  requiresDepthGuard: boolean;
  requiresMutationJournal: boolean;
  requiresDynamicScope: boolean;
  requiresEvaluatedTracking: boolean;
  mutableSchemas: WeakSet<object>;
  reachableSchemas: JSONSchema[];
}

interface EvaluatedState {
  data: any;
  properties?: Set<string>;
  items?: Set<number>;
}

interface SchemaPosition {
  source: Record<string, any>;
  baseUri: string;
  resourceRoot: Record<string, any>;
  pointer: string;
  dialect: SchemaDialect;
  environment: SchemaEnvironment;
}

interface ReferenceRegistry {
  aliases: ReadonlyMap<string, JSONSchema>;
  positions: ReadonlyArray<SchemaPosition>;
  positionsByNode: WeakMap<object, SchemaPosition>;
  ensureIndexed(schema: JSONSchema, environment: SchemaEnvironment): void;
  ensurePointerPosition(
    schema: JSONSchema,
    resourceRoot: Record<string, any>,
    pointer: string
  ): void;
  resolveRegisteredIdentity(uri: string, environment: SchemaEnvironment): void;
}

interface RegisteredSchema {
  schema: JSONSchema;
  identities: readonly string[];
  nestedIdentities: readonly string[];
  baseUri: string;
  rootIdBesideRef: boolean;
  metaSchema: boolean;
}

type SchemaDialect =
  | "legacy"
  | "draft4"
  | "draft6"
  | "draft7"
  | "2019-09"
  | "2020-12";

type VocabularyCategory =
  | "applicator"
  | "content"
  | "core"
  | "format"
  | "metadata"
  | "unevaluated"
  | "validation";

type FormatMode = "default" | "enabled" | "disabled";

interface SchemaEnvironment {
  dialect: SchemaDialect;
  metaschemaUri: string | null;
  vocabularies: ReadonlySet<VocabularyCategory> | null;
  formatAssertionRequired: boolean;
  dependenciesCompatibility: boolean;
  definitionsCompatibility: boolean;
}

interface EvaluationResource {
  compiledRoot: CompiledSchema;
  dynamicAnchors: ReadonlyMap<string, CompiledSchema>;
  recursiveAnchor: boolean;
}

interface DefaultMutation {
  target: Record<string, any>;
  key: string;
  value: any;
}

interface DefaultJournalEntry {
  target: Record<string, any>;
  key: string;
  descriptor?: PropertyDescriptor;
}

interface DepthGuardState {
  context: ValidationContext | null;
}

const MAX_COMPILE_DEPTH = 128;
const LOCAL_SCHEMA_BASE = "schema-shield://local/root";
const FORMAT_ASSERTION_2020_VOCABULARY =
  "https://json-schema.org/draft/2020-12/vocab/format-assertion";
const VOCABULARY_CATEGORIES: ReadonlyMap<string, VocabularyCategory> = new Map([
  ["https://json-schema.org/draft/2019-09/vocab/core", "core"],
  ["https://json-schema.org/draft/2019-09/vocab/applicator", "applicator"],
  ["https://json-schema.org/draft/2019-09/vocab/validation", "validation"],
  ["https://json-schema.org/draft/2019-09/vocab/meta-data", "metadata"],
  ["https://json-schema.org/draft/2019-09/vocab/format", "format"],
  ["https://json-schema.org/draft/2019-09/vocab/content", "content"],
  ["https://json-schema.org/draft/2020-12/vocab/core", "core"],
  ["https://json-schema.org/draft/2020-12/vocab/applicator", "applicator"],
  ["https://json-schema.org/draft/2020-12/vocab/validation", "validation"],
  ["https://json-schema.org/draft/2020-12/vocab/unevaluated", "unevaluated"],
  ["https://json-schema.org/draft/2020-12/vocab/meta-data", "metadata"],
  ["https://json-schema.org/draft/2020-12/vocab/format-annotation", "format"],
  ["https://json-schema.org/draft/2020-12/vocab/format-assertion", "format"],
  ["https://json-schema.org/draft/2020-12/vocab/content", "content"]
]);
const BUILTIN_SCHEMA_REGISTRATIONS: readonly RegisteredSchema[] = Object.freeze(
  BUILTIN_META_SCHEMAS.map((resource) => {
    const hashIndex = resource.uri.indexOf("#");
    const resourceUri =
      hashIndex === -1 ? resource.uri : resource.uri.slice(0, hashIndex);
    return Object.freeze({
      schema: resource.schema as Record<string, any>,
      identities: Object.freeze(Array.from(new Set([resource.uri, resourceUri]))),
      nestedIdentities: Object.freeze([]),
      baseUri: resourceUri,
      rootIdBesideRef: true,
      metaSchema: true
    });
  })
);

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
  private static builtinMetaValidators: Map<string, Validator> = new Map();
  private types: Record<string, TypeFunction | false> = {};
  private formats: Record<string, FormatFunction | false> = {};
  private keywords: Record<string, KeywordFunction | false> = {};
  private immutable = false;
  private useDefaults: boolean | "empty" = false;
  private formatMode: FormatMode = "default";
  private rootSchema: CompiledSchema | null = null;
  private failFast: boolean = true;
  private maxDepth: number;
  private validationContexts: ValidationContext[] = [];
  private compileCache: WeakMap<object, CompiledSchema> = new WeakMap();
  private compilingRequiresContext = false;
  private compilingEvaluatedTracking = false;
  private compilingValidateSubschema?: ValidateSubschemaFunction;
  private compilingMutableSchemas: WeakSet<object> = new WeakSet();
  private compilingDialects: WeakMap<object, SchemaDialect> = new WeakMap();
  private compilingEnvironments: WeakMap<object, SchemaEnvironment> = new WeakMap();
  private compilingSchemaChildren: WeakMap<object, object[]> = new WeakMap();
  private registeredSchemas: RegisteredSchema[] = [];
  private registeredSchemaIds: Map<string, RegisteredSchema> = new Map();
  private customMetaValidators: Map<string, Validator> = new Map();

  constructor(options: {
    immutable?: boolean;
    failFast?: boolean;
    format?: boolean;
    maxDepth?: number;
    useDefaults?: boolean | "empty";
  } = {}) {
    const {
      immutable = false,
      failFast = true,
      maxDepth = 128,
      useDefaults = false
    } = options;
    let formatMode: FormatMode = "default";
    if (hasOwn(options, "format")) {
      if (options.format !== true && options.format !== false) {
        const error = new ValidationError("format must be true or false");
        error.code = "INVALID_FORMAT";
        error.keyword = "format";
        throw error;
      }
      formatMode = options.format ? "enabled" : "disabled";
    }
    if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 256) {
      const error = new ValidationError("maxDepth must be an integer from 1 to 256");
      error.code = "INVALID_MAX_DEPTH";
      error.keyword = "maxDepth";
      throw error;
    }
    if (
      useDefaults !== false &&
      useDefaults !== true &&
      useDefaults !== "empty"
    ) {
      const error = new ValidationError(
        'useDefaults must be false, true, or "empty"'
      );
      error.code = "INVALID_USE_DEFAULTS";
      error.keyword = "useDefaults";
      throw error;
    }
    this.immutable = immutable;
    this.failFast = failFast;
    this.maxDepth = maxDepth;
    this.useDefaults = useDefaults;
    this.formatMode = formatMode;

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
      context.defaults.push({
        target,
        key,
        descriptor: Reflect.getOwnPropertyDescriptor(target, key)
      });
    }
    definePropertyOrThrow(target, key, {
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

    const mutations: DefaultMutation[] = [];
    for (let index = savepoint; index < context.defaults.length; index++) {
      const entry = context.defaults[index];
      mutations.push({
        ...entry,
        value: entry.target[entry.key]
      });
    }
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

  addSchema(schema: JSONSchema, options: AddSchemaOptions = {}): void {
    this.registerSchema(schema, options, false);
  }

  addMetaSchema(schema: JSONSchema, options: AddSchemaOptions = {}): void {
    const validation = this.validateSchema(schema);
    if (!validation.valid) {
      throw this.invalidSchemaError(validation.error);
    }
    if (schema === true || schema === false) {
      throw this.schemaRegistrationError(
        "A metaschema must be an object",
        "INVALID_SCHEMA",
        "schema"
      );
    }
    if (typeof schema.$schema !== "string") {
      throw this.schemaRegistrationError(
        "A custom metaschema must declare $schema",
        "INVALID_SCHEMA",
        "$schema"
      );
    }
    this.assertKnownRequiredVocabularies(schema);
    const verifier = new SchemaShield({ failFast: false });
    verifier.registeredSchemas = [...this.registeredSchemas];
    verifier.registeredSchemaIds = new Map(this.registeredSchemaIds);
    const registrationCount = verifier.registeredSchemas.length;
    verifier.registerSchema(schema, options, true);
    if (verifier.registeredSchemas.length === registrationCount) {
      return;
    }
    const candidate = verifier.registeredSchemas[registrationCount];
    verifier.compile(
      { $ref: candidate.baseUri },
      { validateSchema: false }
    );
    this.registerSchema(schema, options, true);
  }

  private registerSchema(
    schema: JSONSchema,
    options: AddSchemaOptions,
    metaSchema: boolean
  ): void {
    if (!this.isJsonSchema(schema)) {
      throw this.schemaRegistrationError(
        "Invalid schema",
        "INVALID_SCHEMA",
        "schema"
      );
    }
    if (!this.isJsonObject(options)) {
      throw this.schemaRegistrationError(
        "addSchema options must be an object",
        "INVALID_ADD_SCHEMA_OPTIONS",
        "addSchema"
      );
    }

    const builtin = this.claimedBuiltinMetaSchema(schema, options);
    if (builtin !== null) {
      if (this.schemasEqual(schema, builtin.schema)) {
        return;
      }
      throw this.schemaRegistrationError(
        `Builtin schema identity cannot be replaced: ${builtin.uri}`,
        "BUILTIN_SCHEMA_ID_COLLISION",
        "$id"
      );
    }

    let retrievalUri: string | null = null;
    if (hasOwn(options, "uri")) {
      retrievalUri = this.absoluteResourceUri(
        options.uri,
        "INVALID_SCHEMA_URI",
        "uri"
      );
    }

    const rootDialect =
      schema === true || schema === false
        ? "legacy"
        : this.effectiveDialect(schema, "legacy");
    const rootIdIsActive =
      schema !== true &&
      schema !== false &&
      ((rootDialect !== "draft4" &&
        rootDialect !== "draft6" &&
        rootDialect !== "draft7") ||
        !("$ref" in schema));
    const rootIdKeyword = rootDialect === "draft4" ? "id" : "$id";
    let resolvedRootId: string | null = null;
    if (rootIdIsActive && hasOwn(schema, rootIdKeyword)) {
      const rootId = schema[rootIdKeyword];
      if (typeof rootId !== "string") {
        throw this.schemaRegistrationError(
          `Root ${rootIdKeyword} must be a string`,
          "INVALID_SCHEMA_ID",
          rootIdKeyword
        );
      }
      resolvedRootId = retrievalUri
        ? this.resourceIdentityFromReference(rootId, retrievalUri, rootIdKeyword)
        : this.absoluteResourceUri(rootId, "INVALID_SCHEMA_ID", rootIdKeyword);
    }

    if (retrievalUri === null && resolvedRootId === null) {
      throw this.schemaRegistrationError(
        `Schema requires an absolute root ${rootIdKeyword} or an explicit uri`,
        "INVALID_SCHEMA_ID",
        rootIdKeyword
      );
    }

    const aliases = hasOwn(options, "aliases") ? options.aliases : [];
    if (!Array.isArray(aliases)) {
      throw this.schemaRegistrationError(
        "Schema aliases must be an array",
        "INVALID_SCHEMA_ALIAS",
        "aliases"
      );
    }

    const identities = new Set<string>();
    if (retrievalUri !== null) {
      identities.add(retrievalUri);
    }
    if (resolvedRootId !== null) {
      identities.add(resolvedRootId);
    }
    for (const alias of aliases) {
      identities.add(
        this.absoluteResourceUri(alias, "INVALID_SCHEMA_ALIAS", "aliases")
      );
    }

    for (const identity of identities) {
      if (this.registeredSchemaIds.has(identity)) {
        throw this.schemaRegistrationError(
          `Duplicate schema identity: ${identity}`,
          "DUPLICATE_SCHEMA_ID",
          "$id"
        );
      }
    }

    const snapshot = deepCloneUnfreeze(schema) as JSONSchema;
    const baseUri = retrievalUri || resolvedRootId!;
    const nestedIdentities = new Set(
      this.collectRegisteredNestedIdentities(
        snapshot,
        baseUri,
        rootDialect,
        rootIdIsActive
      )
    );
    if (rootDialect === "legacy") {
      for (const dialect of ["2019-09", "2020-12"] as const) {
        for (const identity of this.collectRegisteredNestedIdentities(
          snapshot,
          baseUri,
          dialect,
          rootIdIsActive
        )) {
          nestedIdentities.add(identity);
        }
      }
    }
    for (const identity of [...identities, ...nestedIdentities]) {
      const builtinIdentity = this.builtinMetaSchemaForIdentity(identity);
      if (builtinIdentity !== null) {
        throw this.schemaRegistrationError(
          `Builtin schema identity cannot be replaced: ${builtinIdentity.uri}`,
          "BUILTIN_SCHEMA_ID_COLLISION",
          "$id"
        );
      }
    }
    const registration: RegisteredSchema = Object.freeze({
      schema: snapshot,
      identities: Object.freeze(Array.from(identities)),
      nestedIdentities: Object.freeze(Array.from(nestedIdentities)),
      baseUri,
      rootIdBesideRef: rootIdIsActive,
      metaSchema
    });
    this.registeredSchemas.push(registration);
    for (const identity of identities) {
      this.registeredSchemaIds.set(identity, registration);
    }
  }

  private claimedBuiltinMetaSchema(
    schema: JSONSchema,
    options: AddSchemaOptions
  ) {
    const identities: any[] = [options.uri];
    if (Array.isArray(options.aliases)) {
      identities.push(...options.aliases);
    }
    if (schema !== true && schema !== false) {
      identities.push(schema.$id, schema.id);
    }

    for (const identity of identities) {
      const resource = this.builtinMetaSchemaForIdentity(identity);
      if (resource !== null) {
        return resource;
      }
    }
    return null;
  }

  private builtinMetaSchemaForIdentity(identity: any) {
    if (typeof identity !== "string") {
      return null;
    }
    let normalized: string;
    try {
      normalized = new URL(identity).href;
    } catch {
      return null;
    }
    const normalizedResource = this.resourceUri(normalized);
    for (const resource of BUILTIN_META_SCHEMAS) {
      if (
        normalized === resource.uri ||
        normalizedResource === this.resourceUri(resource.uri)
      ) {
        return resource;
      }
    }
    return null;
  }

  private schemasEqual(left: any, right: any): boolean {
    if (left === right) {
      return true;
    }
    if (
      left === null ||
      right === null ||
      typeof left !== "object" ||
      typeof right !== "object" ||
      Array.isArray(left) !== Array.isArray(right)
    ) {
      return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!hasOwn(right, key) || !this.schemasEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  private assertKnownRequiredVocabularies(schema: Record<string, any>): void {
    if (!this.isJsonObject(schema.$vocabulary)) {
      return;
    }
    for (const [uri, required] of Object.entries(schema.$vocabulary)) {
      if (required === true && this.vocabularyCategory(uri) === null) {
        const error = new ValidationError(`Unknown required vocabulary: ${uri}`);
        error.code = "UNKNOWN_REQUIRED_VOCABULARY";
        error.keyword = "$vocabulary";
        throw error;
      }
    }
  }

  private schemaRegistrationError(message: string, code: string, keyword: string) {
    const error = new ValidationError(message);
    error.code = code;
    error.keyword = keyword;
    return error;
  }

  private absoluteResourceUri(value: any, code: string, keyword: string): string {
    if (typeof value !== "string") {
      throw this.schemaRegistrationError(
        `${keyword} must be an absolute URI without a fragment`,
        code,
        keyword
      );
    }
    try {
      const url = new URL(value);
      if (url.hash !== "" || value.includes("#")) {
        throw new Error("fragment");
      }
      return url.href;
    } catch {
      throw this.schemaRegistrationError(
        `${keyword} must be an absolute URI without a fragment`,
        code,
        keyword
      );
    }
  }

  private resourceIdentityFromReference(
    reference: string,
    baseUri: string,
    keyword: string
  ): string {
    try {
      const url = new URL(reference, baseUri);
      if (url.hash !== "" || reference.includes("#")) {
        throw new Error("fragment");
      }
      return url.href;
    } catch {
      throw this.schemaRegistrationError(
        `${keyword} must resolve to a URI without a fragment`,
        "INVALID_SCHEMA_ID",
        keyword
      );
    }
  }

  private isJsonSchema(schema: any): schema is JSONSchema {
    if (schema === true || schema === false) {
      return true;
    }
    if (!this.isJsonObject(schema)) {
      return false;
    }

    const seen = new WeakSet<object>();
    const stack: any[] = [schema];
    while (stack.length > 0) {
      const value = stack.pop();
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        continue;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          return false;
        }
        continue;
      }
      if (typeof value !== "object") {
        return false;
      }
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      if (!Array.isArray(value) && !this.isJsonObject(value)) {
        return false;
      }
      for (const key of Object.keys(value)) {
        stack.push(value[key]);
      }
    }
    return true;
  }

  private isJsonObject(value: any): value is Record<string, any> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private collectRegisteredNestedIdentities(
    schema: JSONSchema,
    baseUri: string,
    inheritedDialect: SchemaDialect,
    rootIdBesideRef: boolean
  ): string[] {
    if (schema === true || schema === false) {
      return [];
    }

    const identities = new Set<string>();
    const visited = new WeakSet<object>();
    const stack: Array<{
      node: Record<string, any>;
      baseUri: string;
      dialect: SchemaDialect;
      root: boolean;
    }> = [
      { node: schema, baseUri, dialect: inheritedDialect, root: true }
    ];
    while (stack.length > 0) {
      const entry = stack.pop()!;
      if (visited.has(entry.node)) {
        continue;
      }
      visited.add(entry.node);

      const dialect = this.effectiveDialect(entry.node, entry.dialect);
      let childBase = entry.baseUri;
      if (
        typeof entry.node[dialect === "draft4" ? "id" : "$id"] === "string" &&
        (this.isModernDialect(dialect) ||
          !("$ref" in entry.node) ||
          (entry.root && rootIdBesideRef))
      ) {
        try {
          childBase = new URL(
            entry.node[dialect === "draft4" ? "id" : "$id"],
            entry.baseUri
          ).href;
          identities.add(childBase);
          if (childBase.indexOf("#") === -1 || childBase.endsWith("#")) {
            identities.add(this.resourceUri(childBase));
          }
        } catch {
          childBase = entry.baseUri;
        }
      }

      const children = this.registrySubschemaEntries(entry.node, dialect);
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index];
        if (!Array.isArray(child.value)) {
          stack.push({
            node: child.value as Record<string, any>,
            baseUri: childBase,
            dialect,
            root: false
          });
        }
      }
    }
    return Array.from(identities);
  }

  getSchemaRef(path: string): CompiledSchema | undefined {
    if (!this.rootSchema) {
      return;
    }
    return resolvePath(this.rootSchema, path);
  }

  getSchemaById(id: string): CompiledSchema | undefined {
    if (!this.rootSchema) {
      return;
    }

    const stack: CompiledSchema[] = [this.rootSchema];
    const seen = new WeakSet<object>();
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (seen.has(node)) {
        continue;
      }
      seen.add(node);
      if (node.$id === id || node.id === id) {
        return node;
      }

      const children = this.schemaChildren(node);
      for (let index = 0; index < children.length; index++) {
        stack.push(children[index] as CompiledSchema);
      }
    }

    return;
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

  private schemaChildEntries(
    schema: Record<string, any>,
    knownDialect?: SchemaDialect,
    knownEnvironment?: SchemaEnvironment
  ): Array<{ value: object; pointer: string }> {
    const dialect =
      knownDialect ||
      (schema as any)._dialect ||
      this.compilingDialects.get(schema) ||
      "legacy";
    const environment =
      knownEnvironment ||
      this.compilingEnvironments.get(schema) ||
      this.defaultEnvironment(dialect);
    if (
      (dialect === "draft4" || dialect === "draft6" || dialect === "draft7") &&
      typeof schema.$ref === "string" &&
      this.getKeyword("$ref") === keywords.$ref
    ) {
      return [];
    }
    const children = this.registrySubschemaEntries(
      schema,
      dialect,
      environment
    );
    for (const key of ["values", "elements"]) {
      const value = schema[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        children.push({
          value,
          pointer: `/${key}`
        });
      }
    }

    for (const key of Object.keys(schema)) {
      if (
        key === "enum" ||
        key === "const" ||
        key === "default" ||
        key === "examples" ||
        children.some((child) => {
          const keyPointer = `/${this.escapePointerToken(key)}`;
          return (
            child.pointer === keyPointer ||
            child.pointer.startsWith(`${keyPointer}/`)
          );
        })
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
        children.push({
          value,
          pointer: `/${this.escapePointerToken(key)}`
        });
      }
    }

    return children;
  }

  private schemaChildren(
    schema: Record<string, any>,
    knownDialect?: SchemaDialect,
    knownEnvironment?: SchemaEnvironment
  ): object[] {
    const cached = this.compilingSchemaChildren.get(schema);
    if (cached) {
      return cached;
    }
    const entries = this.schemaChildEntries(
      schema,
      knownDialect,
      knownEnvironment
    );
    const children: object[] = [];
    for (let index = 0; index < entries.length; index++) {
      children.push(entries[index].value);
    }
    this.compilingSchemaChildren.set(schema, children);
    return children;
  }

  private registrySubschemaEntries(
    schema: Record<string, any>,
    dialect: SchemaDialect,
    environment = this.defaultEnvironment(dialect)
  ): Array<{ value: object; pointer: string }> {
    const children: Array<{ value: object; pointer: string }> = [];
    if (
      (dialect === "draft4" || dialect === "draft6" || dialect === "draft7") &&
      typeof schema.$ref === "string" &&
      this.getKeyword("$ref") === keywords.$ref
    ) {
      return children;
    }
    const mapKeys: string[] = [];
    if (this.isKeywordActive("definitions", environment)) {
      mapKeys.push("definitions");
    }
    if (this.isKeywordActive("properties", environment)) {
      mapKeys.push("properties", "patternProperties");
    }
    if (this.isModernDialect(dialect)) {
      mapKeys.push("$defs");
      if (this.isKeywordActive("dependentSchemas", environment)) {
        mapKeys.push("dependentSchemas");
      }
      if (this.isKeywordActive("dependencies", environment)) {
        mapKeys.push("dependencies");
      }
    } else if (this.isKeywordActive("dependencies", environment)) {
      mapKeys.push("dependencies");
    }
    const arrayKeys = ["allOf", "anyOf", "oneOf"].filter((key) =>
      this.isKeywordActive(key, environment)
    );
    if (
      dialect !== "2020-12" &&
      this.isKeywordActive("items", environment)
    ) {
      arrayKeys.push("items");
    }
    if (
      dialect === "2020-12" &&
      this.isKeywordActive("prefixItems", environment)
    ) {
      arrayKeys.push("prefixItems");
    }
    const singleKeys = [
      "items",
      "additionalItems",
      "additionalProperties",
      "contains",
      "propertyNames",
      "not",
      "if",
      "then",
      "else",
      "unevaluatedItems",
      "unevaluatedProperties",
      "contentSchema"
    ].filter((key) => {
      if (key === "additionalItems" && dialect === "2020-12") {
        return false;
      }
      if (
        (key === "if" || key === "then" || key === "else") &&
        (dialect === "draft4" || dialect === "draft6")
      ) {
        return false;
      }
      if (
        (key === "unevaluatedItems" ||
          key === "unevaluatedProperties" ||
          key === "contentSchema") &&
        !this.isModernDialect(dialect)
      ) {
        return false;
      }
      return this.isKeywordActive(key, environment);
    });

    for (const key of mapKeys) {
      const value = schema[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      for (const childKey of Object.keys(value)) {
        const child = value[childKey];
        if (child && typeof child === "object" && !Array.isArray(child)) {
          children.push({
            value: child,
            pointer: `/${this.escapePointerToken(key)}/${this.escapePointerToken(
              childKey
            )}`
          });
        }
      }
    }

    for (const key of arrayKeys) {
      const value = schema[key];
      if (!Array.isArray(value)) {
        continue;
      }
      for (let index = 0; index < value.length; index++) {
        const child = value[index];
        if (child && typeof child === "object" && !Array.isArray(child)) {
          children.push({
            value: child,
            pointer: `/${this.escapePointerToken(key)}/${index}`
          });
        }
      }
    }

    for (const key of singleKeys) {
      const value = schema[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        children.push({
          value,
          pointer: `/${this.escapePointerToken(key)}`
        });
      }
    }

    return children;
  }

  private effectiveDialect(
    schema: Record<string, any>,
    inherited: SchemaDialect
  ): SchemaDialect {
    if (typeof schema.$schema !== "string") {
      return inherited;
    }
    try {
      return BUILTIN_DIALECT_BY_URI.get(new URL(schema.$schema).href) || inherited;
    } catch {
      return inherited;
    }
  }

  private defaultEnvironment(dialect: SchemaDialect): SchemaEnvironment {
    return {
      dialect,
      metaschemaUri: null,
      vocabularies: null,
      formatAssertionRequired: false,
      dependenciesCompatibility: !this.isModernDialect(dialect),
      definitionsCompatibility: !this.isModernDialect(dialect)
    };
  }

  private vocabularyCategory(uri: string): VocabularyCategory | null {
    return VOCABULARY_CATEGORIES.get(uri) || null;
  }

  private metaschemaDefinesKeyword(schema: JSONSchema, keyword: string): boolean {
    if (schema === true || schema === false) {
      return false;
    }
    const seen = new WeakSet<object>();
    const stack: Record<string, any>[] = [schema];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      if (
        this.isJsonObject(current.properties) &&
        hasOwn(current.properties, keyword)
      ) {
        return true;
      }
      for (const value of Object.values(current)) {
        if (this.isJsonObject(value)) {
          stack.push(value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (this.isJsonObject(item)) {
              stack.push(item);
            }
          }
        }
      }
    }
    return false;
  }

  private schemaEnvironment(
    schema: Record<string, any>,
    inherited: SchemaEnvironment
  ): SchemaEnvironment {
    if (!hasOwn(schema, "$schema")) {
      return inherited;
    }
    if (typeof schema.$schema !== "string") {
      throw this.unknownMetaschemaError(String(schema.$schema));
    }

    let metaschemaUri: string;
    try {
      metaschemaUri = new URL(schema.$schema).href;
    } catch {
      throw this.unknownMetaschemaError(schema.$schema);
    }
    const builtinDialect = BUILTIN_DIALECT_BY_URI.get(metaschemaUri);
    if (builtinDialect) {
      return {
        ...this.defaultEnvironment(builtinDialect),
        metaschemaUri,
        dependenciesCompatibility: true,
        definitionsCompatibility: !this.isModernDialect(builtinDialect)
      };
    }
    const registration = this.registeredSchemaIds.get(metaschemaUri);
    const metaschema = registration?.schema;
    if (!registration?.metaSchema || !metaschema || metaschema === true) {
      throw this.unknownMetaschemaError(metaschemaUri);
    }

    const metaschemaDialect = this.effectiveDialect(
      metaschema,
      inherited.dialect
    );
    const declared = metaschema.$vocabulary;
    if (!this.isJsonObject(declared)) {
      return {
        ...this.defaultEnvironment(metaschemaDialect),
        metaschemaUri,
        dependenciesCompatibility: this.metaschemaDefinesKeyword(
          metaschema,
          "dependencies"
        ),
        definitionsCompatibility: this.metaschemaDefinesKeyword(
          metaschema,
          "definitions"
        )
      };
    }

    const vocabularies = new Set<VocabularyCategory>();
    let formatAssertionRequired = false;
    for (const [uri, required] of Object.entries(declared)) {
      const category = this.vocabularyCategory(uri);
      if (category !== null) {
        vocabularies.add(category);
        if (uri === FORMAT_ASSERTION_2020_VOCABULARY) {
          formatAssertionRequired = true;
        }
        continue;
      }
      if (required === true) {
        const error = new ValidationError(
          `Unknown required vocabulary: ${uri}`
        );
        error.code = "UNKNOWN_REQUIRED_VOCABULARY";
        error.keyword = "$vocabulary";
        throw error;
      }
    }
    return {
      dialect: metaschemaDialect,
      metaschemaUri,
      vocabularies,
      formatAssertionRequired,
      dependenciesCompatibility: this.metaschemaDefinesKeyword(
        metaschema,
        "dependencies"
      ),
      definitionsCompatibility: this.metaschemaDefinesKeyword(
        metaschema,
        "definitions"
      )
    };
  }

  private isModernDialect(dialect: SchemaDialect): boolean {
    return dialect === "2019-09" || dialect === "2020-12";
  }

  private keywordVocabulary(key: string): VocabularyCategory | null {
    if (
      key === "type" ||
      key === "enum" ||
      key === "const" ||
      key === "multipleOf" ||
      key === "maximum" ||
      key === "exclusiveMaximum" ||
      key === "minimum" ||
      key === "exclusiveMinimum" ||
      key === "maxLength" ||
      key === "minLength" ||
      key === "pattern" ||
      key === "maxItems" ||
      key === "minItems" ||
      key === "uniqueItems" ||
      key === "maxContains" ||
      key === "minContains" ||
      key === "maxProperties" ||
      key === "minProperties" ||
      key === "required" ||
      key === "dependentRequired"
    ) {
      return "validation";
    }
    if (key === "unevaluatedItems" || key === "unevaluatedProperties") {
      return "unevaluated";
    }
    if (key === "format") {
      return "format";
    }
    if (
      key === "contentEncoding" ||
      key === "contentMediaType" ||
      key === "contentSchema"
    ) {
      return "content";
    }
    if (
      key === "allOf" ||
      key === "anyOf" ||
      key === "oneOf" ||
      key === "not" ||
      key === "if" ||
      key === "then" ||
      key === "else" ||
      key === "dependentSchemas" ||
      key === "prefixItems" ||
      key === "items" ||
      key === "contains" ||
      key === "additionalItems" ||
      key === "properties" ||
      key === "patternProperties" ||
      key === "additionalProperties" ||
      key === "propertyNames"
    ) {
      return "applicator";
    }
    return null;
  }

  private isKeywordActive(key: string, environment: SchemaEnvironment): boolean {
    const dialect = environment.dialect;
    if (key === "dependencies") {
      return environment.dependenciesCompatibility;
    }
    if (key === "definitions") {
      return environment.definitionsCompatibility;
    }
    if (key === "format") {
      if (this.formatMode === "enabled") {
        return true;
      }
      if (this.formatMode === "disabled") {
        return false;
      }
      return (
        environment.metaschemaUri === null ||
        environment.formatAssertionRequired
      );
    }
    const vocabulary = this.keywordVocabulary(key);
    if (
      vocabulary !== null &&
      environment.vocabularies !== null &&
      !environment.vocabularies.has(vocabulary)
    ) {
      return false;
    }
    if (key === "$defs") {
      return this.isModernDialect(dialect);
    }
    if (
      dialect === "draft4" &&
      (key === "const" || key === "contains" || key === "propertyNames")
    ) {
      return false;
    }
    if (key === "dependentRequired" || key === "dependentSchemas") {
      return this.isModernDialect(dialect);
    }
    if (key === "minContains" || key === "maxContains") {
      return this.isModernDialect(dialect);
    }
    if (key === "prefixItems") {
      return dialect === "2020-12";
    }
    if (key === "unevaluatedItems" || key === "unevaluatedProperties") {
      return this.isModernDialect(dialect);
    }
    if (key === "additionalItems") {
      return dialect !== "2020-12";
    }
    if (key === "if" || key === "then" || key === "else") {
      return dialect !== "draft4" && dialect !== "draft6";
    }
    if (key === "contentMediaType" || key === "contentEncoding") {
      return dialect === "legacy" || dialect === "draft7";
    }
    return true;
  }

  private validateAnchor(
    value: any,
    dialect: "2019-09" | "2020-12",
    keyword: "$anchor" | "$dynamicAnchor"
  ): string {
    const pattern =
      dialect === "2019-09"
        ? /^[A-Za-z][-A-Za-z0-9.:_]*$/
        : /^[A-Za-z_][-A-Za-z0-9._]*$/;
    if (typeof value !== "string" || !pattern.test(value)) {
      const error = new ValidationError(
        `Invalid ${keyword}: ${String(value)}`
      );
      error.code = "INVALID_ANCHOR";
      error.keyword = keyword;
      throw error;
    }
    return value;
  }

  private escapePointerToken(value: string): string {
    return value.replace(/~/g, "~0").replace(/\//g, "~1");
  }

  private resolveUri(
    reference: string,
    baseUri: string,
    keyword: "id" | "$id" | "$ref"
  ) {
    try {
      return new URL(reference, baseUri).href;
    } catch {
      const error = new ValidationError(`Invalid ${keyword} URI: ${reference}`);
      error.code = keyword === "$ref" ? "REFERENCE_NOT_FOUND" : "INVALID_SCHEMA_ID";
      error.keyword = keyword;
      throw error;
    }
  }

  private resourceUri(uri: string): string {
    const hashIndex = uri.indexOf("#");
    return hashIndex === -1 ? uri : uri.slice(0, hashIndex);
  }

  private buildReferenceRegistry(schema: any): ReferenceRegistry {
    const aliases = new Map<string, JSONSchema>();
    const positions: SchemaPosition[] = [];
    const positionsByNode = new WeakMap<object, SchemaPosition>();

    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return Object.freeze({
        aliases: aliases as ReadonlyMap<string, JSONSchema>,
        positions: Object.freeze(positions),
        positionsByNode,
        ensureIndexed: () => {},
        ensurePointerPosition: () => {},
        resolveRegisteredIdentity: () => {}
      });
    }

    const register = (
      uri: string,
      node: JSONSchema,
      code = "DUPLICATE_SCHEMA_ID",
      keyword = "$id"
    ) => {
      if (aliases.has(uri) && aliases.get(uri) !== node) {
        const error = new ValidationError(`Duplicate schema identity: ${uri}`);
        error.code = code;
        error.keyword = keyword;
        throw error;
      }
      aliases.set(uri, node);
    };

    const registrations = [
      ...BUILTIN_SCHEMA_REGISTRATIONS,
      ...this.registeredSchemas
    ];

    for (const registration of registrations) {
      for (const identity of registration.identities) {
        register(identity, registration.schema);
      }
    }
    register(LOCAL_SCHEMA_BASE, schema);

    const registrationsByRoot = new WeakMap<object, RegisteredSchema>();
    const registrationsByNestedIdentity = new Map<string, RegisteredSchema[]>();
    for (const registration of registrations) {
      if (registration.schema !== true && registration.schema !== false) {
        registrationsByRoot.set(registration.schema, registration);
      }
      for (const identity of registration.nestedIdentities) {
        const candidates = registrationsByNestedIdentity.get(identity);
        if (candidates) {
          candidates.push(registration);
        } else {
          registrationsByNestedIdentity.set(identity, [registration]);
        }
      }
    }

    const indexed = new WeakSet<object>();
    const indexResource = (
      root: Record<string, any>,
      inheritedBase: string,
      inheritedEnvironment: SchemaEnvironment,
      rootIdBesideRef = false,
      containingResourceRoot = root,
      rootPointer = "#"
    ) => {
      if (indexed.has(root)) {
        return;
      }

      const visited = new WeakSet<object>();
      const stack: Array<{
        node: Record<string, any>;
        inheritedBase: string;
        resourceRoot: Record<string, any>;
        pointer: string;
        environment: SchemaEnvironment;
        root: boolean;
      }> = [
        {
          node: root,
          inheritedBase,
          resourceRoot: containingResourceRoot,
          pointer: rootPointer,
          environment: inheritedEnvironment,
          root: true
        }
      ];

      while (stack.length > 0) {
        const entry = stack.pop()!;
        if (visited.has(entry.node)) {
          continue;
        }
        visited.add(entry.node);

        const environment = this.schemaEnvironment(
          entry.node,
          entry.environment
        );
        const dialect = environment.dialect;
        let baseUri = entry.inheritedBase;
        let resourceRoot = entry.resourceRoot;
        const idKeyword = dialect === "draft4" ? "id" : "$id";
        const schemaId = entry.node[idKeyword];
        if (
          typeof schemaId === "string" &&
          (this.isModernDialect(dialect) ||
            !("$ref" in entry.node) ||
            (entry.root && rootIdBesideRef))
        ) {
          baseUri = this.resolveUri(schemaId, entry.inheritedBase, idKeyword);
          if (this.isModernDialect(dialect) && schemaId.includes("#")) {
            const error = new ValidationError(
              `Invalid $id URI for ${dialect}: ${schemaId}`
            );
            error.code = "INVALID_SCHEMA_ID";
            error.keyword = idKeyword;
            throw error;
          }
          register(baseUri, entry.node);
          if (baseUri.indexOf("#") === -1 || baseUri.endsWith("#")) {
            resourceRoot = entry.node;
            register(this.resourceUri(baseUri), entry.node);
          }
        }

        const registerAnchor = (
          anchor: string,
          keyword: "$anchor" | "$dynamicAnchor"
        ) => {
          const resourceIdentities = new Set([this.resourceUri(baseUri)]);
          for (const [identity, target] of aliases) {
            if (target === resourceRoot && !identity.includes("#")) {
              resourceIdentities.add(identity);
            }
          }
          for (const identity of resourceIdentities) {
            register(
              `${identity}#${anchor}`,
              entry.node,
              "DUPLICATE_ANCHOR",
              keyword
            );
          }
        };

        if (
          (dialect === "2019-09" || dialect === "2020-12") &&
          hasOwn(entry.node, "$anchor")
        ) {
          registerAnchor(
            this.validateAnchor(entry.node.$anchor, dialect, "$anchor"),
            "$anchor"
          );
        }
        if (dialect === "2020-12" && hasOwn(entry.node, "$dynamicAnchor")) {
          registerAnchor(
            this.validateAnchor(
              entry.node.$dynamicAnchor,
              dialect,
              "$dynamicAnchor"
            ),
            "$dynamicAnchor"
          );
        }

        const position = {
          source: entry.node,
          baseUri,
          resourceRoot,
          pointer: entry.pointer,
          dialect,
          environment
        };
        positions.push(position);
        positionsByNode.set(entry.node, position);

        const children = this.registrySubschemaEntries(
          entry.node,
          dialect,
          environment
        );
        for (let index = children.length - 1; index >= 0; index--) {
          const child = children[index];
          if (Array.isArray(child.value)) {
            continue;
          }
          stack.push({
            node: child.value as Record<string, any>,
            inheritedBase: baseUri,
            resourceRoot,
            pointer: `${entry.pointer}${child.pointer}`,
            environment,
            root: false
          });
        }
      }

      indexed.add(root);
    };

    indexResource(schema, LOCAL_SCHEMA_BASE, this.defaultEnvironment("legacy"));

    const ensureIndexed = (
      target: JSONSchema,
      environment: SchemaEnvironment
    ) => {
      if (target === true || target === false) {
        return;
      }
      const registration = registrationsByRoot.get(target);
      if (registration) {
        indexResource(
          target,
          registration.baseUri,
          environment,
          registration.rootIdBesideRef
        );
      }
    };
    const resolveRegisteredIdentity = (
      uri: string,
      environment: SchemaEnvironment
    ) => {
      const candidates = registrationsByNestedIdentity.get(uri) || [];
      for (const registration of candidates) {
        ensureIndexed(registration.schema, environment);
      }
    };
    const ensurePointerPosition = (
      target: JSONSchema,
      resourceRoot: Record<string, any>,
      pointer: string
    ) => {
      if (
        target === true ||
        target === false ||
        Array.isArray(target) ||
        positionsByNode.has(target)
      ) {
        return;
      }
      const resourcePosition = positionsByNode.get(resourceRoot);
      if (!resourcePosition) {
        return;
      }
      indexResource(
        target,
        resourcePosition.baseUri,
        resourcePosition.environment,
        false,
        resourceRoot,
        pointer
      );
    };

    return Object.freeze({
      aliases: aliases as ReadonlyMap<string, JSONSchema>,
      positions,
      positionsByNode,
      ensureIndexed,
      ensurePointerPosition,
      resolveRegisteredIdentity
    });
  }

  private resolveReferenceSource(
    ref: string,
    position: SchemaPosition,
    registry: ReferenceRegistry
  ): any {
    const resolvedUri = this.resolveUri(ref, position.baseUri, "$ref");
    if (!registry.aliases.has(resolvedUri)) {
      registry.resolveRegisteredIdentity(resolvedUri, position.environment);
    }
    if (registry.aliases.has(resolvedUri)) {
      const target = registry.aliases.get(resolvedUri)!;
      registry.ensureIndexed(target, position.environment);
      return target;
    }

    const resourceIdentity = this.resourceUri(resolvedUri);
    if (!registry.aliases.has(resourceIdentity)) {
      registry.resolveRegisteredIdentity(resourceIdentity, position.environment);
    }
    if (!registry.aliases.has(resourceIdentity)) {
      return;
    }
    const resourceRoot = registry.aliases.get(resourceIdentity)!;
    registry.ensureIndexed(resourceRoot, position.environment);
    if (registry.aliases.has(resolvedUri)) {
      return registry.aliases.get(resolvedUri)!;
    }

    const hashIndex = resolvedUri.indexOf("#");
    const fragment = hashIndex === -1 ? "" : resolvedUri.slice(hashIndex + 1);
    if (fragment.length === 0) {
      return resourceRoot;
    }
    if (
      fragment.startsWith("/") &&
      resourceRoot !== true &&
      resourceRoot !== false
    ) {
      try {
        const target = resolvePath(resourceRoot, `#${fragment}`);
        registry.ensurePointerPosition(target, resourceRoot, `#${fragment}`);
        return target;
      } catch {
        const error = new ValidationError(`Reference not found: ${ref}`);
        error.code = "REFERENCE_NOT_FOUND";
        error.keyword = "$ref";
        throw error;
      }
    }

    return;
  }

  private builtinReferences(
    schema: Record<string, any>,
    position: SchemaPosition
  ): Array<{
    keyword: "$ref" | "$recursiveRef" | "$dynamicRef";
    ref: string;
  }> {
    const references: Array<{
      keyword: "$ref" | "$recursiveRef" | "$dynamicRef";
      ref: string;
    }> = [];
    if (
      typeof schema.$ref === "string" &&
      this.getKeyword("$ref") === keywords.$ref
    ) {
      references.push({ keyword: "$ref", ref: schema.$ref });
    }
    if (
      position.dialect === "2019-09" &&
      typeof schema.$recursiveRef === "string"
    ) {
      references.push({ keyword: "$recursiveRef", ref: schema.$recursiveRef });
    }
    if (
      position.dialect === "2020-12" &&
      typeof schema.$dynamicRef === "string"
    ) {
      references.push({ keyword: "$dynamicRef", ref: schema.$dynamicRef });
    }
    return references;
  }

  private analyzeSchema(
    schema: any,
    registry: ReferenceRegistry
  ): SchemaAnalysis {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return {
        requiresDepthGuard: false,
        requiresMutationJournal: false,
        requiresDynamicScope: false,
        requiresEvaluatedTracking: false,
        mutableSchemas: new WeakSet(),
        reachableSchemas: [schema]
      };
    }

    const visiting = new WeakSet<object>();
    const visited = new WeakSet<object>();
    const queuedRoots = new WeakSet<object>();
    const roots: JSONSchema[] = [schema];
    queuedRoots.add(schema);
    const reachableSchemas: JSONSchema[] = [];
    let requiresDepthGuard = false;
    let requiresMutationJournal = false;
    let requiresDynamicScope = false;
    let requiresEvaluatedTracking = false;
    const allNodes: Record<string, any>[] = [];

    for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
      const root = roots[rootIndex];
      if (root === true || root === false) {
        reachableSchemas.push(root);
        continue;
      }
      if (!root || typeof root !== "object" || visited.has(root)) {
        continue;
      }
      const stack: Array<{
        value: Record<string, any>;
        depth: number;
        exit: boolean;
      }> = [{ value: root, depth: 0, exit: false }];
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
          const error = new ValidationError(
            "Cyclic schema graph is not supported"
          );
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
        reachableSchemas.push(entry.value);
        allNodes.push(entry.value);
        stack.push({ ...entry, exit: true });

        const position = registry.positionsByNode.get(entry.value);
        const environment =
          position?.environment || this.defaultEnvironment("legacy");
        if (
          this.useDefaults !== false &&
          this.isKeywordActive("properties", environment) &&
          this.hasPropertyDefaults(entry.value)
        ) {
          requiresMutationJournal = true;
        }

        if (
          position &&
          this.isModernDialect(position.dialect) &&
          ((hasOwn(entry.value, "unevaluatedItems") &&
            this.isKeywordActive("unevaluatedItems", environment)) ||
            (hasOwn(entry.value, "unevaluatedProperties") &&
              this.isKeywordActive("unevaluatedProperties", environment)))
        ) {
          requiresEvaluatedTracking = true;
        }
        if (
          (position?.dialect === "2019-09" &&
            typeof entry.value.$recursiveRef === "string") ||
          (position?.dialect === "2020-12" &&
            typeof entry.value.$dynamicRef === "string")
        ) {
          requiresDepthGuard = true;
          requiresDynamicScope = true;
        }

        for (const key of Object.keys(entry.value)) {
          const keyword = this.getKeyword(key);
          if (keyword && keyword !== keywords[key]) {
            requiresDepthGuard = true;
            requiresMutationJournal = true;
          }
        }

        const children = this.schemaChildren(
          entry.value,
          position?.dialect,
          position?.environment
        );
        for (let index = children.length - 1; index >= 0; index--) {
          stack.push({
            value: children[index] as Record<string, any>,
            depth: entry.depth + 1,
            exit: false
          });
        }

        if (position) {
          for (const reference of this.builtinReferences(entry.value, position)) {
            const target = this.resolveReferenceSource(
              reference.ref,
              position,
              registry
            );
            if (typeof target === "undefined") {
              const error = new ValidationError(
                `Reference not found: ${reference.ref}`
              );
              error.code = "REFERENCE_NOT_FOUND";
              error.keyword = reference.keyword;
              throw error;
            }
            if (target === true || target === false) {
              roots.push(target);
            } else if (!queuedRoots.has(target)) {
              queuedRoots.add(target);
              roots.push(target);
            }
          }
        }
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
      const position = registry.positionsByNode.get(entry.value);
      const children = this.schemaChildren(
        entry.value,
        position?.dialect,
        position?.environment
      );
      if (position) {
        for (const reference of this.builtinReferences(entry.value, position)) {
          const target = this.resolveReferenceSource(
            reference.ref,
            position,
            registry
          );
          if (target && typeof target === "object") {
            children.push(target);
          }
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
      for (const node of allNodes) {
        mutableSchemas.add(node);
      }
    }

    return {
      requiresDepthGuard,
      requiresMutationJournal,
      requiresDynamicScope,
      requiresEvaluatedTracking,
      mutableSchemas,
      reachableSchemas
    };
  }

  validateSchema(schema: any): ValidationResult {
    if (!this.isJsonSchema(schema)) {
      const error = this.schemaRegistrationError(
        "Invalid schema",
        "INVALID_SCHEMA",
        "schema"
      );
      return { data: schema, error, valid: false };
    }
    if (schema === true || schema === false) {
      return { data: schema, error: null, valid: true };
    }
    if (!hasOwn(schema, "$schema")) {
      if (!this.isSchemaLike(schema)) {
        const error = this.schemaRegistrationError(
          "Invalid schema",
          "INVALID_SCHEMA",
          "schema"
        );
        return { data: schema, error, valid: false };
      }
      return { data: schema, error: null, valid: true };
    }
    if (typeof schema.$schema !== "string") {
      throw this.unknownMetaschemaError(String(schema.$schema));
    }

    let metaschemaUri: string;
    try {
      metaschemaUri = new URL(schema.$schema).href;
    } catch {
      throw this.unknownMetaschemaError(schema.$schema);
    }
    return this.validateSchemaWithMetaSchema(schema, metaschemaUri);
  }

  private validateSchemaWithMetaSchema(
    schema: any,
    metaschemaUri: string
  ): ValidationResult {
    const validator = this.getMetaSchemaValidator(metaschemaUri);
    if (!validator) {
      throw this.unknownMetaschemaError(metaschemaUri);
    }
    return validator(schema);
  }

  private getMetaSchemaValidator(uri: string): Validator | null {
    const builtin = BUILTIN_META_SCHEMA_BY_URI.get(uri);
    if (builtin) {
      const cacheKey = `${this.formatMode}:${uri}`;
      const cached = SchemaShield.builtinMetaValidators.get(cacheKey);
      if (cached) {
        return cached;
      }
      const ownerOptions: { failFast: boolean; format?: boolean } = {
        failFast: false
      };
      if (this.formatMode === "enabled") {
        ownerOptions.format = true;
      } else if (this.formatMode === "disabled") {
        ownerOptions.format = false;
      }
      const owner = new SchemaShield(ownerOptions);
      const validator = owner.compile(
        { $ref: builtin.uri },
        { validateSchema: false }
      );
      SchemaShield.builtinMetaValidators.set(cacheKey, validator);
      return validator;
    }

    const registration = this.registeredSchemaIds.get(uri);
    if (!registration?.metaSchema) {
      return null;
    }
    const cached = this.customMetaValidators.get(uri);
    if (cached) {
      return cached;
    }
    const validator = this.compile(
      { $ref: uri },
      { validateSchema: false }
    );
    this.customMetaValidators.set(uri, validator);
    return validator;
  }

  private invalidSchemaError(error: ValidationError | null | true) {
    if (error instanceof ValidationError) {
      error.code = "INVALID_SCHEMA";
      return error;
    }
    return this.schemaRegistrationError(
      "Invalid schema",
      "INVALID_SCHEMA",
      "schema"
    );
  }

  private unknownMetaschemaError(uri: string) {
    const error = new ValidationError(`Unknown metaschema: ${uri}`);
    error.code = "UNKNOWN_METASCHEMA";
    error.keyword = "$schema";
    return error;
  }

  compile(schema: any, options: CompileOptions = {}): Validator {
    if (!this.isJsonObject(options)) {
      throw this.schemaRegistrationError(
        "compile options must be an object",
        "INVALID_COMPILE_OPTIONS",
        "compile"
      );
    }
    const validateSchema = hasOwn(options, "validateSchema")
      ? options.validateSchema
      : true;
    if (validateSchema !== true && validateSchema !== false) {
      throw this.schemaRegistrationError(
        "validateSchema must be a boolean",
        "INVALID_COMPILE_OPTIONS",
        "validateSchema"
      );
    }
    const prepared = this.prepareSchema(schema, validateSchema);
    const compiledSchema = prepared.compiledSchema;
    if (
      !prepared.requiresDepthGuard &&
      !prepared.requiresMutationJournal &&
      !prepared.requiresEvaluatedTracking
    ) {
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

  private prepareSchema(schema: any, validateSchema: boolean) {
    this.compilingSchemaChildren = new WeakMap();
    const referenceRegistry = this.buildReferenceRegistry(schema);
    const analysis = this.analyzeSchema(schema, referenceRegistry);
    if (validateSchema) {
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        const validation = this.validateSchema(schema);
        if (!validation.valid) {
          throw this.invalidSchemaError(validation.error);
        }
      } else {
        const validatedResources = new WeakSet<object>();
        for (const position of referenceRegistry.positions) {
          if (
            position.source !== position.resourceRoot ||
            validatedResources.has(position.resourceRoot)
          ) {
            continue;
          }
          validatedResources.add(position.resourceRoot);
          const validation = position.environment.metaschemaUri
            ? this.validateSchemaWithMetaSchema(
                position.resourceRoot,
                position.environment.metaschemaUri
              )
            : this.validateSchema(position.resourceRoot);
          if (!validation.valid) {
            throw this.invalidSchemaError(validation.error);
          }
        }
      }
    }
    const reachableSchemas = analysis.reachableSchemas;
    this.compileCache = new WeakMap();
    this.compilingRequiresContext =
      analysis.requiresDepthGuard ||
      analysis.requiresMutationJournal ||
      analysis.requiresDynamicScope ||
      analysis.requiresEvaluatedTracking;
    this.compilingValidateSubschema = this.compilingRequiresContext
      ? this.validateSubschema.bind(this)
      : undefined;
    if (this.compilingValidateSubschema) {
      this.compilingValidateSubschema.savepoint = () => this.#defaultSavepoint();
      this.compilingValidateSubschema.rollback = (savepoint: number) =>
        this.#rollbackDefaultSavepoint(savepoint);
      this.compilingValidateSubschema.tracksEvaluated =
        analysis.requiresEvaluatedTracking;
    }
    this.compilingMutableSchemas = analysis.mutableSchemas;
    this.compilingEvaluatedTracking = analysis.requiresEvaluatedTracking;
    this.compilingDialects = new WeakMap();
    this.compilingEnvironments = new WeakMap();
    for (const position of referenceRegistry.positions) {
      this.compilingDialects.set(position.source, position.dialect);
      this.compilingEnvironments.set(position.source, position.environment);
    }
    const compiledSchema = this.compileSchema(schema);
    for (const reachableSchema of reachableSchemas) {
      if (reachableSchema !== schema) {
        this.compileSchema(reachableSchema);
      }
    }
    this.rootSchema = compiledSchema;

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

    const evaluationResources = analysis.requiresDynamicScope
      ? this.installEvaluationResourceScopes(referenceRegistry)
      : null;

    const compiledRoots: CompiledSchema[] = [compiledSchema];
    if (analysis.requiresDepthGuard || analysis.requiresEvaluatedTracking) {
      for (const reachableSchema of reachableSchemas) {
        if (
          reachableSchema !== true &&
          reachableSchema !== false &&
          reachableSchema !== schema
        ) {
          const compiledReachable = this.compileCache.get(reachableSchema);
          if (compiledReachable) {
            compiledRoots.push(compiledReachable);
          }
        }
      }
    }

    if (analysis.requiresEvaluatedTracking) {
      this.installEvaluationTracking(compiledRoots);
    }

    let depthGuardState: DepthGuardState | null = null;
    if (analysis.requiresDepthGuard) {
      depthGuardState = this.installDepthGuards(compiledRoots);
      definePropertyOrThrow(compiledSchema, "_requiresDepthGuard", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (
      analysis.requiresMutationJournal ||
      analysis.requiresEvaluatedTracking
    ) {
      depthGuardState = { context: null };
    }

    if ((compiledSchema as any)._hasRef === true) {
      this.linkReferences(referenceRegistry, evaluationResources);
    }

    return {
      compiledSchema,
      requiresDepthGuard: analysis.requiresDepthGuard,
      requiresMutationJournal: analysis.requiresMutationJournal,
      requiresEvaluatedTracking: analysis.requiresEvaluatedTracking,
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
      defaults: [],
      resources: [],
      evaluations: []
    };
    const validate = ((data: any) => {
      this.rootSchema = compiledSchema;
      const context = reusableContext.active
        ? {
            active: false,
            depth: -1,
            depthExceeded: false,
            defaults: [],
            resources: [],
            evaluations: []
          }
        : reusableContext;
      context.active = true;
      context.depth = -1;
      context.depthExceeded = false;
      delete context.depthError;
      context.defaults.length = 0;
      context.resources.length = 0;
      context.evaluations.length = 0;
      delete context.completedEvaluation;
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

    definePropertyOrThrow(schema, "_hasRef", {
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
        return value === true;
      case "items":
        return value === true && !this.compilingEvaluatedTracking;
      case "additionalProperties":
        if (value === true && !this.compilingEvaluatedTracking) {
          return true;
        }

        return (
          value === false &&
          this.isPlainObject(schema.patternProperties) &&
          Object.keys(schema.patternProperties).length > 0
        );
      case "additionalItems":
        return (
          (value === true && !this.compilingEvaluatedTracking) ||
          !Array.isArray(schema.items)
        );
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

        if (this.compilingEvaluatedTracking) {
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

  private hasPropertyDefaults(schema: Record<string, any>): boolean {
    const properties = schema.properties;
    if (!this.isPlainObject(properties)) {
      return false;
    }

    const propertyKeys = Object.keys(properties);
    for (let i = 0; i < propertyKeys.length; i++) {
      const subSchema = properties[propertyKeys[i]];
      if (
        this.isPlainObject(subSchema) &&
        hasOwn(subSchema, "default")
      ) {
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
      if (entry.descriptor) {
        definePropertyOrThrow(entry.target, entry.key, entry.descriptor);
      } else {
        delete entry.target[entry.key];
      }
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

  private validateSubschema(
    schema: CompiledSchema | boolean,
    data: any,
    evaluated?: {
      property?: string;
      item?: number;
      unevaluated?: boolean;
      discardAnnotations?: boolean;
    }
  ): Result {
    const context = this.validationContexts[this.validationContexts.length - 1];
    const parentEvaluation = context?.evaluations[context.evaluations.length - 1];
    if (
      evaluated?.unevaluated === true &&
      ((typeof evaluated.property === "string" &&
        parentEvaluation?.properties?.has(evaluated.property)) ||
        (typeof evaluated.item === "number" &&
          parentEvaluation?.items?.has(evaluated.item)))
    ) {
      return;
    }
    if (schema === true) {
      this.markEvaluated(parentEvaluation, evaluated);
      return;
    }
    if (schema === false) {
      return true;
    }
    if (!schema || typeof schema.$validate !== "function") {
      return;
    }
    const savepoint = context?.defaults.length || 0;
    if (context) {
      delete context.completedEvaluation;
    }
    try {
      const error = schema.$validate(data);
      if (error && context) {
        this.rollbackDefaults(context, savepoint);
      }
      if (!error && evaluated?.discardAnnotations !== true) {
        this.markEvaluated(parentEvaluation, evaluated);
        if (
          typeof evaluated?.property !== "string" &&
          typeof evaluated?.item !== "number"
        ) {
          this.mergeCompletedEvaluation(parentEvaluation, data, context);
        }
      }
      if (evaluated?.discardAnnotations === true && context) {
        delete context.completedEvaluation;
      }
      return error;
    } catch (error) {
      if (context) {
        this.rollbackDefaults(context, savepoint);
      }
      throw error;
    }
  }

  private markEvaluated(
    state: EvaluatedState | undefined,
    evaluated?: { property?: string; item?: number; unevaluated?: boolean }
  ) {
    if (!state || !evaluated) {
      return;
    }
    if (typeof evaluated.property === "string") {
      if (!state.properties) {
        state.properties = new Set<string>();
      }
      state.properties.add(evaluated.property);
    }
    if (typeof evaluated.item === "number") {
      if (!state.items) {
        state.items = new Set<number>();
      }
      state.items.add(evaluated.item);
    }
  }

  private mergeCompletedEvaluation(
    parent: EvaluatedState | undefined,
    data: any,
    context: ValidationContext | undefined
  ) {
    const completed = context?.completedEvaluation;
    if (!parent || !completed || completed === parent || completed.data !== data) {
      return;
    }
    if (completed.properties) {
      if (!parent.properties) {
        parent.properties = new Set<string>();
      }
      for (const key of completed.properties) {
        parent.properties.add(key);
      }
    }
    if (completed.items) {
      if (!parent.items) {
        parent.items = new Set<number>();
      }
      for (const index of completed.items) {
        parent.items.add(index);
      }
    }
  }

  private mergeReferenceEvaluation(data: any) {
    const context = this.validationContexts[this.validationContexts.length - 1];
    const parent = context?.evaluations[context.evaluations.length - 1];
    this.mergeCompletedEvaluation(parent, data, context);
  }

  private installEvaluationTracking(roots: CompiledSchema[]) {
    const stack = roots.slice();
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
          const context = this.validationContexts[this.validationContexts.length - 1];
          if (!context) {
            return directValidate(data);
          }
          const state: EvaluatedState = { data };
          context.evaluations.push(state);
          try {
            const error = directValidate(data);
            if (error) {
              delete context.completedEvaluation;
            } else {
              context.completedEvaluation = state;
            }
            return error;
          } catch (error) {
            delete context.completedEvaluation;
            throw error;
          } finally {
            context.evaluations.pop();
          }
        });
      }
      for (const child of this.schemaChildren(schema)) {
        stack.push(child as CompiledSchema);
      }
    }
  }

  private installDepthGuards(roots: CompiledSchema[]): DepthGuardState {
    const state: DepthGuardState = { context: null };
    const stack: CompiledSchema[] = roots.slice();
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
      definePropertyOrThrow(compiledSchema, "_canApplyDefaults", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    const validateSubschema = this.compilingValidateSubschema;

    let schemaHasRef = false;
    const validators: ValidatorItem[] = [];
    const activeNames: string[] = [];
    const pendingCombinators: PendingCombinator[] = [];
    const dialect = sourceSchema
      ? this.compilingDialects.get(sourceSchema) || "legacy"
      : "legacy";
    const environment = sourceSchema
      ? this.compilingEnvironments.get(sourceSchema) ||
        this.defaultEnvironment(dialect)
      : this.defaultEnvironment("legacy");
    if (
      environment.formatAssertionRequired &&
      this.formatMode === "disabled"
    ) {
      const error = new ValidationError(
        "format cannot be false for a format-assertion dialect"
      );
      error.code = "FORMAT_ASSERTION_REQUIRED";
      error.keyword = "format";
      throw error;
    }
    if (
      environment.formatAssertionRequired &&
      typeof schema.format === "string" &&
      !this.getFormat(schema.format)
    ) {
      const error = new ValidationError(`Unknown format: ${schema.format}`);
      error.code = "UNKNOWN_FORMAT";
      error.keyword = "format";
      throw error;
    }
    definePropertyOrThrow(compiledSchema, "_dialect", {
      value: dialect,
      enumerable: false,
      configurable: false,
      writable: false
    });

    const dynamicKeywords: Array<{
      keyword: "$recursiveRef" | "$dynamicRef";
      active: boolean;
      method: "_resolvedRecursiveRef" | "_resolvedDynamicRef";
      name: string;
    }> = [
      {
        keyword: "$recursiveRef",
        active:
          dialect === "2019-09" && typeof schema.$recursiveRef === "string",
        method: "_resolvedRecursiveRef",
        name: "Validate_Recursive_Reference"
      },
      {
        keyword: "$dynamicRef",
        active: dialect === "2020-12" && typeof schema.$dynamicRef === "string",
        method: "_resolvedDynamicRef",
        name: "Validate_Dynamic_Reference"
      }
    ];
    for (const reference of dynamicKeywords) {
      if (!reference.active) {
        continue;
      }
      schemaHasRef = true;
      const defineError = getDefinedErrorFunctionForKey(
        reference.keyword,
        schema[reference.keyword],
        this.failFast
      );
      validators.push({
        name: reference.name,
        validate: getNamedFunction<ValidateFunction>(reference.name, (data) => {
          const resolved = (compiledSchema as any)[reference.method];
          if (typeof resolved !== "function") {
            return defineError(`Missing reference: ${schema[reference.keyword]}`);
          }
          const error = resolved(data);
          if (!error) {
            this.mergeReferenceEvaluation(data);
          }
          return error;
        })
      });
      activeNames.push(reference.name);
    }

    if ("$ref" in schema) {
      schemaHasRef = true;
      const refValidator = this.getKeyword("$ref");
      const ignoresReferenceSiblings =
        refValidator === keywords.$ref &&
        (dialect === "draft4" ||
          dialect === "draft6" ||
          dialect === "draft7");
      if (refValidator) {
        const defineError = getDefinedErrorFunctionForKey(
          "$ref",
          schema["$ref"],
          this.failFast
        );

        const isBuiltinRef = refValidator === keywords.$ref;
        const refName = isBuiltinRef
          ? "Validate_Reference"
          : refValidator.name || "$ref";
        const refValidate = getNamedFunction<ValidateFunction>(
          refName,
          (data) => {
            const error = (refValidator as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this,
              validateSubschema
            );
            if (!error && isBuiltinRef) {
              this.mergeReferenceEvaluation(data);
            }
            return error;
          }
        );
        if (isBuiltinRef && this.isModernDialect(dialect)) {
          validators.push({ name: refName, validate: refValidate });
          activeNames.push(refName);
        } else {
          compiledSchema.$validate = refValidate;
          if (!isBuiltinRef) {
            schemaHasRef = false;
          }
        }
      }

      if (validators.length === 0) {
        if (!ignoresReferenceSiblings) {
          for (const key of ["definitions", "$defs"]) {
            if (!this.isKeywordActive(key, environment)) {
              continue;
            }
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
        }
        if (schemaHasRef) {
          this.markSchemaHasRef(compiledSchema);
        }
        return compiledSchema;
      }
    }

    if (
      this.useDefaults !== false &&
      this.isKeywordActive("properties", environment) &&
      this.getKeyword("properties") === keywords.properties &&
      this.hasPropertyDefaults(schema)
    ) {
      const applyDefaults =
        this.useDefaults === "empty"
          ? applyEmptyPropertyDefaults
          : applyPropertyDefaults;
      validators.push({
        name: applyDefaults.name,
        validate: getNamedFunction<ValidateFunction>(
          applyDefaults.name,
          (data) => applyDefaults(compiledSchema, data, this)
        )
      });
      activeNames.push(applyDefaults.name);
    }

    if ("type" in schema && this.isKeywordActive("type", environment)) {
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

    const {
      type,
      $id,
      $ref,
      $recursiveRef,
      $dynamicRef,
      $validate,
      required,
      ...otherKeys
    } = schema; // Exclude handled keys

    const otherKeyNames = Object.keys(otherKeys);
    const unevaluatedKeys = otherKeyNames.filter(
      (key) => key === "unevaluatedItems" || key === "unevaluatedProperties"
    );
    const siblingKeys = otherKeyNames.filter(
      (key) => key !== "unevaluatedItems" && key !== "unevaluatedProperties"
    );
    const keyOrder = required
      ? ["required", ...siblingKeys, ...unevaluatedKeys]
      : [...siblingKeys, ...unevaluatedKeys];

    for (const key of keyOrder) {
      if (!this.isKeywordActive(key, environment)) {
        continue;
      }
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
      if (!this.isKeywordActive(key, environment)) {
        continue;
      }
      if (literalKeywords.includes(key)) {
        continue;
      }

      if (
        schema[key] &&
        typeof schema[key] === "object" &&
        !Array.isArray(schema[key])
      ) {
        if (
          key === "properties" ||
          key === "patternProperties" ||
          key === "definitions" ||
          key === "$defs" ||
          key === "dependentSchemas"
        ) {
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

    if (
      this.isKeywordActive("properties", environment) &&
      this.isPlainObject(schema.properties)
    ) {
      definePropertyOrThrow(compiledSchema, "_propKeys", {
        value: Object.keys(schema.properties),
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (
      this.useDefaults !== false &&
      this.isKeywordActive("properties", environment) &&
      this.isPlainObject(schema.properties) &&
      this.hasPropertyDefaults(schema)
    ) {
      const defaultKeys = Object.keys(schema.properties).filter(
        (key: string) => {
          const property = schema.properties[key];
          return (
            property &&
            typeof property === "object" &&
            !Array.isArray(property) &&
            hasOwn(property, "default")
          );
        }
      );
      if (defaultKeys.length > 0) {
        definePropertyOrThrow(compiledSchema, "_defaultKeys", {
          value: defaultKeys,
          enumerable: false,
          configurable: false,
          writable: false
        });
      }
    }

    prepareCombinatorEntries(compiledSchema);

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
    for (let index = 0; index < pendingCombinators.length; index++) {
      const pending = pendingCombinators[index];
      pending.item.validate = getNamedFunction(
        pending.item.name,
        createCombinatorValidator(
          pending.key,
          compiledSchema,
          pending.defineError,
          validateSubschema,
          transactions,
          this.compilingEvaluatedTracking
        )
      );
    }

    if (schemaHasRef) {
      this.markSchemaHasRef(compiledSchema);
    }

    if (validators.length === 0) {
      if (this.compilingEvaluatedTracking) {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      }
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

  private getCompiledReferenceTarget(
    ref: string,
    position: SchemaPosition,
    registry: ReferenceRegistry
  ): CompiledSchema | boolean | undefined {
    const target = this.resolveReferenceSource(ref, position, registry);
    if (target === true || target === false) {
      return target;
    }
    if (target && typeof target === "object") {
      return this.compileCache.get(target);
    }
    return;
  }

  private installEvaluationResourceScopes(
    registry: ReferenceRegistry
  ): WeakMap<object, EvaluationResource> {
    const resources = new Map<
      Record<string, any>,
      {
        compiledRoot: CompiledSchema;
        dynamicAnchors: Map<string, CompiledSchema>;
        recursiveAnchor: boolean;
      }
    >();

    for (const position of registry.positions) {
      if (!this.compileCache.has(position.source)) {
        continue;
      }
      if (!resources.has(position.resourceRoot)) {
        const rootPosition = registry.positionsByNode.get(position.resourceRoot);
        const compiledRoot = this.compileCache.get(position.resourceRoot);
        if (!compiledRoot) {
          continue;
        }
        resources.set(position.resourceRoot, {
          compiledRoot,
          dynamicAnchors: new Map(),
          recursiveAnchor:
            rootPosition?.dialect === "2019-09" &&
            position.resourceRoot.$recursiveAnchor === true
        });
      }
    }

    for (const position of registry.positions) {
      const compiled = this.compileCache.get(position.source);
      const resource = resources.get(position.resourceRoot);
      if (!compiled || !resource) {
        continue;
      }
      if (typeof compiled.$validate !== "function") {
        compiled.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      }
      if (
        position.dialect === "2020-12" &&
        typeof position.source.$dynamicAnchor === "string"
      ) {
        resource.dynamicAnchors.set(position.source.$dynamicAnchor, compiled);
      }
    }

    const resourcesByRoot = new WeakMap<object, EvaluationResource>();
    for (const [root, resource] of resources) {
      resourcesByRoot.set(root, resource);
    }

    const wrapped = new WeakSet<object>();
    for (const position of registry.positions) {
      const compiled = this.compileCache.get(position.source);
      const resource = resources.get(position.resourceRoot);
      if (!compiled || !resource || wrapped.has(compiled)) {
        continue;
      }
      wrapped.add(compiled);
      const directValidate = compiled.$validate!;
      compiled.$validate = getNamedFunction(directValidate.name, (data: any) => {
        const context = this.validationContexts[this.validationContexts.length - 1];
        if (!context || context.resources[context.resources.length - 1] === resource) {
          return directValidate(data);
        }
        context.resources.push(resource);
        try {
          return directValidate(data);
        } finally {
          context.resources.pop();
        }
      });
    }

    return resourcesByRoot;
  }

  private referenceValidator(
    target: CompiledSchema | boolean,
    node: CompiledSchema,
    keyword: "$ref" | "$recursiveRef" | "$dynamicRef"
  ): ValidateFunction {
    if (target === true) {
      return getNamedFunction("Validate_Ref_True", () => {});
    }
    if (target === false) {
      const defineError = getDefinedErrorFunctionForKey(
        keyword,
        node,
        this.failFast
      );
      return getNamedFunction("Validate_Ref_False", (data: any) =>
        defineError("Value is not valid", { data })
      );
    }
    if (typeof target.$validate !== "function") {
      target.$validate = getNamedFunction<ValidateFunction>(
        "Validate_Ref_Any",
        () => {}
      );
    }
    return target.$validate;
  }

  private linkReferences(
    registry: ReferenceRegistry,
    resources: WeakMap<object, EvaluationResource> | null
  ) {
    for (let index = 0; index < registry.positions.length; index++) {
      const position = registry.positions[index];
      if (
        typeof position.source.$ref !== "string" ||
        this.getKeyword("$ref") !== keywords.$ref
      ) {
        continue;
      }

      const node = this.compileCache.get(position.source);
      if (!node) {
        continue;
      }
      const target = this.getCompiledReferenceTarget(
        position.source.$ref,
        position,
        registry
      );
      if (typeof target === "undefined") {
        const error = new ValidationError(
          `Reference not found: ${position.source.$ref}`
        );
        error.code = "REFERENCE_NOT_FOUND";
        error.keyword = "$ref";
        throw error;
      }

      definePropertyOrThrow(node, "_resolvedRef", {
        value: this.referenceValidator(target, node, "$ref"),
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (!resources) {
      return;
    }

    for (let index = 0; index < registry.positions.length; index++) {
      const position = registry.positions[index];
      const references = this.builtinReferences(position.source, position);
      for (const reference of references) {
        if (reference.keyword === "$ref") {
          continue;
        }
        const node = this.compileCache.get(position.source);
        if (!node) {
          continue;
        }
        const targetSource = this.resolveReferenceSource(
          reference.ref,
          position,
          registry
        );
        if (typeof targetSource === "undefined") {
          const error = new ValidationError(
            `Reference not found: ${reference.ref}`
          );
          error.code = "REFERENCE_NOT_FOUND";
          error.keyword = reference.keyword;
          throw error;
        }
        const staticTarget = this.getCompiledReferenceTarget(
          reference.ref,
          position,
          registry
        );
        if (typeof staticTarget === "undefined") {
          const error = new ValidationError(
            `Reference not found: ${reference.ref}`
          );
          error.code = "REFERENCE_NOT_FOUND";
          error.keyword = reference.keyword;
          throw error;
        }
        const staticValidate = this.referenceValidator(
          staticTarget,
          node,
          reference.keyword
        );
        const targetPosition =
          targetSource && typeof targetSource === "object"
            ? registry.positionsByNode.get(targetSource)
            : undefined;

        let targetValidate = staticValidate;
        if (reference.keyword === "$recursiveRef") {
          const dynamicEligible =
            targetPosition?.resourceRoot === targetSource &&
            targetPosition.resourceRoot.$recursiveAnchor === true;
          if (dynamicEligible) {
            targetValidate = (data: any) => {
              const context =
                this.validationContexts[this.validationContexts.length - 1];
              if (context) {
                for (
                  let scopeIndex = 0;
                  scopeIndex < context.resources.length;
                  scopeIndex++
                ) {
                  const resource = context.resources[scopeIndex];
                  if (!resource.recursiveAnchor) {
                    continue;
                  }
                  if (typeof resource.compiledRoot.$validate === "function") {
                    return resource.compiledRoot.$validate(data);
                  }
                }
              }
              return staticValidate(data);
            };
          }
        } else {
          const resolvedUri = this.resolveUri(
            reference.ref,
            position.baseUri,
            "$ref"
          );
          const hashIndex = resolvedUri.indexOf("#");
          const rawFragment =
            hashIndex === -1 ? "" : resolvedUri.slice(hashIndex + 1);
          let anchor = "";
          if (rawFragment.length > 0 && !rawFragment.startsWith("/")) {
            try {
              anchor = decodeURIComponent(rawFragment);
            } catch {
              anchor = "";
            }
          }
          const dynamicEligible =
            anchor.length > 0 &&
            targetPosition?.dialect === "2020-12" &&
            targetSource.$dynamicAnchor === anchor;
          if (dynamicEligible) {
            targetValidate = (data: any) => {
              const context =
                this.validationContexts[this.validationContexts.length - 1];
              if (context) {
                for (
                  let scopeIndex = 0;
                  scopeIndex < context.resources.length;
                  scopeIndex++
                ) {
                  const target = context.resources[scopeIndex].dynamicAnchors.get(
                    anchor
                  );
                  if (target && typeof target.$validate === "function") {
                    return target.$validate(data);
                  }
                }
              }
              return staticValidate(data);
            };
          }
        }

        definePropertyOrThrow(
          node,
          reference.keyword === "$recursiveRef"
            ? "_resolvedRecursiveRef"
            : "_resolvedDynamicRef",
          {
            value: targetValidate,
            enumerable: false,
            configurable: false,
            writable: false
          }
        );
      }
    }
  }
}
