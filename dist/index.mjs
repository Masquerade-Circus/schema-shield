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
  message;
  item;
  keyword;
  cause;
  path = "";
  data;
  schema;
  _getCause(pointer = "#") {
    const path = pointer + "/" + this.keyword + (typeof this.item !== "undefined" ? "/" + this.item : "");
    if (!this.cause) {
      this.path = path;
      return this;
    }
    return this.cause._getCause(path);
  }
  getCause() {
    return this._getCause();
  }
};
function getDefinedErrorFunctionForKey(key, schema) {
  const KeywordError = new ValidationError(`Invalid ${key}`);
  KeywordError.keyword = key;
  KeywordError.schema = schema;
  const defineError = (message, options = {}) => {
    KeywordError.message = message;
    KeywordError.item = options.item;
    KeywordError.cause = options.cause;
    KeywordError.data = options.data;
    return KeywordError;
  };
  return getNamedFunction(
    `defineError_${key}`,
    defineError
  );
}
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
  if (obj && obj.constructor && obj.constructor.name !== "Object") {
    return obj;
  }
  if (isObject(obj)) {
    const result = {
      ...obj
    };
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
  time: /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  hostname: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*[a-zA-Z0-9]$/,
  date: /^(\d{4})-(\d{2})-(\d{2})$/,
  "json-pointer": /^\/(?:[^~]|~0|~1)*$/,
  "relative-json-pointer": /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/
};
var daysInMonth = [31, , 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var Formats = {
  ["date-time"](data) {
    const match = data.match(
      /^(\d{4})-(0[0-9]|1[0-2])-(\d{2})T(0[0-9]|1\d|2[0-3]):([0-5]\d):((?:[0-5]\d|60))(?:.\d+)?(?:([+-])(0[0-9]|1\d|2[0-3]):([0-5]\d)|Z)?$/i
    );
    if (!match) {
      return false;
    }
    let day = Number(match[3]);
    if (match[2] === "02" && day > 29) {
      return false;
    }
    const [
      ,
      yearStr,
      monthStr,
      ,
      hourStr,
      minuteStr,
      secondStr,
      timezoneSign,
      timezoneHourStr,
      timezoneMinuteStr
    ] = match;
    let year = Number(yearStr);
    let month = Number(monthStr);
    let hour = Number(hourStr);
    let minute = Number(minuteStr);
    let second = Number(secondStr);
    if (timezoneSign === "-" || timezoneSign === "+") {
      const timezoneHour = Number(timezoneHourStr);
      const timezoneMinute = Number(timezoneMinuteStr);
      if (timezoneSign === "-") {
        hour += timezoneHour;
        minute += timezoneMinute;
      } else if (timezoneSign === "+") {
        hour -= timezoneHour;
        minute -= timezoneMinute;
      }
      if (minute > 59) {
        hour += 1;
        minute -= 60;
      } else if (minute < 0) {
        hour -= 1;
        minute += 60;
      }
      if (hour > 23) {
        day += 1;
        hour -= 24;
      } else if (hour < 0) {
        day -= 1;
        hour += 24;
      }
      if (day > 31) {
        month += 1;
        day -= 31;
      } else if (day < 1) {
        month -= 1;
        day += 31;
      }
      if (month > 12) {
        year += 1;
        month -= 12;
      } else if (month < 1) {
        year -= 1;
        month += 12;
      }
      if (year < 0) {
        return false;
      }
    }
    const maxDays = month === 2 ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28 : daysInMonth[month - 1];
    if (day > maxDays) {
      return false;
    }
    if (second === 60 && (minute !== 59 || hour !== 23)) {
      return false;
    }
    return true;
  },
  uri(data) {
    return RegExps.uri.test(data);
  },
  email(data) {
    return /^(?!\.)(?!.*\.$)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i.test(
      data
    );
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
  },
  // Not implemented yet
  timestamp: false,
  int8: false,
  unit8: false,
  int16: false,
  unit16: false,
  int32: false,
  unit32: false,
  float32: false,
  float64: false
};

// lib/keywords/array-keywords.ts
var ArrayKeywords = {
  items(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }
    const schemaItems = schema.items;
    const dataLength = data.length;
    if (typeof schemaItems === "boolean") {
      if (schemaItems === false && dataLength > 0) {
        return defineError("Array items are not allowed", { data });
      }
      return;
    }
    if (Array.isArray(schemaItems)) {
      const schemaItemsLength = schemaItems.length;
      const itemsLength = Math.min(schemaItemsLength, dataLength);
      for (let i = 0; i < itemsLength; i++) {
        const schemaItem = schemaItems[i];
        if (typeof schemaItem === "boolean") {
          if (schemaItem === false && typeof data[i] !== "undefined") {
            return defineError("Array item is not allowed", {
              item: i,
              data: data[i]
            });
          }
          continue;
        }
        if (isCompiledSchema(schemaItem)) {
          const error = schemaItem.$validate(data[i]);
          if (error) {
            return defineError("Array item is invalid", {
              item: i,
              cause: error,
              data: data[i]
            });
          }
        }
      }
      return;
    }
    if (isCompiledSchema(schemaItems)) {
      for (let i = 0; i < dataLength; i++) {
        const error = schemaItems.$validate(data[i]);
        if (error) {
          return defineError("Array item is invalid", {
            item: i,
            cause: error,
            data: data[i]
          });
        }
      }
    }
    return;
  },
  elements(schema, data, defineError) {
    if (!Array.isArray(data) || !isCompiledSchema(schema.elements)) {
      return;
    }
    for (let i = 0; i < data.length; i++) {
      const error = schema.elements.$validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }
    return;
  },
  minItems(schema, data, defineError) {
    if (!Array.isArray(data) || data.length >= schema.minItems) {
      return;
    }
    return defineError("Array is too short", { data });
  },
  maxItems(schema, data, defineError) {
    if (!Array.isArray(data) || data.length <= schema.maxItems) {
      return;
    }
    return defineError("Array is too long", { data });
  },
  additionalItems(schema, data, defineError) {
    if (!Array.isArray(data) || !schema.items || !Array.isArray(schema.items)) {
      return;
    }
    if (schema.additionalItems === false) {
      if (data.length > schema.items.length) {
        return defineError("Array is too long", { data });
      }
      return;
    }
    if (isObject(schema.additionalItems)) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = schema.items.length; i < data.length; i++) {
          const error = schema.additionalItems.$validate(data[i]);
          if (error) {
            return defineError("Array item is invalid", {
              item: i,
              cause: error,
              data: data[i]
            });
          }
        }
        return;
      }
      return;
    }
    return;
  },
  uniqueItems(schema, data, defineError) {
    if (!Array.isArray(data) || !schema.uniqueItems) {
      return;
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
        return defineError("Array items are not unique", { data: item });
      }
      unique.add(itemStr);
    }
    return;
  },
  contains(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }
    if (typeof schema.contains === "boolean") {
      if (schema.contains) {
        if (data.length === 0) {
          return defineError("Array must contain at least one item", { data });
        }
        return;
      }
      return defineError("Array must not contain any items", { data });
    }
    for (let i = 0; i < data.length; i++) {
      const error = schema.contains.$validate(data[i]);
      if (!error) {
        return;
      }
      continue;
    }
    return defineError("Array must contain at least one item", { data });
  }
};

// lib/keywords/number-keywords.ts
var NumberKeywords = {
  minimum(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }
    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 1e-15;
    } else if (schema.exclusiveMinimum === true) {
      min += 1e-15;
    }
    if (data < min) {
      return defineError("Value is less than the minimum", { data });
    }
    return;
  },
  maximum(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }
    let max = schema.maximum;
    if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - 1e-15;
    } else if (schema.exclusiveMaximum === true) {
      max -= 1e-15;
    }
    if (data > max) {
      return defineError("Value is greater than the maximum", { data });
    }
    return;
  },
  multipleOf(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }
    const quotient = data / schema.multipleOf;
    if (!isFinite(quotient)) {
      return;
    }
    if (!areCloseEnough(quotient, Math.round(quotient))) {
      return defineError("Value is not a multiple of the multipleOf", { data });
    }
    return;
  },
  exclusiveMinimum(schema, data, defineError, instance) {
    if (typeof data !== "number" || typeof schema.exclusiveMinimum !== "number" || "minimum" in schema) {
      return;
    }
    if (data <= schema.exclusiveMinimum + 1e-15) {
      return defineError("Value is less than or equal to the exclusiveMinimum");
    }
    return;
  },
  exclusiveMaximum(schema, data, defineError, instance) {
    if (typeof data !== "number" || typeof schema.exclusiveMaximum !== "number" || "maximum" in schema) {
      return;
    }
    if (data >= schema.exclusiveMaximum) {
      return defineError(
        "Value is greater than or equal to the exclusiveMaximum",
        { data }
      );
    }
    return;
  }
};

// lib/keywords/object-keywords.ts
var ObjectKeywords = {
  // Object
  required(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    for (let i = 0; i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!data.hasOwnProperty(key)) {
        return defineError("Required property is missing", {
          item: key,
          data: data[key]
        });
      }
    }
    return;
  },
  properties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    for (const key of Object.keys(schema.properties)) {
      if (!data.hasOwnProperty(key)) {
        const schemaProp = schema.properties[key];
        if (isObject(schemaProp) && "default" in schemaProp) {
          data[key] = schemaProp.default;
        }
        continue;
      }
      if (typeof schema.properties[key] === "boolean") {
        if (schema.properties[key] === false) {
          return defineError("Property is not allowed", {
            item: key,
            data: data[key]
          });
        }
        continue;
      }
      if ("$validate" in schema.properties[key]) {
        const error = schema.properties[key].$validate(data[key]);
        if (error) {
          return defineError("Property is invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
        }
      }
    }
    return;
  },
  values(schema, data, defineError) {
    if (!isObject(data) || !isCompiledSchema(schema.values)) {
      return;
    }
    const keys = Object.keys(data);
    for (const key of keys) {
      const error = schema.values.$validate(data[key]);
      if (error) {
        return defineError("Property is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
    return;
  },
  maxProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length <= schema.maxProperties) {
      return;
    }
    return defineError("Too many properties", { data });
  },
  minProperties(schema, data, defineError) {
    if (!isObject(data) || Object.keys(data).length >= schema.minProperties) {
      return;
    }
    return defineError("Too few properties", { data });
  },
  additionalProperties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
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
        return defineError("Additional properties are not allowed", {
          item: key,
          data: data[key]
        });
      }
      if (isCompiled) {
        const error = schema.additionalProperties.$validate(data[key]);
        if (error) {
          return defineError("Additional properties are invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
        }
      }
    }
    return;
  },
  patternProperties(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    const patterns = Object.keys(schema.patternProperties);
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "u");
      if (typeof schema.patternProperties[pattern] === "boolean") {
        if (schema.patternProperties[pattern] === false) {
          for (const key in data) {
            if (regex.test(key)) {
              return defineError("Property is not allowed", {
                item: key,
                data: data[key]
              });
            }
          }
        }
        continue;
      }
      const keys = Object.keys(data);
      for (const key of keys) {
        if (regex.test(key)) {
          if ("$validate" in schema.patternProperties[pattern]) {
            const error = schema.patternProperties[pattern].$validate(
              data[key]
            );
            if (error) {
              return defineError("Property is invalid", {
                item: key,
                cause: error,
                data: data[key]
              });
            }
          }
        }
      }
    }
    return;
  },
  propertyNames(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    if (typeof schema.propertyNames === "boolean") {
      if (schema.propertyNames === false && Object.keys(data).length > 0) {
        return defineError("Properties are not allowed", { data });
      }
    }
    if (isCompiledSchema(schema.propertyNames)) {
      for (let key in data) {
        const error = schema.propertyNames.$validate(key);
        if (error) {
          return defineError("Property name is invalid", {
            item: key,
            cause: error,
            data: data[key]
          });
        }
      }
    }
    return;
  },
  dependencies(schema, data, defineError) {
    if (!isObject(data)) {
      return;
    }
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }
      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0; i < dependency.length; i++) {
          if (!(dependency[i] in data)) {
            return defineError("Dependency is not satisfied", {
              item: i,
              data: dependency[i]
            });
          }
        }
        continue;
      }
      if (typeof dependency === "boolean") {
        if (dependency) {
          continue;
        }
        return defineError("Dependency is not satisfied", { data: dependency });
      }
      if (typeof dependency === "string") {
        if (dependency in data) {
          continue;
        }
        return defineError("Dependency is not satisfied", { data: dependency });
      }
      const error = dependency.$validate(data);
      if (error) {
        return defineError("Dependency is not satisfied", {
          cause: error,
          data
        });
      }
    }
    return;
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
  // Metadata keywords (not used as a function)
  title: false,
  description: false,
  $comment: false,
  examples: false,
  contentMediaType: false,
  contentEncoding: false,
  // Not supported Open API keywords
  discriminator: false,
  nullable: false
};

// lib/keywords/other-keywords.ts
var OtherKeywords = {
  enum(schema, data, defineError) {
    const isArray = Array.isArray(data);
    const isObject2 = typeof data === "object" && data !== null;
    for (let i = 0; i < schema.enum.length; i++) {
      const enumItem = schema.enum[i];
      if (enumItem === data) {
        return;
      }
      if (isArray && Array.isArray(enumItem) || isObject2 && typeof enumItem === "object" && enumItem !== null) {
        if (deepEqual(enumItem, data)) {
          return;
        }
      }
    }
    return defineError("Value is not one of the allowed values", { data });
  },
  allOf(schema, data, defineError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          const error = schema.allOf[i].$validate(data);
          if (error) {
            return defineError("Value is not valid", { cause: error, data });
          }
        }
        continue;
      }
      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          return defineError("Value is not valid", { data });
        }
        continue;
      }
      if (data !== schema.allOf[i]) {
        return defineError("Value is not valid", { data });
      }
    }
    return;
  },
  anyOf(schema, data, defineError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        if ("$validate" in schema.anyOf[i]) {
          const error = schema.anyOf[i].$validate(data);
          if (!error) {
            return;
          }
          continue;
        }
        return;
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return;
          }
        }
        if (data === schema.anyOf[i]) {
          return;
        }
      }
    }
    return defineError("Value is not valid", { data });
  },
  oneOf(schema, data, defineError) {
    let validCount = 0;
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (isObject(schema.oneOf[i])) {
        if ("$validate" in schema.oneOf[i]) {
          const error = schema.oneOf[i].$validate(data);
          if (!error) {
            validCount++;
          }
          continue;
        }
        validCount++;
        continue;
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
      return;
    }
    return defineError("Value is not valid", { data });
  },
  const(schema, data, defineError) {
    if (data === schema.const || isObject(data) && isObject(schema.const) && deepEqual(data, schema.const) || Array.isArray(data) && Array.isArray(schema.const) && deepEqual(data, schema.const)) {
      return;
    }
    return defineError("Value is not valid", { data });
  },
  if(schema, data, defineError) {
    if ("then" in schema === false && "else" in schema === false) {
      return;
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (isCompiledSchema(schema.then)) {
          return schema.then.$validate(data);
        }
      } else if (isCompiledSchema(schema.else)) {
        return schema.else.$validate(data);
      }
      return;
    }
    if (!isCompiledSchema(schema.if)) {
      return;
    }
    const error = schema.if.$validate(data);
    if (!error) {
      if (isCompiledSchema(schema.then)) {
        return schema.then.$validate(data);
      }
      return;
    } else {
      if (isCompiledSchema(schema.else)) {
        return schema.else.$validate(data);
      }
      return;
    }
  },
  not(schema, data, defineError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return defineError("Value is not valid", { data });
      }
      return;
    }
    if (isObject(schema.not)) {
      if ("$validate" in schema.not) {
        const error = schema.not.$validate(data);
        if (!error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        return;
      }
      return defineError("Value is not valid", { data });
    }
    return defineError("Value is not valid", { data });
  }
};

// lib/keywords/string-keywords.ts
var StringKeywords = {
  minLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length >= schema.minLength) {
      return;
    }
    return defineError("Value is shorter than the minimum length", { data });
  },
  maxLength(schema, data, defineError) {
    if (typeof data !== "string" || data.length <= schema.maxLength) {
      return;
    }
    return defineError("Value is longer than the maximum length", { data });
  },
  pattern(schema, data, defineError) {
    if (typeof data !== "string") {
      return;
    }
    const patternRegexp = new RegExp(schema.pattern, "u");
    if (patternRegexp instanceof RegExp === false) {
      return defineError("Invalid regular expression", { data });
    }
    if (patternRegexp.test(data)) {
      return;
    }
    return defineError("Value does not match the pattern", { data });
  },
  format(schema, data, defineError, instance) {
    if (typeof data !== "string") {
      return;
    }
    const formatValidate = instance.getFormat(schema.format);
    if (formatValidate === false) {
      return;
    }
    if (formatValidate) {
      if (formatValidate(data)) {
        return;
      }
      return defineError("Value does not match the format", { data });
    }
    return defineError("Format is not supported", { data });
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
  types = {};
  formats = {};
  keywords = {};
  immutable = false;
  constructor({
    immutable = false
  } = {}) {
    this.immutable = immutable;
    for (const [type, validator] of Object.entries(Types)) {
      if (validator) {
        this.addType(type, validator);
      }
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
  addType(name, validator, overwrite = false) {
    if (this.types[name] && !overwrite) {
      throw new ValidationError(`Type "${name}" already exists`);
    }
    this.types[name] = validator;
  }
  getType(type) {
    return this.types[type];
  }
  addFormat(name, validator, overwrite = false) {
    if (this.formats[name] && !overwrite) {
      throw new ValidationError(`Format "${name}" already exists`);
    }
    this.formats[name] = validator;
  }
  getFormat(format) {
    return this.formats[format];
  }
  addKeyword(name, validator, overwrite = false) {
    if (this.keywords[name] && !overwrite) {
      throw new ValidationError(`Keyword "${name}" already exists`);
    }
    this.keywords[name] = validator;
  }
  getKeyword(keyword) {
    return this.keywords[keyword];
  }
  compile(schema) {
    const compiledSchema = this.compileSchema(schema);
    if (!compiledSchema.$validate) {
      if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      }
      compiledSchema.$validate = getNamedFunction(
        "any",
        () => {
        }
      );
    }
    const validate = (data) => {
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
  compileSchema(schema) {
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
    const compiledSchema = { ...schema };
    const defineTypeError = getDefinedErrorFunctionForKey("type", schema);
    const typeValidations = [];
    let methodName = "";
    if ("type" in schema) {
      const types = Array.isArray(schema.type) ? schema.type : schema.type.split(",").map((t) => t.trim());
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
        compiledSchema.$validate = getNamedFunction(
          methodName,
          (data) => {
            if (typeValidation(data)) {
              return;
            }
            return defineTypeError("Invalid type", { data });
          }
        );
      } else if (typeValidationsLength > 1) {
        compiledSchema.$validate = getNamedFunction(
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
        const executeKeywordValidator = (data) => keywordValidator(
          compiledSchema,
          data,
          defineError,
          this
        );
        if (compiledSchema.$validate) {
          const prevValidator = compiledSchema.$validate;
          methodName += `_AND_${keywordValidator.name}`;
          compiledSchema.$validate = getNamedFunction(
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
          compiledSchema.$validate = getNamedFunction(
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
        compiledSchema[key] = schema[key].map(
          (subSchema, index) => this.isSchemaLike(subSchema) ? this.compileSchema(subSchema) : subSchema
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
        if (subKey in this.keywords) {
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
