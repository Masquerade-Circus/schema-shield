var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/index.ts
var lib_exports = {};
__export(lib_exports, {
  default: () => lib_default
});
module.exports = __toCommonJS(lib_exports);

// lib/utils.ts
var ValidationError = class extends Error {
  name;
  pointer;
  message;
  value;
  code;
  constructor(message, options = {
    pointer: "",
    value: null,
    code: ""
  }) {
    super(message);
    this.name = "ValidationError";
    this.pointer = options.pointer;
    this.message = message;
    this.value = options.value;
    this.code = options.code;
  }
};
function deepEqual(obj, other) {
  if (Array.isArray(obj) && Array.isArray(other)) {
    if (obj.length !== other.length) {
      return false;
    }
    for (let i = 0; i < obj.length; i++) {
      if (!deepEqual(obj[i], other[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeof obj === "object" && typeof other === "object") {
    if (obj === null || other === null) {
      return obj === other;
    }
    const keys = Object.keys(obj);
    if (keys.length !== Object.keys(other).length) {
      return false;
    }
    for (const key of keys) {
      if (!deepEqual(obj[key], other[key])) {
        return false;
      }
    }
    return true;
  }
  return obj === other;
}
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

// lib/formats.ts
var RegExps = {
  "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?=(?:[0-9a-fA-F]{0,4}:){0,7}[0-9a-fA-F]{0,4}(?![:.\w]))(([0-9a-fA-F]{1,4}:){1,7}|:)((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  hostname: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*$/
};
function notImplementedFormat(data) {
  throw new ValidationError(
    `Format "${data}" is not implemented yet. Please open an issue on GitHub.`
  );
  return false;
}
var Formats = {
  ["date-time"](data) {
    return RegExps["date-time"].test(data);
  },
  uri(data) {
    return RegExps.uri.test(data);
  },
  email(data) {
    return RegExps.email.test(data);
  },
  ipv4(data) {
    return RegExps.ipv4.test(data);
  },
  ipv6(data) {
    return RegExps.ipv6.test(data);
  },
  hostname(data) {
    return RegExps.hostname.test(data);
  },
  // Not supported yet
  time: notImplementedFormat,
  date: notImplementedFormat,
  duration: notImplementedFormat,
  "idn-email": notImplementedFormat,
  "idn-hostname": notImplementedFormat,
  uuid: notImplementedFormat,
  "uri-reference": notImplementedFormat,
  iri: notImplementedFormat,
  "iri-reference": notImplementedFormat,
  "uri-template": notImplementedFormat,
  "json-pointer": notImplementedFormat,
  "relative-json-pointer": notImplementedFormat,
  regex: notImplementedFormat
};

// lib/types.ts
var Types = {
  object(schema, data, pointer) {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not an object", {
          pointer,
          value: data,
          code: "NOT_AN_OBJECT"
        })
      ],
      data
    };
  },
  array(schema, data, pointer) {
    if (Array.isArray(data)) {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    if (typeof data === "object" && data !== null && "length" in data) {
      const keys = Object.keys(data);
      if (keys.length > 0 && (keys[0] !== "0" || keys.length !== data.length)) {
        return {
          valid: false,
          errors: [
            new ValidationError("Data is not an array", {
              pointer,
              value: data,
              code: "NOT_AN_ARRAY"
            })
          ],
          data
        };
      }
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not an array", {
          pointer,
          value: data,
          code: "NOT_AN_ARRAY"
        })
      ],
      data
    };
  },
  string(schema, data, pointer) {
    if (typeof data === "string") {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not a string", {
          pointer,
          value: data,
          code: "NOT_A_STRING"
        })
      ],
      data
    };
  },
  number(schema, data, pointer) {
    if (typeof data === "number") {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not a number", {
          pointer,
          value: data,
          code: "NOT_A_NUMBER"
        })
      ],
      data
    };
  },
  integer(schema, data, pointer) {
    if (typeof data === "number" && Number.isInteger(data)) {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not an integer", {
          pointer,
          value: data,
          code: "NOT_AN_INTEGER"
        })
      ],
      data
    };
  },
  boolean(schema, data, pointer) {
    if (typeof data === "boolean") {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not a boolean", {
          pointer,
          value: data,
          code: "NOT_A_BOOLEAN"
        })
      ],
      data
    };
  },
  null(schema, data, pointer) {
    if (data === null) {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Data is not null", {
          pointer,
          value: data,
          code: "NOT_NULL"
        })
      ],
      data
    };
  }
};

// lib/keywords/array-keywords.ts
var ArrayKeywords = {
  items(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = [...data];
    if (Array.isArray(schema.items)) {
      for (let i = 0; i < schema.items.length; i++) {
        if (typeof schema.items[i] === "boolean") {
          if (schema.items[i] === false && typeof data[i] !== "undefined") {
            errors.push(
              new ValidationError("Array item is not allowed", {
                pointer: `${pointer}/${i}`,
                value: data[i],
                code: "ARRAY_ITEM_NOT_ALLOWED"
              })
            );
          }
          continue;
        }
        const { validator } = schema.items[i];
        if (!validator) {
          continue;
        }
        const validatorResult = validator(
          schema.items[i],
          finalData[i],
          `${pointer}/${i}`,
          schemaShieldInstance
        );
        finalData[i] = validatorResult.data;
        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }
      }
    } else if (typeof schema.items === "boolean") {
      if (schema.items === false && data.length > 0) {
        errors.push(
          new ValidationError("Array is not allowed", {
            pointer,
            value: data,
            code: "ARRAY_NOT_ALLOWED"
          })
        );
      }
    } else {
      const { validator } = schema.items;
      if (!validator) {
        return { valid: true, errors: [], data };
      }
      for (let i = 0; i < finalData.length; i++) {
        const validatorErrors = validator(
          schema.items,
          finalData[i],
          `${pointer}/${i}`,
          schemaShieldInstance
        );
        finalData[i] = validatorErrors.data;
        if (!validatorErrors.valid) {
          errors.push(...validatorErrors.errors);
        }
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  },
  minItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Array is too short", {
          pointer,
          value: data,
          code: "ARRAY_TOO_SHORT"
        })
      ],
      data
    };
  },
  maxItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Array is too long", {
          pointer,
          value: data,
          code: "ARRAY_TOO_LONG"
        })
      ],
      data
    };
  },
  additionalItems(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return { valid: true, errors: [], data };
    }
    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return {
          valid: false,
          errors: [
            new ValidationError("Array has too many items", {
              pointer,
              value: data,
              code: "ARRAY_TOO_MANY_ITEMS"
            })
          ],
          data
        };
      }
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = [...data];
    if (typeof schema.additionalItems === "object") {
      for (let i = schema.items.length; i < finalData.length; i++) {
        const { validator } = schema.additionalItems;
        const validatorResult = validator(
          schema.additionalItems,
          finalData[i],
          `${pointer}/${i}`,
          schemaShieldInstance
        );
        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }
        finalData[i] = validatorResult.data;
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  },
  uniqueItems(schema, data, pointer) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return { valid: true, errors: [], data };
    }
    const unique = /* @__PURE__ */ new Set();
    for (const item of data) {
      let itemStr = item;
      if (typeof item === "string") {
        itemStr = `"${item}"`;
      } else if (isObject(item)) {
        const keys = Object.keys(item).sort();
        const sorted = {};
        for (let i = 0; i < keys.length; i++) {
          sorted[keys[i]] = item[keys[i]];
        }
        itemStr = JSON.stringify(sorted);
      } else if (Array.isArray(item)) {
        itemStr = JSON.stringify(item);
      }
      if (unique.has(itemStr)) {
        return {
          valid: false,
          errors: [
            new ValidationError("Array items are not unique", {
              pointer,
              value: data,
              code: "ARRAY_ITEMS_NOT_UNIQUE"
            })
          ],
          data
        };
      } else {
        unique.add(itemStr);
      }
    }
    return { valid: true, errors: [], data };
  }
};

// lib/keywords/number-keywords.ts
var NumberKeywords = {
  minimum(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }
    const min = schema.exclusiveMinimum ? schema.minimum + 1e-15 : schema.minimum;
    const valid = data >= min;
    return {
      valid,
      errors: valid ? [] : [
        new ValidationError("Number is too small", {
          pointer,
          value: data,
          code: "NUMBER_TOO_SMALL"
        })
      ],
      data
    };
  },
  maximum(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }
    const max = schema.exclusiveMaximum ? schema.maximum - 1e-15 : schema.maximum;
    const valid = data <= max;
    return {
      valid,
      errors: valid ? [] : [
        new ValidationError("Number is too large", {
          pointer,
          value: data,
          code: "NUMBER_TOO_LARGE"
        })
      ],
      data
    };
  },
  multipleOf(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, errors: [], data };
    }
    const quotient = data / schema.multipleOf;
    const areMultiples = Math.abs(quotient - Math.round(quotient)) < 1e-15;
    return {
      valid: areMultiples,
      errors: areMultiples ? [] : [
        new ValidationError("Number is not a multiple of", {
          pointer,
          value: data,
          code: "NUMBER_NOT_MULTIPLE_OF"
        })
      ],
      data
    };
  }
};

// lib/keywords/object-keywords.ts
var ObjectKeywords = {
  // Object
  required(schema, data, pointer) {
    if (!isObject(data)) {
      return {
        valid: true,
        errors: [],
        data
      };
    }
    const errors = [];
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        errors.push(
          new ValidationError("Missing required property", {
            pointer: `${pointer}/${key}`,
            value: data,
            code: "MISSING_REQUIRED_PROPERTY"
          })
        );
      }
    }
    return { valid: errors.length === 0, errors, data };
  },
  properties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = { ...data };
    for (let key in schema.properties) {
      if (!data.hasOwnProperty(key) || typeof data[key] === "undefined") {
        if (isObject(schema.properties[key]) && "default" in schema.properties[key]) {
          finalData[key] = schema.properties[key].default;
        }
        continue;
      }
      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          errors.push(
            new ValidationError("Property is not allowed", {
              pointer: `${pointer}/${key}`,
              value: data[key],
              code: "PROPERTY_NOT_ALLOWED"
            })
          );
        }
        continue;
      }
      const { validator } = schema.properties[key];
      if (!validator) {
        continue;
      }
      const validatorResult = validator(
        schema.properties[key],
        finalData[key],
        `${pointer}/${key}`,
        schemaShieldInstance
      );
      finalData[key] = validatorResult.data;
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  },
  maxProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Object has too many properties", {
          pointer,
          value: data,
          code: "OBJECT_TOO_MANY_PROPERTIES"
        })
      ],
      data
    };
  },
  minProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("Object has too few properties", {
          pointer,
          value: data,
          code: "OBJECT_TOO_FEW_PROPERTIES"
        })
      ],
      data
    };
  },
  additionalProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = { ...data };
    for (let key in data) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }
      if (schema.patternProperties) {
        let match = false;
        for (let pattern in schema.patternProperties) {
          if (new RegExp(pattern).test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }
      if (schema.additionalProperties === false) {
        errors.push(
          new ValidationError("Additional property not allowed", {
            pointer: `${pointer}/${key}`,
            value: data,
            code: "ADDITIONAL_PROPERTY_NOT_ALLOWED"
          })
        );
        continue;
      }
      const { validator } = schema.additionalProperties;
      if (!validator) {
        continue;
      }
      const validatorResult = validator(
        schema.additionalProperties,
        finalData[key],
        `${pointer}/${key}`,
        schemaShieldInstance
      );
      finalData[key] = validatorResult.data;
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  },
  patternProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = { ...data };
    for (let pattern in schema.patternProperties) {
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (let key in finalData) {
            if (new RegExp(pattern).test(key)) {
              errors.push(
                new ValidationError("Property is not allowed", {
                  pointer: `${pointer}/${key}`,
                  value: data[key],
                  code: "PROPERTY_NOT_ALLOWED"
                })
              );
            }
          }
        }
        continue;
      }
      const { validator } = schema.patternProperties[pattern];
      if (!validator) {
        continue;
      }
      for (let key in finalData) {
        if (new RegExp(pattern).test(key)) {
          const validatorResult = validator(
            schema.patternProperties[pattern],
            finalData[key],
            `${pointer}/${key}`,
            schemaShieldInstance
          );
          finalData[key] = validatorResult.data;
          if (!validatorResult.valid) {
            errors.push(...validatorResult.errors);
          }
        }
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  }
};

// lib/keywords/other-keywords.ts
var OtherKeywords = {
  nullable(schema, data, pointer) {
    if (schema.nullable && data !== null) {
      return {
        valid: false,
        errors: [
          new ValidationError("Value must be null to be empty", {
            pointer,
            value: data,
            code: "VALUE_NOT_NULL"
          })
        ],
        data
      };
    }
    return { valid: true, errors: [], data };
  },
  oneOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let validCount = 0;
    let finalData = data;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        const { validator } = schema.oneOf[i];
        if (!validator) {
          validCount++;
          continue;
        }
        const validationResult = validator(
          schema.oneOf[i],
          finalData,
          pointer,
          schemaShieldInstance
        );
        if (validationResult.valid) {
          validCount++;
        } else {
          errors.push(...validationResult.errors);
        }
        finalData = validationResult.data;
      } else {
        if (typeof schema.oneOf[i] === "boolean") {
          if (Boolean(data) === schema.oneOf[i]) {
            validCount++;
          }
          continue;
        }
        if (data === schema.oneOf[i]) {
          validCount++;
        }
      }
    }
    if (validCount === 1) {
      return { valid: true, errors: [], data: finalData };
    }
    return {
      valid: false,
      errors: [
        new ValidationError(`Value must match exactly one schema in oneOf`, {
          pointer,
          value: data,
          code: "VALUE_DOES_NOT_MATCH_ONE_OF"
        })
      ],
      data: finalData
    };
  },
  allOf(schema, data, pointer, schemaShieldInstance) {
    const errors = [];
    let finalData = data;
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        const { validator } = schema.allOf[i];
        if (!validator) {
          continue;
        }
        const validatorResult = validator(
          schema.allOf[i],
          finalData,
          pointer,
          schemaShieldInstance
        );
        if (!validatorResult.valid) {
          errors.push(...validatorResult.errors);
        }
        finalData = validatorResult.data;
      } else {
        if (typeof schema.allOf[i] === "boolean") {
          if (Boolean(data) !== schema.allOf[i]) {
            errors.push(
              new ValidationError(`Value must match all schemas in allOf`, {
                pointer,
                value: data,
                code: "VALUE_DOES_NOT_MATCH_ALL_OF"
              })
            );
          }
          continue;
        }
        if (data !== schema.allOf[i]) {
          errors.push(
            new ValidationError(`Value must match all schemas in allOf`, {
              pointer,
              value: data,
              code: "VALUE_DOES_NOT_MATCH_ALL_OF"
            })
          );
        }
      }
    }
    return { valid: errors.length === 0, errors, data: finalData };
  },
  anyOf(schema, data, pointer, schemaShieldInstance) {
    let finalData = data;
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        const { validator } = schema.anyOf[i];
        if (!validator) {
          return { valid: true, errors: [], data };
        }
        const validationResult = validator(
          schema.anyOf[i],
          finalData,
          pointer,
          schemaShieldInstance
        );
        finalData = validationResult.data;
        if (validationResult.valid) {
          return { valid: true, errors: [], data: finalData };
        }
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return { valid: true, errors: [], data: finalData };
          }
        }
        if (data === schema.anyOf[i]) {
          return { valid: true, errors: [], data: finalData };
        }
      }
    }
    return {
      valid: false,
      errors: [
        new ValidationError(`Value must match at least one schema in anyOf`, {
          pointer,
          value: data,
          code: "VALUE_DOES_NOT_MATCH_ANY_OF"
        })
      ],
      data
    };
  },
  dependencies(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, errors: [], data };
    }
    const errors = [];
    let finalData = data;
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }
      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            errors.push(
              new ValidationError(`Dependency ${dependency[i]} is missing`, {
                pointer,
                value: data,
                code: "DEPENDENCY_MISSING"
              })
            );
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        errors.push(
          new ValidationError(`Dependency ${key} is missing`, {
            pointer,
            value: data,
            code: "DEPENDENCY_MISSING"
          })
        );
        continue;
      }
      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        errors.push(
          new ValidationError(`Dependency ${dependency} is missing`, {
            pointer,
            value: data,
            code: "DEPENDENCY_MISSING"
          })
        );
        continue;
      }
      const { validator } = dependency;
      if (!validator) {
        continue;
      }
      const validatorResult = validator(
        dependency,
        finalData,
        pointer,
        schemaShieldInstance
      );
      if (!validatorResult.valid) {
        errors.push(...validatorResult.errors);
      }
      finalData = validatorResult.data;
    }
    return { valid: errors.length === 0, errors, data: finalData };
  }
};

// lib/keywords/string-keywords.ts
var StringKeywords = {
  minLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("String is too short", {
          pointer,
          value: data,
          code: "STRING_TOO_SHORT"
        })
      ],
      data
    };
  },
  maxLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return { valid: true, errors: [], data };
    }
    return {
      valid: false,
      errors: [
        new ValidationError("String is too long", {
          pointer,
          value: data,
          code: "STRING_TOO_LONG"
        })
      ],
      data
    };
  },
  pattern(schema, data, pointer) {
    if (typeof data !== "string") {
      return { valid: true, errors: [], data };
    }
    const patternRegexp = typeof schema.pattern === "string" ? new RegExp(schema.pattern) : schema.pattern;
    if (patternRegexp instanceof RegExp === false) {
      return {
        valid: false,
        errors: [
          new ValidationError("Pattern is not a valid regular expression", {
            pointer,
            value: data,
            code: "PATTERN_IS_NOT_REGEXP"
          })
        ],
        data
      };
    }
    const valid = patternRegexp.test(data);
    return {
      valid,
      errors: valid ? [] : [
        new ValidationError("String does not match pattern", {
          pointer,
          value: data,
          code: "STRING_DOES_NOT_MATCH_PATTERN"
        })
      ],
      data
    };
  },
  format(schema, data, pointer, formatInstance) {
    if (typeof data !== "string") {
      return { valid: true, errors: [], data };
    }
    const formatValidate = formatInstance.formats.get(schema.format);
    if (!formatValidate) {
      return {
        valid: false,
        errors: [
          new ValidationError(`Unknown format ${schema.format}`, {
            pointer,
            value: data,
            code: "UNKNOWN_FORMAT"
          })
        ],
        data
      };
    }
    const valid = formatValidate(data);
    return {
      valid,
      errors: valid ? [] : [
        new ValidationError(
          `String does not match format ${schema.format}`,
          {
            pointer,
            value: data,
            code: "STRING_DOES_NOT_MATCH_FORMAT"
          }
        )
      ],
      data
    };
  },
  enum(schema, data, pointer) {
    for (let i = 0; i < schema.enum.length; i++) {
      if (schema.enum[i] === data) {
        return { valid: true, errors: [], data };
      }
    }
    if (Array.isArray(data)) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (Array.isArray(schema.enum[i])) {
          if (deepEqual(schema.enum[i], data)) {
            return { valid: true, errors: [], data };
          }
        }
      }
    }
    if (typeof data === "object" && data !== null) {
      for (let i = 0; i < schema.enum.length; i++) {
        if (typeof schema.enum[i] === "object" && schema.enum[i] !== null) {
          if (deepEqual(schema.enum[i], data)) {
            return { valid: true, errors: [], data };
          }
        }
      }
    }
    return {
      valid: false,
      errors: [
        new ValidationError(`Value must be one of ${schema.enum.join(", ")}`, {
          pointer,
          value: data,
          code: "VALUE_NOT_IN_ENUM"
        })
      ],
      data
    };
  }
};

// lib/keywords.ts
var keywords = {
  ...ObjectKeywords,
  ...ArrayKeywords,
  ...StringKeywords,
  ...NumberKeywords,
  ...OtherKeywords
};

// lib/index.ts
var SchemaShield = class {
  types = /* @__PURE__ */ new Map();
  formats = /* @__PURE__ */ new Map();
  keywords = /* @__PURE__ */ new Map();
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
  addType(name, validator) {
    this.types.set(name, validator);
  }
  addFormat(name, validator) {
    this.formats.set(name, validator);
  }
  addKeyword(name, validator) {
    this.keywords.set(name, validator);
  }
  compile(schema) {
    const compiledSchema = this.compileSchema(schema, "#");
    const schemaShield = this;
    function validate(data) {
      return compiledSchema.validator(compiledSchema, data, "#", schemaShield);
    }
    validate.compiledSchema = compiledSchema;
    return validate;
  }
  compileSchema(schema, pointer) {
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
      const types = Array.isArray(compiledSchema.type) ? compiledSchema.type : compiledSchema.type.split(",").map((t) => t.trim());
      compiledSchema.validators = types.filter((type) => this.types.has(type)).map((type) => this.types.get(type));
    }
    const validator = (schema2, data, pointer2) => {
      if (typeof data === "undefined") {
        if (pointer2 === "#") {
          return {
            valid: false,
            errors: [
              new ValidationError("Data is undefined", {
                pointer: pointer2,
                value: data,
                code: "DATA_UNDEFINED"
              })
            ],
            data
          };
        }
      }
      let finalData = data;
      const typeErrorsResult = this.validateTypes(schema2, finalData, pointer2);
      if (typeErrorsResult.valid === false) {
        return typeErrorsResult;
      }
      finalData = typeErrorsResult.data;
      return this.validateKeywords(schema2, finalData, pointer2);
    };
    compiledSchema.validator = validator;
    for (let key in schema) {
      if (key === "type") {
        continue;
      }
      if (this.keywords.has(key)) {
        const validator2 = this.keywords.get(key);
        compiledSchema.keywords = compiledSchema.keywords || {};
        compiledSchema.keywords[key] = validator2;
      }
      if (Array.isArray(schema[key])) {
        this.handleArraySchema(key, schema, pointer, compiledSchema);
        continue;
      }
      if (isObject(schema[key])) {
        this.handleObjectSchema(key, schema, pointer, compiledSchema);
        continue;
      }
    }
    return compiledSchema;
  }
  handleArraySchema(key, schema, pointer, compiledSchema) {
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
  handleObjectSchema(key, schema, pointer, compiledSchema) {
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
  validateTypes(schema, data, pointer) {
    if (typeof data === "undefined" || !Array.isArray(schema.validators) || schema.validators.length === 0) {
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
  validateKeywords(schema, data, pointer) {
    const errors = [];
    let finalData = data;
    if ("keywords" in schema) {
      for (let keyword in schema.keywords) {
        const keywordValidator = schema.keywords[keyword];
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
};
var lib_default = SchemaShield;
