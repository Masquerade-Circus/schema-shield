/****************** Path: lib/index.ts ******************/
import { DefineErrorFunction, ValidationError } from "./utils/main-utils";
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
    (schema: CompiledSchema | boolean, data: any, evaluated?: {
        property?: string;
        item?: number;
        unevaluated?: boolean;
        discardAnnotations?: boolean;
    }): Result;
    savepoint?(): number;
    rollback?(savepoint: number): void;
    tracksEvaluated?: boolean;
}
export interface KeywordFunction {
    (schema: CompiledSchema, data: any, defineError: DefineErrorFunction, instance: SchemaShield, validateSubschema?: ValidateSubschemaFunction): Result;
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
export declare class SchemaShield {
    #private;
    private static builtinMetaValidators;
    private types;
    private formats;
    private keywords;
    private immutable;
    private useDefaults;
    private formatMode;
    private rootSchema;
    private failFast;
    private maxDepth;
    private validationContexts;
    private compileCache;
    private compilingRequiresContext;
    private compilingEvaluatedTracking;
    private compilingValidateSubschema?;
    private compilingMutableSchemas;
    private compilingDialects;
    private compilingEnvironments;
    private compilingSchemaChildren;
    private registeredSchemas;
    private registeredSchemaIds;
    private customMetaValidators;
    constructor(options?: {
        immutable?: boolean;
        failFast?: boolean;
        format?: boolean;
        maxDepth?: number;
        useDefaults?: boolean | "empty";
    });
    setDefault(target: Record<string, any>, key: string, value: any): void;
    addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
    getType(type: string): TypeFunction | false;
    addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
    getFormat(format: string): FormatFunction | false;
    isDefaultFormatValidator(format: string, validator: FormatFunction): boolean;
    addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
    getKeyword(keyword: string): KeywordFunction | false;
    addSchema(schema: JSONSchema, options?: AddSchemaOptions): void;
    addMetaSchema(schema: JSONSchema, options?: AddSchemaOptions): void;
    private registerSchema;
    private claimedBuiltinMetaSchema;
    private builtinMetaSchemaForIdentity;
    private schemasEqual;
    private assertKnownRequiredVocabularies;
    private schemaRegistrationError;
    private absoluteResourceUri;
    private resourceIdentityFromReference;
    private isJsonSchema;
    private isJsonObject;
    private collectRegisteredNestedIdentities;
    getSchemaRef(path: string): CompiledSchema | undefined;
    getSchemaById(id: string): CompiledSchema | undefined;
    private depthError;
    private schemaChildEntries;
    private schemaChildren;
    private registrySubschemaEntries;
    private effectiveDialect;
    private defaultEnvironment;
    private vocabularyCategory;
    private metaschemaDefinesKeyword;
    private schemaEnvironment;
    private isModernDialect;
    private keywordVocabulary;
    private isKeywordActive;
    private validateAnchor;
    private escapePointerToken;
    private resolveUri;
    private resourceUri;
    private buildReferenceRegistry;
    private resolveReferenceSource;
    private builtinReferences;
    private analyzeSchema;
    validateSchema(schema: any): ValidationResult;
    private validateSchemaWithMetaSchema;
    private getMetaSchemaValidator;
    private invalidSchemaError;
    private unknownMetaschemaError;
    compile(schema: any, options?: CompileOptions): Validator;
    private prepareSchema;
    private createGuardedValidator;
    private isPlainObject;
    private isTrivialAlwaysValidSubschema;
    private shallowArrayEquals;
    private flattenAssociativeBranches;
    private flattenSingleWrapperOneOf;
    private normalizeSchemaForCompile;
    private markSchemaHasRef;
    private shouldSkipKeyword;
    private hasPropertyDefaults;
    private isDefaultTypeValidator;
    private rollbackDefaults;
    private isDepthError;
    private validateSubschema;
    private markEvaluated;
    private mergeCompletedEvaluation;
    private mergeReferenceEvaluation;
    private installEvaluationTracking;
    private installDepthGuards;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
    private getCompiledReferenceTarget;
    private installEvaluationResourceScopes;
    private referenceValidator;
    private linkReferences;
}
//# sourceMappingURL=index.d.ts.map