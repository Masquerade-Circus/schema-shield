import type { KeywordFunction, ValidateFunction, ValidateSubschemaFunction } from "../index";
import type { DefineErrorFunction } from "../utils/main-utils";
type CombinatorKey = "allOf" | "anyOf" | "oneOf";
type DefaultMutation = {
    target: Record<string, any>;
    key: string;
    value: any;
};
type TransactionHooks = {
    savepoint: () => number;
    rollback: (savepoint: number) => void;
    capture: (savepoint: number) => DefaultMutation[];
    restore: (mutations: DefaultMutation[]) => void;
};
export declare function createCombinatorValidator(key: CombinatorKey, schema: any, defineError: DefineErrorFunction, validateSubschema?: ValidateSubschemaFunction, transactions?: TransactionHooks): ValidateFunction;
export declare function prepareCombinatorEntries(schema: any): void;
export declare const OtherKeywords: Record<string, KeywordFunction>;
export {};
//# sourceMappingURL=other-keywords.d.ts.map