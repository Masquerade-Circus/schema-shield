import { CompiledSchema } from "./index";
export declare class ValidationError extends Error {
    message: string;
    item: string | number;
    keyword: string;
    cause: ValidationError;
    path: string;
    private _getCause;
    getCause(): any;
}
export declare function deepEqual(obj: Array<any> | Record<string, any>, other: Array<any> | Record<string, any>): boolean;
export declare function isObject(data: any): boolean;
export declare function areCloseEnough(a: any, b: any, epsilon?: number): boolean;
export declare function getUTF16Length(str: any): number;
export declare function deepClone(obj: any): any;
export declare function isCompiledSchema(subSchema: any): subSchema is CompiledSchema;
export declare function getNamedFunction<T>(name: string, fn: T): T;
//# sourceMappingURL=utils.d.ts.map