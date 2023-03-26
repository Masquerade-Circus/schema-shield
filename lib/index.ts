import { ValidationError, isObject } from './utils';

import { Formats } from './formats';
import { Types } from './types';
import { keywords } from './keywords';

export interface ValidationErrorProps {
  pointer: string;
  value: any;
  code: string;
}

export interface Result {
  valid: boolean;
  errors: ValidationError[];
  data: any;
}

export interface ValidatorFunction {
  (schema: CompiledSchema, data: any, pointer: string, schemaShieldInstance: SchemaShield): Result;
}

export interface FormatFunction {
  (data: any): boolean;
}

export interface CompiledSchema {
  validators?: ValidatorFunction[];
  types?: ValidatorFunction[];
  [key: string]: any;
}

export interface Validator {
  (data: any): Result;
  compiledSchema: CompiledSchema;
}

export class SchemaShield {
  types = new Map<string, ValidatorFunction>();
  formats = new Map<string, FormatFunction>();
  keywords = new Map<string, ValidatorFunction>();

  constructor() {
    Object.keys(Types).forEach((type) => {
      this.addType(type, Types[type]);
    });

    Object.keys(keywords).forEach((keyword) => {
      this.addKeyword(keyword, keywords[keyword]);
    });

    Object.keys(Formats).forEach((format) => {
      this.addFormat(format, Formats[format]);
    });
  }

  addType(name: string, validator: ValidatorFunction) {
    this.types.set(name, validator);
  }

  addFormat(name: string, validator: FormatFunction) {
    this.formats.set(name, validator);
  }

  addKeyword(name: string, validator: ValidatorFunction) {
    this.keywords.set(name, validator);
  }

  compile(schema: any): Validator {
    const compiledSchema = this.compileSchema(schema, '#');

    const validate: Validator = (data: any) => this.validate(compiledSchema, data);
    validate.compiledSchema = compiledSchema;

    return validate;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any, pointer): CompiledSchema {
    if (!isObject(schema)) {
      if (schema === true) {
        schema = {
          anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'array' }, { type: 'object' }, { type: 'null' }],
        };
      } else if (schema === false) {
        schema = {
          oneOf: [],
        };
      } else {
        schema = {
          oneOf: [schema],
        };
      }
    }

    const compiledSchema: CompiledSchema = {};

    if ('type' in schema) {
      const types = Array.isArray(schema.type) ? schema.type : schema.type.split(',').map((t) => t.trim());

      compiledSchema.types = types.map((type) => this.types.get(type)).filter((validator) => validator !== undefined);
    }

    for (let key in schema) {
      if (key === 'type') {
        continue;
      }

      if (this.keywords.has(key)) {
        compiledSchema.validators = compiledSchema.validators || [];
        compiledSchema.validators.push(this.keywords.get(key));
      }

      if (this.isSchemaLike(schema[key])) {
        compiledSchema[key] = this.compileSchema(schema[key], `${pointer}/${key}`);
        continue;
      }
      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map((subSchema, index) =>
          this.isSchemaLike(subSchema) ? this.compileSchema(subSchema, `${pointer}/${key}/${index}`) : subSchema
        );
        continue;
      }

      if (isObject(schema[key])) {
        compiledSchema[key] = this.compileSchema(schema[key], `${pointer}/${key}`);
        continue;
      }

      compiledSchema[key] = schema[key];
    }

    return compiledSchema;
  }

  validate(schema: CompiledSchema, data: any): Result {
    let errors: ValidationError[] = [];

    if (schema.types) {
      for (let type of schema.types) {
        const result = type(schema, data, schema.pointer, this);

        if (result.valid) {
          errors = [];
          break;
        }

        errors.push(...result.errors);
      }
    }

    if (schema.validators) {
      for (let validator of schema.validators) {
        const result = validator(schema, data, schema.pointer, this);

        if (!result.valid) {
          return result;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data,
    };
  }

  private isSchemaOrKeywordPresent(subSchema: any): boolean {
    if ('type' in subSchema) {
      return true;
    }

    for (let subKey in subSchema) {
      if (this.keywords.has(subKey)) {
        return true;
      }
    }
    return false;
  }

  isSchemaLike(subSchema: any): boolean {
    return isObject(subSchema) && this.isSchemaOrKeywordPresent(subSchema);
  }

  isCompiledSchema(subSchema: any): boolean {
    return isObject(subSchema) && ('validators' in subSchema || 'types' in subSchema);
  }
}
