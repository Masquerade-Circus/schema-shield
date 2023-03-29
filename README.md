# SchemaShield Documentation

SchemaShield is a comprehensive schema validation library that allows you to validate data based on the provided schema. It offers a variety of types, keywords, and formats for validation.

## Features

- Custom type, keyword, and format validators
- Immutable mode for data protection
- Lightweight and fast
- Easy to use and extend
- Error handling and reporting using the new [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) property

## Usage

### 1. Import the SchemaShield class

```javascript
import { SchemaShield } from "schema-shield";
// or
const { SchemaShield } = require("schema-shield");
```

### 2. Instantiate the SchemaShield class

```javascript
const schemaShield = new SchemaShield({ immutable: true });
```

**`immutable`** (optional): Set to `true` to ensure that input data remains unmodified during validation. Default is `false` for better performance.

### 3. Add custom types, keywords, and formats (optional)

```javascript
// Must return true or false
schemaShield.addType("customType", (data) => {
  // Custom type validation logic
});

// Must return true or false
schemaShield.addFormat("customFormat", (data) => {
  // Custom format validation logic
});

// Does not need to return anything if validation is successful
// Must return a defined error if validation fails (see below)
schemaShield.addKeyword(
  "customKeyword",
  (schema, data, defineError, schemaShieldInstance) => {
    // Custom keyword validation logic
  }
);
```

### 4. Compile a schema

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

### 5. Validate data

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

- data: The validated (and potentially modified) data
- error: A `ValidationError` instance if validation failed, otherwise null
- valid: true if validation was successful, otherwise false

## Error Handling

SchemaShield provides a `ValidationError` class to handle errors that occur during schema validation. When a validation error is encountered, a `ValidationError` instance is returned in the error property of the validation result.

This returned error instance uses the new [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) property introduced in ES6. This allows you to analyze the whole error chain or to retrieve the root cause of the error using the `getCause()` method.

### ValidationError Properties

- `message`: A string containing a description of the error
- `item`: The final item in the path that caused the error
- `keyword`: The keyword that triggered the error
- `cause`: A nested ValidationError that caused the current error
- `path`: The JSON Pointer path to the error location in the schema (Only available using the `getCause()` method)
- `data`: The data that caused the error (optional)
- `schema`: The compiled schema that caused the error (optional)

### Get the cause of the error

You can use the `getCause()` method to retrieve the root cause of a validation error. This method returns the nested ValidationError instance that triggered the current error and contains the `path` property.

**Example:**

```javascript
import { SchemaShield } from "schema-shield";

const schemaShield = new SchemaShield({ immutable: true });

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

  // Get the root cause of the error
  const errorCause = validationResult.error.getCause();
  console.error("Root cause:", errorCause.message); // "Value is less than the minimum"
  console.error("Error path:", errorCause.path); // "/properties/age/minimum"
  console.error("Error data:", errorCause.data); // 15
  console.error("Error schema:", errorCause.schema); // 18
  console.error("Error keyword:", errorCause.keyword); // "minimum"
}
```

## Adding Custom Types

SchemaShield allows you to add custom types for validation using the `addType` method.

### Method Signature

```javascript
interface TypeFunction {
  (data: any): boolean;
}

addType(name: string, validator: TypeFunction): void;
```

- `name`: The name of the custom type. This should be a unique string that does not conflict with existing types.
- `validator`: A `TypeFunction` that takes a single argument `data` and returns a boolean value. The function should return `true` if the provided data is valid for the custom type, and `false` otherwise.

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

addFormat(name: string, validator: FormatFunction): void;
```

- `name`: The name of the custom format. This should be a unique string that does not conflict with existing formats.
- `validator`: A FormatFunction that takes a single argument data and returns a boolean value. The function should return true if the provided data is valid for the custom format, and false otherwise.

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

export interface DefineErrorOptions {
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

interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    defineError: DefineErrorFunction,
    instance: SchemaShield
  ): Result;
}

addKeyword(name: string, validator: KeywordFunction): void;
```

- `name`: The name of the custom keyword. This should be a unique string that does not conflict with existing keywords.
- `validator`: A `KeywordFunction` that takes four arguments: `schema`, `data`, `defineError`, and `instance` (The SchemaShield instance that is currently running the validation). The function should not return anything if the data is valid for the custom keyword, and should return a `ValidationError` instance if the data is invalid.

Take into account that the error must be generated using the `defineError` function because this has the required data relevant for the current keyword (`schema`, `keyword`, `getCause` method).

- `message`: A string that describes the validation error.
- `options`: An optional object with properties that provide more context for the error:
  - `item`?: An optional value representing the final item in the path where the validation error occurred.
  - `cause`?: An optional `ValidationError` that represents the cause of the current error.
  - `data`?: An optional value representing the data that caused the validation error.

The `instance` argument is the SchemaShield instance that is currently running the validation. This can be used to access to other `types`, `keywords` or `formats` that have been added to the instance.

### Example: Adding a Custom Keyword

In this example, we'll add a custom keyword called divisibleBy that validates if a given number is divisible by a specified divisor.

```javascript
import { SchemaShield, ValidationError } from "./path/to/SchemaShield";

const schemaShield = new SchemaShield({ immutable: true });

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

### Complex example: Adding a Custom Keyword using the instance

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
  const typeValidator = instance.types.get(validType);
  const prefixValidator = instance.keywords.get(prefixValidator);
  const formatValidator = instance.formats.get(validFormat);

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
