import {
  CompiledSchema,
  Keyword,
  ValidationError,
  Validator,
  ValidatorFunction
} from "./utils";
import { keywords, validateKeywords } from "./keywords";

import { Types } from "./types";

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
    this.addKeyword("required", keywords.required);
    this.addKeyword("properties", keywords.properties);
    this.addKeyword("minProperties", keywords.minProperties);
    this.addKeyword("maxProperties", keywords.maxProperties);
    this.addKeyword("additionalProperties", keywords.additionalProperties);
    this.addKeyword("patternProperties", keywords.patternProperties);

    // Array
    this.addKeyword("items", keywords.items);
    this.addKeyword("minItems", keywords.minItems);
    this.addKeyword("maxItems", keywords.maxItems);
    this.addKeyword("additionalItems", keywords.additionalItems);
    this.addKeyword("uniqueItems", keywords.uniqueItems);

    // String
    this.addKeyword("minLength", keywords.minLength);
    this.addKeyword("maxLength", keywords.maxLength);
    this.addKeyword("pattern", keywords.pattern);
    this.addKeyword("format", keywords.format);
    this.addKeyword("enum", keywords.enum);

    // Number & Integer
    this.addKeyword("minimum", keywords.minimum);
    this.addKeyword("maximum", keywords.maximum);
    this.addKeyword("multipleOf", keywords.multipleOf);

    // All
    this.addKeyword("nullable", keywords.nullable);
    this.addKeyword("oneOf", keywords.oneOf);
    this.addKeyword("allOf", keywords.allOf);
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

  compileSchema(schema: Partial<CompiledSchema>, pointer): any {
    const compiledSchema = {
      ...schema,
      pointer,
      types: [],
      validators: []
    };

    if (typeof compiledSchema !== "object") {
      throw new ValidationError("Schema is not an object", {
        pointer,
        value: schema,
        code: "SCHEMA_NOT_OBJECT"
      });
    }

    if ("type" in compiledSchema) {
      if (Array.isArray(compiledSchema.type)) {
        compiledSchema.types = compiledSchema.type;
      } else if (typeof compiledSchema.type === "string") {
        compiledSchema.types = compiledSchema.type
          .split(",")
          .map((t) => t.trim());
      } else {
        throw new ValidationError(
          `Schema type "${compiledSchema.type}" must be a string or an array`,
          {
            pointer,
            value: schema,
            code: "SCHEMA_TYPE_NOT_STRING"
          }
        );
      }

      for (let type of compiledSchema.types) {
        if (!this.types.has(type)) {
          throw new ValidationError(`Schema type "${type}" is not supported`, {
            pointer,
            value: schema,
            code: "SCHEMA_TYPE_NOT_SUPPORTED"
          });
        }

        compiledSchema.validators.push(this.types.get(type));
      }
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

      if (compiledSchema.validators.length > 0) {
        let errors = [];
        for (let schemaValidator of compiledSchema.validators) {
          const schemaValidatorErrors = schemaValidator(schema, data, pointer);
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

      const keywordErrors = validateKeywords(schema, data, pointer);
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
        const keyword = this.keywords.get(key);
        compiledSchema.keywords = compiledSchema.keywords || {};
        compiledSchema.keywords[key] = keyword.validator;
      }

      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map((subSchema, index) => {
          if (typeof subSchema === "object" && subSchema !== null) {
            if ("type" in subSchema) {
              return this.compileSchema(
                subSchema,
                `${pointer}/${key}/${index}`
              );
            }

            for (let subKey in subSchema) {
              if (this.keywords.has(subKey)) {
                return this.compileSchema(
                  subSchema,
                  `${pointer}/${key}/${index}`
                );
              }
            }
          }
          return subSchema;
        });
        continue;
      }

      if (typeof schema[key] === "object") {
        if ("type" in schema[key]) {
          compiledSchema[key] = this.compileSchema(
            schema[key],
            `${pointer}/${key}`
          );
          continue;
        }

        for (let subKey in schema[key]) {
          compiledSchema[key] = compiledSchema[key] || {};
          compiledSchema[key][subKey] = this.compileSchema(
            schema[key][subKey],
            `${pointer}/${subKey}`
          );
        }

        continue;
      }
    }

    return compiledSchema;
  }
}

export default FJV;
