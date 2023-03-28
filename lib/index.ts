import {
  ValidationError,
  deepClone,
  getNamedFunction,
  isObject
} from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

export type Result = void | ValidationError;

export interface KeywordFunction {
  (
    schema: CompiledSchema,
    data: any,
    error: ValidationError,
    instance: SchemaShield
  ): Result;
}

export interface TypeFunction {
  (data: any): boolean;
}

export interface FormatFunction {
  (data: any): boolean;
}

export interface ValidateFunction {
  (data: any): Result;
}

export interface CompiledSchema {
  $validate?: ValidateFunction;
  [key: string]: any;
}

export interface Validator {
  (data: any): { data: any; error: ValidationError | null; valid: boolean };
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
    const compiledSchema = this.compileSchema(schema);
    if (!compiledSchema.$validate) {
      if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      }

      compiledSchema.$validate = getNamedFunction<ValidateFunction>(
        "any",
        () => {}
      );
    }

    const validate: Validator = (data: any) => {
      const clonedData = this.immutable ? deepClone(data) : data;
      const error = compiledSchema.$validate(clonedData);

      return {
        data: clonedData,
        error: error ? error : null,
        valid: !error
      };
    };

    validate.compiledSchema = compiledSchema;

    return validate;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any): CompiledSchema {
    if (!isObject(schema)) {
      if (schema === true) {
        schema = {
          anyOf: [{}]
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
    const TypeError = new ValidationError(`Invalid type`);
    TypeError.keyword = "type";
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

      const typeValidationsLength = typeValidations.length;

      if (typeValidationsLength === 0) {
        throw TypeError;
      }

      if (typeValidationsLength === 1) {
        const typeValidation = typeValidations[0];
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          methodName,
          (data) => {
            if (typeValidation(data)) {
              return;
            }
            return TypeError;
          }
        );
      } else if (typeValidationsLength > 1) {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          methodName,
          (data) => {
            for (let i = 0; i < typeValidationsLength; i++) {
              if (typeValidations[i](data)) {
                return;
              }
            }
            return TypeError;
          }
        );
      }
    }

    for (const key in schema) {
      if (key === "type") {
        compiledSchema.type = schema.type;
        continue;
      }

      const keywordValidator = this.keywords.get(key);
      if (keywordValidator) {
        const KeywordError = new ValidationError(`Invalid ${key}`);
        KeywordError.keyword = key;
        const executeKeywordValidator = (data: any) =>
          (keywordValidator as KeywordFunction)(
            compiledSchema,
            data,
            KeywordError,
            this
          );

        if (compiledSchema.$validate) {
          const prevValidator = compiledSchema.$validate;
          methodName += `_AND_${keywordValidator.name}`;
          compiledSchema.$validate = getNamedFunction<ValidateFunction>(
            methodName,
            (data) => {
              const error = prevValidator(data);
              if (error) {
                return error;
              }
              const keywordError = executeKeywordValidator(data);
              if (keywordError) {
                return keywordError;
              }
            }
          );
        } else {
          methodName = keywordValidator.name;
          compiledSchema.$validate = getNamedFunction<ValidateFunction>(
            methodName,
            executeKeywordValidator
          );
        }
      }

      if (isObject(schema[key])) {
        compiledSchema[key] = this.compileSchema(schema[key]);
        continue;
      }

      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map((subSchema, index) =>
          this.isSchemaLike(subSchema)
            ? this.compileSchema(subSchema)
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
