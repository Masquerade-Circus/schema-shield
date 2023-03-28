import { ValidationError } from "./utils";
export type Result = any;
export interface ValidatorFunction {
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
    (data: any): Result;
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    types: Map<string, false | TypeFunction>;
    formats: Map<string, false | FormatFunction>;
    keywords: Map<string, false | ValidatorFunction>;
    immutable: boolean;
    constructor({ immutable }?: {
        immutable?: boolean;
    });
    addType(name: string, validator: TypeFunction): void;
    addFormat(name: string, validator: FormatFunction): void;
    addKeyword(name: string, validator: ValidatorFunction): void;
    compile(schema: any): Validator;
    private compileSchema;
    isSchemaLike(subSchema: any): boolean;
}
//# sourceMappingURL=index.d.ts.map