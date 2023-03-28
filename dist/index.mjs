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
  item;
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
function deepClone(obj) {
  if (Array.isArray(obj)) {
    const result = [];
    for (let i = 0; i < obj.length; i++) {
      result[i] = deepClone(obj[i]);
    }
    return result;
  }
  if (isObject(obj)) {
    const result = {};
    for (const key in obj) {
      result[key] = deepClone(obj[key]);
    }
    return result;
  }
  return obj;
}
function isCompiledSchema(subSchema) {
  return isObject(subSchema) && "$validate" in subSchema;
}
function getNamedFunction(name, fn) {
  return Object.defineProperty(fn, "name", { value: name });
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
  object(data) {
    return isObject(data);
  },
  array(data) {
    if (Array.isArray(data)) {
      return true;
    }
    return typeof data === "object" && data !== null && "length" in data && "0" in data && Object.keys(data).length - 1 === data.length;
  },
  string(data) {
    return typeof data === "string";
  },
  number(data) {
    return typeof data === "number";
  },
  integer(data) {
    return typeof data === "number" && data % 1 === 0;
  },
  boolean(data) {
    return typeof data === "boolean";
  },
  null(data) {
    return data === null;
  }
};

// lib/keywords/array-keywords.ts
var ArrayKeywords = {
  items(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return data;
    }
    const schemaItems = schema.items;
    const dataLength = data.length;
    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        throw KeywordError;
      }
      return data;
    }
    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        if (typeof schemaItems[i] === "boolean") {
          if (schemaItems[i] === false && typeof data[i] !== "undefined") {
            KeywordError.message = "Array item is not allowed";
            KeywordError.item = i;
            throw KeywordError;
          }
          continue;
        }
        if (isCompiledSchema(schemaItems[i])) {
          data[i] = schemaItems[i].$validate(data[i]);
        }
      }
      return data;
    }
    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        data[i] = schemaItems.$validate(data[i]);
      }
    }
    return data;
  },
  minItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return data;
    }
    throw KeywordError;
  },
  maxItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return data;
    }
    throw KeywordError;
  },
  additionalItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return data;
    }
    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        throw KeywordError;
      }
      return data;
    }
    if (isCompiledSchema(schema.additionalItems)) {
      for (let i = schema.items.length; i < data.length; i++) {
        data[i] = schema.additionalItems.$validate(data[i]);
      }
      return data;
    }
    return data;
  },
  uniqueItems(schema, data, KeywordError) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return data;
    }
    const unique = /* @__PURE__ */ new Set();
    for (const item of data) {
      let itemStr;
      if (typeof item === "string") {
        itemStr = `s:${item}`;
      } else if (isObject(item)) {
        itemStr = `o:${JSON.stringify(
          Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
          )
        )}`;
      } else if (Array.isArray(item)) {
        itemStr = JSON.stringify(item);
      } else {
        itemStr = String(item);
      }
      if (unique.has(itemStr)) {
        throw KeywordError;
      } else {
        unique.add(itemStr);
      }
    }
    return data;
  },
  contains(schema, data, KeywordError) {
    if (!Array.isArray(data)) {
      return data;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          throw KeywordError;
        }
        return data;
      }
      throw KeywordError;
    }
    for (let i = 0; i < data.length; i++) {
      try {
        data[i] = schema.contains.$validate(data[i]);
        return data;
      } catch (error) {
        continue;
      }
    }
    throw KeywordError;
  }
};

// lib/keywords/number-keywords.ts
var NumberKeywords = {
  minimum(schema, data, KeywordError) {
    if (typeof data !== "number") {
      return data;
    }
    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }
    if (data < min) {
      throw KeywordError;
    }
    return data;
  },
  maximum(schema, data, KeywordError) {
    if (typeof data !== "number") {
      return data;
    }
    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }
    if (data > max) {
      throw KeywordError;
    }
    return data;
  },
  multipleOf(schema, data, KeywordError) {
    if (typeof data !== "number") {
      return data;
    }
    const quotient = data / schema.multipleOf;
    if (!isFinite(quotient)) {
      return data;
    }
    if (!areCloseEnough(quotient, Math.round(quotient))) {
      throw KeywordError;
    }
    return data;
  },
  exclusiveMinimum(schema, data, KeywordError) {
    if (typeof data !== "number" || typeof schema.exclusiveMinimum !== "number" || "minimum" in schema) {
      return data;
    }
    if (data <= schema.exclusiveMinimum + 1e-15) {
      throw KeywordError;
    }
    return data;
  },
  exclusiveMaximum(schema, data, KeywordError) {
    if (typeof data !== "number" || typeof schema.exclusiveMaximum !== "number" || "maximum" in schema) {
      return data;
    }
    if (data >= schema.exclusiveMaximum - 1e-15) {
      throw KeywordError;
    }
    return data;
  }
};

// lib/keywords/object-keywords.ts
var ObjectKeywords = {
  // Object
  required(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        KeywordError.item = key;
        throw KeywordError;
      }
    }
    return data;
  },
  properties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      if (typeof data[key] === "undefined") {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && "default" in schemaProp) {
          data[key] = schemaProp.default;
        }
        continue;
      }
      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          KeywordError.item = key;
          throw KeywordError;
        }
        continue;
      }
      if ("$validate" in schema.properties[key]) {
        data[key] = schema.properties[key].$validate(data[key]);
      }
    }
    return data;
  },
  maxProperties(schema, data, KeywordError) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return data;
    }
    throw KeywordError;
  },
  minProperties(schema, data, KeywordError) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return data;
    }
    throw KeywordError;
  },
  additionalProperties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    const keys = Object.keys(data);
    const isCompiled = isCompiledSchema(schema.additionalProperties);
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
        KeywordError.item = key;
        throw KeywordError;
      }
      if (isCompiled) {
        data[key] = schema.additionalProperties.$validate(data[key]);
      }
    }
    return data;
  },
  patternProperties(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in data) {
            if (regex.test(key)) {
              KeywordError.item = key;
              throw KeywordError;
            }
          }
        }
        continue;
      }
      const keys = Object.keys(data);
      for (const key of keys) {
        if (regex.test(key)) {
          if ("$validate" in schema.patternProperties[pattern]) {
            data[key] = schema.patternProperties[pattern].$validate(data[key]);
          }
        }
      }
    }
    return data;
  },
  propertyNames(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        throw KeywordError;
      }
    }
    if (isCompiledSchema(schema.propertyNames)) {
      for (let key in data) {
        schema.propertyNames.$validate(key);
      }
    }
    return data;
  },
  // Required by other keywords but not used as a function itself
  then: false,
  else: false,
  default: false,
  // Not implemented yet
  $ref: false,
  definitions: false,
  $id: false,
  $schema: false,
  title: false,
  $comment: false,
  contentMediaType: false,
  contentEncoding: false
};

// lib/keywords/other-keywords.ts
var OtherKeywords = {
  nullable(schema, data, KeywordError) {
    if (schema.nullable && data !== null) {
      throw KeywordError;
    }
    return data;
  },
  allOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          data = schema.allOf[i].$validate(data);
        }
        continue;
      }
      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          throw KeywordError;
        }
        continue;
      }
      if (data !== schema.allOf[i]) {
        throw KeywordError;
      }
    }
    return data;
  },
  anyOf(schema, data, KeywordError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        try {
          if ("$validate" in schema.anyOf[i]) {
            data = schema.anyOf[i].$validate(data);
          }
          return data;
        } catch (error) {
          continue;
        }
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return data;
          }
        }
        if (data === schema.anyOf[i]) {
          return data;
        }
      }
    }
    throw KeywordError;
  },
  oneOf(schema, data, KeywordError) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        if ("$validate" in schema.oneOf[i] === false) {
          validCount++;
          continue;
        }
        try {
          data = schema.oneOf[i].$validate(data);
          validCount++;
        } catch (error) {
          continue;
        }
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
      return data;
    }
    throw KeywordError;
  },
  dependencies(schema, data, KeywordError) {
    if (!isObject(data)) {
      return data;
    }
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }
      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            KeywordError.item = i;
            throw KeywordError;
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        throw KeywordError;
      }
      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        throw KeywordError;
      }
      data = dependency.$validate(data);
    }
    return data;
  },
  const(schema, data, KeywordError) {
    if (data === schema.const || isObject(data) && isObject(schema.const) && deepEqual(data, schema.const) || Array.isArray(data) && Array.isArray(schema.const) && deepEqual(data, schema.const)) {
      return data;
    }
    throw KeywordError;
  },
  if(schema, data, KeywordError) {
    if ("then" in schema === false && "else" in schema === false) {
      return data;
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then) {
          return schema.then.$validate(data);
        }
      } else if (schema.else) {
        return schema.else.$validate(data);
      }
      return data;
    }
    try {
      data = schema.if.$validate(data);
      if (schema.then) {
        try {
          return schema.then.$validate(data);
        } catch (error) {
          KeywordError.message = `Value must match then schema if it matches if schema`;
          throw KeywordError;
        }
      }
    } catch (error) {
      if (error instanceof ValidationError === false || error.message === "Value must match then schema if it matches if schema") {
        throw error;
      }
      if (schema.else) {
        try {
          return schema.else.$validate(data);
        } catch (error2) {
          KeywordError.message = `Value must match else schema if it does not match if schema`;
          throw KeywordError;
        }
      }
    }
    return data;
  },
  not(schema, data, KeywordError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        throw KeywordError;
      }
      return data;
    }
    try {
      data = schema.not.$validate(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        return data;
      }
    }
    throw KeywordError;
  }
};

// lib/keywords/string-keywords.ts
var StringKeywords = {
  minLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return data;
    }
    throw KeywordError;
  },
  maxLength(schema, data, KeywordError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return data;
    }
    throw KeywordError;
  },
  pattern(schema, data, KeywordError) {
    if (typeof data !== "string") {
      return data;
    }
    const patternRegexp = new RegExp(schema.pattern, "u");
    if (patternRegexp instanceof RegExp === false) {
      throw KeywordError;
    }
    if (patternRegexp.test(data)) {
      return data;
    }
    throw KeywordError;
  },
  format(schema, data, KeywordError, formatInstance) {
    if (typeof data !== "string") {
      return data;
    }
    const formatValidate = formatInstance.formats.get(schema.format);
    if (formatValidate === false) {
      return data;
    }
    if (typeof formatValidate === "function") {
      if (formatValidate(data)) {
        return data;
      }
      throw KeywordError;
    }
    throw KeywordError;
  },
  enum(schema, data, KeywordError) {
    const isArray = Array.isArray(data);
    const isObject2 = typeof data === "object" && data !== null;
    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];
      if (enumItem === data) {
        return data;
      }
      if (isArray && Array.isArray(enumItem) || isObject2 && typeof enumItem === "object" && enumItem !== null) {
        if (deepEqual(enumItem, data)) {
          return data;
        }
      }
    }
    throw KeywordError;
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
  immutable = false;
  constructor({
    immutable = false
  } = {}) {
    this.immutable = immutable;
    for (const [type, validator] of Object.entries(Types)) {
      this.addType(type, validator);
    }
    for (const [keyword, validator] of Object.entries(keywords)) {
      this.addKeyword(keyword, validator);
    }
    for (const [format, validator] of Object.entries(Formats)) {
      if (validator) {
        this.addFormat(format, validator);
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
    if (!compiledSchema.$validate) {
      if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema", "#");
      }
      compiledSchema.$validate = getNamedFunction(
        "any",
        (data) => data
      );
    }
    const validate = (data) => {
      if (this.immutable) {
        data = deepClone(data);
      }
      return compiledSchema.$validate(data);
    };
    validate.compiledSchema = compiledSchema;
    return validate;
  }
  compileSchema(schema, pointer) {
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
    const compiledSchema = {};
    if ("type" in schema) {
      const types = Array.isArray(schema.type) ? schema.type : schema.type.split(",").map((t) => t.trim());
      const typeValidations = [];
      let name = "";
      for (const type of types) {
        const validator = this.types.get(type);
        if (validator) {
          typeValidations.push(validator);
          name += (name ? "_OR_" : "") + validator.name;
        }
      }
      const TypeError2 = new ValidationError(`Invalid type`, pointer);
      if (typeValidations.length === 0) {
        throw TypeError2;
      }
      if (typeValidations.length === 1) {
        const typeValidation = typeValidations[0];
        compiledSchema.$validate = getNamedFunction(
          name,
          (data) => {
            if (typeValidation(data)) {
              return data;
            }
            throw TypeError2;
          }
        );
      } else {
        compiledSchema.$validate = getNamedFunction(
          name,
          (data) => {
            for (const validator of typeValidations) {
              if (validator(data)) {
                return data;
              }
            }
            throw TypeError2;
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
          const name = `${prevValidator.name}_AND_${keywordValidator.name}`;
          compiledSchema.$validate = getNamedFunction(
            name,
            (data) => {
              data = prevValidator(data);
              return keywordValidator(
                compiledSchema,
                data,
                KeywordError,
                this
              );
            }
          );
        } else {
          compiledSchema.$validate = getNamedFunction(
            keywordValidator.name,
            (data) => {
              return keywordValidator(
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
        compiledSchema[key] = schema[key].map(
          (subSchema, index) => this.isSchemaLike(subSchema) ? this.compileSchema(subSchema, `${pointer}/${key}/${index}`) : subSchema
        );
        continue;
      }
      compiledSchema[key] = schema[key];
    }
    return compiledSchema;
  }
  isSchemaLike(subSchema) {
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
};
export {
  SchemaShield
};
