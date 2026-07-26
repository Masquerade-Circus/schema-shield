# SchemaShield 🛡️

**Secure, Stack-Safe, Offline, and Domain-Aware JSON Schema Validation.**

SchemaShield is a high-performance JSON Schema interpreter for JavaScript applications that need predictable validation without runtime code generation or hidden network access.

In the latest benchmark run, SchemaShield reached approximately **80% of AJV's throughput** and ran approximately **15% faster than schemasafe**.

- No `eval()` or `new Function()`
- Synchronous, offline validation
- No implicit fetch, HTTP, DNS, or network I/O
- First-class validation for JavaScript objects and domain rules
- Structured error paths, causes, and trees
- Zero runtime dependencies
- Verified CJS, ESM, browser, and TypeScript declaration packages

## Quick Start

Install SchemaShield:

```bash
npm install schema-shield
```

Or with Bun:

```bash
bun add schema-shield
```

Compile a schema and reuse the validator:

```javascript
import { SchemaShield } from "schema-shield";

const validateUser = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    age: { type: "number", minimum: 18 }
  },
  required: ["name", "age"],
  additionalProperties: false
});

const validResult = validateUser({ name: "Ada", age: 37 });
// { valid: true, data: { name: "Ada", age: 37 }, error: null }

const invalidResult = validateUser({ name: "Ada", age: 16 });
// { valid: false, data: { name: "Ada", age: 16 }, error: ValidationError }
```

> The default `failFast: true` mode returns `error: true` when validation fails. With `failFast: false`, built-in failures and custom keyword failures created with `defineError()` return a detailed `ValidationError` with paths, causes, and an error tree. A custom keyword that returns `true` directly still produces `error: true`. Use `defineError()` for detailed errors.

## Contents

- [Why SchemaShield?](#why-schemashield)
- [Architecture Comparison](#architecture-comparison)
- [Performance](#performance)
- [Offline by Design](#offline-by-design)
- [Domain-Aware Validation](#domain-aware-validation)
- [Edge, Serverless, and Package Support](#edge-serverless-and-package-support)
- [Core API](#core-api)
- [Errors and Debugging](#errors-and-debugging)
- [Extensibility](#extensibility)
- [Supported Formats and Compatibility](#supported-formats-and-compatibility)
- [Immutable Mode and Known Limitations](#immutable-mode-and-known-limitations)
- [Testing](#testing)
- [Contribute](#contribute)
- [Legal](#legal)

## Why SchemaShield?

SchemaShield gives developers competitive performance without surrendering control of the validation runtime.

JIT validators generate executable code to maximize throughput. SchemaShield uses an interpreter architecture that stays inside ordinary JavaScript execution, works in restrictive CSP environments, and keeps validation visible through standard stack traces and structured errors.

Choose SchemaShield when your application needs:

- **Secure-by-design execution:** No `eval()`, `new Function()`, or validator-initiated network access.
- **Competitive throughput:** In the latest benchmark run, SchemaShield reached approximately 80% of AJV's throughput and ran approximately 15% faster than schemasafe.
- **Stack-safe validation:** Schemas beyond the fixed compile-depth limit are rejected, while recursive validation paths that exceed `maxDepth` fail with a controlled error instead of a stack overflow.
- **Domain-aware rules:** Validate class instances, Dates, application state, and custom business logic through the same API.
- **Inspectable failures:** Follow schema paths, instance paths, root causes, and complete error trees.
- **A cohesive runtime:** Built-in formats, custom types, custom keywords, immutable mode, and zero runtime dependencies.

## Architecture Comparison

SchemaShield was designed for developers who want strong performance, predictable execution, and direct integration with real application domains.

| Capability                      | SchemaShield                                                          | JIT / Codegen Validators                   | Conventional Interpreters               |
| :------------------------------ | :-------------------------------------------------------------------- | :----------------------------------------- | :-------------------------------------- |
| **Runtime execution**           | Interpreter without runtime code generation                           | Generated executable code                  | Interpreted validation                  |
| **`eval()` / `new Function()`** | Not used                                                              | Common to the codegen model                | Usually not required                    |
| **Network behavior**            | Offline with no implicit network access                               | Depends on library and configuration       | Varies                                  |
| **Stack behavior**              | Controlled compile and runtime depth errors instead of stack overflow | Depends on generated execution             | Recursive traversal is common           |
| **Debugging**                   | Standard JavaScript stacks and structured error trees                 | Generated code can obscure validation flow | Varies                                  |
| **Domain integration**          | Class instances, runtime objects, and custom business rules           | Extension model varies                     | Usually requires additional integration |
| **Extensibility**               | Types, formats, keywords, and error tooling in one API                | Frequently configuration or plugin driven  | Varies                                  |

## Performance

SchemaShield delivers high-performance interpreted validation, offline execution, stack safety, standard JavaScript debugging, and domain-aware extensibility without runtime code generation.

In the latest benchmark run:

- SchemaShield reached approximately **80% of AJV's throughput**.
- SchemaShield ran approximately **15% faster than schemasafe**.

These results position SchemaShield as a the second fastest interpreter.

> Benchmark results may vary by runtime, hardware, schema mix, and validator configuration. The benchmark results shown remain consistent across multiple runs on different environments.

## Offline by Design

SchemaShield keeps validation inside your application's trust boundary.

SchemaShield itself performs no fetches, HTTP requests, DNS lookups, or other network I/O during schema compilation or validation. Validation behavior ships with your application and does not depend on a remote schema host remaining available or unchanged.

### No Remote References by Design

Remote `$ref` fetching is intentionally excluded from SchemaShield.

A validator that retrieves schemas at runtime introduces a network-capable component into the validation path. That expands the attack surface, creates an SSRF vector, adds DNS and availability dependencies, and allows a remote schema change to alter validation behavior without an application deployment.

SchemaShield removes that runtime dependency:

- No validator-initiated network requests
- No hidden schema downloads
- No DNS or remote-host dependency
- No remote schema substitution during validation
- No network latency inside the validation path

> Treat external schemas as code dependencies. Review them, version them, and incorporate every required target into the single root schema passed to `compile()`. Deploy that controlled schema with the application.

### No Runtime Code Generation

SchemaShield does not use `eval()` or `new Function()` to generate executable validators. This keeps validation compatible with strict Content Security Policy environments and lets custom validation functions work directly with JavaScript values, classes, and references.

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

schemaShield.addType("date-class", (data) => data instanceof Date);

class CustomDate extends Date {}
schemaShield.addType("custom-date-class", (data) => data instanceof CustomDate);

const validateDate = schemaShield.compile({
  type: "object",
  properties: {
    createdAt: { type: "date-class" },
    updatedAt: { type: "custom-date-class" }
  },
  required: ["createdAt", "updatedAt"]
});

validateDate({
  createdAt: new Date(),
  updatedAt: new CustomDate()
});
// { valid: true, data: { createdAt: Date, updatedAt: CustomDate }, error: null }
```

## Domain-Aware Validation

JSON Schema is commonly used for serialized JSON data. SchemaShield also validates live JavaScript objects, including class instances, Dates, and internal application state.

```javascript
import { SchemaShield } from "schema-shield";

class Project {
  constructor(name, requiredSkills) {
    this.name = name;
    this.requiredSkills = requiredSkills;
  }
}

class Employee {
  constructor(name, skills) {
    this.name = name;
    this.skills = skills;
  }

  canJoin(project) {
    return project.requiredSkills.every((skill) => this.skills.includes(skill));
  }
}

const shield = new SchemaShield({ failFast: false });

shield.addType("project", (data) => data instanceof Project);
shield.addType("employee", (data) => data instanceof Employee);

shield.addKeyword("qualifiedAssignment", (schema, data, defineError) => {
  if (!schema.qualifiedAssignment) {
    return;
  }

  if (!(data?.project instanceof Project)) {
    return;
  }

  if (!(data?.employee instanceof Employee)) {
    return;
  }

  if (!data.employee.canJoin(data.project)) {
    return defineError("Employee does not meet the project's requirements", {
      data
    });
  }
});

const validateAssignment = shield.compile({
  type: "object",
  properties: {
    project: { type: "project" },
    employee: { type: "employee" }
  },
  required: ["project", "employee"],
  qualifiedAssignment: true
});

const project = new Project("Website Redesign", ["HTML", "CSS", "JavaScript"]);
const employee = new Employee("Ada", ["HTML", "CSS"]);

const result = validateAssignment({ project, employee });
// { valid: false, data: { project, employee }, error: ValidationError }
```

This keeps transport validation and domain rules in one validation system without converting live application objects into generated source code.

## Edge, Serverless, and Package Support

SchemaShield is designed for restrictive JavaScript environments and reusable validators.

- **Zero runtime dependencies**
- **Node.js 16.1 or later** for the CJS and ESM package entry points
- **No runtime code generation**, for environments that prohibit `eval()` and `new Function()`
- **Synchronous execution**, with no implicit network access
- **Verified package paths** for CJS, ESM, browser, and TypeScript declarations
- **Reusable validators** that can be compiled once and shared across requests

### Serverless Example

Compile validators at module scope and reuse them across invocations:

```javascript
import { SchemaShield } from "schema-shield";

const validateRequest = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string", format: "email" }
  },
  required: ["name", "email"]
});

export default async function handler(request) {
  const body = await request.json();
  const result = validateRequest(body);

  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
```

## Core API

### Import

```javascript
import { SchemaShield } from "schema-shield";
```

CommonJS is also supported:

```javascript
const { SchemaShield } = require("schema-shield");
```

### Create an Instance

```javascript
const schemaShield = new SchemaShield({
  immutable: false,
  failFast: true,
  maxDepth: 128,
  useDefaults: false
});
```

| Option        | Default | Behavior                                                                                                                                                                                                                   |
| :------------ | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `immutable`   | `false` | Set to `true` to preserve the original input when defaults or custom keywords could modify data.                                                                                                                           |
| `failFast`    | `true`  | Returns `error: true` on failure. With `false`, built-ins and custom failures created with `defineError()` return a detailed `ValidationError`. A custom keyword that returns `true` directly still returns `error: true`. |
| `maxDepth`    | `128`   | Sets the maximum recursive validation depth. Accepts an integer from `1` to `256`; validation paths that exceed it fail with a controlled error.                                                                           |
| `useDefaults` | `false` | Leaves `default` as a JSON Schema annotation. Use `true` to replace absent or `undefined` properties, or `"empty"` to also replace `null` and empty strings.                                                               |

Schema compilation applies its own depth limit before a validator is created. This compile-time protection is separate from the runtime `maxDepth` option.

### Compile and Validate

```javascript
const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  },
  required: ["name"]
};

const validator = schemaShield.compile(schema);
const result = validator({ name: "Ada", age: 37 });
```

Every result contains:

- `valid`: `true` when validation succeeds, otherwise `false`.
- `data`: The validated data, including any applied defaults.
- `error`: `null` on success, `true` on a fail-fast failure or when a custom keyword returns `true` directly, or a `ValidationError` for built-in failures and custom failures created with `defineError()` when `failFast: false`.

### Defaults

SchemaShield keeps data shaping explicit. By default, `default` remains a standard JSON Schema annotation and your input stays unchanged.

Enable `useDefaults` when you want validated data to apply defaults and leave the validator ready to use:

| `useDefaults`      | Behavior                                                                              |
| :----------------- | :------------------------------------------------------------------------------------ |
| Omitted or `false` | Keeps defaults as annotations and does not modify data.                               |
| `true`             | Completes missing required and optional properties.                                   |
| `"empty"`          | Also replaces `null` and `""`, while preserving valid values such as `0` and `false`. |

Combine `useDefaults` with `immutable: true` to receive completed data without modifying the original object:

```javascript
const validateUser = new SchemaShield({
  useDefaults: true,
  immutable: true
}).compile({
  type: "object",
  properties: {
    role: { type: "string", default: "member" },
    theme: { type: "string", default: "system" }
  },
  required: ["role"]
});

const input = {};
const result = validateUser(input);

input;
// {}

result.data;
// { role: "member", theme: "system" }
```

## Errors and Debugging

SchemaShield provides two error modes:

- `failFast: true` returns `error: true` with minimal allocation.
- `failFast: false` returns a `ValidationError` with rich debugging information for built-in failures and custom keyword failures created with `defineError()`. A custom keyword that returns `true` directly still produces `error: true`. Use `defineError()` for detailed errors.

```javascript
import { SchemaShield } from "schema-shield";

const validatePerson = new SchemaShield({ failFast: false }).compile({
  type: "object",
  properties: {
    age: { type: "number", minimum: 18 }
  },
  required: ["age"]
});

const result = validatePerson({ age: 15 });

if (!result.valid) {
  const paths = result.error.getPath();

  console.error(result.error.message);
  console.error(paths.schemaPath);
  console.error(paths.instancePath);
}
```

### ValidationError Properties

- `message`: Description of the validation error.
- `item`: Final item in the failing path, when available.
- `keyword`: Keyword that triggered the error.
- `cause`: Nested `ValidationError` that caused the current error.
- `code`: Stable error code, when the error provides one.
- `schemaPath`: JSON Pointer to the failing schema location.
- `instancePath`: JSON Pointer to the failing data location.
- `data`: Data that caused the error, when available.
- `schema`: Schema value that caused the error, when available.

`schemaPath` and `instancePath` become available after calling `getCause()`, `getTree()`, or `getPath()`.

### Error Methods

#### `getPath()`

Returns the schema and instance paths for the root validation failure.

```javascript
const { schemaPath, instancePath } = result.error.getPath();
```

#### `getCause()`

Returns the root `ValidationError` that caused the validation chain.

```javascript
const cause = result.error.getCause();
console.error(cause.message, cause.keyword);
```

#### `getTree()`

Returns the complete nested error chain as an error tree.

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
```

## Extensibility

SchemaShield exposes custom types, formats, and keywords through the same instance used to compile validators.

The examples in this section use the following instance:

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();
```

### Custom Types

```typescript
interface TypeFunction {
  (data: any): boolean;
}

interface SchemaShieldTypeAPI {
  addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
}
```

```javascript
schemaShield.addType(
  "adult-age",
  (data) => typeof data === "number" && data >= 18
);

const validator = schemaShield.compile({ type: "adult-age" });
```

Set `overwrite` to `true` to replace an existing type with the same name. The default is `false`.

### Custom Formats

```typescript
interface FormatFunction {
  (data: any): boolean;
}

interface SchemaShieldFormatAPI {
  addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
}
```

```javascript
schemaShield.addFormat(
  "username",
  (data) => typeof data === "string" && /^[a-z0-9._-]{3,}$/i.test(data)
);

const validator = schemaShield.compile({
  type: "string",
  format: "username"
});
```

Set `overwrite` to `true` to replace an existing format with the same name. The default is `false`.

### Custom Keywords

```typescript
import type {
  CompiledSchema,
  SchemaShield,
  ValidationError
} from "schema-shield";

type Result = void | ValidationError | true;

interface DefineErrorOptions {
  code?: string;
  item?: any;
  cause?: ValidationError | true;
  data?: any;
}

interface DefineErrorFunction {
  (
    message: string,
    options?: DefineErrorOptions
  ): ValidationError | void | true;
}

interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: DefineErrorFunction,
    instance: SchemaShield
  ): Result;
}

interface SchemaShieldKeywordAPI {
  addKeyword(
    name: string,
    validator: KeywordFunction,
    overwrite?: boolean
  ): void;
}
```

Use `defineError()` so SchemaShield can attach the current keyword, schema, data, and error-chain context:

```javascript
schemaShield.addKeyword("divisibleBy", (schema, data, defineError) => {
  if (typeof data !== "number") {
    return defineError("Value must be a number", { data });
  }

  if (data % schema.divisibleBy !== 0) {
    return defineError(`Value must be divisible by ${schema.divisibleBy}`, {
      data
    });
  }
});

const validator = schemaShield.compile({
  type: "number",
  divisibleBy: 5
});
```

The `instance` argument provides access to types, formats, and keywords registered on the active `SchemaShield` instance through `getType()`, `getFormat()`, and `getKeyword()`.

When `failFast: true`, `defineError()` returns `true`. When `failFast: false`, it returns a `ValidationError`. A custom keyword that returns `true` directly produces `error: true` in either mode, so use `defineError()` when you need detailed errors.

## Supported Formats and Compatibility

SchemaShield supports draft-06 and draft-07 JSON Schema validation and includes built-in validators for:

- **Date and time:** `date`, `time`, `date-time`, `duration`
- **Email:** `email`, `idn-email`
- **Hostnames:** `hostname`, `idn-hostname`
- **IP addresses:** `ipv4`, `ipv6`
- **Resource identifiers:** `uuid`, `uri`, `uri-reference`, `uri-template`, `iri`, `iri-reference`
- **JSON Pointers:** `json-pointer`, `relative-json-pointer`
- **Regular expressions:** `regex`

Remote references are intentionally outside the offline execution model described above.

Any built-in format can be replaced, and new formats can be added with `schemaShield.addFormat()`.

### TypeScript

Type declarations are included in the package. CJS, ESM, browser, and declaration package smokes have been verified.

## Immutable Mode and Known Limitations

### Immutable Mode

SchemaShield can apply defaults, and application-provided custom keywords can modify data. Enable immutable mode when the original input must remain unchanged:

```javascript
const schemaShield = new SchemaShield({ immutable: true });
```

Immutable mode creates a deep copy before validation. This preserves ordinary JSON-compatible data, but cloning may not reproduce instantiated classes or other complex objects accurately. Applications that validate such values can manage cloning explicitly.

Leave immutable mode disabled when input preservation is unnecessary and validation performance is the priority.

### Remote References

SchemaShield does not retrieve remote references and does not provide an external registry or multi-document bundle API. Every referenced target must form part of the single root schema supplied to `compile()`.

### Structural Equality

`enum`, `const`, and `uniqueItems` use exact structural comparison for predictable semantics. Very large arrays or enums containing complex objects can take longer to compare than strategies based on aggressive structural hashing.

## Testing

SchemaShield is tested against the [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) and the package's own functional and distribution checks.

The latest observed functional suite completed with **1,635 passing** and **14 pending**. Package smokes for CJS, ESM, browser, and TypeScript declarations also passed.

```bash
npm test
```

For development:

```bash
npm run dev:test
```

## Contribute

SchemaShield is open source. Contributions that improve validation behavior, developer experience, documentation, compatibility, or performance are welcome.

Before opening a pull request:

1. Add or update the relevant tests and documentation.
2. Run the functional suite.
3. Check that the change does not introduce a performance regression.
4. Explain the behavior change and its motivation in the pull request.

## Acknowledgments

- **AJV:** The performance reference for JSON Schema validation. Its JIT architecture sets the raw-throughput bar for the ecosystem.
- **@exodus/schemasafe:** A strong interpreter-first validator that demonstrates the value of security-focused validation architectures. Competing with it makes SchemaShield better.

## Legal

Author: [Masquerade Circus](http://masquerade-circus.net).

License: [Apache-2.0](https://opensource.org/licenses/Apache-2.0).
