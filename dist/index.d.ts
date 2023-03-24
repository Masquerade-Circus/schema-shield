import { ValidationError } from "./utils";
export interface ValidationErrorProps {
    pointer: string;
    value: any;
    code: string;
}
export interface Result {
    valid: boolean;
    errors: ValidationError[];
    data: any;
}
export interface ValidatorFunction {
    (schema: CompiledSchema, data: any, pointer: string, schemaShieldInstance: SchemaShield): Result;
}
export interface FormatFunction {
    (data: any): boolean;
}
export interface CompiledSchema {
    pointer: string;
    validator?: ValidatorFunction;
    type?: string;
    validators?: ValidatorFunction[];
    keywords?: Record<string, ValidatorFunction>;
    [key: string]: any;
}
export interface Validator {
    (data: any): Result;
    compiledSchema: CompiledSchema;
}
export declare class SchemaShield {
    types: Map<string, ValidatorFunction>;
    formats: Map<string, FormatFunction>;
    keywords: Map<string, ValidatorFunction>;
    constructor();
    addType(name: string, validator: ValidatorFunction): void;
    addFormat(name: string, validator: FormatFunction): void;
    addKeyword(name: string, validator: ValidatorFunction): void;
    compile(schema: any): Validator;
    private compileSchema;
    private handleArraySchema;
    private handleObjectSchema;
    private validateTypes;
    private validateKeywords;
}
//# sourceMappingURL=index.d.ts.map