import {
  ValidationError,
  deepClone,
  getNamedFunction,
  isObject
} from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

export type Result = any;

export interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    error: ValidationError,
    instance: SchemaShield
  ): [boolean, ValidationError];
}

export interface TypeFunction {
  (data: any): boolean;
}

export interface FormatFunction {
  (data: any): boolean;
}

export interface ValidateFunction {
  (data: any): [boolean, ValidationError];
}

export interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}

export interface Validator {
  (data: any): [boolean, ValidationError];
  compiledSchema: CompiledSchema;
}

export class SchemaShield {
  types = new Map<string, TypeFunction | false>();
  formats = new Map<string, FormatFunction | false>();
  keywords = new Map<string, KeywordFunction | false>();
  immutable = false;

  constructor({
    immutable = false
  }: {
    immutable?: boolean;
  } = {}) {
    this.immutable = immutable;

    for (const [type, validator] of Object.entries(Types)) {
      this.addType(type, validator);
    }

    for (const [keyword, validator] of Object.entries(keywords)) {
      this.addKeyword(keyword, validator as KeywordFunction);
    }

    for (const [format, validator] of Object.entries(Formats)) {
      if (validator) {
        this.addFormat(format, validator as FormatFunction);
      }
    }
  }

  addType(name: string, validator: TypeFunction) {
    this.types.set(name, validator);
  }

  addFormat(name: string, validator: FormatFunction) {
    this.formats.set(name, validator);
  }

  addKeyword(name: string, validator: KeywordFunction) {
    this.keywords.set(name, validator);
  }

  compile(schema: any): Validator {
    const compiledSchema = this.compileSchema(schema, "#");
    if (!compiledSchema.$validate) {
      if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema", "#");
      }

      compiledSchema.$validate = getNamedFunction<ValidateFunction>(
        "any",
        (data) => [true, null]
      );
    }

    const validate: Validator = (data: any) => {
      if (this.immutable) {
        data = deepClone(data);
      }
      return compiledSchema.$validate(data);
    };
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

    const compiledSchema: CompiledSchema = {} as CompiledSchema;
    const TypeError = new ValidationError(`Invalid type`, pointer);
    const typeValidations: TypeFunction[] = [];
    let methodName = "";

    if ("type" in schema) {
      const types = Array.isArray(schema.type)
        ? schema.type
        : schema.type.split(",").map((t) => t.trim());

      for (const type of types) {
        const validator = this.types.get(type);
        if (validator) {
          typeValidations.push(validator);
          methodName += (methodName ? "_OR_" : "") + validator.name;
        }
      }

      if (typeValidations.length === 0) {
        throw TypeError;
      }

      if (typeValidations.length === 1) {
        const typeValidation = typeValidations[0];
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          methodName,
          (data) => {
            if (typeValidation(data)) {
              return [true, null];
            }
            return [false, TypeError];
          }
        );
      } else if (typeValidations.length > 1) {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          methodName,
          (data) => {
            for (const validator of typeValidations) {
              if (validator(data)) {
                return [true, null];
              }
            }
            return [false, TypeError];
          }
        );
      }
    }

    for (let key in schema) {
      if (key === "type") {
        continue;
      }

      let keywordValidator = this.keywords.get(key);
      if (keywordValidator) {
        const KeywordError = new ValidationError(`Invalid ${key}`, pointer);
        if (compiledSchema.$validate) {
          const prevValidator = compiledSchema.$validate;
          methodName += `_AND_${keywordValidator.name}`;
          compiledSchema.$validate = getNamedFunction<ValidateFunction>(
            methodName,
            (data) => {
              let [valid, error] = prevValidator(data);
              if (!valid) {
                return [false, error];
              }

              return (keywordValidator as KeywordFunction)(
                compiledSchema,
                data,
                KeywordError,
                this
              );
            }
          );
        } else {
          methodName = keywordValidator.name;
          compiledSchema.$validate = getNamedFunction<ValidateFunction>(
            methodName,
            (data) => {
              return (keywordValidator as KeywordFunction)(
                compiledSchema,
                data,
                KeywordError,
                this
              );
            }
          );
        }
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

    return compiledSchema as CompiledSchema;
  }

  isSchemaLike(subSchema: any): boolean {
    if (isObject(subSchema)) {
      if ("type" in subSchema) {
        return true;
      }

      for (let subKey in subSchema) {
        if (this.keywords.has(subKey)) {
          return true;
        }
      }
    }
    return false;
  }
}
