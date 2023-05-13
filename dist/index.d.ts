import { DefineErrorFunction, ValidationError } from "./utils";
export { ValidationError } from "./utils";
export { deepClone } from "./utils";
export type Result = void | ValidationError;
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
        error: ValidationError | null;
        valid: boolean;
    };
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    private types;
    private formats;
    private keywords;
    private immutable;
    constructor({ immutable }?: {
        immutable?: boolean;
    });
    addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
    getType(type: string): TypeFunction | false;
    addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
    getFormat(format: string): FormatFunction | false;
    addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
    getKeyword(keyword: string): KeywordFunction | false;
    compile(schema: any): Validator;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
}
//# sourceMappingURL=index.d.ts.map