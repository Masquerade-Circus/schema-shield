import { ValidationError } from "./utils";
export type Result = void | ValidationError;
export interface KeywordFunction {
    (schema: CompiledSchema, data: any, error: ValidationError, instance: SchemaShield): Result;
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
    (data: any): [any, Result];
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    types: Map<string, false | TypeFunction>;
    formats: Map<string, false | FormatFunction>;
    keywords: Map<string, false | KeywordFunction>;
    immutable: boolean;
    constructor({ immutable }?: {
        immutable?: boolean;
    });
    addType(name: string, validator: TypeFunction): void;
    addFormat(name: string, validator: FormatFunction): void;
    addKeyword(name: string, validator: KeywordFunction): void;
    compile(schema: any): Validator;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
}
//# sourceMappingURL=index.d.ts.map