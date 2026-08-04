import { deepFreeze } from "./utils/deep-freeze";

export type BuiltinDialect =
  | "draft4"
  | "draft6"
  | "draft7"
  | "2019-09"
  | "2020-12";

export interface BuiltinMetaSchemaResource {
  readonly dialect: BuiltinDialect;
  readonly uri: string;
  readonly schema: Readonly<Record<string, any>>;
}

const {
  draft4,
  draft6,
  draft7,
  draft2019,
  draft2019Core,
  draft2019Applicator,
  draft2019Validation,
  draft2019Metadata,
  draft2019Format,
  draft2019Content,
  draft2020,
  draft2020Core,
  draft2020Applicator,
  draft2020Unevaluated,
  draft2020Validation,
  draft2020Metadata,
  draft2020Format,
  draft2020FormatAssertion,
  draft2020Content
} = require("./official-meta-schemas.json");

const resources: Array<{
  dialect: BuiltinDialect;
  uri: string;
  schema: Record<string, any>;
}> = [
  {
    dialect: "draft4",
    uri: "http://json-schema.org/draft-04/schema#",
    schema: draft4
  },
  {
    dialect: "draft6",
    uri: "http://json-schema.org/draft-06/schema#",
    schema: draft6
  },
  {
    dialect: "draft7",
    uri: "http://json-schema.org/draft-07/schema#",
    schema: draft7
  },
  { dialect: "2019-09", uri: draft2019.$id, schema: draft2019 },
  { dialect: "2019-09", uri: draft2019Core.$id, schema: draft2019Core },
  {
    dialect: "2019-09",
    uri: draft2019Applicator.$id,
    schema: draft2019Applicator
  },
  {
    dialect: "2019-09",
    uri: draft2019Validation.$id,
    schema: draft2019Validation
  },
  { dialect: "2019-09", uri: draft2019Metadata.$id, schema: draft2019Metadata },
  { dialect: "2019-09", uri: draft2019Format.$id, schema: draft2019Format },
  { dialect: "2019-09", uri: draft2019Content.$id, schema: draft2019Content },
  { dialect: "2020-12", uri: draft2020.$id, schema: draft2020 },
  { dialect: "2020-12", uri: draft2020Core.$id, schema: draft2020Core },
  {
    dialect: "2020-12",
    uri: draft2020Applicator.$id,
    schema: draft2020Applicator
  },
  {
    dialect: "2020-12",
    uri: draft2020Unevaluated.$id,
    schema: draft2020Unevaluated
  },
  {
    dialect: "2020-12",
    uri: draft2020Validation.$id,
    schema: draft2020Validation
  },
  { dialect: "2020-12", uri: draft2020Metadata.$id, schema: draft2020Metadata },
  { dialect: "2020-12", uri: draft2020Format.$id, schema: draft2020Format },
  {
    dialect: "2020-12",
    uri: draft2020FormatAssertion.$id,
    schema: draft2020FormatAssertion
  },
  { dialect: "2020-12", uri: draft2020Content.$id, schema: draft2020Content }
];

for (const resource of resources) {
  deepFreeze(resource.schema);
  Object.freeze(resource);
}

export const BUILTIN_META_SCHEMAS: readonly BuiltinMetaSchemaResource[] =
  Object.freeze(resources);

export const BUILTIN_META_SCHEMA_BY_URI: ReadonlyMap<
  string,
  BuiltinMetaSchemaResource
> = new Map(resources.map((resource) => [resource.uri, resource]));

export const BUILTIN_DIALECT_BY_URI: ReadonlyMap<string, BuiltinDialect> = new Map(
  resources
    .filter(
      (resource) =>
        resource.uri.endsWith("/schema") || resource.uri.endsWith("/schema#")
    )
    .map((resource) => [resource.uri, resource.dialect])
);
