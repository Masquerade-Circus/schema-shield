import type { KeywordFunction, SchemaShield } from "../index";
interface ApplyPropertyDefaultsFunction {
    (schema: Record<string, any>, data: any, instance: SchemaShield): void;
}
export declare const applyPropertyDefaults: ApplyPropertyDefaultsFunction;
export declare const applyEmptyPropertyDefaults: ApplyPropertyDefaultsFunction;
export declare const ObjectKeywords: Record<string, KeywordFunction | false>;
export {};
//# sourceMappingURL=object-keywords.d.ts.map