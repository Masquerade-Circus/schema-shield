import type { KeywordFunction } from "../index";
type BranchEntry = {
    kind: "validate";
    validate: (data: any) => any;
} | {
    kind: "alwaysValid";
} | {
    kind: "alwaysInvalid";
} | {
    kind: "literal";
    value: any;
};
export declare function getCombinatorBranchEntries(schema: any, key: "allOf" | "anyOf" | "oneOf", rebuild?: boolean): BranchEntry[];
export declare function prepareCombinatorKeywordCaches(schema: any): void;
export declare const OtherKeywords: Record<string, KeywordFunction>;
export {};
//# sourceMappingURL=other-keywords.d.ts.map