import {
  CompiledSchema,
  FormatFunction,
  Keyword,
  ValidationError,
  Validator,
  ValidatorFunction
} from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

class FastSchema {
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

    function validate(data: any) {
      const errors = compiledSchema.validator(compiledSchema, data, "#");
      if (errors) {
        return {
          valid: false,
          errors
        };
      }

      return {
        valid: true,
        errors: null
      };
    }

    validate.compiledSchema = compiledSchema;

    return validate;
  }

  private compileSchema(schema: Partial<CompiledSchema>, pointer): any {
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
          return [
            new ValidationError("Data is undefined", {
              pointer,
              value: data,
              code: "DATA_UNDEFINED"
            })
          ];
        }

        return;
      }

      const typeErrors = this.validateTypes(schema, data, pointer);
      if (typeErrors) {
        return typeErrors;
      }

      const keywordErrors = this.validateKeywords(schema, data, pointer);
      if (keywordErrors) {
        return keywordErrors;
      }
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

      if (Array.isArray(schema[key])) {
        this.handleArraySchema(key, schema, pointer, compiledSchema);
        continue;
      }

      if (typeof schema[key] === "object") {
        this.handleObjectSchema(key, schema, pointer, compiledSchema);
        continue;
      }
    }

    return compiledSchema;
  }

  private handleArraySchema(
    key: string,
    schema: any,
    pointer: string,
    compiledSchema: any
  ) {
    compiledSchema[key] = schema[key].map((subSchema, index) => {
      if (typeof subSchema === "object" && subSchema !== null) {
        if ("type" in subSchema) {
          return this.compileSchema(subSchema, `${pointer}/${key}/${index}`);
        }

        for (let subKey in subSchema) {
          if (this.keywords.has(subKey)) {
            return this.compileSchema(subSchema, `${pointer}/${key}/${index}`);
          }
        }
      }
      return subSchema;
    });
  }

  private handleObjectSchema(
    key: string,
    schema: any,
    pointer: string,
    compiledSchema: any
  ) {
    if ("type" in schema[key]) {
      compiledSchema[key] = this.compileSchema(
        schema[key],
        `${pointer}/${key}`
      );
      return;
    }

    for (let subKey in schema[key]) {
      compiledSchema[key] = compiledSchema[key] || {};

      if (this.keywords.has(subKey)) {
        compiledSchema[key][subKey] = this.compileSchema(
          schema[key][subKey],
          `${pointer}/${subKey}`
        );
        continue;
      }

      if (typeof schema[key][subKey] === "object") {
        if ("type" in schema[key][subKey]) {
          compiledSchema[key][subKey] = this.compileSchema(
            schema[key][subKey],
            `${pointer}/${key}/${subKey}`
          );
          continue;
        }

        for (let subSubKey in schema[key][subKey]) {
          if (this.keywords.has(subSubKey)) {
            compiledSchema[key][subKey] = this.compileSchema(
              schema[key][subKey],
              `${pointer}/${key}/${subKey}`
            );
            continue;
          }
        }
      }
    }
  }

  private validateKeywords(schema: CompiledSchema, data, pointer) {
    const errors = [];

    if ("keywords" in schema) {
      for (let keyword in schema.keywords) {
        const keywordValidator: ValidatorFunction = schema.keywords[keyword];
        const keywordErrors = keywordValidator(schema, data, pointer, this);
        if (keywordErrors) {
          errors.push(...keywordErrors);
        }
      }
    }

    if (errors.length > 0) {
      return errors;
    }
  }

  private validateTypes(schema: CompiledSchema, data, pointer) {
    if (Array.isArray(schema.validators) && schema.validators.length > 0) {
      let errors = [];
      for (let schemaValidator of schema.validators) {
        const schemaValidatorErrors = schemaValidator(
          schema,
          data,
          pointer,
          this
        );
        if (!schemaValidatorErrors) {
          errors = [];
          break;
        }

        errors = schemaValidatorErrors;
      }

      if (errors.length > 0) {
        return errors;
      }
    }
  }
}

export default FastSchema;
