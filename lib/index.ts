/****************** Path: lib/index.ts ******************/
import {
  DefineErrorFunction,
  ValidationError,
  deepClone,
  getDefinedErrorFunctionForKey,
  getNamedFunction,
  isObject,
  resolvePath
} from "./utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";

export { ValidationError } from "./utils";
export { deepClone } from "./utils";

export type Result = void | ValidationError | true;

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
  (data: any): {
    data: any;
    error: ValidationError | null | true;
    valid: boolean;
  };
  compiledSchema: CompiledSchema;
}

interface ValidatorItem {
  fn: KeywordFunction;
  defineError: DefineErrorFunction;
}

export class SchemaShield {
  private types: Record<string, TypeFunction | false> = {};
  private formats: Record<string, FormatFunction | false> = {};
  private keywords: Record<string, KeywordFunction | false> = {};
  private immutable = false;
  private rootSchema: CompiledSchema | null = null;
  private idRegistry: Map<string, CompiledSchema> = new Map();
  private failFast: boolean = true;

  constructor({
    immutable = false,
    failFast = true
  }: {
    immutable?: boolean;
    failFast?: boolean;
  } = {}) {
    this.immutable = immutable;
    this.failFast = failFast;

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

  getSchemaRef(path: string): CompiledSchema | undefined {
    if (!this.rootSchema) {
      return;
    }
    return resolvePath(this.rootSchema, path);
  }

  getSchemaById(id: string): CompiledSchema | undefined {
    return this.idRegistry.get(id);
  }

  compile(schema: any): Validator {
    this.idRegistry.clear();
    const compiledSchema = this.compileSchema(schema);
    this.rootSchema = compiledSchema;
    this.linkReferences(compiledSchema);

    if (!compiledSchema.$validate) {
      if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      }

      compiledSchema.$validate = getNamedFunction<ValidateFunction>(
        "Validate_Any",
        () => {}
      );
    }

    const validate: Validator = (data: any) => {
      this.rootSchema = compiledSchema;

      const clonedData = this.immutable ? deepClone(data) : data;
      const res = compiledSchema.$validate!(clonedData);

      if (res) {
        return { data: clonedData, error: res, valid: false };
      }

      return { data: clonedData, error: null, valid: true };
    };

    validate.compiledSchema = compiledSchema;
    return validate;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any): CompiledSchema {
    if (!isObject(schema)) {
      if (schema === true) {
        schema = { anyOf: [{}] }; // Always valid
      } else if (schema === false) {
        schema = { oneOf: [] }; // Always invalid
      } else {
        schema = { oneOf: [schema] };
      }
    }

    const compiledSchema: CompiledSchema = deepClone(schema) as CompiledSchema;

    if (typeof schema.$id === "string") {
      this.idRegistry.set(schema.$id, compiledSchema);
    }

    if ("$ref" in schema) {
      const refValidator = this.getKeyword("$ref");
      if (refValidator) {
        const defineError = getDefinedErrorFunctionForKey(
          "$ref",
          schema["$ref"],
          this.failFast
        );

        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Reference",
          (data) =>
            (refValidator as KeywordFunction)(
              compiledSchema,
              data,
              defineError,
              this
            )
        );
      }
      return compiledSchema;
    }

    const validators: ValidatorItem[] = [];
    const activeNames: string[] = [];

    if ("type" in schema) {
      const defineTypeError = getDefinedErrorFunctionForKey(
        "type",
        schema,
        this.failFast
      );
      const types = Array.isArray(schema.type)
        ? schema.type
        : schema.type.split(",").map((t: string) => t.trim());

      const typeFunctions: TypeFunction[] = [];
      const typeNames: string[] = [];

      for (const type of types) {
        const validator = this.getType(type);
        if (validator) {
          typeFunctions.push(validator);
          typeNames.push(validator.name);
        }
      }

      if (typeFunctions.length === 0) {
        throw getDefinedErrorFunctionForKey(
          "type",
          schema,
          this.failFast
        )("Invalid type for schema", { data: schema.type });
      }

      let combinedTypeValidator: ValidateFunction;
      let typeMethodName = "";

      if (typeFunctions.length === 1) {
        typeMethodName = typeNames[0];
        const singleTypeFn = typeFunctions[0];
        combinedTypeValidator = (data) => {
          if (!singleTypeFn(data)) {
            return defineTypeError("Invalid type", { data });
          }
        };
      } else {
        typeMethodName = typeNames.join("_OR_");
        combinedTypeValidator = (data) => {
          for (let i = 0; i < typeFunctions.length; i++) {
            if (typeFunctions[i](data)) {
              return;
            }
          }
          return defineTypeError("Invalid type", { data });
        };
      }

      const typeAdapter: KeywordFunction = (_s, data) =>
        combinedTypeValidator(data);

      validators.push({
        fn: getNamedFunction(typeMethodName, typeAdapter),
        defineError: defineTypeError
      });
      activeNames.push(typeMethodName);
    }

    const { type, $id, $ref, $validate, required, ...otherKeys } = schema; // Exclude handled keys

    // In here we create an array of keys putting the require keyword last
    // This is to ensure required properties are checked after defaults are applied
    const keyOrder = required
      ? [...Object.keys(otherKeys), "required"]
      : Object.keys(otherKeys);
    for (const key of keyOrder) {
      const keywordFn = this.getKeyword(key);

      if (keywordFn) {
        const defineError = getDefinedErrorFunctionForKey(
          key,
          schema[key],
          this.failFast
        );
        const fnName = keywordFn.name || key;

        validators.push({
          fn: keywordFn as KeywordFunction,
          defineError
        });

        activeNames.push(fnName);
      }
    }

    const literalKeywords = ["enum", "const", "default", "examples"];
    for (const key of keyOrder) {
      if (literalKeywords.includes(key)) {
        continue;
      }
      if (isObject(schema[key])) {
        if (key === "properties") {
          for (const subKey of Object.keys(schema[key])) {
            compiledSchema[key][subKey] = this.compileSchema(
              schema[key][subKey]
            );
          }
          continue;
        }
        compiledSchema[key] = this.compileSchema(schema[key]);
        continue;
      }

      if (Array.isArray(schema[key])) {
        for (let i = 0; i < schema[key].length; i++) {
          if (this.isSchemaLike(schema[key][i])) {
            compiledSchema[key][i] = this.compileSchema(schema[key][i]);
          }
        }
        continue;
      }
    }

    if (validators.length === 0) {
      return compiledSchema;
    }

    if (validators.length === 1) {
      const v = validators[0];
      compiledSchema.$validate = getNamedFunction(activeNames[0], (data) =>
        v.fn(compiledSchema, data, v.defineError, this)
      );
    } else {
      const compositeName = "Validate_" + activeNames.join("_AND_");

      const masterValidator: ValidateFunction = (data) => {
        for (let i = 0; i < validators.length; i++) {
          const v = validators[i];
          const error = v.fn(compiledSchema, data, v.defineError, this);
          if (error) {
            return error;
          }
        }
        return;
      };

      compiledSchema.$validate = getNamedFunction(
        compositeName,
        masterValidator
      );
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

  private linkReferences(root: CompiledSchema) {
    const stack: any[] = [root];

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node || typeof node !== "object") continue;

      if (
        typeof node.$ref === "string" &&
        typeof node.$validate === "function" &&
        node.$validate.name === "Validate_Reference"
      ) {
        const refPath = node.$ref as string;

        let target: any = this.getSchemaRef(refPath);
        if (typeof target === "undefined") {
          target = this.getSchemaById(refPath);
        }

        if (typeof target === "boolean") {
          if (target === true) {
            node.$validate = getNamedFunction("Validate_Ref_True", () => {});
          } else {
            const defineError = getDefinedErrorFunctionForKey(
              "$ref",
              node as any,
              this.failFast
            );

            node.$validate = getNamedFunction(
              "Validate_Ref_False",
              (_data: any) => defineError("Value is not valid")
            );
          }
          continue;
        }

        if (target && typeof target.$validate === "function") {
          node.$validate = target.$validate;
        }
      }

      for (const key in node) {
        const value = node[key];
        if (!value) continue;

        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const v = value[i];
            if (v && typeof v === "object") {
              stack.push(v);
            }
          }
        } else if (typeof value === "object") {
          stack.push(value);
        }
      }
    }
  }
}
