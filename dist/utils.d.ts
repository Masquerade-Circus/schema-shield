import { CompiledSchema } from "./index";
export declare class ValidationError extends Error {
    name: string;
    pointer: string;
    message: string;
    value: any;
    code: string;
    item: string | number;
    constructor(message: string, pointer?: string);
}
export declare function deepEqual(obj: Array<any> | Record<string, any>, other: Array<any> | Record<string, any>): boolean;
export declare function isObject(data: any): boolean;
export declare function areCloseEnough(a: any, b: any, epsilon?: number): boolean;
export declare function getUTF16Length(str: any): number;
export declare function deepClone(obj: any): any;
export declare function isCompiledSchema(subSchema: any): subSchema is CompiledSchema;
export declare function getNamedFunction<T>(name: string, fn: T): T;
//# sourceMappingURL=utils.d.ts.map