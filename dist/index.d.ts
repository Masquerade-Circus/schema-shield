/****************** Path: lib/index.ts ******************/
import { DefineErrorFunction, ValidationError } from "./utils/main-utils";
export { ValidationError } from "./utils/main-utils";
export { deepCloneUnfreeze as deepClone } from "./utils/deep-freeze";
export type Result = void | ValidationError | true;
export interface ValidateSubschemaFunction {
    (schema: CompiledSchema, data: any): Result;
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
    (data: any): {
        data: any;
        error: ValidationError | null | true;
        valid: boolean;
    };
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    #private;
    private types;
    private formats;
    private keywords;
    private immutable;
    private rootSchema;
    private failFast;
    private maxDepth;
    private validationContexts;
    private compileCache;
    private compilingRequiresContext;
    private compilingMutableSchemas;
    constructor({ immutable, failFast, maxDepth }?: {
        immutable?: boolean;
        failFast?: boolean;
        maxDepth?: number;
    });
    setDefault(target: Record<string, any>, key: string, value: any): void;
    addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
    getType(type: string): TypeFunction | false;
    addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
    getFormat(format: string): FormatFunction | false;
    isDefaultFormatValidator(format: string, validator: FormatFunction): boolean;
    addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
    getKeyword(keyword: string): KeywordFunction | false;
    getSchemaRef(path: string): CompiledSchema | undefined;
    getSchemaById(id: string): CompiledSchema | undefined;
    private depthError;
    private schemaChildEntries;
    private schemaChildren;
    private registrySubschemaEntries;
    private escapePointerToken;
    private resolveUri;
    private resourceUri;
    private buildReferenceRegistry;
    private resolveReferenceSource;
    private analyzeSchema;
    compile(schema: any): Validator;
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
    private hasRequiredDefaults;
    private isDefaultTypeValidator;
    private rollbackDefaults;
    private isDepthError;
    private validateSubschema;
    private installDepthGuards;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
    private getCompiledReferenceTarget;
    private linkReferences;
}
//# sourceMappingURL=index.d.ts.map