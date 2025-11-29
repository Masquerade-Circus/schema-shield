import { CompiledSchema } from "./index";
interface ErrorTree {
    message: string;
    keyword: string;
    item?: string | number;
    schemaPath: string;
    instancePath: string;
    data?: any;
    cause?: ErrorTree;
}
export declare class ValidationError extends Error {
    message: string;
    item?: string | number;
    keyword: string;
    cause?: ValidationError;
    schemaPath: string;
    instancePath: string;
    data?: any;
    schema?: CompiledSchema;
    private _getCause;
    getCause(): ValidationError;
    private _getTree;
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
export declare function hasChanged(prev: any, current: any): boolean;
export declare function isObject(data: any): boolean;
export declare function areCloseEnough(a: any, b: any, epsilon?: number): boolean;
export declare function getUTF16Length(str: any): number;
export declare function deepClone<T>(obj: T, cloneClassInstances?: boolean, seen?: WeakMap<object, any>): T;
export declare function isCompiledSchema(subSchema: any): subSchema is CompiledSchema;
export declare function getNamedFunction<T>(name: string, fn: T): T;
export declare function resolvePath(root: any, path: string): any;
export {};
//# sourceMappingURL=utils.d.ts.map