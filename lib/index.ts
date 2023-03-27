import { ValidationError, isObject } from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

export type Result = any;

export interface ValidatorFunction {
  (
    schema: CompiledSchema,
    data: any,
    pointer: string,
    schemaShieldInstance: SchemaShield
  ): Result;
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
  types = new Map<string, ValidatorFunction | false>();
  formats = new Map<string, FormatFunction | false>();
  keywords = new Map<string, ValidatorFunction | false>();

  constructor() {
    for (const type of Object.keys(Types)) {
      this.addType(type, Types[type]);
    }

    for (const keyword of Object.keys(keywords)) {
      if (keywords[keyword]) {
        this.addKeyword(keyword, keywords[keyword] as ValidatorFunction);
      }
    }

    for (const format of Object.keys(Formats)) {
      if (Formats[format]) {
        this.addFormat(format, Formats[format] as FormatFunction);
      }
    }
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
    const compiledSchema = this.compileSchema(schema, "#");

    const validate: Validator = (data: any) =>
      this.validate(compiledSchema, data);
    validate.compiledSchema = compiledSchema;

    return validate;
  }

  private compileSchema(
    schema: Partial<CompiledSchema> | any,
    pointer
  ): CompiledSchema {
    if (!isObject(schema)) {
      if (schema === true) {
        schema = {
          anyOf: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
            { type: "array" },
            { type: "object" },
            { type: "null" }
          ]
        };
      } else if (schema === false) {
        schema = {
          oneOf: []
        };
      } else {
        schema = {
          oneOf: [schema]
        };
      }
    }

    const compiledSchema: CompiledSchema = {};

    if ("type" in schema) {
      const types = Array.isArray(schema.type)
        ? schema.type
        : schema.type.split(",").map((t) => t.trim());

      compiledSchema.types = types
        .map((type) => this.types.get(type))
        .filter((validator) => Boolean(validator));
    }

    for (let key in schema) {
      if (key === "type") {
        continue;
      }

      let keywordValidator = this.keywords.get(key);
      if (keywordValidator) {
        compiledSchema.validators = compiledSchema.validators || [];
        compiledSchema.validators.push(keywordValidator);
      }

      if (isObject(schema[key])) {
        compiledSchema[key] = this.compileSchema(
          schema[key],
          `${pointer}/${key}`
        );
        continue;
      }

      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map((subSchema, index) =>
          this.isSchemaLike(subSchema)
            ? this.compileSchema(subSchema, `${pointer}/${key}/${index}`)
            : subSchema
        );
        continue;
      }

      compiledSchema[key] = schema[key];
    }

    return compiledSchema;
  }

  validate(schema: CompiledSchema, data: any): Result {
    if (schema.types) {
      let typeValid = false;
      for (let type of schema.types) {
        try {
          data = type(schema, data, schema.pointer, this);
          typeValid = true;
        } catch (error) {
          continue;
        }
      }

      if (!typeValid) {
        throw new ValidationError(`Invalid type`, schema.pointer);
      }
    }

    if (schema.validators) {
      for (let validator of schema.validators) {
        data = validator(schema, data, schema.pointer, this);
      }
    }

    return data;
  }

  private isSchemaOrKeywordPresent(subSchema: any): boolean {
    if ("type" in subSchema) {
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
    return (
      isObject(subSchema) && ("validators" in subSchema || "types" in subSchema)
    );
  }
}
