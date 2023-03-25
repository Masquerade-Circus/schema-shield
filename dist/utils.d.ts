import { ValidationErrorProps } from './index';
export declare class ValidationError extends Error {
    name: string;
    pointer: string;
    message: string;
    value: any;
    code: string;
    constructor(message: string, options?: ValidationErrorProps);
}
export declare const defaultValidator: (schema: any, data: any, pointer: any) => ValidationError[];
export declare function deepEqual(obj: Array<any> | Record<string, any>, other: Array<any> | Record<string, any>): boolean;
export declare function isObject(data: any): boolean;
export declare function areCloseEnough(a: any, b: any, epsilon?: number): boolean;
export declare function getUTF16Length(str: any): number;
//# sourceMappingURL=utils.d.ts.map