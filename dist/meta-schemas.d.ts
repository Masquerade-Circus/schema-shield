export type BuiltinDialect = "draft4" | "draft6" | "draft7" | "2019-09" | "2020-12";
export interface BuiltinMetaSchemaResource {
    readonly dialect: BuiltinDialect;
    readonly uri: string;
    readonly schema: Readonly<Record<string, any>>;
}
export declare const BUILTIN_META_SCHEMAS: readonly BuiltinMetaSchemaResource[];
export declare const BUILTIN_META_SCHEMA_BY_URI: ReadonlyMap<string, BuiltinMetaSchemaResource>;
export declare const BUILTIN_DIALECT_BY_URI: ReadonlyMap<string, BuiltinDialect>;
//# sourceMappingURL=meta-schemas.d.ts.map