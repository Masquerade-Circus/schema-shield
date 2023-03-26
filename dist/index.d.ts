import { ValidationError } from './utils';
export interface Result {
    valid: boolean;
    error: ValidationError | null;
    data: any;
}
export interface ValidatorFunction {
    (schema: CompiledSchema, data: any, pointer: string, schemaShieldInstance: SchemaShield): Result;
}
export interface FormatFunction {
    (data: any): boolean;
}
export interface CompiledSchema {
    validators?: ValidatorFunction[];
    types?: ValidatorFunction[];
    [key: string]: any;
}
export interface Validator {
    (data: any): Result;
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    types: Map<string, false | ValidatorFunction>;
    formats: Map<string, false | FormatFunction>;
    keywords: Map<string, false | ValidatorFunction>;
    constructor();
    addType(name: string, validator: ValidatorFunction): void;
    addFormat(name: string, validator: FormatFunction): void;
    addKeyword(name: string, validator: ValidatorFunction): void;
    compile(schema: any): Validator;
    private compileSchema;
    validate(schema: CompiledSchema, data: any): Result;
    private isSchemaOrKeywordPresent;
    isSchemaLike(subSchema: any): boolean;
    isCompiledSchema(subSchema: any): boolean;
}
//# sourceMappingURL=index.d.ts.map