interface ValidationErrorProps {
  pointer: string;
  message: string;
  value: any;
  code: string;
}

interface Result {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidatorFunction {
  (schema, data, pointer): Result;
}

interface Validator {
  (data: any): Result;
  compiledSchema: object;
}

interface Keyword {
  validator: ValidatorFunction;
  schemaType: string;
}

class ValidationError extends Error {
  name: string;
  pointer: string;
  message: string;
  value: any;
  code: string;

  constructor(message: string, options: ValidationErrorProps) {
    super(message);
    this.name = "ValidationError";
    this.pointer = options.pointer;
    this.message = options.message;
    this.value = options.value;
    this.code = options.code;
  }
}

const defaultValidator = (schema, data, pointer) => {
  return {
    valid: true,
    errors: []
  };
};

const Types: Record<string, ValidatorFunction> = {
  object: defaultValidator,
  array: defaultValidator,
  string: defaultValidator,
  number: defaultValidator,
  integer: defaultValidator,
  boolean: defaultValidator,
  null: defaultValidator
};

const keywords: Record<string, ValidatorFunction> = {
  // Object
  required: defaultValidator,
  properties: defaultValidator,

  // Array
  items: defaultValidator,

  // String
  minLength: defaultValidator,
  maxLength: defaultValidator,
  pattern: defaultValidator,
  format: defaultValidator,
  enum: defaultValidator,

  // Number / Integer
  minimum: defaultValidator,
  maximum: defaultValidator,

  // All
  nullable: defaultValidator
};

class FJV {
  types = new Map<string, ValidatorFunction>();
  formats = new Map<string, ValidatorFunction>();
  keywords = new Map<string, Keyword>();

  constructor() {
    // Types
    this.addType("object", Types.object);
    this.addType("array", Types.array);
    this.addType("string", Types.string);
    this.addType("number", Types.number);
    this.addType("integer", Types.integer);
    this.addType("boolean", Types.boolean);
    this.addType("null", Types.null);

    // Object
    this.addKeyword("required", keywords.required, "object");
    this.addKeyword("properties", keywords.properties, "object");

    // Array
    this.addKeyword("items", keywords.items, "array");

    // String
    this.addKeyword("minLength", keywords.minLength, "string");
    this.addKeyword("maxLength", keywords.maxLength, "string");
    this.addKeyword("pattern", keywords.pattern, "string");
    this.addKeyword("format", keywords.format, "string");
    this.addKeyword("enum", keywords.enum, "string");

    // Number
    this.addKeyword("minimum", keywords.minimum, "number");
    this.addKeyword("maximum", keywords.maximum, "number");

    // Integer
    this.addKeyword("minimum", keywords.minimum, "integer");
    this.addKeyword("maximum", keywords.maximum, "integer");

    // All
    this.addKeyword("nullable", keywords.nullable, "any");
  }

  addType(name: string, validator: ValidatorFunction) {
    this.types.set(name, validator);
  }

  addFormat(name: string, validator: ValidatorFunction) {
    this.formats.set(name, validator);
  }

  addKeyword(
    name: string,
    validator: ValidatorFunction,
    schemaType: string = "any"
  ) {
    this.keywords.set(name, { validator, schemaType });
  }

  compile(schema: any): Validator {
    const compiledSchema = this.compileSchema(schema, "#");

    function validate(data: any) {
      let result = compiledSchema.validator(compiledSchema, data, "#");
      return result;
      return {
        valid: true,
        errors: []
      };
    }

    validate.compiledSchema = compiledSchema;

    return validate;
  }

  compileSchema(schema: any, pointer): any {
    if (typeof schema !== "object") {
      throw new ValidationError("Schema is not an object", {
        pointer,
        message: "Schema is not an object",
        value: schema,
        code: "SCHEMA_NOT_OBJECT"
      });
    }

    if (!schema.type) {
      throw new ValidationError("Schema is missing type", {
        pointer,
        message: "Schema is missing type",
        value: schema,
        code: "SCHEMA_MISSING_TYPE"
      });
    }

    if (!this.types.has(schema.type)) {
      throw new ValidationError("Schema type is not supported", {
        pointer,
        message: "Schema type is not supported",
        value: schema,
        code: "SCHEMA_TYPE_NOT_SUPPORTED"
      });
    }

    // Compile schema type
    const compiledSchema = {
      ...schema,
      validator: this.types.get(schema.type),
      pointer
    };

    // Compile keywords
    for (const [keyword, { validator, schemaType }] of this.keywords) {
      if (
        keyword in schema &&
        (schemaType === schema.type || schemaType === "any")
      ) {
        compiledSchema.keywords = compiledSchema.keywords || {};
        compiledSchema.keywords[keyword] = validator;
      }
    }

    return compiledSchema;
  }

  validate(schema: any, data: any, pointer = "#"): Result {
    return {
      valid: true,
      errors: []
    };
  }
}

export default FJV;
