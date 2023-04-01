# SchemaShield

SchemaShield is a versatile and powerful JSON Schema validator designed to simplify the process of validating complex data structures.

Unlike many other libraries, SchemaShield does not rely on code generation, making it safer to pass real references to objects, classes, or variables and opening new possibilities for custom validation that are not possible with other libraries.

Despite its feature-rich and easy extendable nature, SchemaShield is designed to be fast and efficient, matching the performance of other libraries that use code generation.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Features](#features)
- [Usage](#usage)
- [No Code Generation](#no-code-generation)
- [Error Handling](#error-handling)
- [Adding Custom Types](#adding-custom-types)
  - [Method Signature](#method-signature)
  - [Example: Adding a Custom Type](#example-adding-a-custom-type)
- [Adding Custom Formats](#adding-custom-formats)
  - [Method Signature](#method-signature-1)
  - [Example: Adding a Custom Format](#example-adding-a-custom-format)
- [Adding Custom Keywords](#adding-custom-keywords)
  - [Method Signature](#method-signature-2)
  - [Example: Adding a Custom Keyword](#example-adding-a-custom-keyword)
  - [Complex example: Adding a Custom Keyword that uses the instance](#complex-example-adding-a-custom-keyword-that-uses-the-instance)
- [No Code Generation Opened Possibilities](#no-code-generation-opened-possibilities)
- [More on Error Handling](#more-on-error-handling)
  - [ValidationError Properties](#validationerror-properties)
  - [Get the path to the error location](#get-the-path-to-the-error-location)
  - [Get the full error chain as a tree](#get-the-full-error-chain-as-a-tree)
  - [Get the cause of the error](#get-the-cause-of-the-error)
- [Immutable Mode](#immutable-mode)
- [TypeScript Support](#typescript-support)
- [Known Limitations](#known-limitations)
  - [Schema References and Schema Definitions](#schema-references-and-schema-definitions)
  - [Unsupported Formats](#unsupported-formats)
- [Testing](#testing)
- [Contribute](#contribute)
- [Legal](#legal)

## Features

- Supports draft-06 and draft-07 of the [JSON Schema](https://json-schema.org/) specification.
- No Code Generation for Enhanced Safety and Validation Flexibility.
- Custom type, keyword, and format validators.
- Immutable mode for data protection.
- Lightweight and fast.
- Easy to use and extend.
- No dependencies.
- Typescript support.

## Usage

**1. Install the package**

```bash
npm install schema-shield
# or
yarn add schema-shield
```

**2. Import the SchemaShield class**

```javascript
import { SchemaShield } from "schema-shield";
// or
const { SchemaShield } = require("schema-shield");
```

**3. Instantiate the SchemaShield class**

```javascript
const schemaShield = new SchemaShield({ immutable: true });
```

**`immutable`** (optional): Set to `true` to ensure that input data remains unmodified during validation. Default is `false` for better performance.

**3.5. Add custom types, keywords, and formats (optional)**

```javascript
schemaShield.addType("customType", (data) => {
  // Custom type validation logic
});

schemaShield.addFormat("customFormat", (data) => {
  // Custom format validation logic
});

schemaShield.addKeyword(
  "customKeyword",
  (schema, data, defineError, instance) => {
    // Custom keyword validation logic
  }
);
```

**4. Compile a schema**

```javascript
const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  }
};

const validator = schemaShield.compile(schema);
```

**5. Validate some data**

```javascript
const data = {
  name: "John Doe",
  age: 30
};

const validationResult = validator(data);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error);
}
```

**`validationResult`**: Contains the following properties:

- `data`: The validated (and potentially modified) data.
- `error`: A `ValidationError` instance if validation failed, otherwise null.
- `valid`: true if validation was successful, otherwise false.

## No Code Generation

Unlike some other validation libraries that rely on code generation to achieve fast performance, SchemaShield does not use code generation.

This design decision ensures that you can safely pass real references to objects, classes, or variables in your custom validation functions without any unintended side effects or security concerns.

For example, you can easily use `instanceof` to check if the provided data is an instance of a particular class or a subclass:

```javascript
schemaShield.addType("date-class", (data) => data instanceof Date);
// or use your custom classes, functions or references
class CustomDate extends Date {}
schemaShield.addType("custom-date-class", (data) => data instanceof CustomDate);
```

You can see a full example of this in the [No Code Generation opened possibilities](#no-code-generation-opened-possibilities) section.

## Error Handling

SchemaShield provides comprehensive error handling for schema validation. When a validation error occurs, a `ValidationError` instance is returned in the error property of the validation result. This error has the `getPath()` method, which is particularly useful for quickly identifying the location of an error in both the schema and the data.

**Example:**

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: {
      type: "number",
      minimum: 18
    }
  }
};

const validator = schemaShield.compile(schema);

const invalidData = {
  name: "John Doe",
  age: 15
};

const validationResult = validator(invalidData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.message); // "Property is invalid"

  // Get the paths to the error location in the schema and in the data
  const errorPaths = validationResult.error.getPath();
  console.error("Schema path:", errorPaths.schemaPath); // "#/properties/age/minimum"
  console.error("Instance path:", errorPaths.instancePath); // "#/age"
}
```

For more advanced error handling and a detailed explanation of the ValidationError properties and methods, refer to the [More on Error Handling](#more-on-error-handling) section.

## Adding Custom Types

SchemaShield allows you to add custom types for validation using the `addType` method.

### Method Signature

```javascript
interface TypeFunction {
  (data: any): boolean;
}

addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
```

- `name`: The name of the custom type. This should be a unique string that does not conflict with existing types.
- `validator`: A `TypeFunction` that takes a single argument `data` and returns a boolean value. The function should return `true` if the provided data is valid for the custom type, and `false` otherwise.
- `overwrite` (optional): Set to `true` to overwrite an existing type with the same name. Default is `false`. If set to `false` and a type with the same name already exists, an error will be thrown.

### Example: Adding a Custom Type

In this example, we'll add a custom type called age that validates if a given number is between 18 and 120.

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

// Custom type 'age' validator function
const ageValidator = (data) => {
  return typeof data === "number" && data >= 18 && data <= 120;
};

// Adding the custom type 'age'
schemaShield.addType("age", ageValidator);

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "age" }
  }
};

const validator = schemaShield.compile(schema);

const validData = {
  name: "John Doe",
  age: 25
};

const validationResult = validator(validData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.getCause().message);
}
```

## Adding Custom Formats

SchemaShield allows you to add custom formats for validation using the `addFormat` method.

### Method Signature

```javascript
interface FormatFunction {
  (data: any): boolean;
}

addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
```

- `name`: The name of the custom format. This should be a unique string that does not conflict with existing formats.
- `validator`: A FormatFunction that takes a single argument data and returns a boolean value. The function should return true if the provided data is valid for the custom format, and false otherwise.
- `overwrite` (optional): Set to true to overwrite an existing format with the same name. Default is false. If set to false and a format with the same name already exists, an error will be thrown.

### Example: Adding a Custom Format

In this example, we'll add a custom format called ssn that validates if a given string is a valid U.S. Social Security Number (SSN).

```javascript
import { SchemaShield } from "./path/to/SchemaShield";

const schemaShield = new SchemaShield();

// Custom format 'ssn' validator function
const ssnValidator = (data) => {
  const ssnPattern = /^(?!000|.+0{4})(?:\d{9}|\d{3}-\d{2}-\d{4})$/;
  return typeof data === "string" && ssnPattern.test(data);
};

// Adding the custom format 'ssn'
schemaShield.addFormat("ssn", ssnValidator);

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    ssn: { type: "string", format: "ssn" }
  }
};

const validator = schemaShield.compile(schema);

const validData = {
  name: "John Doe",
  ssn: "123-45-6789"
};

const validationResult = validator(validData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.getCause().message);
}
```

## Adding Custom Keywords

SchemaShield allows you to add custom keywords for validation using the addKeyword method. This is the most powerful method for adding custom validation logic to SchemaShield because it allows to interact with the entire schema and data being validated at the level of the keyword.

### Method Signature

```javascript
type Result = void | ValidationError;

interface DefineErrorOptions {
  item?: any; // Final item in the path
  cause?: ValidationError; // Cause of the error
  data?: any; // Data that caused the error
}

interface DefineErrorFunction {
  (message: string, options?: DefineErrorOptions): ValidationError;
}

interface ValidateFunction {
  (data: any): Result;
}

interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}

interface FormatFunction {
  (data: any): boolean;
}

interface TypeFunction {
  (data: any): boolean;
}

declare class SchemaShield {
    constructor({ immutable }?: {
        immutable?: boolean;
    });
    compile(schema: any): Validator;
    addType(name: string, validator: TypeFunction, overwrite?: boolean): void;
    addFormat(name: string, validator: FormatFunction, overwrite?: boolean): void;
    addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
    getType(type: string): TypeFunction | false;
    getFormat(format: string): FormatFunction | false;
    getKeyword(keyword: string): KeywordFunction | false;
    isSchemaLike(subSchema: any): boolean;
}

interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: DefineErrorFunction,
    instance: SchemaShield
  ): Result;
}



addKeyword(name: string, validator: KeywordFunction, overwrite?: boolean): void;
```

- `name`: The name of the custom keyword. This should be a unique string that does not conflict with existing keywords.
- `validator`: A `KeywordFunction` that takes four arguments: `schema`, `data`, `defineError`, and `instance` (The SchemaShield instance that is currently running the validation). The function should not return anything if the data is valid for the custom keyword, and should return a `ValidationError` instance if the data is invalid.
- `overwrite` (optional): Set to true to overwrite an existing keyword with the same name. Default is false. If set to false and a keyword with the same name already exists, an error will be thrown.

#### About the `defineError` Function

Take into account that the error must be generated using the `defineError` function because the error returned by this method has the required data relevant for the current keyword (`schema`, `keyword`, `getCause` method).

- `message`: A string that describes the validation error.
- `options`: An optional object with properties that provide more context for the error:
  - `item`?: An optional value representing the final item in the path where the validation error occurred. (e.g. index of an array item)
  - `cause`?: An optional `ValidationError` that represents the cause of the current error.
  - `data`?: An optional value representing the data that caused the validation error.

#### About the `instance` Argument

The `instance` argument is the SchemaShield instance that is currently running the validation. This can be used to access to other `types`, `keywords` or `formats` that have been added to the instance.

### Example: Adding a Custom Keyword

In this example, we'll add a custom keyword called divisibleBy that validates if a given number is divisible by a specified divisor.

```javascript
import { SchemaShield, ValidationError } from "./path/to/SchemaShield";

const schemaShield = new SchemaShield();

// Custom keyword 'divisibleBy' validator function
const divisibleByValidator = (schema, data, defineError, instance) => {
  if (typeof data !== "number") {
    return defineError("Value must be a number", {
      data
    });
  }

  if (data % schema.divisibleBy !== 0) {
    return defineError(`Value must be divisible by ${schema.divisibleBy}`, {
      data
    });
  }
};

// Adding the custom keyword 'divisibleBy'
schemaShield.addKeyword("divisibleBy", divisibleByValidator);

const schema = {
  type: "object",
  properties: {
    value: { type: "number", divisibleBy: 5 }
  }
};

const validator = schemaShield.compile(schema);

const validData = {
  value: 15
};

const validationResult = validator(validData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.getCause().message);
}
```

### Complex example: Adding a Custom Keyword that uses the instance

In this example we'll add a custom keyword called `prefixedUsername` that will validate if a given string is a valid username and has a specific prefix. This will only work if the additional validation methods and types have been added to the instance.

```javascript
import { SchemaShield, ValidationError } from "schema-shield";

const schemaShield = new SchemaShield();

// Custom type validator: nonEmptyString
const nonEmptyStringValidator = (data) =>
  typeof data === "string" && data.length > 0;
schemaShield.addType("nonEmptyString", nonEmptyStringValidator);

// Custom keyword validator: hasPrefix
const hasPrefixValidator = (schema, data, defineError, instance) => {
  const { prefix } = schema.hasPrefix;
  if (typeof data === "string" && !data.startsWith(prefix)) {
    return defineError(`String must have the prefix "${prefix}"`, {
      data
    });
  }
};
schemaShield.addKeyword("hasPrefix", hasPrefixValidator);

// Custom format validator: username
const usernameValidator = (data) => /^[a-zA-Z0-9._-]{3,}$/i.test(data);
schemaShield.addFormat("username", usernameValidator);

// Custom keyword 'prefixedUsername' validator function
const prefixedUsername = (schema, data, defineError, instance) => {
  const { validType, prefixValidator, validFormat } = schema.prefixedUsername;

  // Get the validators for the specified types and formats from the instance
  // (if they exist)
  const typeValidator = instance.getType(validType);
  const prefixValidator = instance.getKeyword(prefixValidator);
  const formatValidator = instance.getFormat(validFormat);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Validate that the data is of the correct type if specified
    if (validType && typeValidator) {
      if (!typeValidator(item)) {
        return defineError(`Invalid type: ${validType}`, {
          item: i,
          data: data[i]
        });
      }
    }

    // Validate that the data has the correct format if specified
    if (validFormat && formatValidator) {
      if (!formatValidator(item)) {
        return defineError(`Invalid format: ${validFormat}`, {
          item: i,
          data: data[i]
        });
      }
    }

    // Validate that the data has the correct prefix if specified
    if (prefixValidator) {
      const error = prefixValidator(schema, item, defineError, instance);
      if (error) {
        return defineError(`Invalid prefix: ${prefixValidator}`, {
          cause: error,
          item: i,
          data: data[i]
        });
      }
    }
  }
};

schemaShield.addKeyword("prefixedUsername", prefixedUsername);

const schema = {
  type: "array",
  prefixedUsername: {
    validType: "nonEmptyString",
    prefixValidator: "hasPrefix",
    validFormat: "username"
  },
  items: {
    type: "string"
  }
};

const validator = schemaShield.compile(schema);

const validData = ["user.john", "user.jane"];

const validationResult = validator(validData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.getCause().message);
}
```

## No Code Generation Opened Possibilities

With the no code generation nature of SchemaShield, you can create complex validation logic that incorporates custom classes, objects, or variables. This flexibility allows you to seamlessly integrate the validation process into your application's unique requirements and data structures.

For example, imagine you have a custom class representing a project and another representing an employee. You could create a custom validator to ensure that only employees with the right qualifications are assigned to a specific project:

```javascript
import { SchemaShield, ValidationError } from "schema-shield";

const schemaShield = new SchemaShield();

// Custom classes
class Project {
  constructor(name: string, requiredSkills: string[]) {
    this.name = name;
    this.requiredSkills = requiredSkills;
  }
}

class Employee {
  constructor(name: string, skills: string[]) {
    this.name = name;
    this.skills = skills;
  }

  hasSkillsForProject(project: Project) {
    return project.requiredSkills.every((skill) => this.skills.includes(skill));
  }
}

// Add custom types to the instance
schemaShield.addType("project", (data) => data instanceof Project);
schemaShield.addType("employee", (data) => data instanceof Employee);

schemaShield.addKeyword(
  "requiresQualifiedEmployee",
  (schema, data, defineError, instance) => {
    const { assignment, project, employee } = data;

    const stringTypeValidator = instance.getType("string");
    const projectTypeValidator = instance.getType("project");
    const employeeTypeValidator = instance.getType("employee");

    if (!stringTypeValidator(assignment)) {
      return defineError("Assignment must be a string", {
        item: "assignment",
        data: assignment
      });
    }

    if (!projectTypeValidator(project)) {
      return defineError("Project must be a Project instance", {
        item: "project",
        data: project
      });
    }

    if (!employeeTypeValidator(employee)) {
      return defineError("Employee must be an Employee instance", {
        item: "employee",
        data: employee
      });
    }

    if (schema.requiresQualifiedEmployee) {
      if (!employee.hasSkillsForProject(project)) {
        return defineError(
          "Employee does not meet the project's requirements",
          {
            data: {
              assignment,
              project,
              employee
            }
          }
        );
      }
    }
  }
);

// Create and compile the schema
const schema = {
  type: "object",
  properties: {
    assignment: {}, // Empty schema because we will validate it with the custom keyword
    project: {}, // Empty schema because we will validate it with the custom keyword
    employee: {} // Empty schema because we will validate it with the custom keyword
  },
  required: ["assignment", "project", "employee"],
  requiresQualifiedEmployee: true
};

const validator = schemaShield.compile(schema);

// Create some data to validate
const employee1 = new Employee("Employee 1", ["A", "B", "C"]);

const project1 = new Project("Project 1", ["A", "B"]);

const dataToValidate = {
  assignment: "Assignment 1 for Project 1",
  project: project1,
  employee: employee1
};

// Validate the data
const validationResult = validator(schema);

if (validationResult.valid) {
  console.log("Assignment is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.message);
}
```

In this example, SchemaShield safely accesses instances of custom classes and utilizes them in the validation process. This level of complexity and flexibility would not be possible or would require a lot of boilerplate code with other libraries that rely on code generation.

## More on Error Handling

SchemaShield provides a `ValidationError` class to handle errors that occur during schema validation. When a validation error is encountered, a `ValidationError` instance is returned in the error property of the validation result.

This error instance uses the new [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) property introduced in ES6. This allows you to analyze the whole error chain or to retrieve the root cause of the error using the `getCause()` `getTree()` and `getPath()` methods.

### ValidationError Properties

- `message`: A string containing a description of the error.
- `item`: The final item in the path that caused the error (either a string or a number) (optional).
- `keyword`: The keyword that triggered the error.
- `cause`: A nested ValidationError or a normal Error that caused the current error.
- `schemaPath`: The JSON Pointer path to the error location in the schema.
- `instancePath`: The JSON Pointer path to the error location in the data.
- `data`: The data that caused the error (optional).
- `schema`: The schema that caused the error (optional).

_Note:_ The `schemaPath` and `instancePath` will be only available after using the `getCause()` `getTree()` or `getPath()` methods.

### Get the path to the error location

You can use the `getPath` method to get the JSON Pointer path to the error location in the schema and in the data. This method returns an object containing the `schemaPath` and `instancePath`.

**Example:**

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

const schema = {
  type: "object",
  properties: {
    description: { type: "string" },
    shouldLoadDb: { type: "boolean" },
    enableNetConnectFor: { type: "array", items: { type: "string" } },
    params: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          description: { type: "string" },
          default: { type: "string" }
        },
        required: ["description"]
      }
    },
    run: { type: "string" }
  }
};

const validator = schemaShield.compile(schema);

const invalidData = {
  description: "Say hello to the bot.",
  shouldLoadDb: false,
  enableNetConnectFor: [],
  params: {
    color: {
      type: "string",
      // description: "The color of the text", // Missing description on purpose
      default: "red"
    }
  },
  run: "run"
};

const validationResult = validator(invalidData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.message); // "Property is invalid"

  // Get the paths to the error location in the schema and in the data
  const errorPaths = validationResult.error.getPath();
  console.error("Schema path:", errorPaths.schemaPath); // "#/properties/params/additionalProperties/required"
  console.error("Instance path:", errorPaths.instancePath); // "#/params/color/description"
}
```

### Get the full error chain as a tree

You can use the `getTree()` method to retrieve the full error chain as a tree. This method returns an ErrorTree object with the complete nested error structure, allowing you to analyze the full chain of errors that occurred during validation.

#### ErrorTree Signature

```typescript
interface ErrorTree {
  message: string; // The error message
  keyword: string; // The keyword that triggered the error
  item?: string | number; // The final item in the path that caused the error (either a string or a number) (optional)
  schemaPath: string; // The JSON Pointer path to the error location in the schema
  instancePath: string; // The JSON Pointer path to the error location in the data
  data?: any; // The data that caused the error (optional)
  cause?: ErrorTree; // A nested ErrorTree representation of the nested error that caused the current error
}
```

**Example:**

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

const schema = {
  type: "object",
  properties: {
    description: { type: "string" },
    shouldLoadDb: { type: "boolean" },
    enableNetConnectFor: { type: "array", items: { type: "string" } },
    params: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          description: { type: "string" },
          default: { type: "string" }
        },
        required: ["description"]
      }
    },
    run: { type: "string" }
  }
};

const validator = schemaShield.compile(schema);

const invalidData = {
  description: "Say hello to the bot.",
  shouldLoadDb: false,
  enableNetConnectFor: [],
  params: {
    color: {
      type: "string",
      // description: "The color of the text", // Missing description on purpose
      default: "red"
    }
  },
  run: "run"
};

const validationResult = validator(invalidData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.message); // "Property is invalid"

  // Get the full error chain as a tree
  const errorTree = validationResult.error.getTree();
  console.error(errorTree);

  /*
    {
      message: "Property is invalid",
      keyword: "properties",
      item: "params",
      schemaPath: "#/properties/params",
      instancePath: "#/params",
      data: { color: { type: "string", default: "red" } },
      cause: {
        message: "Additional properties are invalid",
        keyword: "additionalProperties",
        item: "color",
        schemaPath: "#/properties/params/additionalProperties",
        instancePath: "#/params/color",
        data: { type: "string", default: "red" },
        cause: {
          message: "Required property is missing",
          keyword: "required",
          item: "description",
          schemaPath: "#/properties/params/additionalProperties/required",
          instancePath: "#/params/color/description",
          data: undefined
        }
      }
    }
  */
}
```

The `errorTree` object contains the full error chain with nested causes, allowing you to analyze the entire error structure.

### Get the cause of the error

You can use the `getCause()` method to retrieve the root cause of a validation error. This method returns the nested ValidationError instance that triggered the current error and contains the `schemaPath` and `instancePath` properties.

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield();

const schema = {
  type: "object",
  properties: {
    description: { type: "string" },
    shouldLoadDb: { type: "boolean" },
    enableNetConnectFor: { type: "array", items: { type: "string" } },
    params: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          description: { type: "string" },
          default: { type: "string" }
        },
        required: ["description"]
      }
    },
    run: { type: "string" }
  }
};

const validator = schemaShield.compile(schema);

const invalidData = {
  description: "Say hello to the bot.",
  shouldLoadDb: false,
  enableNetConnectFor: [],
  params: {
    color: {
      type: "string",
      // description: "The color of the text", // Missing description on purpose
      default: "red"
    }
  },
  run: "run"
};

const validationResult = validator(invalidData);

if (validationResult.valid) {
  console.log("Data is valid:", validationResult.data);
} else {
  console.error("Validation error:", validationResult.error.message); // "Property is invalid"

  // Get the root cause of the error
  const errorCause = validationResult.error.getCause();
  console.error("Root cause:", errorCause.message); // "Required property is missing"
  console.error("Schema path:", errorCause.schemaPath); // "#/properties/params/additionalProperties/required"
  console.error("Instance path:", errorCause.instancePath); // "#/params/color/description"
  console.error("Error data:", errorCause.data); // undefined
  console.error("Error schema:", errorCause.schema); // ["description"]
  console.error("Error keyword:", errorCause.keyword); // "required"
}
```

## Immutable Mode

SchemaShield offers an optional immutable mode to prevent modifications to the input data during validation. In some cases, SchemaShield may mutate the data when using the `default` keyword or within custom added keywords.

By enabling immutable mode, the library creates a deep copy of the input data before performing any validation checks, ensuring that the original data remains unchanged throughout the process. This feature can be useful in situations where preserving the integrity of the input data is essential.

To enable immutable mode, simply pass the `immutable` option when creating a new `SchemaShield` instance:

```javascript
const schemaShield = new SchemaShield({ immutable: true });
```

By default, the immutable mode is disabled. If you don't need the immutability guarantee, you can leave it disabled to optimize performance.

However, there are some caveats to consider when using immutable mode. The deep copy may not accurately reproduce complex objects such as instantiated classes. In such cases, you can handle the cloning process yourself using a custom keyword to ensure the proper preservation of your data's structure.

## TypeScript Support

SchemaShield offers comprehensive TypeScript support, enhancing the library's usability for TypeScript projects. Type definitions are included in the package, so you can import the library and use it in your TypeScript projects without any additional configuration.

With the built in TypeScript support, you can take advantage of features like strong typing, autocompletion, and compile-time error checking, which can help you catch potential issues early and improve the overall quality of your code.

## Known Limitations

SchemaShield is a powerful and flexible library, but there are some limitations to be aware of when using it. Some features are not yet supported in the current version.

### Schema References and Schema Definitions

SchemaShield currently does not support schema references and schema definitions (i.e. `$ref` and `definitions`). This is planned to be addressed in future updates of SchemaShield.

For now, consider using custom implementations using the `addKeyword` method or use alternative libraries to handle these specific features if you need them.

### Unsupported Formats

#### Internationalized Formats

There is no plan to support the following formats in SchemaShield, as they are not relevant to the majority of use cases. If you need to use these formats, consider using custom implementations using the `addFormat` method to handle them.

- `idn-email`
- `idn-hostname`
- `iri`
- `iri-reference`

Also you can contribute to SchemaShield and add support for these keywords and formats or leve a comment requesting support for them.

## Testing

SchemaShield prioritizes reliability and accuracy in JSON Schema validation by using the [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).

This comprehensive test suite ensures compliance with the JSON Schema standard, providing developers with a dependable and consistent validation experience.

```bash
npm test
# or
npm run test:dev # for development
```

## Contribute

SchemaShield is an open-source project, and we welcome contributions from the community. By contributing to SchemaShield, you can help improve the library and expand its feature set.

If you are interested in contributing, please follow these steps:

- **Fork the repository:** Fork the SchemaShield repository on GitHub and clone it to your local machine.

- **Create a feature branch:** Create a new branch for your feature or bugfix. Make sure to give it a descriptive name.

- **Implement your changes:** Make the necessary changes to the codebase. Be sure to add or update the relevant tests and documentation.

- **Test your changes:** Before submitting your pull request, make sure your changes pass all existing tests and any new tests you've added. It's also a good idea to ensure that your changes do not introduce any performance regressions or new issues.

- **Submit a pull request:** Once your changes are complete and tested, submit a pull request to the main SchemaShield repository. In your pull request description, please provide a brief summary of your changes and any relevant context.

- **Code review:** Your pull request will be reviewed and may request changes or provide feedback. Be prepared to engage in a discussion and possibly make further changes to your code based on the feedback.

- **Merge:** Once your pull request is approved, it will be merged into the main SchemaShield repository.

We appreciate your interest in contributing to SchemaShield and look forward to your valuable input. Together, we can make SchemaShield an even better library for the community.

## Legal

Author: [Masquerade Circus](http://masquerade-circus.net).  
License [Apache-2.0](https://opensource.org/licenses/Apache-2.0)
