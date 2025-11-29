/****************** Path: lib/index.ts ******************/
import { DefineErrorFunction, ValidationError } from "./utils";
export { ValidationError } from "./utils";
export { deepClone } from "./utils";
export type Result = void | ValidationError | true;
export interface KeywordFunction {
    (schema: CompiledSchema, data: any, defineError: DefineErrorFunction, instance: SchemaShield): Result;
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
    private types;
    private formats;
    private keywords;
    private immutable;
    private rootSchema;
    private idRegistry;
    private failFast;
    constructor({ immutable, failFast }?: {
        immutable?: boolean;
        failFast?: boolean;
    });
    addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
    getType(type: string): TypeFunction | false;
    addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
    getFormat(format: string): FormatFunction | false;
    addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
    getKeyword(keyword: string): KeywordFunction | false;
    getSchemaRef(path: string): CompiledSchema | undefined;
    getSchemaById(id: string): CompiledSchema | undefined;
    compile(schema: any): Validator;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
    private linkReferences;
}
//# sourceMappingURL=index.d.ts.map