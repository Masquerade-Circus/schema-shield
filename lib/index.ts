import {
  DefineErrorFunction,
  ValidationError,
  deepClone,
  getDefinedErrorFunctionForKey,
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
    defineError: DefineErrorFunction,
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
  private types: Record<string, TypeFunction | false> = {};
  private formats: Record<string, FormatFunction | false> = {};
  private keywords: Record<string, KeywordFunction | false> = {};
  private immutable = false;

  constructor({
    immutable = false
  }: {
    immutable?: boolean;
  } = {}) {
    this.immutable = immutable;

    for (const [type, validator] of Object.entries(Types)) {
      if (validator) {
        this.addType(type, validator);
      }
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

  addType(name: string, validator: TypeFunction, overwrite = false) {
    if (this.types[name] && !overwrite) {
      throw new ValidationError(`Type "${name}" already exists`);
    }
    this.types[name] = validator;
  }

  getType(type: string): TypeFunction | false {
    return this.types[type];
  }

  addFormat(name: string, validator: FormatFunction, overwrite = false) {
    if (this.formats[name] && !overwrite) {
      throw new ValidationError(`Format "${name}" already exists`);
    }
    this.formats[name] = validator;
  }

  getFormat(format: string): FormatFunction | false {
    return this.formats[format];
  }

  addKeyword(name: string, validator: KeywordFunction, overwrite = false) {
    if (this.keywords[name] && !overwrite) {
      throw new ValidationError(`Keyword "${name}" already exists`);
    }
    this.keywords[name] = validator;
  }

  getKeyword(keyword: string): KeywordFunction | false {
    return this.keywords[keyword];
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

    const compiledSchema: CompiledSchema = { ...schema } as CompiledSchema;
    const defineTypeError = getDefinedErrorFunctionForKey("type", schema);
    const typeValidations: TypeFunction[] = [];

    let methodName = "";

    if ("type" in schema) {
      const types = Array.isArray(schema.type)
        ? schema.type
        : schema.type.split(",").map((t) => t.trim());

      for (const type of types) {
        const validator = this.getType(type);
        if (validator) {
          typeValidations.push(validator);
          methodName += (methodName ? "_OR_" : "") + validator.name;
        }
      }

      const typeValidationsLength = typeValidations.length;

      if (typeValidationsLength === 0) {
        throw defineTypeError("Invalid type for schema", { data: schema.type });
      }

      if (typeValidationsLength === 1) {
        const typeValidation = typeValidations[0];
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          methodName,
          (data) => {
            if (typeValidation(data)) {
              return;
            }
            return defineTypeError("Invalid type", { data });
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
            return defineTypeError("Invalid type", { data });
          }
        );
      }
    }

    for (const key of Object.keys(schema)) {
      if (key === "type") {
        compiledSchema.type = schema.type;
        continue;
      }

      const keywordValidator = this.getKeyword(key);
      if (keywordValidator) {
        const defineError = getDefinedErrorFunctionForKey(key, schema[key]);
        const executeKeywordValidator = (data: any) =>
          (keywordValidator as KeywordFunction)(
            compiledSchema,
            data,
            defineError,
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
        if (subKey in this.keywords) {
          return true;
        }
      }
    }
    return false;
  }
}
