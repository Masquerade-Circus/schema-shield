import { ValidationError, isObject } from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

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
  pointer: string;
  validator?: ValidatorFunction;
  type?: string;
  validators?: ValidatorFunction[];
  keywords?: Record<string, ValidatorFunction>;
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
    for (const type in Types) {
      this.addType(type, Types[type]);
    }

    for (const keyword in keywords) {
      this.addKeyword(keyword, keywords[keyword]);
    }

    for (const format in Formats) {
      this.addFormat(format, Formats[format]);
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

    const validate: Validator = (data: any) => {
      return compiledSchema.validator(compiledSchema, data, "#", this);
    };

    validate.compiledSchema = compiledSchema;

    return validate;
  }

  private compileSchema(
    schema: Partial<CompiledSchema>,
    pointer
  ): CompiledSchema {
    if (typeof schema !== "object" || schema === null) {
      throw new ValidationError("Schema is not an object", {
        pointer,
        value: schema,
        code: "SCHEMA_NOT_OBJECT"
      });
    }

    const compiledSchema = {
      ...schema,
      pointer
    };

    if ("type" in compiledSchema) {
      const types = Array.isArray(compiledSchema.type)
        ? compiledSchema.type
        : compiledSchema.type.split(",").map((t) => t.trim());

      compiledSchema.validators = types
        .filter((type) => this.types.has(type))
        .map((type) => this.types.get(type));
    }

    // Compile schema type
    const validator: ValidatorFunction = (
      schema: any,
      data: any,
      pointer: string
    ) => {
      if (typeof data === "undefined") {
        if (pointer === "#") {
          return {
            valid: false,
            errors: [
              new ValidationError("Data is undefined", {
                pointer,
                value: data,
                code: "DATA_UNDEFINED"
              })
            ],
            data
          };
        }
      }

      let finalData = data;
      const typeErrorsResult = this.validateTypes(schema, finalData, pointer);
      if (typeErrorsResult.valid === false) {
        return typeErrorsResult;
      }
      finalData = typeErrorsResult.data;

      return this.validateKeywords(schema, finalData, pointer);
    };

    compiledSchema.validator = validator;

    // Recursively compile sub schemas
    for (let key in schema) {
      // Skip type as it is already compiled
      if (key === "type") {
        continue;
      }

      if (this.keywords.has(key)) {
        const validator = this.keywords.get(key);
        compiledSchema.keywords = compiledSchema.keywords || {};
        compiledSchema.keywords[key] = validator;
      }

      this.handleSubSchema(key, schema, pointer, compiledSchema);
    }

    return compiledSchema;
  }

  private handleSubSchema(
    key: string,
    schema: any,
    pointer: string,
    compiledSchema: any
  ) {
    if (Array.isArray(schema[key])) {
      compiledSchema[key] = schema[key].map((subSchema, index) => {
        if (this.isSchemaLike(subSchema)) {
          return this.compileSchema(subSchema, `${pointer}/${key}/${index}`);
        }
        return subSchema;
      });
    } else if (isObject(schema[key])) {
      if (this.isSchemaLike(schema[key])) {
        compiledSchema[key] = this.compileSchema(
          schema[key],
          `${pointer}/${key}`
        );
      } else {
        for (let subKey in schema[key]) {
          if (this.isSchemaLike(schema[key][subKey])) {
            compiledSchema[key] = compiledSchema[key] || {};

            compiledSchema[key][subKey] = this.compileSchema(
              schema[key][subKey],
              `${pointer}/${key}/${subKey}`
            );
          }
        }
      }
    }
  }

  private validateTypes(schema: CompiledSchema, data, pointer): Result {
    if (
      typeof data === "undefined" ||
      !Array.isArray(schema.validators) ||
      schema.validators.length === 0
    ) {
      return {
        valid: true,
        errors: [],
        data
      };
    }

    let errors = [];
    let finalData = data;

    for (let schemaValidator of schema.validators) {
      const schemaResult = schemaValidator(schema, data, pointer, this);

      finalData = schemaResult.data;

      if (schemaResult.valid) {
        return schemaResult;
      }

      errors = schemaResult.errors;
    }

    return {
      valid: errors.length === 0,
      errors,
      data: finalData
    };
  }

  private validateKeywords(schema: CompiledSchema, data, pointer): Result {
    const errors = [];
    let finalData = data;

    if ("keywords" in schema) {
      for (let keyword in schema.keywords) {
        const keywordValidator: ValidatorFunction = schema.keywords[keyword];
        const keywordResult = keywordValidator(
          schema,
          finalData,
          pointer,
          this
        );
        finalData = keywordResult.data;
        if (!keywordResult.valid) {
          errors.push(...keywordResult.errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: finalData
    };
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

  private isSchemaLike(subSchema: any): boolean {
    return isObject(subSchema) && this.isSchemaOrKeywordPresent(subSchema);
  }
}
