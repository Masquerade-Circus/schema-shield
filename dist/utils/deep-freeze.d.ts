export declare function deepFreeze(obj: any, freezeClassInstances?: boolean, seen?: WeakSet<object>): any;
declare function isPlainObject(value: any): boolean;
export { isPlainObject };
export declare function deepCloneUnfreeze<T>(obj: T, cloneClassInstances?: boolean, seen?: WeakMap<object, any>): T;
//# sourceMappingURL=deep-freeze.d.ts.map