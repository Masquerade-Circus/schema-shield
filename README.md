# SchemaShield 🛡️

**Predictable JSON Schema validation for JavaScript, without runtime code generation or hidden network access.**

SchemaShield is a synchronous, high-performance JSON Schema interpreter for applications that need secure, local, explicit validations and easy to inspect validation errors.

Compile reusable validators for JSON data or live JavaScript objects, extend them with domain rules, and receive the validated value together with a clear success or failure result.

- Interpreted execution without `eval()` or `new Function()`
- No implicit fetches, file reads, DNS lookups, or other I/O
- JSON Schema draft-04, draft-06, draft-07, 2019-09, and 2020-12
- Built-in official metaschemas with schema validation during compilation
- Validation of JSON data, class instances, Dates, and other live values
- Custom types, formats, and keywords
- Structured errors with schema paths, instance paths, and causal chains
- Zero runtime dependencies
- Support for ESM, CommonJS, and TypeScript

## Quick Start

```bash
npm install schema-shield
```

```javascript
import { SchemaShield } from "schema-shield";

const validateUser = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    age: { type: "integer", minimum: 18 }
  },
  required: ["name", "age"],
  additionalProperties: false
});

const result = validateUser({ name: "Ada", age: 37 });

if (result.valid) {
  console.log(result.data);
} else {
  console.error(result.error.getPath());
}
```

Every validator returns the same shape:

```typescript
{
  data: any;
  error: ValidationError | null | true;
  valid: boolean;
}
```

`failFast` defaults `error` to `true`. Use `failFast: false` when you need a `ValidationError` with diagnostic context.

## Contents

- [Why SchemaShield](#why-schemashield)
- [Installation and package formats](#installation-and-package-formats)
- [Core concepts](#core-concepts)
  - [Compile once, validate many times](#compile-once-validate-many-times)
  - [Choose an error mode](#choose-an-error-mode)
  - [Apply defaults](#apply-defaults)
  - [Preserve the original input](#preserve-the-original-input)
  - [Validate live JavaScript objects](#validate-live-javascript-objects)
- [Working with schema resources](#working-with-schema-resources)
  - [Use built-in metaschemas](#use-built-in-metaschemas)
  - [Register external schemas](#register-external-schemas)
  - [Register a custom metaschema](#register-a-custom-metaschema)
  - [Use local references and JSON Pointers](#use-local-references-and-json-pointers)
  - [Use anchors and recursive references](#use-anchors-and-recursive-references)
- [Extend SchemaShield](#extend-schemashield)
  - [Custom types](#custom-types)
  - [Custom formats](#custom-formats)
  - [Custom keywords](#custom-keywords)
- [API reference](#api-reference)
  - [Root exports](#root-exports)
  - [Public TypeScript types](#public-typescript-types)
  - [SchemaShield constructor](#schemashield-constructor)
  - [SchemaShield methods](#schemashield-methods)
  - [Validator](#validator)
  - [ValidationError](#validationerror)
  - [deepClone](#deepclone)
- [JSON Schema compatibility](#json-schema-compatibility)
  - [Dialects](#dialects)
  - [Built-in formats](#built-in-formats)
  - [Non-standard extensions](#non-standard-extensions)
  - [Compatibility notes](#compatibility-notes)
- [Execution model and limits](#execution-model-and-limits)
- [Error codes](#error-codes)
- [Development](#development)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Why SchemaShield

### Keep validation predictable

SchemaShield interprets schemas with ordinary JavaScript functions. It does not generate executable source at runtime, and it does not call `eval()` or `new Function()`. Validation remains compatible with environments that restrict runtime code generation.

### Keep resources under application control

SchemaShield never downloads a referenced schema. Register reviewed resources with `addSchema()` and ship them with your application. An `http:` or `https:` URI is an identifier inside the local registry, not permission to access the network.

### Use one validation boundary for transport and domain values

Built-in JSON Schema types cover JSON-compatible data. Custom types and keywords can also inspect class instances, Dates, application state, and other live JavaScript values without serializing them first.

### Inspect the failure that matters

SchemaShield stops at the first failing path. With detailed errors enabled, that failure retains its keyword, data, schema context, nested cause, and JSON Pointer paths.

## Installation and package formats

Install with npm:

```bash
npm install schema-shield
```

Or with Bun:

```bash
bun add schema-shield
```

Use the package root with ESM:

```javascript
import { SchemaShield, ValidationError, deepClone } from "schema-shield";
```

Use the package root with CommonJS:

```javascript
const { SchemaShield, ValidationError, deepClone } = require("schema-shield");
```

There is no default export. TypeScript declarations are included. The package metadata also provides a browser bundle for browser-aware tooling.

SchemaShield requires Node.js 18 or later when used through its Node.js package entry points.

## Core concepts

### Compile once, validate many times

Create an instance, compile a schema, and retain the returned function:

```javascript
import { SchemaShield } from "schema-shield";

const shield = new SchemaShield();
const validateMessage = shield.compile({
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    body: { type: "string", minLength: 1 }
  },
  required: ["id", "body"]
});

const first = validateMessage({
  id: "123e4567-e89b-12d3-a456-426614174000",
  body: "Ready"
});

const second = validateMessage({ id: "invalid", body: "" });

console.log(first.valid); // true
console.log(second.valid); // false
```

### Choose an error mode

The default mode minimizes error construction:

```javascript
const validate = new SchemaShield().compile({ type: "integer" });
const result = validate("3");

console.log(result);
// { data: "3", error: true, valid: false }
```

Detailed mode returns a `ValidationError` for built-in failures and custom failures created with `defineError()`:

```javascript
const validate = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    profile: {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18 }
      },
      required: ["age"]
    }
  },
  required: ["profile"]
});

const result = validate({ profile: { age: 16 } });

if (!result.valid && result.error !== true) {
  console.log(result.error.getPath());
  // { schemaPath: "#/properties/profile/properties/age/minimum",
  //   instancePath: "#/profile/age" }

  console.log(result.error.getTree());
}
```

> Detailed mode preserves a causal chain for the first failing path. It does not collect every independent validation error into a list. A custom keyword that returns `true` directly still produces `error: true`, even when `failFast` is `false`.

### Apply defaults

`default` remains an annotation unless `useDefaults` is enabled.

```javascript
const validateSettings = new SchemaShield({
  useDefaults: true
}).compile({
  type: "object",
  properties: {
    theme: { type: "string", default: "system" },
    retries: { type: "integer", default: 3 }
  }
});

const input = {};
const result = validateSettings(input);

console.log(result.data);
// { theme: "system", retries: 3 }
```

| `useDefaults` | Behavior                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `false`       | Leaves `default` as an annotation. This is the default.                                                                |
| `true`        | Replaces absent or `undefined` object properties with their defaults.                                                  |
| `"empty"`     | Also replaces `null` and empty strings. Values such as `0`, `false`, empty arrays, and empty objects remain unchanged. |

Object and array defaults are cloned for each validation. Nested defaults apply when their containing object exists or the container itself receives a default.

> Defaults are mutations. During ordinary validation, an inserted default is validated like any other value. If that default is invalid, validation fails and the inserted value can remain on mutable input.

### Preserve the original input

Set `immutable: true` to validate a cloned value:

```javascript
const validate = new SchemaShield({
  immutable: true,
  useDefaults: true
}).compile({
  type: "object",
  properties: {
    role: { type: "string", default: "member" }
  }
});

const input = {};
const result = validate(input);

console.log(input); // {}
console.log(result.data); // { role: "member" }
console.log(result.data === input); // false
```

> Immutable mode clones the root value with the platform's `structuredClone`. Class instances become cloned objects without their original prototype. Values unsupported by `structuredClone`, including functions, promises, weak collections, and symbols, make cloning throw. Treat immutable mode as reliable isolation for ordinary JSON-compatible data, not as a universal object-capability boundary.

### Validate live JavaScript objects

Custom types can recognize domain values directly:

```javascript
import { SchemaShield } from "schema-shield";

class Invoice {
  constructor(total) {
    this.total = total;
  }
}

const shield = new SchemaShield({ failFast: false });

shield.addType("invoice", (value) => value instanceof Invoice);
shield.addKeyword("positiveTotal", (schema, data, defineError) => {
  if (!schema.positiveTotal || !(data instanceof Invoice)) {
    return;
  }

  if (data.total <= 0) {
    return defineError("Invoice total must be positive", {
      code: "INVALID_INVOICE_TOTAL",
      data
    });
  }
});

const validateInvoice = shield.compile({
  type: "invoice",
  positiveTotal: true
});

const result = validateInvoice(new Invoice(-10));
console.log(result.valid); // false
```

> Leave `immutable` disabled when class identity or reference identity matters. A structured-cloned class instance loses its prototype and stops satisfying `instanceof` checks.

## Working with schema resources

### Use built-in metaschemas

SchemaShield includes 18 official metaschema resources for draft-04, draft-06, draft-07, 2019-09, and 2020-12. The 2019-09 and 2020-12 catalogs include the complete graphs of implemented vocabulary resources. All built-in resources are immutable, shared by every instance, and ready for local `$ref` resolution.

`compile()` validates every reachable schema resource against its declared metaschema by default. A `$schema` value selects a built-in or custom metaschema through an exact identity match. Empty, malformed, and unknown identities throw `UNKNOWN_METASCHEMA`.

```javascript
const shield = new SchemaShield({ failFast: false });

shield.compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "string",
  minLength: 1
});

const result = shield.validateSchema({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  minLength: -1
});

console.log(result.valid); // false
```

For a complete schema graph validated earlier in your pipeline, skip metavalidation explicitly:

```javascript
shield.compile(schema, { validateSchema: false });
```

This option changes the metavalidation step. SchemaShield requires a known `$schema`, resolves every reachable reference, and uses local resources exclusively.

### Register external schemas

`addSchema()` stores a local snapshot of a schema resource. URI strings identify resources within the local registry and guide reference resolution.

```javascript
import { SchemaShield } from "schema-shield";

const shield = new SchemaShield({ failFast: false });

shield.addSchema(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "address.json",
    type: "object",
    properties: {
      city: { type: "string", minLength: 1 },
      postalCode: { type: "string" }
    },
    required: ["city"]
  },
  {
    uri: "https://resources.example/schemas/address.json",
    aliases: ["https://schemas.example/address"]
  }
);

const validateCustomer = shield.compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    address: { $ref: "https://schemas.example/address" }
  },
  required: ["address"]
});
```

Registration follows these rules:

- `uri` and every alias must be absolute URIs without fragments.
- A root `$id` is resolved against `uri` when both are present.
- Without `uri`, the active root `id` or `$id` must already be absolute and fragment-free.
- Boolean schemas require an explicit `uri`.
- The retrieval URI, resolved root identifier, and aliases identify the same resource.
- Registration snapshots the schema. Later mutations to the source object do not change future compilations.
- Newly registered schemas affect future `compile()` calls. Existing validators keep their compiled targets.
- Duplicate identities are rejected. Registered resources cannot be overwritten or removed.
- Resources may be registered in any order. Every resource reachable from the compiled root must be present by compile time.
- SchemaShield provides no fetch callback, loader, file access, or remote retrieval fallback.

Built-in metaschema identities are reserved. Registering an exact structural copy preserves the current resource. Registering different content under a reserved identity throws `BUILTIN_SCHEMA_ID_COLLISION`.

### Register a custom metaschema

Use `addMetaSchema()` to register a custom dialect that defines vocabularies or extends standard keyword contracts. Resources registered with `addSchema()` remain ordinary schema resources.

```javascript
const shield = new SchemaShield();

shield.addMetaSchema({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.example/meta/domain",
  $vocabulary: {
    "https://json-schema.org/draft/2020-12/vocab/core": true,
    "https://json-schema.org/draft/2020-12/vocab/validation": true
  },
  type: ["object", "boolean"]
});

shield.compile({
  $schema: "https://schemas.example/meta/domain",
  type: "string"
});
```

SchemaShield validates each custom metaschema against its declared parent metaschema before registration. Required vocabulary identities must exactly match an implemented 2019-09 or 2020-12 vocabulary. An unknown required vocabulary throws `UNKNOWN_REQUIRED_VOCABULARY`. Registration is local, additive, and snapshot-based.

### Use local references and JSON Pointers

Local references, relative references, cross-document references, aliases, transitive references, and JSON Pointer fragments are resolved during compilation:

```javascript
const validate = new SchemaShield().compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    identifier: {
      type: "string",
      pattern: "^[A-Z]{3}-[0-9]+$"
    }
  },
  type: "object",
  properties: {
    id: { $ref: "#/$defs/identifier" }
  },
  required: ["id"]
});
```

An unresolved reachable reference throws synchronously from `compile()` with `REFERENCE_NOT_FOUND`.

### Use anchors and recursive references

SchemaShield resolves named anchors in modern dialects, draft 2019-09 `$recursiveRef`, and draft 2020-12 `$dynamicRef`. Dynamic resolution of a draft 2019-09 `$recursiveRef` requires the destination resource root to declare `$recursiveAnchor: true`. Without that anchor, the reference uses its statically resolved target. Include `$schema` whenever behavior depends on a dialect:

```javascript
const validateTree = new SchemaShield({ maxDepth: 64 }).compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.example/tree",
  $dynamicAnchor: "node",
  type: "object",
  properties: {
    value: { type: "string" },
    children: {
      type: "array",
      items: { $dynamicRef: "#node" }
    }
  },
  required: ["value"]
});
```

> Invalid or duplicate anchors fail during compilation. Recursive validation remains subject to the runtime `maxDepth` limit.

## Extend SchemaShield

Application registrations belong to one `SchemaShield` instance and affect validators compiled from that instance. Official metaschemas are shared immutable built-ins. Types, formats, and keywords use `overwrite = false` by default. Registering an existing active name throws unless `overwrite = true` is explicitly enabled. An internal entry represented by `false` is disabled rather than active, so it can be activated without overwrite.

### Custom types

```typescript
addType(name: string, validator: TypeFunction, overwrite?: boolean): void
getType(name: string): TypeFunction | false
```

```javascript
const shield = new SchemaShield();

shield.addType("safe-integer", (data) => Number.isSafeInteger(data));

const validate = shield.compile({ type: "safe-integer" });
```

A type function receives the candidate value and returns `true` when it belongs to the type.

### Custom formats

```typescript
addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void
getFormat(name: string): FormatFunction | false
```

```javascript
const shield = new SchemaShield();

shield.addFormat("ticket-id", (data) => /^TKT-[0-9]{6}$/.test(data));

const validate = shield.compile({
  type: "string",
  format: "ticket-id"
});
```

The `format` keyword calls format validators only for strings. Unknown formats are ignored.

### Custom keywords

```typescript
addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void
getKeyword(name: string): KeywordFunction | false
```

```javascript
const shield = new SchemaShield({ failFast: false });

shield.addKeyword("divisibleBy", (schema, data, defineError) => {
  if (typeof data !== "number") {
    return;
  }

  if (data % schema.divisibleBy !== 0) {
    return defineError(`Value must be divisible by ${schema.divisibleBy}`, {
      code: "NOT_DIVISIBLE",
      item: "divisibleBy",
      data
    });
  }
});

const validate = shield.compile({
  type: "number",
  divisibleBy: 5
});
```

A keyword receives five arguments:

1. `schema`, the active `CompiledSchema`.
2. `data`, the current value.
3. `defineError(message, options)`, the error factory for the active mode.
4. `instance`, the active `SchemaShield` instance.
5. `validateSubschema`, an optional helper for custom keywords that descend into compiled subschemas.

`defineError()` accepts `code`, `item`, `cause`, and `data`. It returns `true` in fail-fast mode and a `ValidationError` in detailed mode. Return its result from the keyword to reject the value. Returning `undefined` accepts it.

When supplied, `validateSubschema()` participates in depth guards, evaluated-item tracking, and default rollback. Its optional `evaluated` argument can identify a `property` or `item` and can set `unevaluated` or `discardAnnotations`. The helper also exposes optional `savepoint()`, `rollback(savepoint)`, and `tracksEvaluated` members for advanced integrations. These hooks describe current low-level extension behavior and should be used only when a keyword needs to manage nested validation.

`setDefault()` is available to custom keywords that need to write a default through SchemaShield's mutation journal:

```javascript
shield.addKeyword("withGeneratedId", (schema, data, _defineError, instance) => {
  if (
    schema.withGeneratedId === true &&
    data &&
    typeof data === "object" &&
    !("id" in data)
  ) {
    instance.setDefault(data, "id", "pending");
  }
});
```

> Custom functions may inspect or mutate live values. Their behavior is part of your application's trust boundary.

## API reference

### Root exports

The package root has three runtime exports:

| Export            | Kind     | Purpose                                                                      |
| ----------------- | -------- | ---------------------------------------------------------------------------- |
| `SchemaShield`    | Class    | Owns configuration, extension registries, schema resources, and compilation. |
| `ValidationError` | Class    | Represents detailed compile-time or validation failures.                     |
| `deepClone`       | Function | Clones supported values for application-controlled isolation.                |

There is no default export.

The package root also exports these TypeScript types:

- `Result`
- `ValidationResult`
- `JSONSchema`
- `AddSchemaOptions`
- `CompileOptions`
- `ValidateSubschemaFunction`
- `KeywordFunction`
- `TypeFunction`
- `FormatFunction`
- `ValidateFunction`
- `CompiledSchema`
- `Validator`

### Public TypeScript types

#### `Result`

```typescript
type Result = void | ValidationError | true;
```

Internal validation and extension functions return nothing on success, `true` for a minimal failure, or `ValidationError` for a detailed failure.

#### `ValidationResult`

```typescript
interface ValidationResult {
  data: any;
  error: ValidationError | null | true;
  valid: boolean;
}
```

Returned by validators and `validateSchema()`.

#### `JSONSchema`

```typescript
type JSONSchema = boolean | Record<string, any>;
```

Used by schema registration. Portable JSON Schema roots are booleans or schema objects. `compile(any)` also has a non-standard convenience behavior for cloneable literal values and arrays. See [`compile()`](#compileschema).

#### `AddSchemaOptions`

```typescript
interface AddSchemaOptions {
  uri?: string;
  aliases?: readonly string[];
}
```

`uri` is the absolute, fragment-free retrieval identity. `aliases` adds equivalent absolute, fragment-free identities.

#### `CompileOptions`

```typescript
interface CompileOptions {
  validateSchema?: boolean;
}
```

`validateSchema` defaults to `true`. Set it to `false` for a complete reachable schema graph validated earlier in your pipeline.

#### `ValidateSubschemaFunction`

```typescript
interface ValidateSubschemaFunction {
  (
    schema: CompiledSchema | boolean,
    data: any,
    evaluated?: {
      property?: string;
      item?: number;
      unevaluated?: boolean;
      discardAnnotations?: boolean;
    }
  ): Result;
  savepoint?(): number;
  rollback?(savepoint: number): void;
  tracksEvaluated?: boolean;
}
```

An optional helper passed to custom keywords for nested validation. It returns `Result` and may expose mutation and annotation controls when the compiled schema requires them.

#### `KeywordFunction`

```typescript
interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: (
      message: string,
      options?: {
        code?: string;
        item?: any;
        cause?: ValidationError | true;
        data?: any;
      }
    ) => ValidationError | void | true,
    instance: SchemaShield,
    validateSubschema?: ValidateSubschemaFunction
  ): Result;
}
```

The root export is `KeywordFunction`. The inline `defineError` shape above documents its callback contract. Its helper types are not package-root exports.

#### `TypeFunction`

```typescript
interface TypeFunction {
  (data: any): boolean;
}
```

Returns `true` when the value matches a built-in or custom type.

#### `FormatFunction`

```typescript
interface FormatFunction {
  (data: any): boolean;
}
```

Returns `true` when a string satisfies a built-in or custom format. SchemaShield invokes format functions only for string data.

#### `ValidateFunction`

```typescript
interface ValidateFunction {
  (data: any): Result;
}
```

The low-level callable stored on a compiled schema as `$validate`. Most applications should call `Validator` instead.

#### `CompiledSchema`

```typescript
interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}
```

The interpreted schema graph produced by `compile()`. It is exposed for inspection and extension interoperability. Treat undocumented properties as implementation details.

#### `Validator`

```typescript
interface Validator {
  (data: any): {
    data: any;
    error: ValidationError | null | true;
    valid: boolean;
  };
  compiledSchema: CompiledSchema;
}
```

The reusable function returned by `compile()`.

### SchemaShield constructor

```typescript
new SchemaShield(options?: {
  immutable?: boolean;
  failFast?: boolean;
  maxDepth?: number;
  useDefaults?: boolean | "empty";
})
```

| Option        | Default | Purpose and limits                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `immutable`   | `false` | Clones input with `structuredClone` before validation. Class instances lose their original prototype. Unsupported values make cloning throw. |
| `failFast`    | `true`  | Uses `true` as the normal failure sentinel. Set to `false` for causal `ValidationError` objects. Both modes stop at the first failure.                                                                                                                                                                                                     |
| `maxDepth`    | `128`   | Runtime recursive-validation limit. Must be an integer from `1` through `256`. Invalid values throw `INVALID_MAX_DEPTH`.                                                                                                                                                                                                                   |
| `useDefaults` | `false` | Accepts only `false`, `true`, or `"empty"`. Invalid values throw `INVALID_USE_DEFAULTS`.                                                                                                                                                                                                                                                   |

The constructor returns new independent type, format, keyword, ordinary-resource, and custom-metaschema registries. Official metaschema resources and their cached validators are immutable built-ins shared by all instances.

### SchemaShield methods

#### `setDefault(target, key, value)`

```typescript
setDefault(target: Record<string, any>, key: string, value: any): void
```

Writes an enumerable, configurable, writable property and records the previous property state when validation has an active mutation journal. It returns nothing. Custom keywords can use this method so speculative nested validation can roll the write back when required. The method mutates `target` directly and does not validate `value` by itself.

#### `addType(name, validator, overwrite)`

```typescript
addType(name: string, validator: TypeFunction, overwrite?: boolean): void
```

Registers a synchronous type predicate and returns nothing. `overwrite` defaults to `false`. A duplicate active name throws `ValidationError` unless overwrite is enabled.

#### `getType(type)`

```typescript
getType(type: string): TypeFunction | false
```

Returns the registered predicate for `type`. Disabled built-in names can return `false`. An unknown name currently returns `undefined` at runtime, although the declaration says `false`.

#### `addFormat(name, validator, overwrite)`

```typescript
addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void
```

Registers a synchronous string-format predicate and returns nothing. `overwrite` defaults to `false`. A duplicate active name throws `ValidationError` unless overwrite is enabled.

#### `getFormat(format)`

```typescript
getFormat(format: string): FormatFunction | false
```

Returns the registered predicate for `format`. An unknown name currently returns `undefined` at runtime, although the declaration says `false`.

#### `isDefaultFormatValidator(format, validator)`

```typescript
isDefaultFormatValidator(
  format: string,
  validator: FormatFunction
): boolean
```

Returns `true` when `validator` is identical to the original built-in function stored in SchemaShield's static format table for `format`. The comparison does not use the validator currently registered on the instance. SchemaShield uses this distinction to cache built-in format results, while replacements and custom validators are not treated as default validators.

#### `addKeyword(name, validator, overwrite)`

```typescript
addKeyword(
  name: string,
  validator: KeywordFunction,
  overwrite?: boolean
): void
```

Registers a synchronous keyword function and returns nothing. `overwrite` defaults to `false`. A duplicate active name throws `ValidationError` unless overwrite is enabled.

#### `getKeyword(keyword)`

```typescript
getKeyword(keyword: string): KeywordFunction | false
```

Returns the registered keyword function. Some recognized annotation or unsupported names are registered as `false`. An unknown name currently returns `undefined` at runtime, although the declaration says `false`.

#### `addSchema(schema, options)`

```typescript
addSchema(schema: JSONSchema, options?: AddSchemaOptions): void
```

Validates registration inputs, snapshots `schema`, assigns its identities, and stores it on the instance. It returns nothing. It accepts JSON-compatible object schemas and boolean schemas. Cyclic object graphs, non-finite numbers, functions, symbols, arrays at the root, and non-plain schema objects are rejected.

All identities must resolve to absolute URIs without fragments. Boolean schemas require `options.uri`. The method rejects duplicate identities and provides no overwrite, removal, loading, or fetching operation.

Built-in metaschema identities are reserved. Registering an exact structural copy preserves the current resource. Registering different content under a reserved identity throws `BUILTIN_SCHEMA_ID_COLLISION`.

#### `addMetaSchema(schema, options)`

```typescript
addMetaSchema(schema: JSONSchema, options?: AddSchemaOptions): void
```

Validates and registers a custom metaschema as a dialect selector. The metaschema must be an object, declare its parent dialect through `$schema`, and provide an absolute root `$id` or an explicit `uri`. Unknown required vocabularies, unresolved references, invalid schemas, duplicate identities, and built-in identity collisions throw synchronously. Resources registered through `addSchema()` remain ordinary schema resources.

#### `getSchemaRef(path)`

```typescript
getSchemaRef(path: string): CompiledSchema | undefined
```

Looks up a location in the current compiled root. `"#"` returns the root. A `"#/..."` path uses JSON Pointer decoding. A simple name can resolve a matching legacy `definitions` or `defs` entry or the root's matching identifier. It returns `undefined` when there is no compiled root or no match. Malformed URI encoding or JSON Pointer escapes can throw.

This method inspects the compiled root. It is not a lookup into the `addSchema()` registry.

#### `getSchemaById(id)`

```typescript
getSchemaById(id: string): CompiledSchema | undefined
```

Traverses the current compiled root and returns the first compiled node whose `$id` or `id` exactly equals `id`. It returns `undefined` when there is no match or no compiled root. It does not retrieve a resource and is not a direct registry lookup.

#### `validateSchema(schema)`

```typescript
validateSchema(schema: any): ValidationResult
```

Validates one schema against the exact built-in or custom metaschema selected by `$schema`. A valid schema returns `{ data: schema, error: null, valid: true }`. An invalid schema returns a normal validation result. A malformed or unknown `$schema` throws `UNKNOWN_METASCHEMA`.

Schemas without `$schema` use SchemaShield's native compatibility recognition, including custom types and keywords. Declare `$schema` when the schema requires portable conformance to an official dialect.

#### `compile(schema)`

```typescript
compile(schema: any, options?: CompileOptions): Validator
```

Validates every reachable schema resource against its declared metaschema, then compiles the input into a synchronous `Validator`. Set `options.validateSchema` to `false` for a complete graph validated earlier in your pipeline. Boolean values retain JSON Schema boolean semantics, and schema-like objects compile as schemas. Other cloneable literal values and cloneable arrays use a non-standard convenience path that wraps the input as a literal branch of `oneOf`.

Cloneable literals are compared with strict equality. Values such as strings, numbers other than `NaN`, `null`, `undefined`, and `BigInt` can therefore match their retained literal value. `NaN` compiles, but it cannot match because strict equality treats `NaN` as unequal to itself. Arrays are also stored as literal branches. A separately created structurally equal array does not match because literal `oneOf` branches are compared by identity. It can match only when validation receives the exact array retained in `validator.compiledSchema`.

Snapshot creation can throw for values that `structuredClone` cannot clone, including functions and symbols. Portable JSON Schema should express literals with a boolean or object schema, normally through `const` or `enum`, instead of passing a literal value or array as the root schema.

Compilation resolves every reachable local and registered reference. It can throw `ValidationError`, or the literal `true` in the current fail-fast unknown-type case. The fixed compile graph-depth limit is `128` and is separate from the configurable runtime `maxDepth`.

Schemas that declare an official `$schema` must satisfy that official metaschema. This includes the standard `type` names. Use a custom metaschema for an extended dialect. Schemas without `$schema` retain SchemaShield's native compatibility behavior for custom types, custom keywords, and non-standard extensions.

Current schema-shape behavior has two additional edges:

- An empty object, `{}`, is rejected as `Invalid schema` instead of acting as an always-valid schema. Use `true` for an explicit always-valid root.
- If every name in `type` is unknown, `failFast: true` can throw the literal `true` during compilation. With `failFast: false`, compilation throws a `ValidationError`.

#### `isSchemaLike(subSchema)`

```typescript
isSchemaLike(subSchema: any): boolean
```

Returns `true` when `subSchema` is a non-array object that contains `type` or at least one name recognized by the instance's keyword registry. It returns `false` for booleans, arrays, primitives, and `{}`. This helper performs structural recognition. Use `validateSchema(schema)` to validate a schema document against its selected metaschema.

### Validator

```typescript
const validator: Validator = shield.compile(schema);
const result = validator(data);
```

| Member                     | Meaning                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `result.valid`             | `true` when validation succeeds.                                                                                  |
| `result.data`              | The value that was validated. It can be the original value, a mutated value with defaults, or an immutable clone. |
| `result.error`             | `null` on success, `true` for a minimal failure, or `ValidationError` for a detailed failure.                     |
| `validator.compiledSchema` | The compiled root used by the validator.                                                                          |

The validator returns normally for data-validation failures. Compile errors, custom keyword exceptions, clone failures, and other programming errors can throw.

### ValidationError

```typescript
new ValidationError(message: string)
```

`ValidationError` extends `Error`. SchemaShield creates and enriches these errors during detailed validation and compilation.

#### Properties

| Property       | Type                            | Meaning                                                                                            |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `code`         | `string \| undefined`           | Machine-readable code when the failure defines one.                                                |
| `message`      | `string`                        | Human-readable failure description.                                                                |
| `item`         | `string \| number \| undefined` | Property or index associated with this link in the error chain.                                    |
| `keyword`      | `string`                        | Keyword associated with the failure. Manually constructed errors do not receive it until assigned. |
| `cause`        | `ValidationError \| undefined`  | Nested failure that caused this wrapper error.                                                     |
| `schemaPath`   | `string`                        | JSON Pointer path to the resolved root failure. Initially empty.                                   |
| `instancePath` | `string`                        | JSON Pointer path to the resolved root data failure. Initially empty.                              |
| `data`         | `any`                           | Data attached to the failure, when available.                                                      |
| `schema`       | `CompiledSchema \| undefined`   | Compiled schema attached to the failure, when available.                                           |

`schemaPath` and `instancePath` are populated while resolving the chain through `getCause()`, `getTree()`, or `getPath()`.

#### `getCause()`

```typescript
getCause(): ValidationError
```

Walks the causal chain, populates paths, and returns the deepest reachable `ValidationError`. Cyclic error chains are guarded.

#### `getTree()`

```typescript
interface ErrorTree {
  message: string;
  keyword: string;
  item?: string | number;
  schemaPath: string;
  instancePath: string;
  data?: any;
  cause?: ErrorTree;
}

getTree(): ErrorTree
```

Returns a nested tree of plain error-node objects for the first-failure chain. The tree itself is a chain of causes, not a collection of all independent errors. It is not guaranteed to be JSON-serializable because each node's `data` can contain cycles, `BigInt`, or other values rejected by `JSON.stringify()`.

#### `getPath()`

```typescript
getPath(): {
  schemaPath: string;
  instancePath: string;
}
```

Returns the schema and instance JSON Pointer paths for the deepest cause.

### deepClone

```typescript
deepClone<T>(value: T): T
```

Delegates cloning to the platform's `structuredClone`. Supported values follow the native structured clone algorithm, including circular references, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed-array views, and `Error` values. Class instances lose their original prototype. Unsupported values, including functions, promises, weak collections, and symbols, throw the platform clone error.

## JSON Schema compatibility

### Dialects

SchemaShield recognizes these dialects through exact `$schema` identities:

| Dialect  | `$schema` value                                |
| -------- | ---------------------------------------------- |
| draft-04 | `http://json-schema.org/draft-04/schema#`      |
| draft-06 | `http://json-schema.org/draft-06/schema#`      |
| draft-07 | `http://json-schema.org/draft-07/schema#`      |
| 2019-09  | `https://json-schema.org/draft/2019-09/schema` |
| 2020-12  | `https://json-schema.org/draft/2020-12/schema` |

The 18 official metaschema resources are built in, including the complete graphs of implemented vocabulary resources for modern drafts. Schemas without `$schema` use SchemaShield's native compatibility behavior. Declare `$schema` for portable metaschema validation, dialect-sensitive keywords, identifiers, anchors, reference siblings, vocabularies, tuple items, or content behavior.

Implemented validation and applicator families include:

- Types and values: `type`, `enum`, and `const`
- Numbers: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, and `multipleOf`
- Strings: `minLength`, `maxLength`, `pattern`, and `format`
- Arrays: `items`, `prefixItems`, `additionalItems`, `contains`, `minContains`, `maxContains`, `minItems`, `maxItems`, `uniqueItems`, and `unevaluatedItems`
- Objects: `required`, `properties`, `patternProperties`, `additionalProperties`, `propertyNames`, `dependencies`, `dependentRequired`, `dependentSchemas`, `minProperties`, `maxProperties`, and `unevaluatedProperties`
- Composition and conditions: `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, and `else`
- References: `$ref`, `$recursiveRef`, `$recursiveAnchor`, and `$dynamicRef`, with dialect-specific identifier and anchor behavior
- Content assertions: limited `contentEncoding` and `contentMediaType` behavior described below
- Annotations used by compilation or left inert: `default`, `definitions`, `$defs`, `$id`, `id`, `$schema`, `title`, `description`, `$comment`, and `examples`

Keyword availability follows the selected dialect and, for modern custom metaschemas, recognized vocabulary declarations.

### Built-in formats

SchemaShield includes synchronous validators for:

- Date and time: `date`, `time`, `date-time`, `duration`
- Email: `email`, `idn-email`
- Host names: `hostname`, `idn-hostname`
- IP addresses: `ipv4`, `ipv6`
- Identifiers and references: `uuid`, `uri`, `uri-reference`, `uri-template`, `iri`, `iri-reference`
- JSON Pointers: `json-pointer`, `relative-json-pointer`
- Regular expressions: `regex`

Formats apply only to strings. Unknown formats are annotations in practice and do not fail validation. Replace or add a validator with `addFormat()` when your application requires different semantics.

### Non-standard extensions

SchemaShield recognizes two non-standard schema keywords:

#### `values`

Applies one subschema to every own enumerable property value of a non-array object.

```javascript
const validateScores = new SchemaShield().compile({
  type: "object",
  values: { type: "number", minimum: 0 }
});
```

#### `elements`

Applies one subschema to every element of an array.

```javascript
const validateTags = new SchemaShield().compile({
  type: "array",
  elements: { type: "string", minLength: 1 }
});
```

Use standard `additionalProperties`, `items`, or `prefixItems` when schema portability matters.

### Compatibility notes

- `nullable` and `discriminator` are recognized as unsupported OpenAPI keywords and ignored.
- Draft 2019-09 `$recursiveRef` resolves dynamically only when its destination resource root declares `$recursiveAnchor: true`.
- `contentEncoding` validates only `base64`, and only where that keyword is active for the selected dialect.
- `contentMediaType` validates only `application/json`, and only where that keyword is active for the selected dialect.
- `contentSchema` is currently inert. Parsed or decoded content is not validated against it.
- Unknown formats are ignored.
- The `format` keyword validates strings only.
- `enum`, `const`, and `uniqueItems` use structural comparison. Large collections containing complex objects can require more comparison work.
- Schema resources remain local. URI schemes do not enable retrieval.
- Dialect selection uses exact `$schema` identities. Unknown identities fail with `UNKNOWN_METASCHEMA`.
- `compile()` metavalidates reachable resources by default. `{ validateSchema: false }` changes that step and keeps every other compile-time check active.

## Execution model and limits

| Behavior                         | Current contract                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution                        | Synchronous interpreted JavaScript.                                                                                                                                                                                                                                                                                  |
| Runtime code generation          | None. SchemaShield does not call `eval()` or `new Function()`.                                                                                                                                                                                                                                                       |
| Implicit I/O                     | None. Compilation and validation do not fetch, read files, query DNS, or access remote schemas.                                                                                                                                                                                                                      |
| Runtime dependencies             | None.                                                                                                                                                                                                                                                                                                                |
| Failure selection                | First failure only.                                                                                                                                                                                                                                                                                                  |
| `failFast: true`                 | Usually returns `error: true` from a validator. The unknown-type compile edge can throw `true`.                                                                                                                                                                                                                      |
| `failFast: false`                | Returns a causal `ValidationError` for built-ins and `defineError()` failures. It does not aggregate all errors.                                                                                                                                                                                                     |
| Runtime recursion                | Controlled by `maxDepth`, default `128`, configurable from `1` through `256`.                                                                                                                                                                                                                                        |
| Compile graph depth              | Fixed at `128`, independent of `maxDepth`.                                                                                                                                                                                                                                                                           |
| Cyclic JavaScript schema graph   | Rejected with `CYCLIC_SCHEMA_GRAPH`.                                                                                                                                                                                                                                                                                 |
| Recursive JSON Schema references | Supported for registered and local resources, subject to runtime depth control.                                                                                                                                                                                                                                      |
| Defaults                         | Can mutate data. Invalid inserted defaults can remain after a normal failed validation.                                                                                                                                                                                                                              |
| Immutable mode                   | Clones the root with `structuredClone`. Class instances lose their original prototype, and unsupported values make cloning throw. |
| Schema registration              | Snapshot-based, additive, local, and per instance. No overwrite or removal.                                                                                                                                                                                                                                          |
| Built-in metaschemas             | Shared, immutable, and ready for local resolution on every instance. Modern drafts include the complete graphs of implemented vocabulary resources.                                                                                                                                                                  |
| Schema validation                | `compile()` validates every reachable resource by default. `validateSchema(schema)` validates the schema document passed to that call.                                                                                                                                                                                |
| Empty object schema              | Rejected at the root. Use `true` for an explicit always-valid schema.                                                                                                                                                                                                                                                |
| Registry getters                 | Missing names can return `undefined` at runtime despite declarations that say `false`.                                                                                                                                                                                                                               |

## Error codes

The following machine-readable codes are emitted by current constructor, registration, compilation, and depth checks:

| Code                          | Meaning                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `INVALID_MAX_DEPTH`           | `maxDepth` is not an integer from `1` through `256`.                                            |
| `INVALID_USE_DEFAULTS`        | `useDefaults` is not `false`, `true`, or `"empty"`.                                             |
| `INVALID_SCHEMA`              | A schema supplied to `addSchema()` is not an accepted JSON-compatible schema object or boolean. |
| `INVALID_ADD_SCHEMA_OPTIONS`  | The `addSchema()` options value is not an object.                                               |
| `INVALID_COMPILE_OPTIONS`     | The `compile()` options or `validateSchema` value is invalid.                                   |
| `INVALID_SCHEMA_URI`          | `options.uri` is not an absolute, fragment-free URI.                                            |
| `INVALID_SCHEMA_ID`           | A schema identifier is invalid, missing when required, or resolves incorrectly.                 |
| `INVALID_SCHEMA_ALIAS`        | Aliases are malformed or contain an invalid identity.                                           |
| `DUPLICATE_SCHEMA_ID`         | Two registered or reachable schema resources claim the same identity.                           |
| `BUILTIN_SCHEMA_ID_COLLISION` | A registration tries to replace a built-in metaschema identity with different content.          |
| `INVALID_ANCHOR`              | An anchor does not satisfy the selected dialect's anchor syntax.                                |
| `DUPLICATE_ANCHOR`            | Two reachable nodes claim the same anchor identity.                                             |
| `REFERENCE_NOT_FOUND`         | A reachable reference cannot be resolved from local or registered resources.                    |
| `UNKNOWN_REQUIRED_VOCABULARY` | A custom modern metaschema requires a vocabulary SchemaShield does not recognize.               |
| `UNKNOWN_METASCHEMA`          | `$schema` does not exactly identify a built-in or registered custom metaschema.                  |
| `CYCLIC_SCHEMA_GRAPH`         | The input contains a cycle in the JavaScript object graph of schema nodes.                      |
| `MAX_COMPILE_DEPTH_EXCEEDED`  | The schema graph exceeds the fixed compile-depth limit.                                         |
| `MAX_DEPTH_EXCEEDED`          | Recursive runtime validation exceeds `maxDepth`.                                                |

Validation keywords can produce `ValidationError` objects without one of these codes. Custom keywords can define application-specific codes through `defineError()`.

## Development

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run dev:test
```

Run the SchemaShield benchmark against the draft-06 test corpus:

```bash
npm run benchmark
```

Create a local baseline under the ignored `./tmp` directory, then compare a
later run against it:

```bash
npm run benchmark:baseline
npm run benchmark:compare
```

The benchmark checks every measured case against its expected JSON Schema
result before it reports nanoseconds per operation and operations per second.
Baseline comparison reports the largest ratios without enforcing a noisy,
machine-dependent release threshold.

Regenerate the committed metaschema snapshot from the pinned local sources. This
command verifies every SHA-256 digest and works entirely from local files:

```bash
npm run generate:metaschemas
```

Maintainers can explicitly refresh those sources from the pinned commits in the
official JSON Schema specification repository:

```bash
npm run update:metaschemas
```

Network access is isolated to the explicit update command. The normal build reads
`meta-schemas/manifest.json`, verifies the 18 local source files, and regenerates
`lib/official-meta-schemas.json` deterministically. The manifest records each
upstream commit, path, canonical URI, and SHA-256 digest. License and attribution
data ship under `meta-schemas/`.

Build the distribution:

```bash
npm run build
```

## Contributing

Contributions that improve validation behavior, compatibility, developer experience, documentation, or interpreted execution are welcome.

Before opening a pull request:

1. Add or update the relevant tests and documentation.
2. Run the functional suite.
3. Build the distribution when package output changes.
4. Explain the behavior change and its motivation.

## Acknowledgments

SchemaShield acknowledges AJV and the broader JSON Schema community for the public engineering work that has inspired this validator design.

## License

Copyright Masquerade Circus.

Licensed under Apache-2.0. See [`LICENSE`](LICENSE).
