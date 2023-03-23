interface ValidationErrorProps {
  pointer: string;
  value: any;
  code: string;
}

interface ValidatorFunction {
  (schema: CompiledSchema, data, pointer): ValidationError[] | void;
}

interface CompiledSchema {
  validator: ValidatorFunction;
  pointer: string;
  [key: string]: any;
}

interface Validator {
  (data: any): ValidationError[] | void;
  compiledSchema: CompiledSchema;
}

interface Keyword {
  validator: ValidatorFunction;
  schemaType: string;
}

export class ValidationError extends Error {
  name: string;
  pointer: string;
  message: string;
  value: any;
  code: string;

  constructor(message: string, options: ValidationErrorProps) {
    super(message);
    this.name = 'ValidationError';
    this.pointer = options.pointer;
    this.message = message;
    this.value = options.value;
    this.code = options.code;
  }
}

const defaultValidator = (schema, data, pointer) => {};

function validateKeywords(schema, data, pointer) {
  const errors = [];

  if ('keywords' in schema) {
    for (let keyword in schema.keywords) {
      const keywordValidator: ValidatorFunction = schema.keywords[keyword];
      const keywordErrors = keywordValidator(schema, data, pointer);
      if (keywordErrors) {
        errors.push(...keywordErrors);
      }
    }
  }

  if (errors.length > 0) {
    return errors;
  }
}

const Types: Record<string, ValidatorFunction> = {
  object(schema, data, pointer) {
    if (typeof data !== 'object') {
      return [
        new ValidationError('Data is not an object', {
          pointer,
          value: data,
          code: 'NOT_AN_OBJECT',
        }),
      ];
    }
  },
  array(schema, data, pointer) {
    if (!Array.isArray(data)) {
      return [
        new ValidationError('Data is not an array', {
          pointer,
          value: data,
          code: 'NOT_AN_ARRAY',
        }),
      ];
    }
  },
  string(schema, data, pointer) {
    if (typeof data !== 'string') {
      return [
        new ValidationError('Data is not a string', {
          pointer,
          value: data,
          code: 'NOT_A_STRING',
        }),
      ];
    }
  },
  number(schema, data, pointer) {
    if (typeof data !== 'number') {
      return [
        new ValidationError('Data is not a number', {
          pointer,
          value: data,
          code: 'NOT_A_NUMBER',
        }),
      ];
    }
  },
  integer(schema, data, pointer) {
    if (typeof data !== 'number' || !Number.isInteger(data)) {
      return [
        new ValidationError('Data is not an integer', {
          pointer,
          value: data,
          code: 'NOT_AN_INTEGER',
        }),
      ];
    }
  },
  boolean(schema, data, pointer) {
    if (typeof data !== 'boolean') {
      return [
        new ValidationError('Data is not a boolean', {
          pointer,
          value: data,
          code: 'NOT_A_BOOLEAN',
        }),
      ];
    }
  },
  null(schema, data, pointer) {
    if (data !== null) {
      return [
        new ValidationError('Data is not null', {
          pointer,
          value: data,
          code: 'NOT_NULL',
        }),
      ];
    }
  },
};

const keywords: Record<string, ValidatorFunction> = {
  // Object
  required(schema, data, pointer) {
    const errors = [];
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        errors.push(
          new ValidationError('Missing required property', {
            pointer: `${pointer}/${key}`,
            value: data,
            code: 'MISSING_REQUIRED_PROPERTY',
          })
        );
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },
  properties(schema, data, pointer) {
    const errors = [];
    for (let key in schema.properties) {
      const { validator } = schema.properties[key];
      const validatorErrors = validator(schema.properties[key], data[key], `${pointer}/${key}`);

      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

  // Array
  items(schema, data, pointer) {
    const errors = [];
    for (let i = 0; i < data.length; i++) {
      const { validator } = schema.items;
      const validatorErrors = validator(schema.items, data[i], `${pointer}/${i}`);
      if (validatorErrors) {
        errors.push(...validatorErrors);
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  },

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
  nullable: defaultValidator,
};

class FJV {
  types = new Map<string, ValidatorFunction>();
  formats = new Map<string, ValidatorFunction>();
  keywords = new Map<string, Keyword>();

  constructor() {
    // Types
    this.addType('object', Types.object);
    this.addType('array', Types.array);
    this.addType('string', Types.string);
    this.addType('number', Types.number);
    this.addType('integer', Types.integer);
    this.addType('boolean', Types.boolean);
    this.addType('null', Types.null);

    // Object
    this.addKeyword('required', keywords.required, 'object');
    this.addKeyword('properties', keywords.properties, 'object');

    // Array
    this.addKeyword('items', keywords.items, 'array');

    // String
    this.addKeyword('minLength', keywords.minLength, 'string');
    this.addKeyword('maxLength', keywords.maxLength, 'string');
    this.addKeyword('pattern', keywords.pattern, 'string');
    this.addKeyword('format', keywords.format, 'string');
    this.addKeyword('enum', keywords.enum, 'string');

    // Number
    this.addKeyword('minimum', keywords.minimum, 'number');
    this.addKeyword('maximum', keywords.maximum, 'number');

    // Integer
    this.addKeyword('minimum', keywords.minimum, 'integer');
    this.addKeyword('maximum', keywords.maximum, 'integer');

    // All
    this.addKeyword('nullable', keywords.nullable, 'any');
  }

  addType(name: string, validator: ValidatorFunction) {
    this.types.set(name, validator);
  }

  addFormat(name: string, validator: ValidatorFunction) {
    this.formats.set(name, validator);
  }

  addKeyword(name: string, validator: ValidatorFunction, schemaType: string = 'any') {
    this.keywords.set(name, { validator, schemaType });
  }

  compile(schema: any): Validator {
    const compiledSchema = this.compileSchema(schema, '#');

    function validate(data: any) {
      return compiledSchema.validator(compiledSchema, data, '#');
    }

    validate.compiledSchema = compiledSchema;

    return validate;
  }

  compileSchema(schema: any, pointer): any {
    if (typeof schema !== 'object') {
      throw new ValidationError('Schema is not an object', {
        pointer,
        value: schema,
        code: 'SCHEMA_NOT_OBJECT',
      });
    }

    if (!schema.type) {
      throw new ValidationError('Schema is missing type', {
        pointer,
        value: schema,
        code: 'SCHEMA_MISSING_TYPE',
      });
    }

    if (!this.types.has(schema.type)) {
      throw new ValidationError('Schema type is not supported', {
        pointer,
        value: schema,
        code: 'SCHEMA_TYPE_NOT_SUPPORTED',
      });
    }

    // Compile schema type
    const schemaValidator = this.types.get(schema.type);
    const validator: ValidatorFunction = (schema: any, data: any, pointer: string) => {
      if (typeof data === 'undefined') {
        if (pointer === '#') {
          return [
            new ValidationError('Data is undefined', {
              pointer,
              value: data,
              code: 'DATA_UNDEFINED',
            }),
          ];
        }

        return;
      }

      const errors = schemaValidator(schema, data, pointer);
      if (errors) {
        return errors;
      }

      const keywordErrors = validateKeywords(schema, data, pointer);

      if (keywordErrors) {
        return keywordErrors;
      }

      if (pointer === '#') {
        return true;
      }
    };

    const compiledSchema = {
      ...schema,
      validator,
      pointer,
    };

    // Recursively compile sub schemas
    for (let key in schema) {
      // Skip type as it is already compiled
      if (key === 'type') {
        continue;
      }

      if (this.keywords.has(key)) {
        const keyword = this.keywords.get(key);
        if (keyword.schemaType === 'any' || keyword.schemaType === schema.type) {
          compiledSchema.keywords = compiledSchema.keywords || {};
          compiledSchema.keywords[key] = keyword.validator;
        }
      }

      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map((subSchema, index) => {
          if (typeof subSchema === 'object' && 'type' in subSchema) {
            return this.compileSchema(subSchema, `${pointer}/${key}/${index}`);
          }
          return subSchema;
        });
        continue;
      }

      if (typeof schema[key] === 'object') {
        if ('type' in schema[key]) {
          compiledSchema[key] = this.compileSchema(schema[key], `${pointer}/${key}`);
          continue;
        }

        for (let subKey in schema[key]) {
          compiledSchema[key] = compiledSchema[key] || {};
          compiledSchema[key][subKey] = this.compileSchema(schema[key][subKey], `${pointer}/${subKey}`);
        }

        continue;
      }
    }

    return compiledSchema;
  }
}

export default FJV;
