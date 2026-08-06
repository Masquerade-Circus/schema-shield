# SchemaShield 🛡️

**High-performance JSON Schema validation for Node.js, Bun, and compatible serverless or edge runtimes.**

**Zero runtime code generation. Near-zero validation overhead on cold starts.**

SchemaShield supports five JSON Schema drafts without runtime source-code generation, implicit I/O, or runtime dependencies. Compile a validator once per process or isolate, reuse it across requests, and validate JSON data or live JavaScript objects synchronously.

- Near-zero validation overhead on cold starts
- High sustained validation throughput
- No `eval()` or `new Function()`
- No implicit network, file, or DNS access during compilation or validation
- Zero runtime dependencies
- JSON Schema draft-04, draft-06, draft-07, 2019-09, and 2020-12
- Nineteen built-in official metaschema resources and compile-time metavalidation
- Reusable synchronous validators
- Custom types, formats, keywords, and local schema resources
- ESM, CommonJS, and TypeScript declarations

## Install

```bash
npm install schema-shield
```

```bash
bun add schema-shield
```

Node.js package entry points require Node.js 18 or later. The package root supports ESM and CommonJS and has no default export.

```javascript
import { SchemaShield } from "schema-shield";
```

```javascript
const { SchemaShield } = require("schema-shield");
```

## Quick start

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

Every validator returns the same result shape:

```typescript
{
  data: any;
  error: ValidationError | null | true;
  valid: boolean;
}
```

Successful validation returns `error: null`. The default `failFast: true` mode returns `error: true` for normal data failures and avoids constructing detailed errors. Set `failFast: false` before calling `getPath()`, `getCause()`, or `getTree()`.

## Choose a configuration

| Goal                                               | Configuration                                |
| -------------------------------------------------- | -------------------------------------------- |
| Minimal error construction                         | `new SchemaShield()`                         |
| Detailed causal errors                             | `new SchemaShield({ failFast: false })`      |
| Apply defaults to absent or `undefined` properties | `new SchemaShield({ useDefaults: true })`    |
| Also apply defaults to `null` and `""`             | `new SchemaShield({ useDefaults: "empty" })` |
| Preserve structured-clone-compatible input         | `new SchemaShield({ immutable: true })`      |
| Validate every registered format across dialects   | `new SchemaShield({ format: true })`         |
| Disable optional format assertions                 | `new SchemaShield({ format: false })`        |
| Change the recursive validation limit              | `new SchemaShield({ maxDepth: 64 })`         |

Constructor defaults are `immutable: false`, `failFast: true`, `maxDepth: 128`, and `useDefaults: false`. The `format` option is omitted by default so the selected dialect controls format behavior.

## Compile once and reuse

Compilation resolves references and metavalidates the reachable schema graph by default. Keep compilation outside the request path and reuse the returned function within the current process or isolate.

### Persistent server

```javascript
import { SchemaShield } from "schema-shield";

const validateRequest = new SchemaShield().compile({
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" }
  },
  required: ["name", "email"],
  additionalProperties: false
});

app.post("/users", (request, response) => {
  const result = validateRequest(request.body);

  if (!result.valid) {
    return response.status(400).json({ error: "Invalid request" });
  }

  return response.status(201).json(result.data);
});
```

Each process or worker isolate creates and retains its own validator. A compiled JavaScript function is not shared automatically across processes or worker threads.

### Serverless and edge pattern

SchemaShield suits serverless and edge runtimes that support the package's JavaScript requirements. The following Cloudflare Workers pattern compiles at module scope, parses the request body before validation, and separates malformed JSON from schema failures:

```javascript
import { SchemaShield } from "schema-shield";

const validateRequest = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" }
  },
  required: ["name", "email"],
  additionalProperties: false
});

export default {
  async fetch(request) {
    let data;

    try {
      data = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = validateRequest(data);

    if (!result.valid) {
      return Response.json({ error: result.error.getPath() }, { status: 400 });
    }

    return Response.json(result.data);
  }
};
```

This is an integration pattern for a compatible Worker runtime, rather than a certification of every serverless or edge platform.

## Errors report the first failing path

SchemaShield stops at the first failing validation path in both error modes.

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
  // {
  //   schemaPath: "#/properties/profile/properties/age/minimum",
  //   instancePath: "#/profile/age"
  // }

  console.log(result.error.getTree());
}
```

`getTree()` returns the nested causal chain for that first failure. It does not collect independent failures from the rest of the input. Custom keywords should return the value from `defineError()` to participate in the selected error mode.

## Defaults and input mutation

The `default` keyword remains an annotation until `useDefaults` is enabled.

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

`useDefaults: true` replaces absent or `undefined` object properties. `useDefaults: "empty"` also replaces `null` and empty strings. It leaves `0`, `false`, empty arrays, and empty objects unchanged. Object and array defaults are cloned for each validation. Nested defaults apply when their containing object already exists or the container itself receives a default.

Defaults mutate the value being validated. Inserted defaults are validated normally, and an invalid default can remain on mutable input after validation fails.

### Preserve compatible input with `immutable`

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
```

Immutable mode clones the root with the platform's `structuredClone`. Class instances lose their original prototype. Functions, promises, weak collections, symbols, and other unsupported values make cloning throw. Keep `immutable` disabled when prototype or reference identity matters.

## Drafts, metaschemas, and formats

SchemaShield supports these five JSON Schema drafts through exact `$schema` identities:

| Draft    | `$schema`                                      |
| -------- | ---------------------------------------------- |
| draft-04 | `http://json-schema.org/draft-04/schema#`      |
| draft-06 | `http://json-schema.org/draft-06/schema#`      |
| draft-07 | `http://json-schema.org/draft-07/schema#`      |
| 2019-09  | `https://json-schema.org/draft/2019-09/schema` |
| 2020-12  | `https://json-schema.org/draft/2020-12/schema` |

Nineteen official metaschema and vocabulary resources are built in. `compile()` validates every reachable schema resource against its declared metaschema by default. This support statement describes implemented draft behavior and does not claim third-party certification of complete conformance.

```javascript
const validate = new SchemaShield().compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "string",
  minLength: 1
});
```

Use `compile(schema, { validateSchema: false })` only when your application has already validated the complete reachable schema graph. Reference resolution and other compile-time checks remain active.

### Format policy

- `format: true` validates registered formats in every dialect.
- `format: false` disables optional format validation, but conflicts with a custom dialect that requires `format-assertion`.
- With `format` omitted, schemas without `$schema` validate registered formats.
- With `format` omitted, official dialects treat formats as annotations.
- A custom dialect that requires `format-assertion` validates registered formats and rejects unknown ones.

Built-in synchronous formats include date and time, email, host names, IP addresses, UUID, URI and IRI families, JSON Pointers, regular expressions, and duration. String lengths count Unicode code points.

The complete policy matrix and format catalog are in [REFERENCE.md](REFERENCE.md#format-policy-matrices).

## Local schema resources and `$ref`

SchemaShield never retrieves schemas from the network. HTTP and HTTPS URIs work as identifiers in the built-in and per-instance local registries.

```javascript
const shield = new SchemaShield();

shield.addSchema(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "address.json",
    type: "object",
    properties: {
      city: { type: "string", minLength: 1 }
    },
    required: ["city"]
  },
  { uri: "https://schemas.example/address" }
);

const validateCustomer = shield.compile({
  type: "object",
  properties: {
    address: { $ref: "https://schemas.example/address" }
  },
  required: ["address"]
});
```

The HTTPS URI above performs no request. Every reachable resource must be registered before compilation. Registration stores a snapshot, affects future compilations, rejects duplicate identities, and offers no overwrite or removal operation.

Local fragments, JSON Pointers, relative and cross-document references, named anchors, draft 2019-09 recursive references, and draft 2020-12 dynamic references resolve during compilation. An unresolved reachable reference throws synchronously.

See [Schema resource contracts](REFERENCE.md#schema-resource-contracts) for identities, aliases, collisions, anchors, and custom metaschemas.

## Extend validation for your domain

Registrations belong to one `SchemaShield` instance and affect validators compiled from that instance.

### Custom type

```javascript
class Invoice {
  constructor(total) {
    this.total = total;
  }
}

const shield = new SchemaShield();
shield.addType("invoice", (value) => value instanceof Invoice);

const validateInvoice = shield.compile({ type: "invoice" });
```

### Custom format

```javascript
const shield = new SchemaShield();

shield.addFormat("ticket-id", (value) => /^TKT-[0-9]{6}$/.test(value));

const validateTicket = shield.compile({
  type: "string",
  format: "ticket-id"
});
```

### Custom keyword

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

Types, formats, and keywords reject an existing active name unless `overwrite: true` is supplied. Custom functions execute synchronously and may inspect or mutate live values, so they belong to the application's trust boundary. Advanced nested-keyword helpers and mutation rollback contracts are documented in [REFERENCE.md](REFERENCE.md#extension-contracts).

## Integration limits that affect decisions

| Behavior                       | Current contract                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Execution                      | Synchronous interpreted JavaScript.                                                         |
| Runtime source-code generation | None. SchemaShield does not call `eval()` or `new Function()`.                              |
| Implicit I/O                   | Compilation and validation do not fetch, read files, query DNS, or retrieve remote schemas. |
| Runtime dependencies           | None.                                                                                       |
| Failure selection              | The first failing path only.                                                                |
| Runtime recursion              | `maxDepth` defaults to `128` and accepts integers from `1` through `256`.                   |
| Compile graph depth            | A separate fixed limit of `128`.                                                            |
| Defaults                       | Can mutate data. An invalid inserted default can remain after failure.                      |
| Immutable mode                 | Uses `structuredClone` and inherits its prototype and value limitations.                    |
| Formats                        | Assertion behavior depends on the constructor option and selected dialect.                  |
| Root `{}`                      | Currently rejected as an invalid root schema. Use `true` for an explicit always-valid root. |
| Schema resources               | Local, snapshot-based, additive, and per instance.                                          |

Data-validation failures return a result. Compilation errors, custom keyword exceptions, clone failures, and programming errors can throw. The fail-fast unknown-type compile edge can currently throw the literal `true`. Detailed behavior and machine-readable codes are listed in [REFERENCE.md](REFERENCE.md#error-codes).

## Measured performance

Measured execution covers sustained throughput with reusable validators. Cold execution covers a fresh context, validator construction, configuration, registrations and setup when required, followed by the first validation. It excludes process startup and module import, so near-zero refers specifically to validator overhead rather than runtime or platform startup. Every measured case must produce its expected result before its timing is accepted.

The repository also includes a correctness-gated sustained validation benchmark for local baselines:

```bash
npm run benchmark
npm run benchmark:baseline
npm run benchmark:compare
```

Use application-specific schemas on the target runtime for capacity planning. Local baselines remain machine-dependent and compare SchemaShield runs on the same environment.

## Full reference

[REFERENCE.md](REFERENCE.md) contains the exhaustive API contracts, public TypeScript types, advanced extension hooks, resource rules, format matrices, compatibility notes, non-standard literal compilation behavior, and error-code catalog.

## Development

```bash
npm test
npm run dev:test
npm run build
```

The normal build reads pinned local metaschema sources, verifies their SHA-256 digests, and regenerates the bundled snapshot deterministically. `npm run update:metaschemas` is the explicit maintenance command that accesses the network.

## Contributing

Contributions that improve validation behavior, compatibility, developer experience, documentation, or interpreted execution are welcome. Update relevant tests and documentation, run the functional suite, build when package output changes, and explain the behavior change.

## Acknowledgments

SchemaShield acknowledges [Ajv](https://github.com/ajv-validator/ajv), [@exodus/schemasafe](https://github.com/ExodusOSS/schemasafe), and the broader JSON Schema community for the public engineering work that inspired this validator design.

## Documentation for humans and agents

- [`llms.txt`](llms.txt) provides compact integration context for language models and other agents.
- [`SKILL.md`](SKILL.md) provides the canonical agent skill instructions for recommending and integrating SchemaShield.

## License

Copyright Masquerade Circus.

Licensed under Apache-2.0. See [LICENSE](LICENSE).
