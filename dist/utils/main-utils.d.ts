import { CompiledSchema } from "../index";
interface ErrorTree {
    message: string;
    keyword: string;
    item?: string | number;
    schemaPath: string;
    instancePath: string;
    data?: any;
    cause?: ErrorTree;
}
export interface CompactValidationPath {
    messages: string[];
    keywords: string[];
    schemas: CompiledSchema[];
    items: Array<string | number | undefined>;
    data: any[];
}
export declare class ValidationError extends Error {
    message: string;
    code?: string;
    item?: string | number;
    keyword: string;
    cause?: ValidationError;
    schemaPath: string;
    instancePath: string;
    data?: any;
    schema?: CompiledSchema;
    private compactPath?;
    private compactLeaf?;
    constructor(message: string);
    setCompactPath(path: CompactValidationPath, leaf: ValidationError): void;
    private visitPath;
    getCause(): ValidationError;
    getTree(): ErrorTree;
    getPath(): {
        schemaPath: string;
        instancePath: string;
    };
}
export interface DefineErrorOptions {
    item?: any;
    cause?: ValidationError | true;
    data?: any;
}
export interface DefineErrorFunction {
    (message: string, options?: DefineErrorOptions): ValidationError | void | true;
}
export declare function getDefinedErrorFunctionForKey(key: string, schema: CompiledSchema, failFast: boolean): DefineErrorFunction;
export declare function getUTF16Length(str: any): number;
export declare function isCompiledSchema(subSchema: any): subSchema is CompiledSchema;
export declare function getNamedFunction<T>(name: string, fn: T): T;
export declare function resolvePath(root: any, path: string): any;
export declare function areCloseEnough(a: number, b: number, epsilon?: number): boolean;
export {};
//# sourceMappingURL=main-utils.d.ts.map