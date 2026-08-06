# SchemaShield reference

This document contains the advanced and exhaustive contracts for SchemaShield. Start with the adoption guide in [README.md](README.md) for installation, configuration choices, request-validation patterns, and integration limits.

## Contents

- [Package exports](#package-exports)
- [Public TypeScript types](#public-typescript-types)
- [Constructor](#constructor)
- [SchemaShield methods](#schemashield-methods)
- [Validator contract](#validator-contract)
- [ValidationError](#validationerror)
- [deepClone](#deepclone)
- [Extension contracts](#extension-contracts)
- [Schema resource contracts](#schema-resource-contracts)
- [Format policy matrices](#format-policy-matrices)
- [JSON Schema compatibility](#json-schema-compatibility)
- [Non-standard root literals](#non-standard-root-literals)
- [Execution limits](#execution-limits)
- [Error codes](#error-codes)

## Package exports

The package root has three runtime exports and no default export.

| Export | Kind | Purpose |
| --- | --- | --- |
| `SchemaShield` | Class | Owns configuration, extension registries, schema resources, and compilation. |
| `ValidationError` | Class | Represents detailed compilation or validation failures. |
| `deepClone` | Function | Clones values with the platform's structured clone algorithm. |

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

## Public TypeScript types

### `Result`

```typescript
type Result = void | ValidationError | true;
```

Low-level validation and extension functions return nothing on success, `true` for a minimal failure, or `ValidationError` for a detailed failure.

### `ValidationResult`

```typescript
interface ValidationResult {
  data: any;
  error: ValidationError | null | true;
  valid: boolean;
}
```

Validators and `validateSchema()` return this shape.

### `JSONSchema`

```typescript
type JSONSchema = boolean | Record<string, any>;
```

Schema registration accepts portable boolean or object roots. `shield.compile(value, { validateSchema: false })` exposes a non-standard path for cloneable literals and arrays by explicitly skipping metavalidation. Portable schemas should express literal values with `const` or `enum`. See [Non-standard root literals](#non-standard-root-literals).

### `AddSchemaOptions`

```typescript
interface AddSchemaOptions {
  uri?: string;
  aliases?: readonly string[];
}
```

`uri` is an absolute, fragment-free retrieval identity. Every alias adds an equivalent absolute, fragment-free identity.

### `CompileOptions`

```typescript
interface CompileOptions {
  validateSchema?: boolean;
}
```

`validateSchema` defaults to `true`. Set it to `false` only when the complete reachable graph was validated earlier in the application pipeline.

### `ValidateSubschemaFunction`

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

This optional custom-keyword helper performs nested validation. It participates in depth guards, evaluated-item tracking, and default rollback. The `evaluated` argument can identify a property or item and can mark unevaluated handling or discard annotations. `savepoint()` and `rollback()` expose mutation-journal controls when the compiled schema requires them.

### `KeywordFunction`

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

The root export is `KeywordFunction`. The helper types nested inside `defineError` are not separate package-root exports.

### `TypeFunction`

```typescript
interface TypeFunction {
  (data: any): boolean;
}
```

### `FormatFunction`

```typescript
interface FormatFunction {
  (data: any): boolean;
}
```

SchemaShield invokes format functions only for string data.

### `ValidateFunction`

```typescript
interface ValidateFunction {
  (data: any): Result;
}
```

This is the low-level callable stored as `$validate` on a compiled schema. Applications normally call `Validator`.

### `CompiledSchema`

```typescript
interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}
```

`CompiledSchema` is the interpreted graph produced by compilation. It is exposed for inspection and extension interoperability. Treat undocumented properties as implementation details.

### `Validator`

```typescript
interface Validator {
  (data: any): ValidationResult;
  compiledSchema: CompiledSchema;
}
```

## Constructor

```typescript
new SchemaShield(options?: {
  immutable?: boolean;
  failFast?: boolean;
  format?: boolean;
  maxDepth?: number;
  useDefaults?: boolean | "empty";
})
```

| Option | Default | Contract |
| --- | --- | --- |
| `immutable` | `false` | Clones the root with `structuredClone` before validation. Class instances lose their prototypes and unsupported values make cloning throw. |
| `failFast` | `true` | Uses `true` as the normal failure sentinel. `false` enables causal `ValidationError` objects. Both modes stop at the first failure. |
| `format` | Omitted | `true` asserts registered formats in every dialect. `false` disables optional assertions. Omission follows the selected dialect. |
| `maxDepth` | `128` | Controls recursive runtime validation. Accepts integers from `1` through `256`. |
| `useDefaults` | `false` | Accepts `false`, `true`, or `"empty"`. |

Each instance has independent type, format, keyword, ordinary-resource, and custom-metaschema registries. Official metaschemas and their cached validators are shared immutable built-ins.

## SchemaShield methods

### `compile(schema, options)`

```typescript
compile(schema: any, options?: CompileOptions): Validator
```

Validates every reachable resource against its declared metaschema by default, resolves the complete reachable local graph, and returns a synchronous reusable validator. `{ validateSchema: false }` skips the metavalidation step while preserving reference resolution and other compile-time checks.

Boolean roots retain JSON Schema boolean semantics. Schema-like objects compile as schemas. Cloneable literals and arrays are rejected by the default metavalidation path. Their non-standard compilation behavior requires `compile(value, { validateSchema: false })`, which omits metavalidation. Portable schemas should use `const` or `enum`.

Compilation can throw a `ValidationError`. The current fail-fast unknown-type edge can throw the literal `true`. The compile graph has a fixed depth limit of `128`, separate from runtime `maxDepth`.

Schemas with an official `$schema` must satisfy that metaschema, including its standard `type` names. Schemas without `$schema` retain native compatibility behavior for custom types, custom keywords, and non-standard extensions.

Current schema-shape edges:

- An empty object root, `{}`, is rejected as `Invalid schema`. Use `true` for an explicit always-valid root.
- If every name in `type` is unknown, `failFast: true` can throw `true` during compilation. `failFast: false` throws a `ValidationError`.

### `validateSchema(schema)`

```typescript
validateSchema(schema: any): ValidationResult
```

Validates one schema against the exact built-in or custom metaschema selected by `$schema`. A malformed or unknown identity throws `UNKNOWN_METASCHEMA`. Schemas without `$schema` use native compatibility recognition, including registered custom types and keywords.

### `addSchema(schema, options)`

```typescript
addSchema(schema: JSONSchema, options?: AddSchemaOptions): void
```

Validates registration inputs, snapshots the schema, assigns its identities, and stores it on the instance. It accepts JSON-compatible plain object schemas and boolean schemas. It rejects cyclic object graphs, non-finite numbers, functions, symbols, root arrays, and non-plain schema objects.

All identities must resolve to absolute fragment-free URIs. Boolean schemas require `options.uri`. Registration has no overwrite, removal, loading, or fetching operation.

### `addMetaSchema(schema, options)`

```typescript
addMetaSchema(schema: JSONSchema, options?: AddSchemaOptions): void
```

Registers a custom metaschema as a dialect selector after validating it against its declared parent metaschema. The metaschema must be an object, declare its parent through `$schema`, and provide an absolute root `$id` or explicit `uri`. Unknown required vocabularies, unresolved references, invalid schemas, duplicate identities, and built-in collisions throw synchronously.

### `addType(name, validator, overwrite)`

```typescript
addType(name: string, validator: TypeFunction, overwrite?: boolean): void
```

Registers a synchronous predicate. `overwrite` defaults to `false`. A duplicate active name throws unless overwrite is enabled.

### `getType(name)`

```typescript
getType(name: string): TypeFunction | false
```

Returns a registered predicate. Disabled built-in names can return `false`. An unknown name currently returns `undefined` at runtime although the declaration says `false`.

### `addFormat(name, validator, overwrite)`

```typescript
addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void
```

Registers a synchronous string predicate. `overwrite` defaults to `false`. A duplicate active name throws unless overwrite is enabled.

### `getFormat(name)`

```typescript
getFormat(name: string): FormatFunction | false
```

Returns a registered predicate. An unknown name currently returns `undefined` at runtime although the declaration says `false`.

### `isDefaultFormatValidator(format, validator)`

```typescript
isDefaultFormatValidator(
  format: string,
  validator: FormatFunction
): boolean
```

Returns `true` when `validator` is identical to the original built-in function stored in the static format table. The comparison does not use the validator currently registered on the instance. Built-in format results can be cached, while replacements and custom validators are not treated as defaults.

### `addKeyword(name, validator, overwrite)`

```typescript
addKeyword(
  name: string,
  validator: KeywordFunction,
  overwrite?: boolean
): void
```

Registers a synchronous keyword function. `overwrite` defaults to `false`. A duplicate active name throws unless overwrite is enabled.

### `getKeyword(name)`

```typescript
getKeyword(name: string): KeywordFunction | false
```

Returns the registered keyword function. Some recognized annotations or unsupported names are represented by `false`. An unknown name currently returns `undefined` at runtime although the declaration says `false`.

### `setDefault(target, key, value)`

```typescript
setDefault(target: Record<string, any>, key: string, value: any): void
```

Writes an enumerable, configurable, writable property. During active validation it records the previous property state in the mutation journal. Custom keywords can use it so speculative nested validation can roll the write back. It mutates `target` and does not validate `value` by itself.

### `getSchemaRef(path)`

```typescript
getSchemaRef(path: string): CompiledSchema | undefined
```

Looks up a location in the current compiled root. `"#"` returns the root. A `"#/..."` path uses JSON Pointer decoding. A simple name can resolve a matching legacy `definitions` or `defs` entry or the root's matching identifier. It returns `undefined` without a compiled root or match. Malformed URI encoding or JSON Pointer escapes can throw.

This method inspects the compiled root. It does not query the `addSchema()` registry.

### `getSchemaById(id)`

```typescript
getSchemaById(id: string): CompiledSchema | undefined
```

Traverses the current compiled root and returns the first compiled node whose `$id` or `id` exactly matches `id`. It does not retrieve a resource or directly query the registry.

### `isSchemaLike(subSchema)`

```typescript
isSchemaLike(subSchema: any): boolean
```

Returns `true` for a non-array object containing `type` or at least one name recognized by the instance keyword registry. It returns `false` for booleans, arrays, primitives, and `{}`. This is structural recognition. Use `validateSchema()` for metaschema validation.

## Validator contract

```javascript
const validator = shield.compile(schema);
const result = validator(data);
```

| Member | Meaning |
| --- | --- |
| `result.valid` | `true` when validation succeeds. |
| `result.data` | The validated value, which can be original, mutated by defaults, or an immutable clone. |
| `result.error` | `null` on success, `true` for a minimal failure, or `ValidationError` for a detailed failure. |
| `validator.compiledSchema` | The compiled root used by the validator. |

Data failures return normally. Compilation failures, custom keyword exceptions, clone failures, and programming errors can throw.

## ValidationError

```typescript
new ValidationError(message: string)
```

`ValidationError` extends `Error`.

| Property | Type | Meaning |
| --- | --- | --- |
| `code` | `string \| undefined` | Machine-readable code when defined. |
| `message` | `string` | Human-readable description. |
| `item` | `string \| number \| undefined` | Property or index associated with this causal link. |
| `keyword` | `string` | Keyword associated with the failure. |
| `cause` | `ValidationError \| undefined` | Nested causal failure. |
| `schemaPath` | `string` | JSON Pointer to the resolved root schema failure. |
| `instancePath` | `string` | JSON Pointer to the resolved root data failure. |
| `data` | `any` | Attached failing data when available. |
| `schema` | `CompiledSchema \| undefined` | Attached compiled schema when available. |

Paths are populated while resolving the chain through `getCause()`, `getTree()`, or `getPath()`.

### `getCause()`

```typescript
getCause(): ValidationError
```

Walks the causal chain, populates paths, and returns the deepest reachable error. Cyclic chains are guarded.

### `getTree()`

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

Returns plain nested nodes for the causal chain of the first failure. It is a chain, rather than a collection of independent errors. The tree is not guaranteed to be JSON-serializable because attached data can contain cycles, `BigInt`, or other unsupported JSON values.

### `getPath()`

```typescript
getPath(): {
  schemaPath: string;
  instancePath: string;
}
```

Returns paths for the deepest cause.

## deepClone

```typescript
deepClone<T>(value: T): T
```

Delegates to the platform's `structuredClone`. Supported values include circular references, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed-array views, and `Error`. Class instances lose their original prototype. Functions, promises, weak collections, symbols, and other unsupported values throw the platform clone error.

## Extension contracts

A custom keyword receives the active compiled schema, current data, error factory, active instance, and optional nested-validation helper.

`defineError(message, options)` accepts `code`, `item`, `cause`, and `data`. It returns `true` in fail-fast mode and a `ValidationError` in detailed mode. Return that result to reject the value. Returning `undefined` accepts it.

When present, `validateSubschema()` handles depth accounting, evaluated-item annotations, and default rollback. Use `savepoint()` and `rollback()` only when a custom keyword must coordinate speculative nested validation. Use `setDefault()` for writes that should participate in the mutation journal.

Custom functions form part of the application trust boundary. They can inspect or mutate live values and can throw their own exceptions.

## Schema resource contracts

`addSchema()` stores a local snapshot. URI strings identify resources and never authorize network access.

Registration follows these rules:

- `uri` and every alias must be absolute and fragment-free.
- A root `$id` resolves against `uri` when both are present.
- Without `uri`, the active root `id` or `$id` must already be absolute and fragment-free.
- Boolean schemas require an explicit `uri`.
- The retrieval URI, resolved root identifier, and aliases identify one resource.
- Later mutations to the source object do not affect future compilations.
- New resources affect future `compile()` calls. Existing validators retain their compiled targets.
- Duplicate identities are rejected.
- Registered resources cannot be overwritten or removed.
- Resources can be registered in any order, but every reachable resource must be present by compilation time.
- There is no fetch callback, loader, file access, or remote retrieval fallback.

Built-in metaschema identities are reserved. Registering an exact structural copy preserves the current resource. Different content under a reserved identity throws `BUILTIN_SCHEMA_ID_COLLISION`.

### Custom metaschemas and vocabularies

`addMetaSchema()` creates a custom dialect selector. `addSchema()` always creates an ordinary resource. A custom metaschema is validated against its declared parent before registration. Required vocabulary identities must exactly match an implemented 2019-09 or 2020-12 vocabulary. Unknown required identities throw `UNKNOWN_REQUIRED_VOCABULARY`.

### References and anchors

Compilation resolves local references, relative references, cross-document references, aliases, transitive references, and JSON Pointer fragments. Missing reachable targets throw `REFERENCE_NOT_FOUND`.

Modern dialects support named anchors. Draft 2019-09 supports `$recursiveRef`. Draft 2020-12 supports `$dynamicRef`. Dynamic resolution of a 2019-09 `$recursiveRef` requires the destination root to declare `$recursiveAnchor: true`. Without the anchor, the statically resolved target is used. Invalid or duplicate anchors fail during compilation.

Recursive runtime validation remains subject to `maxDepth`.

## Format policy matrices

### Registered formats

| Schema context | Option omitted | `format: true` | `format: false` |
| --- | --- | --- | --- |
| Without `$schema` | Validates | Validates | Does not validate |
| Official draft | Does not validate | Validates | Does not validate |
| Custom dialect with `format-assertion` | Validates | Validates | Does not compile |
| Custom dialect without `format-assertion` | Does not validate | Validates | Does not validate |

### Unknown formats

| Schema context | Option omitted | `format: true` | `format: false` |
| --- | --- | --- | --- |
| Without `$schema` | Compiles | Compiles | Compiles |
| Official draft | Compiles | Compiles | Compiles |
| Custom dialect with `format-assertion` | Does not compile | Does not compile | Does not compile |
| Custom dialect without `format-assertion` | Compiles | Compiles | Compiles |

`format: false` under an assertion dialect throws `FORMAT_ASSERTION_REQUIRED`. An unknown format under that dialect throws `UNKNOWN_FORMAT`.

Built-in synchronous formats:

- Date and time: `date`, `time`, `date-time`, `duration`
- Email: `email`, `idn-email`
- Host names: `hostname`, `idn-hostname`
- IP addresses: `ipv4`, `ipv6`
- Identifiers and references: `uuid`, `uri`, `uri-reference`, `uri-template`, `iri`, `iri-reference`
- JSON Pointers: `json-pointer`, `relative-json-pointer`
- Regular expressions: `regex`

Formats apply only to strings.

## JSON Schema compatibility

Exact built-in dialect identities:

| Draft | `$schema` identity |
| --- | --- |
| draft-04 | `http://json-schema.org/draft-04/schema#` |
| draft-06 | `http://json-schema.org/draft-06/schema#` |
| draft-07 | `http://json-schema.org/draft-07/schema#` |
| 2019-09 | `https://json-schema.org/draft/2019-09/schema` |
| 2020-12 | `https://json-schema.org/draft/2020-12/schema` |

Implemented keyword families include:

- Types and values: `type`, `enum`, `const`
- Numbers: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`
- Strings: `minLength`, `maxLength`, `pattern`, `format`
- Arrays: `items`, `prefixItems`, `additionalItems`, `contains`, `minContains`, `maxContains`, `minItems`, `maxItems`, `uniqueItems`, `unevaluatedItems`
- Objects: `required`, `properties`, `patternProperties`, `additionalProperties`, `propertyNames`, `dependencies`, `dependentRequired`, `dependentSchemas`, `minProperties`, `maxProperties`, `unevaluatedProperties`
- Composition and conditions: `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`
- References: `$ref`, `$recursiveRef`, `$recursiveAnchor`, `$dynamicRef`
- Content assertions: limited `contentEncoding` and `contentMediaType`
- Compilation annotations: `default`, `definitions`, `$defs`, `$id`, `id`, `$schema`, `title`, `description`, `$comment`, `examples`

Keyword availability follows the selected dialect and recognized vocabulary declarations.

### Non-standard schema keywords

`values` applies one subschema to every own enumerable property value of a non-array object.

```javascript
const validateScores = new SchemaShield().compile({
  type: "object",
  values: { type: "number", minimum: 0 }
});
```

`elements` applies one subschema to every element of an array.

```javascript
const validateTags = new SchemaShield().compile({
  type: "array",
  elements: { type: "string", minLength: 1 }
});
```

Use standard `additionalProperties`, `items`, or `prefixItems` when portability matters.

### Compatibility notes

- `nullable` and `discriminator` are recognized as unsupported keywords and ignored.
- `contentEncoding` validates only `base64` where active for the selected dialect.
- `contentMediaType` validates only `application/json` where active for the selected dialect.
- `contentSchema` is inert. Parsed or decoded content is not validated against it.
- Unknown formats compile unless a custom assertion dialect requires them.
- `enum`, `const`, and `uniqueItems` use structural comparison. Large collections of complex objects can require additional comparison work.
- String-length keywords count Unicode code points.
- Dialect selection uses exact `$schema` identities.

## Non-standard root literals

The non-standard literal path requires an explicit metavalidation opt-out:

```javascript
const validator = shield.compile(value, { validateSchema: false });
```

The default `compile(value)` path metavalidates its input and rejects literal or array roots with `INVALID_SCHEMA`. Setting `validateSchema: false` omits that metavalidation step. The non-standard path then wraps cloneable literals and arrays internally as literal branches of `oneOf`.

Primitive literals use strict equality. Strings, numbers other than `NaN`, `null`, `undefined`, and `BigInt` can match their retained value. `NaN` compiles but never matches because strict equality treats it as unequal to itself.

Arrays are retained as literal branches. A separately created structurally equal array does not match because comparison uses identity. Only the exact array retained in `validator.compiledSchema` can match.

Snapshot creation throws for values unsupported by `structuredClone`, including functions and symbols. Portable schemas should express literals through `const` or `enum` instead of disabling metavalidation.

## Execution limits

| Behavior | Contract |
| --- | --- |
| Execution | Synchronous interpreted JavaScript. |
| Runtime source-code generation | None. |
| Implicit runtime I/O | None during compilation or validation. |
| Failure selection | First failure only. |
| Runtime recursion | `maxDepth`, default `128`, configurable from `1` through `256`. |
| Compile graph depth | Fixed at `128`, independent of `maxDepth`. |
| Cyclic JavaScript schema graph | Rejected with `CYCLIC_SCHEMA_GRAPH`. |
| Recursive schema references | Supported, subject to runtime depth control. |
| Defaults | Mutating when enabled. Invalid inserted values can remain after failure. |
| Immutable mode | Uses `structuredClone` and inherits its limitations. |
| Resource registration | Snapshot-based, additive, local, and per instance. |
| Root `{}` | Rejected. Use `true` for an always-valid root. |
| Registry getters | Missing names can return `undefined` despite declarations that say `false`. |

## Error codes

| Code | Meaning |
| --- | --- |
| `INVALID_MAX_DEPTH` | `maxDepth` is not an integer from `1` through `256`. |
| `INVALID_USE_DEFAULTS` | `useDefaults` is not `false`, `true`, or `"empty"`. |
| `INVALID_FORMAT` | The constructor's `format` option is present and is not boolean. |
| `FORMAT_ASSERTION_REQUIRED` | `format: false` conflicts with a required `format-assertion` vocabulary. |
| `UNKNOWN_FORMAT` | A required asserted format is unregistered. |
| `INVALID_SCHEMA` | `addSchema()` received an unsupported schema value, or the default metavalidation in `compile(value)` rejected the input as a schema, including literal and array roots. |
| `INVALID_ADD_SCHEMA_OPTIONS` | Registration options are not an object. |
| `INVALID_COMPILE_OPTIONS` | Compile options or `validateSchema` are invalid. |
| `INVALID_SCHEMA_URI` | `options.uri` is not absolute and fragment-free. |
| `INVALID_SCHEMA_ID` | A schema identifier is invalid, missing, or resolves incorrectly. |
| `INVALID_SCHEMA_ALIAS` | Aliases are malformed or contain an invalid identity. |
| `DUPLICATE_SCHEMA_ID` | Two registered or reachable resources claim one identity. |
| `BUILTIN_SCHEMA_ID_COLLISION` | Different content attempts to claim a built-in identity. |
| `INVALID_ANCHOR` | An anchor violates the selected dialect's syntax. |
| `DUPLICATE_ANCHOR` | Two reachable nodes claim one anchor identity. |
| `REFERENCE_NOT_FOUND` | A reachable reference cannot resolve locally. |
| `UNKNOWN_REQUIRED_VOCABULARY` | A custom modern metaschema requires an unrecognized vocabulary. |
| `UNKNOWN_METASCHEMA` | `$schema` does not exactly identify a built-in or registered custom metaschema. |
| `CYCLIC_SCHEMA_GRAPH` | The input schema object graph contains a cycle. |
| `MAX_COMPILE_DEPTH_EXCEEDED` | The graph exceeds the fixed compilation limit. |
| `MAX_DEPTH_EXCEEDED` | Recursive runtime validation exceeds `maxDepth`. |

Validation keywords can return `ValidationError` objects without one of these codes. Custom keywords can define application codes through `defineError()`.
