import type { KeywordFunction } from "../index";
type PatternPropertyEntry = {
    schemaProp: any;
    match: (key: string) => boolean;
};
export declare function getPatternPropertyEntries(schema: Record<string, any>, rebuild?: boolean): PatternPropertyEntry[];
export declare function prepareObjectKeywordCaches(schema: Record<string, any>): void;
export declare const ObjectKeywords: Record<string, KeywordFunction | false>;
export {};
//# sourceMappingURL=object-keywords.d.ts.map