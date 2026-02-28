/****************** Path: lib/index.ts ******************/
import {
  DefineErrorFunction,
  ValidationError,
  getDefinedErrorFunctionForKey,
  getNamedFunction,
  resolvePath
} from "./utils/main-utils";

import { Formats } from "./formats";
import { Types } from "./types";
import { keywords } from "./keywords";
import { deepCloneUnfreeze } from "./utils/deep-freeze";

export { ValidationError } from "./utils/main-utils";
export { deepCloneUnfreeze as deepClone } from "./utils/deep-freeze";

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
  name: string;
  validate: ValidateFunction;
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
    if ((compiledSchema as any)._hasRef === true) {
      this.linkReferences(compiledSchema);
    }

    if (!compiledSchema.$validate) {
      if (schema === false) {
        const defineError = getDefinedErrorFunctionForKey(
          "oneOf",
          compiledSchema,
          this.failFast
        );

        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_False",
          (data) => defineError("Value is not valid", { data })
        );
      } else if (schema === true) {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      } else if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      } else {
        compiledSchema.$validate = getNamedFunction<ValidateFunction>(
          "Validate_Any",
          () => {}
        );
      }
    }

    const validate: Validator = (data: any) => {
      this.rootSchema = compiledSchema;

      const clonedData = this.immutable ? deepCloneUnfreeze(data) : data;
      const res = compiledSchema.$validate!(clonedData);

      if (res) {
        return { data: clonedData, error: res, valid: false };
      }

      return { data: clonedData, error: null, valid: true };
    };

    validate.compiledSchema = compiledSchema;
    return validate;
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private isTrivialAlwaysValidSubschema(value: any): boolean {
    return (
      value === true ||
      (this.isPlainObject(value) && Object.keys(value).length === 0)
    );
  }

  private shallowArrayEquals(a: any[], b: any[]): boolean {
    if (a === b) {
      return true;
    }

    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  private flattenAssociativeBranches(
    key: "allOf" | "anyOf",
    branches: any[]
  ): any[] {
    const out: any[] = [];

    for (let i = 0; i < branches.length; i++) {
      const item = branches[i];
      if (
        this.isPlainObject(item) &&
        Object.keys(item).length === 1 &&
        Array.isArray(item[key])
      ) {
        const nested = this.flattenAssociativeBranches(key, item[key]);
        for (let j = 0; j < nested.length; j++) {
          out.push(nested[j]);
        }
        continue;
      }
      out.push(item);
    }

    return out;
  }

  private flattenSingleWrapperOneOf(branches: any[]): any[] {
    let current = branches;

    while (current.length === 1) {
      const item = current[0];
      if (
        this.isPlainObject(item) &&
        Object.keys(item).length === 1 &&
        Array.isArray(item.oneOf)
      ) {
        current = item.oneOf;
        continue;
      }
      break;
    }

    return current;
  }

  private normalizeSchemaForCompile(schema: Record<string, any>): Record<string, any> {
    let normalized = schema;
    const schemaKeys = Object.keys(schema);
    const hasOnlyKey = (key: string) =>
      schemaKeys.length === 1 && schemaKeys[0] === key;

    const setNormalized = (key: string, value: any) => {
      if (normalized === schema) {
        normalized = { ...schema };
      }
      normalized[key] = value;
    };

    if (Array.isArray(schema.allOf)) {
      const flattenedAllOf = this.flattenAssociativeBranches(
        "allOf",
        schema.allOf
      ).filter(
        (item) =>
          !(
            this.isPlainObject(item) && Object.keys(item).length === 0
          )
      );

      if (
        hasOnlyKey("allOf") &&
        flattenedAllOf.length === 1 &&
        this.isPlainObject(flattenedAllOf[0])
      ) {
        return flattenedAllOf[0];
      }

      if (!this.shallowArrayEquals(flattenedAllOf, schema.allOf)) {
        setNormalized("allOf", flattenedAllOf);
      }
    }

    if (Array.isArray(schema.anyOf)) {
      const flattenedAnyOf = this.flattenAssociativeBranches(
        "anyOf",
        schema.anyOf
      );

      if (
        hasOnlyKey("anyOf") &&
        flattenedAnyOf.length === 1 &&
        this.isPlainObject(flattenedAnyOf[0])
      ) {
        return flattenedAnyOf[0];
      }

      if (!this.shallowArrayEquals(flattenedAnyOf, schema.anyOf)) {
        setNormalized("anyOf", flattenedAnyOf);
      }
    }

    if (Array.isArray(schema.oneOf)) {
      const flattenedOneOf = this.flattenSingleWrapperOneOf(schema.oneOf);

      if (
        hasOnlyKey("oneOf") &&
        flattenedOneOf.length === 1 &&
        this.isPlainObject(flattenedOneOf[0])
      ) {
        return flattenedOneOf[0];
      }

      if (!this.shallowArrayEquals(flattenedOneOf, schema.oneOf)) {
        setNormalized("oneOf", flattenedOneOf);
      }
    }

    return normalized;
  }

  private markSchemaHasRef(schema: CompiledSchema) {
    if ((schema as any)._hasRef === true) {
      return;
    }

    Object.defineProperty(schema, "_hasRef", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  private shouldSkipKeyword(schema: Record<string, any>, key: string): boolean {
    const value = schema[key];

    switch (key) {
      case "required":
        return Array.isArray(value) && value.length === 0;
      case "uniqueItems":
        return value === false;
      case "properties":
      case "patternProperties":
      case "dependencies":
        return (
          this.isPlainObject(value) &&
          Object.keys(value).length === 0
        );
      case "propertyNames":
      case "items":
        return value === true;
      case "additionalProperties":
        if (value === true) {
          return true;
        }

        return (
          value === false &&
          this.isPlainObject(schema.patternProperties) &&
          Object.keys(schema.patternProperties).length > 0
        );
      case "additionalItems":
        return value === true || !Array.isArray(schema.items);
      case "allOf": {
        if (!Array.isArray(value)) {
          return false;
        }

        if (value.length === 0) {
          return true;
        }

        for (let i = 0; i < value.length; i++) {
          if (this.isTrivialAlwaysValidSubschema(value[i])) {
            continue;
          }

          return false;
        }

        return true;
      }
      case "anyOf": {
        if (!Array.isArray(value)) {
          return false;
        }

        for (let i = 0; i < value.length; i++) {
          if (this.isTrivialAlwaysValidSubschema(value[i])) {
            return true;
          }
        }

        return false;
      }
      default:
        return false;
    }
  }

  private hasRequiredDefaults(schema: Record<string, any>): boolean {
    const properties = schema.properties;
    if (!this.isPlainObject(properties)) {
      return false;
    }

    const keys = Object.keys(properties);
    for (let i = 0; i < keys.length; i++) {
      const subSchema = properties[keys[i]];
      if (this.isPlainObject(subSchema) && "default" in subSchema) {
        return true;
      }
    }

    return false;
  }

  private isDefaultTypeValidator(type: string, validator: TypeFunction): boolean {
    return (Types as Record<string, TypeFunction | false>)[type] === validator;
  }

  private compileSchema(schema: Partial<CompiledSchema> | any): CompiledSchema {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      if (schema === true) {
        schema = { anyOf: [{}] }; // Always valid
      } else if (schema === false) {
        schema = { oneOf: [] }; // Always invalid
      } else {
        schema = { oneOf: [schema] };
      }
    }

    schema = this.normalizeSchemaForCompile(schema);

    const compiledSchema: CompiledSchema = deepCloneUnfreeze(
      schema
    ) as CompiledSchema;

    let schemaHasRef = false;

    if (typeof schema.$id === "string") {
      this.idRegistry.set(schema.$id, compiledSchema);
    }

    if ("$ref" in schema) {
      schemaHasRef = true;
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

      this.markSchemaHasRef(compiledSchema);
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
      const defaultTypeNames: string[] = [];
      let allTypesDefault = true;

      for (const type of types) {
        const validator = this.getType(type);
        if (validator) {
          typeFunctions.push(validator);
          typeNames.push(validator.name);
          if (this.isDefaultTypeValidator(type, validator)) {
            defaultTypeNames.push(type);
          } else {
            allTypesDefault = false;
          }
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

      if (typeFunctions.length === 1 && allTypesDefault) {
        const singleTypeName = defaultTypeNames[0];
        typeMethodName = singleTypeName;

        switch (singleTypeName) {
          case "object":
            combinedTypeValidator = (data) => {
              if (data === null || typeof data !== "object" || Array.isArray(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "array":
            combinedTypeValidator = (data) => {
              if (!Array.isArray(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "string":
            combinedTypeValidator = (data) => {
              if (typeof data !== "string") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "number":
            combinedTypeValidator = (data) => {
              if (typeof data !== "number") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "integer":
            combinedTypeValidator = (data) => {
              if (typeof data !== "number" || !Number.isInteger(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "boolean":
            combinedTypeValidator = (data) => {
              if (typeof data !== "boolean") {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          case "null":
            combinedTypeValidator = (data) => {
              if (data !== null) {
                return defineTypeError("Invalid type", { data });
              }
            };
            break;
          default: {
            const singleTypeFn = typeFunctions[0];
            combinedTypeValidator = (data) => {
              if (!singleTypeFn(data)) {
                return defineTypeError("Invalid type", { data });
              }
            };
          }
        }
      } else if (typeFunctions.length > 1 && allTypesDefault) {
        typeMethodName = defaultTypeNames.join("_OR_");

        const allowsObject = defaultTypeNames.includes("object");
        const allowsArray = defaultTypeNames.includes("array");
        const allowsString = defaultTypeNames.includes("string");
        const allowsNumber = defaultTypeNames.includes("number");
        const allowsInteger = defaultTypeNames.includes("integer");
        const allowsBoolean = defaultTypeNames.includes("boolean");
        const allowsNull = defaultTypeNames.includes("null");

        combinedTypeValidator = (data) => {
          const dataType = typeof data;

          if (dataType === "number") {
            if (allowsNumber || (allowsInteger && Number.isInteger(data))) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "string") {
            if (allowsString) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "boolean") {
            if (allowsBoolean) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          if (dataType === "object") {
            if (data === null) {
              if (allowsNull) {
                return;
              }

              return defineTypeError("Invalid type", { data });
            }

            if (Array.isArray(data)) {
              if (allowsArray) {
                return;
              }

              return defineTypeError("Invalid type", { data });
            }

            if (allowsObject) {
              return;
            }

            return defineTypeError("Invalid type", { data });
          }

          return defineTypeError("Invalid type", { data });
        };
      } else if (typeFunctions.length === 1) {
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

      validators.push({
        name: typeMethodName,
        validate: getNamedFunction(typeMethodName, combinedTypeValidator)
      });
      activeNames.push(typeMethodName);
    }

    const { type, $id, $ref, $validate, required, ...otherKeys } = schema; // Exclude handled keys

    // In here we create an array of keys putting the require keyword last
    // This is to ensure required properties are checked after defaults are applied
    const keyOrder = required
      ? this.hasRequiredDefaults(schema)
        ? [...Object.keys(otherKeys), "required"]
        : ["required", ...Object.keys(otherKeys)]
      : Object.keys(otherKeys);

    for (const key of keyOrder) {
      const keywordFn = this.getKeyword(key);

      if (!keywordFn) {
        continue;
      }

      if (this.shouldSkipKeyword(schema, key)) {
        continue;
      }

      const defineError = getDefinedErrorFunctionForKey(
        key,
        schema[key],
        this.failFast
      );
      const fnName = keywordFn.name || key;

      validators.push({
        name: fnName,
        validate: getNamedFunction<ValidateFunction>(fnName, (data) =>
          (keywordFn as KeywordFunction)(compiledSchema, data, defineError, this)
        )
      });

      activeNames.push(fnName);
    }

    const literalKeywords = ["enum", "const", "default", "examples"];
    for (const key of keyOrder) {
      if (literalKeywords.includes(key)) {
        continue;
      }

      if (
        schema[key] &&
        typeof schema[key] === "object" &&
        !Array.isArray(schema[key])
      ) {
        if (key === "properties") {
          for (const subKey of Object.keys(schema[key])) {
            const compiledSubSchema = this.compileSchema(
              schema[key][subKey]
            );

            if ((compiledSubSchema as any)._hasRef === true) {
              schemaHasRef = true;
            }

            compiledSchema[key][subKey] = compiledSubSchema;
          }
          continue;
        }
        const compiledSubSchema = this.compileSchema(schema[key]);
        if ((compiledSubSchema as any)._hasRef === true) {
          schemaHasRef = true;
        }

        compiledSchema[key] = compiledSubSchema;
        continue;
      }

      if (Array.isArray(schema[key])) {
        for (let i = 0; i < schema[key].length; i++) {
          if (this.isSchemaLike(schema[key][i])) {
            const compiledSubSchema = this.compileSchema(schema[key][i]);
            if ((compiledSubSchema as any)._hasRef === true) {
              schemaHasRef = true;
            }

            compiledSchema[key][i] = compiledSubSchema;
          }
        }
        continue;
      }
    }

    if (schemaHasRef) {
      this.markSchemaHasRef(compiledSchema);
    }

    if (validators.length === 0) {
      return compiledSchema;
    }

    if (validators.length === 1) {
      const v = validators[0];
      compiledSchema.$validate = getNamedFunction(v.name, v.validate);
    } else {
      const compositeName = "Validate_" + activeNames.join("_AND_");

      const masterValidator: ValidateFunction = (data) => {
        for (let i = 0; i < validators.length; i++) {
          const v = validators[i];
          const error = v.validate(data);
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
    if (
      subSchema &&
      typeof subSchema === "object" &&
      !Array.isArray(subSchema)
    ) {
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
