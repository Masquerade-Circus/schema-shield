var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/is-my-ip-valid/index.js
var require_is_my_ip_valid = __commonJS({
  "node_modules/is-my-ip-valid/index.js"(exports, module) {
    var reIpv4FirstPass = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    var reSubnetString = /\/\d{1,3}(?=%|$)/;
    var reForwardSlash = /\//;
    var reZone = /%.*$/;
    var reBadCharacters = /([^0-9a-f:/%])/i;
    var reBadAddress = /([0-9a-f]{5,}|:{3,}|[^:]:$|^:[^:]|\/$)/i;
    function validate4(input) {
      if (!reIpv4FirstPass.test(input))
        return false;
      var parts = input.split(".");
      if (parts.length !== 4)
        return false;
      if (parts[0][0] === "0" && parts[0].length > 1)
        return false;
      if (parts[1][0] === "0" && parts[1].length > 1)
        return false;
      if (parts[2][0] === "0" && parts[2].length > 1)
        return false;
      if (parts[3][0] === "0" && parts[3].length > 1)
        return false;
      var n0 = Number(parts[0]);
      var n1 = Number(parts[1]);
      var n2 = Number(parts[2]);
      var n3 = Number(parts[3]);
      return n0 >= 0 && n0 < 256 && n1 >= 0 && n1 < 256 && n2 >= 0 && n2 < 256 && n3 >= 0 && n3 < 256;
    }
    function validate6(input) {
      var withoutSubnet = input.replace(reSubnetString, "");
      var hasSubnet = input.length !== withoutSubnet.length;
      if (hasSubnet)
        return false;
      if (!hasSubnet) {
        if (reForwardSlash.test(input))
          return false;
      }
      var withoutZone = withoutSubnet.replace(reZone, "");
      var lastPartSeparator = withoutZone.lastIndexOf(":");
      if (lastPartSeparator === -1)
        return false;
      var lastPart = withoutZone.substring(lastPartSeparator + 1);
      var hasV4Part = validate4(lastPart);
      var address = hasV4Part ? withoutZone.substring(0, lastPartSeparator + 1) + "1234:5678" : withoutZone;
      if (reBadCharacters.test(address))
        return false;
      if (reBadAddress.test(address))
        return false;
      var halves = address.split("::");
      if (halves.length > 2)
        return false;
      if (halves.length === 2) {
        var first = halves[0] === "" ? [] : halves[0].split(":");
        var last = halves[1] === "" ? [] : halves[1].split(":");
        var remainingLength = 8 - (first.length + last.length);
        if (remainingLength <= 0)
          return false;
      } else {
        if (address.split(":").length !== 8)
          return false;
      }
      return true;
    }
    function validate(input) {
      return validate4(input) || validate6(input);
    }
    module.exports = function validator(options) {
      if (!options)
        options = {};
      if (options.version === 4)
        return validate4;
      if (options.version === 6)
        return validate6;
      if (options.version == null)
        return validate;
      throw new Error("Unknown version: " + options.version);
    };
    module.exports["__all_regexes__"] = [
      reIpv4FirstPass,
      reSubnetString,
      reForwardSlash,
      reZone,
      reBadCharacters,
      reBadAddress
    ];
  }
});

// lib/utils.ts
var ValidationError = class extends Error {
  name;
  pointer;
  message;
  value;
  code;
  constructor(message, pointer) {
    super(message);
    this.pointer = pointer;
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
function areCloseEnough(a, b, epsilon = 1e-15) {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}

// lib/formats.ts
var import_is_my_ip_valid = __toESM(require_is_my_ip_valid());
var RegExps = {
  "date-time": /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  time: /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  hostname: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*[a-zA-Z0-9]$/,
  date: /^(\d{4})-(\d{2})-(\d{2})$/,
  "json-pointer": /^\/(?:[^~]|~0|~1)*$/,
  "relative-json-pointer": /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/
};
var Formats = {
  ["date-time"](data) {
    const upperCaseData = data.toUpperCase();
    if (!RegExps["date-time"].test(upperCaseData)) {
      return false;
    }
    const date = new Date(upperCaseData);
    return !isNaN(date.getTime());
  },
  uri(data) {
    return RegExps.uri.test(data);
  },
  email(data) {
    if (!RegExps.email.test(data)) {
      return false;
    }
    const [local, domain] = data.split("@");
    if (local.length > 64 || local.indexOf("..") !== -1 || local[0] === "." || local[local.length - 1] === ".") {
      return false;
    }
    if (domain.length > 255 || domain.indexOf("..") !== -1 || domain[0] === "." || domain[domain.length - 1] === ".") {
      return false;
    }
    return true;
  },
  ipv4: (0, import_is_my_ip_valid.default)({ version: 4 }),
  ipv6: (0, import_is_my_ip_valid.default)({ version: 6 }),
  hostname(data) {
    return RegExps.hostname.test(data);
  },
  date(data) {
    if (typeof data !== "string") {
      return false;
    }
    if (RegExps.date.test(data) === false) {
      return false;
    }
    return !isNaN(new Date(data).getTime());
  },
  regex(data) {
    try {
      new RegExp(data);
      return true;
    } catch (e) {
      return false;
    }
  },
  "json-pointer"(data) {
    if (data === "") {
      return true;
    }
    return RegExps["json-pointer"].test(data);
  },
  "relative-json-pointer"(data) {
    if (data === "") {
      return true;
    }
    return RegExps["relative-json-pointer"].test(data);
  },
  time(data) {
    return RegExps.time.test(data);
  },
  // Not supported yet
  duration: false,
  "idn-email": false,
  "idn-hostname": false,
  uuid: false,
  "uri-reference": false,
  iri: false,
  "iri-reference": false,
  "uri-template": false
};

// lib/types.ts
var Types = {
  object(schema, data, pointer) {
    if (isObject(data)) {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not an object", pointer),
      data
    };
  },
  array(schema, data, pointer) {
    if (Array.isArray(data)) {
      return {
        valid: true,
        error: null,
        data
      };
    }
    if (typeof data === "object" && data !== null && "length" in data) {
      const keys = Object.keys(data);
      if (keys.length > 0 && (keys[0] !== "0" || keys.length !== data.length)) {
        return {
          valid: false,
          error: new ValidationError("Data is not an array", pointer),
          data
        };
      }
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not an array", pointer),
      data
    };
  },
  string(schema, data, pointer) {
    if (typeof data === "string") {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not a string", pointer),
      data
    };
  },
  number(schema, data, pointer) {
    if (typeof data === "number") {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not a number", pointer),
      data
    };
  },
  integer(schema, data, pointer) {
    if (typeof data === "number" && Number.isInteger(data)) {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not an integer", pointer),
      data
    };
  },
  boolean(schema, data, pointer) {
    if (typeof data === "boolean") {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not a boolean", pointer),
      data
    };
  },
  null(schema, data, pointer) {
    if (data === null) {
      return {
        valid: true,
        error: null,
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError("Data is not null", pointer),
      data
    };
  }
};

// lib/keywords/array-keywords.ts
var ArrayKeywords = {
  items(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, error: null, data };
    }
    const schemaItems = schema.items;
    const dataLength = data.length;
    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        return {
          valid: false,
          error: new ValidationError("Array is not allowed", pointer),
          data
        };
      }
      return { valid: true, error: null, data };
    }
    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const finalData = [...data];
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === "boolean") {
          if (schemaItems[i] === false && typeof finalData[i] !== "undefined") {
            return {
              valid: false,
              error: new ValidationError("Array item is not allowed", `${pointer}/${i}`),
              data: finalData
            };
          }
          continue;
        }
        const validatorResult = schemaShieldInstance.validate(schemaItems[i], finalData[i]);
        finalData[i] = validatorResult.data;
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }
      return { valid: true, error: null, data: finalData };
    }
    if (schemaShieldInstance.isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const validatorErrors = schemaShieldInstance.validate(schemaItems, data[i]);
        data[i] = validatorErrors.data;
        if (!validatorErrors.valid) {
          return { valid: false, error: validatorErrors.error, data };
        }
      }
    }
    return { valid: true, error: null, data };
  },
  minItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("Array is too short", pointer),
      data
    };
  },
  maxItems(schema, data, pointer) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("Array is too long", pointer),
      data
    };
  },
  additionalItems(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return { valid: true, error: null, data };
    }
    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return {
          valid: false,
          error: new ValidationError("Array has too many items", pointer),
          data
        };
      }
      return { valid: true, error: null, data };
    }
    if (schemaShieldInstance.isCompiledSchema(schema.additionalItems)) {
      const finalData = [...data];
      for (let i = schema.items.length; i < finalData.length; i++) {
        const validatorResult = schemaShieldInstance.validate(schema.additionalItems, finalData[i]);
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
        finalData[i] = validatorResult.data;
      }
      return { valid: true, error: null, data: finalData };
    }
    return { valid: true, error: null, data };
  },
  uniqueItems(schema, data, pointer) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return { valid: true, error: null, data };
    }
    const unique = /* @__PURE__ */ new Set();
    for (const item of data) {
      let itemStr;
      if (typeof item === "string") {
        itemStr = `s:${item}`;
      } else if (isObject(item)) {
        itemStr = `o:${JSON.stringify(Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))))}`;
      } else {
        itemStr = JSON.stringify(item);
      }
      if (unique.has(itemStr)) {
        return {
          valid: false,
          error: new ValidationError("Array items are not unique", pointer),
          data
        };
      } else {
        unique.add(itemStr);
      }
    }
    return { valid: true, error: null, data };
  }
};

// lib/keywords/number-keywords.ts
var NumberKeywords = {
  minimum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== "number") {
      return { valid: true, error: null, data };
    }
    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }
    const valid = data >= min;
    return {
      valid,
      error: valid ? null : new ValidationError("Number is too small", pointer),
      data
    };
  },
  maximum(schema, data, pointer, schemaShieldInstance) {
    if (typeof data !== "number") {
      return { valid: true, error: null, data };
    }
    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }
    const valid = data <= max;
    return {
      valid,
      error: valid ? null : new ValidationError("Number is too big", pointer),
      data
    };
  },
  multipleOf(schema, data, pointer) {
    if (typeof data !== "number") {
      return { valid: true, error: null, data };
    }
    const quotient = data / schema.multipleOf;
    if (!isFinite(quotient)) {
      return { valid: true, error: null, data };
    }
    const areMultiples = areCloseEnough(quotient, Math.round(quotient));
    return {
      valid: areMultiples,
      error: areMultiples ? null : new ValidationError("Number is not a multiple of", pointer),
      data
    };
  },
  exclusiveMinimum(schema, data, pointer) {
    if (typeof data !== "number" || typeof schema.exclusiveMinimum !== "number" || "minimum" in schema) {
      return { valid: true, error: null, data };
    }
    const valid = data > schema.exclusiveMinimum + 1e-15;
    return {
      valid,
      error: valid ? null : new ValidationError("Number is too small", pointer),
      data
    };
  },
  exclusiveMaximum(schema, data, pointer) {
    if (typeof data !== "number" || typeof schema.exclusiveMaximum !== "number" || "maximum" in schema) {
      return { valid: true, error: null, data };
    }
    const valid = data < schema.exclusiveMaximum - 1e-15;
    return {
      valid,
      error: valid ? null : new ValidationError("Number is too big", pointer),
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
        error: null,
        data
      };
    }
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        return {
          valid: false,
          error: new ValidationError("Property is required", `${pointer}/${key}`),
          data
        };
      }
    }
    return { valid: true, error: null, data };
  },
  properties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }
    let finalData = { ...data };
    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      const prop = data[key];
      if (typeof prop === "undefined") {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && "default" in schemaProp) {
          finalData[key] = schemaProp.default;
        }
        continue;
      }
      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          return {
            valid: false,
            error: new ValidationError("Property is not allowed", `${pointer}/${key}`),
            data
          };
        }
        continue;
      }
      const validatorResult = schemaShieldInstance.validate(schema.properties[key], prop);
      finalData[key] = validatorResult.data;
      if (!validatorResult.valid) {
        return { valid: false, error: validatorResult.error, data: finalData };
      }
    }
    return { valid: true, error: null, data: finalData };
  },
  maxProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("Object has too many properties", pointer),
      data
    };
  },
  minProperties(schema, data, pointer) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("Object has too few properties", pointer),
      data
    };
  },
  additionalProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }
    let finalData = { ...data };
    const keys = Object.keys(data);
    const isCompiledSchema = schemaShieldInstance.isCompiledSchema(schema.additionalProperties);
    for (const key of keys) {
      if (schema.properties && schema.properties.hasOwnProperty(key)) {
        continue;
      }
      if (schema.patternProperties) {
        let match = false;
        for (const pattern in schema.patternProperties) {
          if (new RegExp(pattern, "u").test(key)) {
            match = true;
            break;
          }
        }
        if (match) {
          continue;
        }
      }
      if (schema.additionalProperties === false) {
        return {
          valid: false,
          error: new ValidationError("Property is not allowed", `${pointer}/${key}`),
          data
        };
        continue;
      }
      if (isCompiledSchema) {
        const validatorResult = schemaShieldInstance.validate(schema.additionalProperties, finalData[key]);
        finalData[key] = validatorResult.data;
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }
    }
    return { valid: true, error: null, data: finalData };
  },
  patternProperties(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }
    let finalData = { ...data };
    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in finalData) {
            if (regex.test(key)) {
              return {
                valid: false,
                error: new ValidationError("Property is not allowed", `${pointer}/${key}`),
                data: finalData
              };
            }
          }
        }
        continue;
      }
      const keys = Object.keys(finalData);
      for (const key of keys) {
        if (regex.test(key)) {
          const validatorResult = schemaShieldInstance.validate(schema.patternProperties[pattern], finalData[key]);
          finalData[key] = validatorResult.data;
          if (!validatorResult.valid) {
            return { valid: false, error: validatorResult.error, data: finalData };
          }
        }
      }
    }
    return { valid: true, error: null, data: finalData };
  },
  propertyNames(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        return {
          valid: false,
          error: new ValidationError("Property names are not allowed", pointer),
          data
        };
      }
    }
    let finalData = { ...data };
    if (schemaShieldInstance.isCompiledSchema(schema.propertyNames)) {
      for (let key in finalData) {
        const validatorResult = schemaShieldInstance.validate(schema.propertyNames, key);
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
      }
    }
    return { valid: true, error: null, data: finalData };
  }
};

// lib/keywords/other-keywords.ts
var OtherKeywords = {
  nullable(schema, data, pointer) {
    if (schema.nullable && data !== null) {
      return {
        valid: false,
        error: new ValidationError("Value must be null to be empty", pointer),
        data
      };
    }
    return { valid: true, error: null, data };
  },
  allOf(schema, data, pointer, schemaShieldInstance) {
    let finalData = data;
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        const validatorResult = schemaShieldInstance.validate(schema.allOf[i], finalData);
        if (!validatorResult.valid) {
          return { valid: false, error: validatorResult.error, data: finalData };
        }
        finalData = validatorResult.data;
      } else {
        if (typeof schema.allOf[i] === "boolean") {
          if (Boolean(data) !== schema.allOf[i]) {
            return {
              valid: false,
              error: new ValidationError(`Value must match all schemas in allOf`, pointer),
              data: finalData
            };
          }
          continue;
        }
        if (data !== schema.allOf[i]) {
          return {
            valid: false,
            error: new ValidationError(`Value must match all schemas in allOf`, pointer),
            data: finalData
          };
        }
      }
    }
    return { valid: true, error: null, data: finalData };
  },
  anyOf(schema, data, pointer, schemaShieldInstance) {
    let finalData = data;
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        const validationResult = schemaShieldInstance.validate(schema.anyOf[i], finalData);
        finalData = validationResult.data;
        if (validationResult.valid) {
          return { valid: true, error: null, data: finalData };
        }
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return { valid: true, error: null, data: finalData };
          }
        }
        if (data === schema.anyOf[i]) {
          return { valid: true, error: null, data: finalData };
        }
      }
    }
    return {
      valid: false,
      error: new ValidationError(`Value must match at least one schema in anyOf`, pointer),
      data
    };
  },
  oneOf(schema, data, pointer, schemaShieldInstance) {
    let validCount = 0;
    let finalData = data;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        const validationResult = schemaShieldInstance.validate(schema.oneOf[i], finalData);
        if (validationResult.valid) {
          validCount++;
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
      return { valid: true, error: null, data: finalData };
    }
    return {
      valid: false,
      error: new ValidationError(`Value must match exactly one schema in oneOf`, pointer),
      data: finalData
    };
  },
  dependencies(schema, data, pointer, schemaShieldInstance) {
    if (!isObject(data)) {
      return { valid: true, error: null, data };
    }
    let finalData = data;
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }
      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            return {
              valid: false,
              error: new ValidationError(`Dependency ${dependency[i]} is missing`, pointer),
              data: finalData
            };
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return {
          valid: false,
          error: new ValidationError(`Dependency ${key} is missing`, pointer),
          data: finalData
        };
      }
      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return {
          valid: false,
          error: new ValidationError(`Dependency ${dependency} is missing`, pointer),
          data: finalData
        };
      }
      const validatorResult = schemaShieldInstance.validate(dependency, finalData);
      if (!validatorResult.valid) {
        return { valid: false, error: validatorResult.error, data: finalData };
      }
      finalData = validatorResult.data;
    }
    return { valid: true, error: null, data: finalData };
  },
  const(schema, data, pointer) {
    if (data === schema.const || isObject(data) && isObject(schema.const) && deepEqual(data, schema.const) || Array.isArray(data) && Array.isArray(schema.const) && deepEqual(data, schema.const)) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError(`Value must be equal to const`, pointer),
      data
    };
  },
  contains(schema, data, pointer, schemaShieldInstance) {
    if (!Array.isArray(data)) {
      return { valid: true, error: null, data };
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        const valid = data.length > 0;
        return {
          valid,
          error: valid ? null : new ValidationError(`Value must contain at least one item`, pointer),
          data
        };
      }
      return {
        valid: false,
        error: new ValidationError(`Value must not contain any items`, pointer),
        data
      };
    }
    for (let i = 0; i < data.length; i++) {
      const validatorResult = schemaShieldInstance.validate(schema.contains, data[i]);
      if (validatorResult.valid) {
        return { valid: true, error: null, data };
      }
    }
    return {
      valid: false,
      error: new ValidationError(`Value must contain at least one item that matches the contains schema`, pointer),
      data
    };
  },
  if(schema, data, pointer, schemaShieldInstance) {
    if ("then" in schema === false && "else" in schema === false) {
      return { valid: true, error: null, data };
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          const thenResult = schemaShieldInstance.validate(schema.then, data);
          if (!thenResult.valid) {
            return thenResult;
          }
        }
      } else if (schema.else) {
        const elseResult = schemaShieldInstance.validate(schema.else, data);
        if (!elseResult.valid) {
          return elseResult;
        }
      }
      return { valid: true, error: null, data };
    }
    const ifResult = schemaShieldInstance.validate(schema.if, data);
    if (ifResult.valid) {
      if (schema.then) {
        const thenResult = schemaShieldInstance.validate(schema.then, data);
        if (!thenResult.valid) {
          return thenResult;
        }
      }
    } else if (schema.else) {
      const elseResult = schemaShieldInstance.validate(schema.else, data);
      if (!elseResult.valid) {
        return elseResult;
      }
    }
    return { valid: true, error: null, data };
  },
  not(schema, data, pointer, schemaShieldInstance) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return {
          valid: false,
          error: new ValidationError(`Value must not be valid`, pointer),
          data
        };
      }
      return { valid: true, error: null, data };
    }
    const validatorResult = schemaShieldInstance.validate(schema.not, data);
    if (validatorResult.valid) {
      return {
        valid: false,
        error: new ValidationError(`Value must not be valid`, pointer),
        data
      };
    }
    return { valid: true, error: null, data };
  }
};

// lib/keywords/string-keywords.ts
var StringKeywords = {
  minLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("String is too short", pointer),
      data
    };
  },
  maxLength(schema, data, pointer) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return { valid: true, error: null, data };
    }
    return {
      valid: false,
      error: new ValidationError("String is too long", pointer),
      data
    };
  },
  pattern(schema, data, pointer) {
    if (typeof data !== "string") {
      return { valid: true, error: null, data };
    }
    const patternRegexp = new RegExp(schema.pattern, "u");
    if (patternRegexp instanceof RegExp === false) {
      return {
        valid: false,
        error: new ValidationError("Pattern is not a valid regular expression", pointer),
        data
      };
    }
    const valid = patternRegexp.test(data);
    return {
      valid,
      error: valid ? null : new ValidationError("String does not match pattern", pointer),
      data
    };
  },
  format(schema, data, pointer, formatInstance) {
    if (typeof data !== "string") {
      return { valid: true, error: null, data };
    }
    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return { valid: true, error: null, data };
    }
    if (typeof formatValidate === "function") {
      const valid = formatValidate(data);
      return {
        valid,
        error: valid ? null : new ValidationError(`String does not match format ${schema.format}`, pointer),
        data
      };
    }
    return {
      valid: false,
      error: new ValidationError(`Unknown format ${schema.format}`, pointer),
      data
    };
  },
  enum(schema, data, pointer) {
    const isArray = Array.isArray(data);
    const isObject2 = typeof data === "object" && data !== null;
    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];
      if (enumItem === data) {
        return { valid: true, error: null, data };
      }
      if (isArray && Array.isArray(enumItem) || isObject2 && typeof enumItem === "object" && enumItem !== null) {
        if (deepEqual(enumItem, data)) {
          return { valid: true, error: null, data };
        }
      }
    }
    return {
      valid: false,
      error: new ValidationError(`Value must be one of ${schema.enum.join(", ")}`, pointer),
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
    for (const type of Object.keys(Types)) {
      this.addType(type, Types[type]);
    }
    for (const keyword of Object.keys(keywords)) {
      this.addKeyword(keyword, keywords[keyword]);
    }
    for (const format of Object.keys(Formats)) {
      if (Formats[format]) {
        this.addFormat(format, Formats[format]);
      }
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
    const validate = (data) => this.validate(compiledSchema, data);
    validate.compiledSchema = compiledSchema;
    return validate;
  }
  compileSchema(schema, pointer) {
    if (!isObject(schema)) {
      if (schema === true) {
        schema = {
          anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "array" }, { type: "object" }, { type: "null" }]
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
    const compiledSchema = {};
    if ("type" in schema) {
      const types = Array.isArray(schema.type) ? schema.type : schema.type.split(",").map((t) => t.trim());
      compiledSchema.types = types.map((type) => this.types.get(type)).filter((validator) => Boolean(validator));
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
      if (this.isSchemaLike(schema[key])) {
        compiledSchema[key] = this.compileSchema(schema[key], `${pointer}/${key}`);
        continue;
      }
      if (Array.isArray(schema[key])) {
        compiledSchema[key] = schema[key].map(
          (subSchema, index) => this.isSchemaLike(subSchema) ? this.compileSchema(subSchema, `${pointer}/${key}/${index}`) : subSchema
        );
        continue;
      }
      if (isObject(schema[key])) {
        compiledSchema[key] = this.compileSchema(schema[key], `${pointer}/${key}`);
        continue;
      }
      compiledSchema[key] = schema[key];
    }
    return compiledSchema;
  }
  validate(schema, data) {
    if (schema.types) {
      let typeValid = false;
      for (let type of schema.types) {
        const result = type(schema, data, schema.pointer, this);
        if (result.valid) {
          typeValid = true;
          break;
        }
      }
      if (!typeValid) {
        return {
          valid: false,
          error: new ValidationError(`Invalid type`, schema.pointer),
          data
        };
      }
    }
    if (schema.validators) {
      for (let validator of schema.validators) {
        const result = validator(schema, data, schema.pointer, this);
        if (!result.valid) {
          return result;
        }
      }
    }
    return {
      valid: true,
      error: null,
      data
    };
  }
  isSchemaOrKeywordPresent(subSchema) {
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
  isSchemaLike(subSchema) {
    return isObject(subSchema) && this.isSchemaOrKeywordPresent(subSchema);
  }
  isCompiledSchema(subSchema) {
    return isObject(subSchema) && ("validators" in subSchema || "types" in subSchema);
  }
};
export {
  SchemaShield
};
