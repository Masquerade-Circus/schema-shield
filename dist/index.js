var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// lib/index.ts
var exports_lib = {};
__export(exports_lib, {
  deepClone: () => deepCloneUnfreeze,
  ValidationError: () => ValidationError,
  SchemaShield: () => SchemaShield
});
module.exports = __toCommonJS(exports_lib);

// lib/utils/main-utils.ts
class ValidationError extends Error {
  message;
  code;
  item;
  keyword;
  cause;
  schemaPath = "";
  instancePath = "";
  data;
  schema;
  compactPath;
  compactLeaf;
  constructor(message) {
    super(message);
    this.message = message;
  }
  setCompactPath(path, leaf) {
    this.compactPath = path;
    this.compactLeaf = leaf;
    this.cause = leaf;
  }
  visitPath(visitor) {
    let pointer = "#";
    let instancePointer = "#";
    const compactPath = this.compactPath;
    if (compactPath) {
      for (let i = 0;i < compactPath.keywords.length; i++) {
        const item = compactPath.items[i];
        let schemaPath = `${pointer}/${compactPath.keywords[i]}`;
        let instancePath = instancePointer;
        if (typeof item !== "undefined") {
          const escapedItem = String(item).replace(/~/g, "~0").replace(/\//g, "~1");
          const frameSchema = compactPath.schemas[i];
          if (typeof item === "string" && frameSchema && typeof frameSchema === "object" && item in frameSchema) {
            schemaPath += `/${escapedItem}`;
          }
          instancePath += `/${escapedItem}`;
        }
        const frameError = i === 0 ? this : new ValidationError(compactPath.messages[i]);
        frameError.message = compactPath.messages[i];
        frameError.keyword = compactPath.keywords[i];
        frameError.schema = compactPath.schemas[i];
        frameError.item = item;
        frameError.data = compactPath.data[i];
        frameError.schemaPath = schemaPath;
        frameError.instancePath = instancePath;
        visitor(frameError);
        pointer = schemaPath;
        instancePointer = instancePath;
      }
      let current2 = this.compactLeaf;
      while (true) {
        let schemaPath = `${pointer}/${current2.keyword}`;
        let instancePath = instancePointer;
        if (typeof current2.item !== "undefined") {
          const escapedItem = String(current2.item).replace(/~/g, "~0").replace(/\//g, "~1");
          if (typeof current2.item === "string" && current2.schema && typeof current2.schema === "object" && current2.item in current2.schema) {
            schemaPath += `/${escapedItem}`;
          }
          instancePath += `/${escapedItem}`;
        }
        current2.schemaPath = schemaPath;
        current2.instancePath = instancePath;
        visitor(current2);
        if (!current2.cause || !(current2.cause instanceof ValidationError)) {
          return current2;
        }
        pointer = schemaPath;
        instancePointer = instancePath;
        current2 = current2.cause;
      }
    }
    let current = this;
    while (true) {
      let schemaPath = `${pointer}/${current.keyword}`;
      let instancePath = instancePointer;
      if (typeof current.item !== "undefined") {
        const escapedItem = String(current.item).replace(/~/g, "~0").replace(/\//g, "~1");
        if (typeof current.item === "string" && current.schema && typeof current.schema === "object" && current.item in current.schema) {
          schemaPath += `/${escapedItem}`;
        }
        instancePath += `/${escapedItem}`;
      }
      current.instancePath = instancePath;
      current.schemaPath = schemaPath;
      visitor(current);
      if (!current.cause || !(current.cause instanceof ValidationError)) {
        return current;
      }
      pointer = schemaPath;
      instancePointer = instancePath;
      current = current.cause;
    }
  }
  getCause() {
    return this.visitPath(() => {});
  }
  getTree() {
    let root;
    let previous;
    this.visitPath((current) => {
      const tree = {
        message: current.message,
        keyword: current.keyword,
        item: current.item,
        schemaPath: current.schemaPath,
        instancePath: current.instancePath,
        data: current.data
      };
      if (!root) {
        root = tree;
      }
      if (previous) {
        previous.cause = tree;
      }
      previous = tree;
    });
    return root;
  }
  getPath() {
    const cause = this.getCause();
    return {
      schemaPath: cause.schemaPath,
      instancePath: cause.instancePath
    };
  }
}
var FAIL_FAST_DEFINE_ERROR = () => true;
function getDefinedErrorFunctionForKey(key, schema, failFast) {
  if (failFast) {
    return FAIL_FAST_DEFINE_ERROR;
  }
  const defineError = (message, options = {}) => {
    const KeywordError = new ValidationError(message);
    KeywordError.keyword = key;
    KeywordError.schema = schema;
    KeywordError.message = message;
    KeywordError.item = options.item;
    KeywordError.cause = options.cause && options.cause !== true ? options.cause : undefined;
    KeywordError.code = KeywordError.cause?.code;
    KeywordError.data = options.data;
    return KeywordError;
  };
  return getNamedFunction(`defineError_${key}`, defineError);
}
function isCompiledSchema(subSchema) {
  return !!subSchema && typeof subSchema === "object" && !Array.isArray(subSchema) && "$validate" in subSchema;
}
function getNamedFunction(name, fn) {
  return Object.defineProperty(fn, "name", { value: name });
}
function resolvePath(root, path) {
  if (!path || path === "#") {
    return root;
  }
  if (path.startsWith("#/")) {
    const parts = path.split("/").slice(1);
    let current = root;
    for (const part of parts) {
      const decodedUriPart = decodeURIComponent(part);
      const key = decodedUriPart.replace(/~1/g, "/").replace(/~0/g, "~");
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return;
      }
    }
    return current;
  }
  if (!path.includes("#")) {
    if (root.definitions && root.definitions[path]) {
      return root.definitions[path];
    }
    if (root.defs && root.defs[path]) {
      return root.defs[path];
    }
    if (root.$id && typeof root.$id === "string") {
      if (root.$id === path || root.$id.endsWith("/" + path)) {
        return root;
      }
    }
  }
  return;
}
function areCloseEnough(a, b, epsilon = 0.000000000000001) {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}

// lib/formats.ts
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var DURATION_REGEX = /^P(?!$)((\d+Y)?(\d+M)?(\d+W)?(\d+D)?)(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
var URI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
var EMAIL_REGEX = /^(?!\.)(?!.*\.$)(?=[^@]{1,64}@)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,64}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,64}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i;
var HOSTNAME_REGEX = /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*[a-z0-9]$/i;
var DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
var TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;
var URI_REFERENCE_REGEX = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
var IRI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
var IRI_REFERENCE_REGEX = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
var IDN_EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
var IDN_HOSTNAME_REGEX = /^[^\s!@#$%^&*()_+\=\[\]{};':"\\|,<>\/?]+$/;
var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isDigitCharCode(code) {
  return code >= 48 && code <= 57;
}
function parseTwoDigits(data, index) {
  const first = data.charCodeAt(index) - 48;
  const second = data.charCodeAt(index + 1) - 48;
  if (first < 0 || first > 9 || second < 0 || second > 9) {
    return -1;
  }
  return first * 10 + second;
}
function parseFourDigits(data, index) {
  const a = data.charCodeAt(index) - 48;
  const b = data.charCodeAt(index + 1) - 48;
  const c = data.charCodeAt(index + 2) - 48;
  const d = data.charCodeAt(index + 3) - 48;
  if (a < 0 || a > 9 || b < 0 || b > 9 || c < 0 || c > 9 || d < 0 || d > 9) {
    return -1;
  }
  return a * 1000 + b * 100 + c * 10 + d;
}
function isValidIpv4Range(data, start, end) {
  let segmentCount = 0;
  let segmentStart = start;
  for (let i = start;i <= end; i++) {
    if (i !== end && data.charCodeAt(i) !== 46) {
      continue;
    }
    const segmentLength = i - segmentStart;
    if (segmentLength < 1 || segmentLength > 3) {
      return false;
    }
    if (segmentLength > 1 && data.charCodeAt(segmentStart) === 48) {
      return false;
    }
    let value = 0;
    for (let j = segmentStart;j < i; j++) {
      const digit = data.charCodeAt(j) - 48;
      if (digit < 0 || digit > 9) {
        return false;
      }
      value = value * 10 + digit;
    }
    if (value > 255) {
      return false;
    }
    segmentCount++;
    segmentStart = i + 1;
  }
  return segmentCount === 4;
}
function isValidIpv4(data) {
  return isValidIpv4Range(data, 0, data.length);
}
function isHexCharCode(code) {
  return code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102;
}
function isValidIpv6(data) {
  const length = data.length;
  if (length === 0) {
    return false;
  }
  let hasColon = false;
  let hasDoubleColon = false;
  let hextetCount = 0;
  let i = 0;
  while (i < length) {
    if (data.charCodeAt(i) === 58) {
      hasColon = true;
      if (i + 1 < length && data.charCodeAt(i + 1) === 58) {
        if (hasDoubleColon) {
          return false;
        }
        hasDoubleColon = true;
        i += 2;
        if (i === length) {
          break;
        }
        continue;
      }
      return false;
    }
    const segmentStart = i;
    let segmentLength = 0;
    while (i < length && isHexCharCode(data.charCodeAt(i))) {
      segmentLength++;
      if (segmentLength > 4) {
        return false;
      }
      i++;
    }
    if (segmentLength === 0) {
      return false;
    }
    if (i < length && data.charCodeAt(i) === 46) {
      if (!hasColon) {
        return false;
      }
      if (!isValidIpv4Range(data, segmentStart, length)) {
        return false;
      }
      if (hasDoubleColon) {
        return hextetCount < 6;
      }
      return hextetCount === 6;
    }
    hextetCount++;
    if (hextetCount > 8) {
      return false;
    }
    if (i === length) {
      break;
    }
    if (data.charCodeAt(i) !== 58) {
      return false;
    }
    hasColon = true;
    i++;
    if (i === length) {
      return false;
    }
    if (data.charCodeAt(i) === 58) {
      if (hasDoubleColon) {
        return false;
      }
      hasDoubleColon = true;
      i++;
      if (i === length) {
        break;
      }
    }
  }
  if (!hasColon) {
    return false;
  }
  if (hasDoubleColon) {
    return hextetCount < 8;
  }
  return hextetCount === 8;
}
function isValidJsonPointer(data) {
  if (data === "") {
    return true;
  }
  if (data.charCodeAt(0) !== 47) {
    return false;
  }
  for (let i = 1;i < data.length; i++) {
    if (data.charCodeAt(i) !== 126) {
      continue;
    }
    const next = data.charCodeAt(i + 1);
    if (next !== 48 && next !== 49) {
      return false;
    }
    i++;
  }
  return true;
}
function isValidRelativeJsonPointer(data) {
  if (data.length === 0) {
    return true;
  }
  let i = 0;
  while (i < data.length) {
    const code = data.charCodeAt(i);
    if (code < 48 || code > 57) {
      break;
    }
    i++;
  }
  if (i === 0) {
    return false;
  }
  if (i === data.length) {
    return true;
  }
  if (data.charCodeAt(i) === 35) {
    return i + 1 === data.length;
  }
  if (data.charCodeAt(i) !== 47) {
    return false;
  }
  for (i = i + 1;i < data.length; i++) {
    if (data.charCodeAt(i) !== 126) {
      continue;
    }
    const next = data.charCodeAt(i + 1);
    if (next !== 48 && next !== 49) {
      return false;
    }
    i++;
  }
  return true;
}
function isValidUriTemplate(data) {
  for (let i = 0;i < data.length; i++) {
    const code = data.charCodeAt(i);
    if (code === 125) {
      return false;
    }
    if (code !== 123) {
      continue;
    }
    const closeIndex = data.indexOf("}", i + 1);
    if (closeIndex === -1 || closeIndex === i + 1) {
      return false;
    }
    i = closeIndex;
  }
  return true;
}
var Formats = {
  ["date-time"](data) {
    const length = data.length;
    if (length < 19) {
      return false;
    }
    if (data.charCodeAt(4) !== 45 || data.charCodeAt(7) !== 45 || data.charCodeAt(13) !== 58 || data.charCodeAt(16) !== 58) {
      return false;
    }
    const tCode = data.charCodeAt(10);
    if (tCode !== 84 && tCode !== 116) {
      return false;
    }
    const year = parseFourDigits(data, 0);
    const month = parseTwoDigits(data, 5);
    const day = parseTwoDigits(data, 8);
    const hour = parseTwoDigits(data, 11);
    const minute = parseTwoDigits(data, 14);
    const second = parseTwoDigits(data, 17);
    if (year < 0 || month < 0 || day < 0 || hour < 0 || minute < 0 || second < 0) {
      return false;
    }
    if (hour > 23 || minute > 59 || second > 60) {
      return false;
    }
    let cursor = 19;
    let offsetSign = null;
    let offsetHour = 0;
    let offsetMinute = 0;
    if (cursor < length && data.charCodeAt(cursor) === 46) {
      cursor++;
      const fracStart = cursor;
      while (cursor < length && isDigitCharCode(data.charCodeAt(cursor))) {
        cursor++;
      }
      if (cursor === fracStart) {
        return false;
      }
    }
    if (cursor < length) {
      const tzCode = data.charCodeAt(cursor);
      if (tzCode === 90 || tzCode === 122) {
        cursor++;
      } else if (tzCode === 43 || tzCode === 45) {
        offsetSign = tzCode === 43 ? "+" : "-";
        if (cursor + 6 > length || data.charCodeAt(cursor + 3) !== 58) {
          return false;
        }
        offsetHour = parseTwoDigits(data, cursor + 1);
        offsetMinute = parseTwoDigits(data, cursor + 4);
        if (offsetHour < 0 || offsetMinute < 0 || offsetHour > 23 || offsetMinute > 59) {
          return false;
        }
        cursor += 6;
      } else {
        return false;
      }
    }
    if (cursor !== length) {
      return false;
    }
    if (month < 1 || month > 12) {
      return false;
    }
    if (day < 1) {
      return false;
    }
    const maxDays = month === 2 ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28 : DAYS_IN_MONTH[month - 1];
    if (!maxDays || day > maxDays) {
      return false;
    }
    if (second === 60) {
      let utcTotalMinutes = hour * 60 + minute;
      if (offsetSign) {
        const offsetTotalMinutes = offsetHour * 60 + offsetMinute;
        utcTotalMinutes += offsetSign === "+" ? -offsetTotalMinutes : offsetTotalMinutes;
        utcTotalMinutes %= 24 * 60;
        if (utcTotalMinutes < 0) {
          utcTotalMinutes += 24 * 60;
        }
      }
      if (utcTotalMinutes !== 23 * 60 + 59) {
        return false;
      }
    }
    return true;
  },
  uri(data) {
    if (data.includes("[") && !data.includes("]")) {
      return false;
    }
    return URI_REGEX.test(data);
  },
  email(data) {
    return EMAIL_REGEX.test(data);
  },
  ipv4(data) {
    return isValidIpv4(data);
  },
  ipv6(data) {
    return isValidIpv6(data);
  },
  hostname(data) {
    return HOSTNAME_REGEX.test(data);
  },
  date(data) {
    const match = DATE_REGEX.exec(data);
    if (!match) {
      return false;
    }
    const [, yearStr, monthStr, dayStr] = match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (month < 1 || month > 12) {
      return false;
    }
    if (day < 1) {
      return false;
    }
    const maxDays = month === 2 ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28 : DAYS_IN_MONTH[month - 1];
    return !!maxDays && day <= maxDays;
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
    return isValidJsonPointer(data);
  },
  "relative-json-pointer"(data) {
    return isValidRelativeJsonPointer(data);
  },
  time(data) {
    return TIME_REGEX.test(data);
  },
  "uri-reference"(data) {
    if (data.includes("\\")) {
      return false;
    }
    return URI_REFERENCE_REGEX.test(data);
  },
  "uri-template"(data) {
    return isValidUriTemplate(data);
  },
  duration(data) {
    return DURATION_REGEX.test(data);
  },
  uuid(data) {
    return UUID_REGEX.test(data);
  },
  iri(data) {
    return IRI_REGEX.test(data);
  },
  "iri-reference"(data) {
    if (data.includes("\\")) {
      return false;
    }
    return IRI_REFERENCE_REGEX.test(data);
  },
  "idn-email"(data) {
    return IDN_EMAIL_REGEX.test(data);
  },
  "idn-hostname"(data) {
    return IDN_HOSTNAME_REGEX.test(data);
  }
};

// lib/types.ts
var Types = {
  object(data) {
    return data !== null && typeof data === "object" && !Array.isArray(data);
  },
  array(data) {
    return Array.isArray(data);
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
  timestamp: false,
  int8: false,
  uint8: false,
  int16: false,
  uint16: false,
  int32: false,
  uint32: false,
  float32: false,
  float64: false
};

// lib/utils/has-changed.ts
function hasChanged(prev, current) {
  if (Object.is(prev, current)) {
    return false;
  }
  if (Array.isArray(prev)) {
    if (Array.isArray(current) === false) {
      return true;
    }
    if (prev.length !== current.length) {
      return true;
    }
    for (let i = 0;i < current.length; i++) {
      if (hasChanged(prev[i], current[i])) {
        return true;
      }
    }
    return false;
  }
  if (typeof prev === "object" && prev !== null) {
    if (typeof current !== "object" || current === null) {
      return true;
    }
    for (const key in current) {
      if (hasChanged(prev[key], current[key])) {
        return true;
      }
    }
    for (const key in prev) {
      if (key in current) {
        continue;
      }
      if (hasChanged(prev[key], undefined)) {
        return true;
      }
    }
    return false;
  }
  return true;
}

// lib/keywords/array-keywords.ts
function isUniquePrimitive(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function getArrayBucketKey(value) {
  const length = value.length;
  if (length === 0) {
    return "0";
  }
  const first = value[0];
  const last = value[length - 1];
  const firstType = first === null ? "null" : typeof first;
  const lastType = last === null ? "null" : typeof last;
  let firstArrayMarker = "";
  if (Array.isArray(first)) {
    const firstSignature = getPrimitiveArraySignature(first);
    firstArrayMarker = firstSignature === null ? `a:${first.length}` : firstSignature;
  }
  let lastArrayMarker = "";
  if (Array.isArray(last)) {
    const lastSignature = getPrimitiveArraySignature(last);
    lastArrayMarker = lastSignature === null ? `a:${last.length}` : lastSignature;
  }
  return `${length}:${firstType}:${firstArrayMarker}:${lastType}:${lastArrayMarker}`;
}
function getObjectShapeKey(value) {
  const keys = Object.keys(value).sort();
  return `${keys.length}:${keys.join("\x01")}`;
}
function getPrimitiveArraySignature(value) {
  const length = value.length;
  if (length === 0) {
    return "a:0";
  }
  if (!isUniquePrimitive(value[0]) || !isUniquePrimitive(value[length - 1])) {
    return null;
  }
  let signature = `a:${length}:`;
  for (let i = 0;i < length; i++) {
    const item = value[i];
    if (item === null) {
      signature += "l;";
      continue;
    }
    if (typeof item === "string") {
      signature += `s${item.length}:${item};`;
      continue;
    }
    if (typeof item === "number") {
      if (Number.isNaN(item)) {
        signature += "n:NaN;";
        continue;
      }
      if (Object.is(item, -0)) {
        signature += "n:-0;";
        continue;
      }
      signature += `n:${item};`;
      continue;
    }
    if (typeof item === "boolean") {
      signature += item ? "b:1;" : "b:0;";
      continue;
    }
    return null;
  }
  return signature;
}
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
      const itemsLength = schemaItemsLength < dataLength ? schemaItemsLength : dataLength;
      for (let i = 0;i < itemsLength; i++) {
        const schemaItem = schemaItems[i];
        if (typeof schemaItem === "boolean") {
          if (schemaItem === false && data[i] !== undefined) {
            return defineError("Array item is not allowed", {
              item: i,
              data: data[i]
            });
          }
          continue;
        }
        const validate2 = schemaItem && schemaItem.$validate;
        if (typeof validate2 === "function") {
          const error = validate2(data[i]);
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
    const validate = schemaItems && schemaItems.$validate;
    if (typeof validate !== "function") {
      return;
    }
    for (let i = 0;i < dataLength; i++) {
      const error = validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }
  },
  elements(schema, data, defineError) {
    if (!Array.isArray(data)) {
      return;
    }
    const elementsSchema = schema.elements;
    const validate = elementsSchema && elementsSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }
    for (let i = 0;i < data.length; i++) {
      const error = validate(data[i]);
      if (error) {
        return defineError("Array item is invalid", {
          item: i,
          cause: error,
          data: data[i]
        });
      }
    }
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
    if (!Array.isArray(data) || !Array.isArray(schema.items)) {
      return;
    }
    let tupleLength = schema._tupleItemsLength;
    if (tupleLength === undefined) {
      tupleLength = schema.items.length;
      Object.defineProperty(schema, "_tupleItemsLength", {
        value: tupleLength,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    if (data.length <= tupleLength) {
      return;
    }
    if (schema.additionalItems === false) {
      return defineError("Array is too long", { data });
    }
    if (schema.additionalItems && typeof schema.additionalItems === "object" && !Array.isArray(schema.additionalItems)) {
      if (isCompiledSchema(schema.additionalItems)) {
        for (let i = tupleLength;i < data.length; i++) {
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
    const len = data.length;
    if (len <= 1) {
      return;
    }
    if (len <= 8) {
      for (let i = 0;i < len; i++) {
        const left = data[i];
        for (let j = i + 1;j < len; j++) {
          const right = data[j];
          if (left === right) {
            return defineError("Array items are not unique", { data: right });
          }
          if (typeof left === "number" && typeof right === "number" && Number.isNaN(left) && Number.isNaN(right)) {
            return defineError("Array items are not unique", { data: right });
          }
          if (left && right && typeof left === "object" && typeof right === "object" && !hasChanged(left, right)) {
            return defineError("Array items are not unique", { data: right });
          }
        }
      }
      return;
    }
    const primitiveSeen = new Set;
    let primitiveArraySignatures;
    let arrayBuckets;
    let objectBuckets;
    for (let i = 0;i < len; i++) {
      const item = data[i];
      if (isUniquePrimitive(item)) {
        if (primitiveSeen.has(item)) {
          return defineError("Array items are not unique", { data: item });
        }
        primitiveSeen.add(item);
        continue;
      }
      if (!item || typeof item !== "object") {
        continue;
      }
      if (Array.isArray(item)) {
        const signature = getPrimitiveArraySignature(item);
        if (signature !== null) {
          if (!primitiveArraySignatures) {
            primitiveArraySignatures = new Set;
          }
          if (primitiveArraySignatures.has(signature)) {
            return defineError("Array items are not unique", { data: item });
          }
          primitiveArraySignatures.add(signature);
          continue;
        }
        if (!arrayBuckets) {
          arrayBuckets = new Map;
        }
        const bucketKey2 = getArrayBucketKey(item);
        let candidates2 = arrayBuckets.get(bucketKey2);
        if (!candidates2) {
          candidates2 = [];
          arrayBuckets.set(bucketKey2, candidates2);
        }
        for (let j = 0;j < candidates2.length; j++) {
          if (!hasChanged(candidates2[j], item)) {
            return defineError("Array items are not unique", { data: item });
          }
        }
        candidates2.push(item);
        continue;
      }
      if (!objectBuckets) {
        objectBuckets = new Map;
      }
      const bucketKey = getObjectShapeKey(item);
      let candidates = objectBuckets.get(bucketKey);
      if (!candidates) {
        candidates = [];
        objectBuckets.set(bucketKey, candidates);
      }
      for (let j = 0;j < candidates.length; j++) {
        if (!hasChanged(candidates[j], item)) {
          return defineError("Array items are not unique", { data: item });
        }
      }
      candidates.push(item);
    }
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
    const containsValidate = schema.contains.$validate;
    for (let i = 0;i < data.length; i++) {
      const error = containsValidate(data[i]);
      if (!error) {
        return;
      }
      continue;
    }
    return defineError("Array must contain at least one item", { data });
  }
};

// lib/utils/deep-freeze.ts
function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function canUseStructuredClone(value) {
  if (typeof Buffer !== "undefined" && value instanceof Buffer) {
    return false;
  }
  return Array.isArray(value) || isPlainObject(value) || value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}
function clonePlainObjectOrArrayIteratively(value, cloneClassInstances, seen) {
  const sourceRoot = value;
  const cloneRoot = Array.isArray(sourceRoot) ? [] : Object.create(Object.getPrototypeOf(sourceRoot));
  seen.set(sourceRoot, cloneRoot);
  const pending = [
    { source: sourceRoot, clone: cloneRoot }
  ];
  while (pending.length > 0) {
    const current = pending.pop();
    const keys = Reflect.ownKeys(current.source);
    for (let i = 0;i < keys.length; i++) {
      const key = keys[i];
      const descriptor = Object.getOwnPropertyDescriptor(current.source, key);
      if (!("value" in descriptor)) {
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }
      const item = descriptor.value;
      if (item === null || typeof item !== "object") {
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }
      if (!Array.isArray(item) && !isPlainObject(item)) {
        descriptor.value = deepCloneUnfreeze(item, cloneClassInstances, seen);
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }
      let clonedItem = seen.get(item);
      if (!clonedItem) {
        clonedItem = Array.isArray(item) ? [] : Object.create(Object.getPrototypeOf(item));
        seen.set(item, clonedItem);
        pending.push({ source: item, clone: clonedItem });
      }
      descriptor.value = clonedItem;
      Object.defineProperty(current.clone, key, descriptor);
    }
  }
  return cloneRoot;
}
function deepCloneUnfreeze(obj, cloneClassInstances = false, seen = new WeakMap) {
  if (typeof obj === "undefined" || obj === null || typeof obj !== "object") {
    return obj;
  }
  const source = obj;
  if (seen.has(source)) {
    return seen.get(source);
  }
  if (canUseStructuredClone(source)) {
    try {
      const cloned = structuredClone(source);
      seen.set(source, cloned);
      return cloned;
    } catch (error) {
      if (!(error instanceof RangeError) || !Array.isArray(source) && !isPlainObject(source)) {
        throw error;
      }
      return clonePlainObjectOrArrayIteratively(source, cloneClassInstances, seen);
    }
  }
  let clone;
  switch (true) {
    case source instanceof Date: {
      clone = new Date(source.getTime());
      seen.set(source, clone);
      return clone;
    }
    case source instanceof RegExp: {
      clone = new RegExp(source.source, source.flags);
      seen.set(source, clone);
      return clone;
    }
    case source instanceof Map: {
      clone = new Map;
      seen.set(source, clone);
      for (const [key, value] of source.entries()) {
        clone.set(deepCloneUnfreeze(key, cloneClassInstances, seen), deepCloneUnfreeze(value, cloneClassInstances, seen));
      }
      return clone;
    }
    case source instanceof Set: {
      clone = new Set;
      seen.set(source, clone);
      for (const value of source.values()) {
        clone.add(deepCloneUnfreeze(value, cloneClassInstances, seen));
      }
      return clone;
    }
    case source instanceof ArrayBuffer: {
      clone = source.slice(0);
      seen.set(source, clone);
      return clone;
    }
    case ArrayBuffer.isView(source): {
      clone = new source.constructor(source.buffer.slice(0));
      seen.set(source, clone);
      return clone;
    }
    case (typeof Buffer !== "undefined" && source instanceof Buffer): {
      clone = Buffer.from(source);
      seen.set(source, clone);
      return clone;
    }
    case source instanceof Error: {
      clone = new source.constructor(source.message);
      seen.set(source, clone);
      break;
    }
    case (source instanceof Promise || source instanceof WeakMap || source instanceof WeakSet): {
      clone = source;
      seen.set(source, clone);
      return clone;
    }
    case (source.constructor && source.constructor !== Object): {
      if (!cloneClassInstances) {
        clone = source;
        seen.set(source, clone);
        return clone;
      }
      clone = Object.create(Object.getPrototypeOf(source));
      seen.set(source, clone);
      break;
    }
    default: {
      clone = {};
      seen.set(source, clone);
      const keys = Reflect.ownKeys(source);
      for (let i = 0, l = keys.length;i < l; i++) {
        const key = keys[i];
        clone[key] = deepCloneUnfreeze(source[key], cloneClassInstances, seen);
      }
      return clone;
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(source);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if ("value" in descriptor) {
      descriptor.value = deepCloneUnfreeze(descriptor.value, cloneClassInstances, seen);
    }
    Object.defineProperty(clone, key, descriptor);
  }
  return clone;
}

// lib/keywords/number-keywords.ts
var NumberKeywords = {
  minimum(schema, data, defineError, instance) {
    if (typeof data !== "number") {
      return;
    }
    let min = schema.minimum;
    if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + 0.000000000000001;
    } else if (schema.exclusiveMinimum === true) {
      min += 0.000000000000001;
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
      max = schema.exclusiveMaximum - 0.000000000000001;
    } else if (schema.exclusiveMaximum === true) {
      max -= 0.000000000000001;
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
      return defineError("Value is not a multiple of the multipleOf", { data });
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
    if (data <= schema.exclusiveMinimum + 0.000000000000001) {
      return defineError("Value is less than or equal to the exclusiveMinimum");
    }
    return;
  },
  exclusiveMaximum(schema, data, defineError, instance) {
    if (typeof data !== "number" || typeof schema.exclusiveMaximum !== "number" || "maximum" in schema) {
      return;
    }
    if (data >= schema.exclusiveMaximum) {
      return defineError("Value is greater than or equal to the exclusiveMaximum", { data });
    }
    return;
  }
};

// lib/utils/pattern-matcher.ts
var REGEX_META_CHARS = /[\\.^$*+?()[\]{}|]/;
function hasRegexMeta(value) {
  return REGEX_META_CHARS.test(value);
}
var PATTERN_CACHE = new Map;
function compilePatternMatcher(pattern) {
  const cached = PATTERN_CACHE.get(pattern);
  if (cached) {
    return cached;
  }
  let compiled;
  if (pattern.length === 0) {
    compiled = (_value) => true;
  } else if (!hasRegexMeta(pattern)) {
    compiled = (value) => value.includes(pattern);
  } else {
    const patternLength = pattern.length;
    if (patternLength >= 2 && pattern[0] === "^" && pattern[patternLength - 1] === "$") {
      const inner = pattern.slice(1, -1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (value) => value.length === 0;
        } else {
          compiled = (value) => value === inner;
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else if (pattern[0] === "^") {
      const inner = pattern.slice(1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (_value) => true;
        } else {
          compiled = (value) => value.startsWith(inner);
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else if (pattern[patternLength - 1] === "$") {
      const inner = pattern.slice(0, -1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (_value) => true;
        } else {
          compiled = (value) => value.endsWith(inner);
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else {
      compiled = new RegExp(pattern, "u");
    }
  }
  PATTERN_CACHE.set(pattern, compiled);
  return compiled;
}

// lib/keywords/object-keywords.ts
var PATTERN_KEY_CACHE_LIMIT = 512;
function getPatternPropertyEntries(schema) {
  let entries = schema._patternPropertyEntries;
  if (entries) {
    return entries;
  }
  if (!schema.patternProperties || typeof schema.patternProperties !== "object" || Array.isArray(schema.patternProperties)) {
    return;
  }
  const patternKeys = Object.keys(schema.patternProperties);
  entries = new Array(patternKeys.length);
  for (let i = 0;i < patternKeys.length; i++) {
    const key = patternKeys[i];
    const compiledMatcher = compilePatternMatcher(key);
    const match = compiledMatcher instanceof RegExp ? (value) => compiledMatcher.test(value) : compiledMatcher;
    entries[i] = {
      schemaProp: schema.patternProperties[key],
      match
    };
  }
  Object.defineProperty(schema, "_patternPropertyEntries", {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return entries;
}
function getPatternKeyMatchIndexes(schema, key, entries) {
  let cache = schema._patternKeyMatchIndexCache;
  if (cache) {
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
  } else {
    cache = new Map;
    Object.defineProperty(schema, "_patternKeyMatchIndexCache", {
      value: cache,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  const indexes = [];
  for (let i = 0;i < entries.length; i++) {
    if (entries[i].match(key)) {
      indexes.push(i);
    }
  }
  if (cache.size < PATTERN_KEY_CACHE_LIMIT) {
    cache.set(key, indexes);
  }
  return indexes;
}
var ObjectKeywords = {
  required(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    for (let i = 0;i < schema.required.length; i++) {
      const key = schema.required[i];
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        return defineError("Required property is missing", {
          item: key,
          data: data[key]
        });
      }
    }
    return;
  },
  properties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    let requiredSet = schema._requiredSet;
    if (requiredSet === undefined) {
      requiredSet = Array.isArray(schema.required) ? new Set(schema.required) : null;
      Object.defineProperty(schema, "_requiredSet", {
        value: requiredSet,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    let validationEntries = schema._propertyValidationEntries;
    if (!validationEntries) {
      const propKeys = Object.keys(schema.properties || {});
      validationEntries = [];
      for (let i = 0;i < propKeys.length; i++) {
        const key = propKeys[i];
        const schemaProp = schema.properties[key];
        const hasDefault = !!requiredSet && requiredSet.has(key) && schemaProp && typeof schemaProp === "object" && !Array.isArray(schemaProp) && "default" in schemaProp;
        if (schemaProp === false) {
          validationEntries.push({ key, schemaProp, hasDefault: false });
          continue;
        }
        if (schemaProp === true) {
          continue;
        }
        if (schemaProp && typeof schemaProp === "object" && !Array.isArray(schemaProp) && (typeof schemaProp.$validate === "function" || hasDefault)) {
          validationEntries.push({ key, schemaProp, hasDefault });
        }
      }
      Object.defineProperty(schema, "_propertyValidationEntries", {
        value: validationEntries,
        enumerable: false,
        configurable: false,
        writable: false
      });
      Object.defineProperty(schema, "_hasRequiredDefaults", {
        value: validationEntries.some((entry) => entry.hasDefault),
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    if (schema._hasRequiredDefaults !== true) {
      for (let i = 0;i < validationEntries.length; i++) {
        const { key, schemaProp } = validationEntries[i];
        if (!Object.prototype.hasOwnProperty.call(data, key)) {
          continue;
        }
        if (typeof schemaProp === "boolean") {
          if (schemaProp === false) {
            return defineError("Property is not allowed", {
              item: key,
              data: data[key]
            });
          }
          continue;
        }
        if (schemaProp && "$validate" in schemaProp) {
          const error = schemaProp.$validate(data[key]);
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
    }
    const stagedDefaults = [];
    for (let i = 0;i < validationEntries.length; i++) {
      const { key, schemaProp, hasDefault } = validationEntries[i];
      if (Object.prototype.hasOwnProperty.call(data, key) || !hasDefault) {
        continue;
      }
      const defaultValue = deepCloneUnfreeze(schemaProp.default);
      const validate = schemaProp.$validate;
      const error = typeof validate === "function" ? validate(defaultValue) : undefined;
      if (error) {
        return defineError("Default property is invalid", {
          item: key,
          cause: error,
          data: defaultValue
        });
      }
      stagedDefaults.push({ key, value: defaultValue });
    }
    for (let i = 0;i < stagedDefaults.length; i++) {
      const { key, value } = stagedDefaults[i];
      if (key === "__proto__") {
        Object.defineProperty(data, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        data[key] = value;
      }
    }
    for (let i = 0;i < validationEntries.length; i++) {
      const { key, schemaProp } = validationEntries[i];
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      if (stagedDefaults.some((item) => item.key === key)) {
        continue;
      }
      if (typeof schemaProp === "boolean") {
        if (schemaProp === false) {
          return defineError("Property is not allowed", {
            item: key,
            data: data[key]
          });
        }
        continue;
      }
      if (schemaProp && "$validate" in schemaProp) {
        const error = schemaProp.$validate(data[key]);
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    const valueSchema = schema.values;
    const validate = valueSchema && valueSchema.$validate;
    if (typeof validate !== "function") {
      return;
    }
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      const error = validate(data[key]);
      if (error) {
        return defineError("Property is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
  },
  maxProperties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    let count = 0;
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      count++;
      if (count > schema.maxProperties) {
        return defineError("Too many properties", { data });
      }
    }
    return;
  },
  minProperties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    let count = 0;
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      count++;
      if (count >= schema.minProperties) {
        return;
      }
    }
    return defineError("Too few properties", { data });
  },
  additionalProperties(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    let apValidate = schema._apValidate;
    if (apValidate === undefined) {
      apValidate = isCompiledSchema(schema.additionalProperties) ? schema.additionalProperties.$validate : null;
      Object.defineProperty(schema, "_apValidate", {
        value: apValidate,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    const patternEntries = getPatternPropertyEntries(schema);
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      if (schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key)) {
        continue;
      }
      if (patternEntries && patternEntries.length) {
        if (getPatternKeyMatchIndexes(schema, key, patternEntries).length > 0) {
          continue;
        }
      }
      if (schema.additionalProperties === false) {
        return defineError("Additional properties are not allowed", {
          item: key,
          data: data[key]
        });
      }
      if (apValidate) {
        const error = apValidate(data[key]);
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
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    const patternEntries = getPatternPropertyEntries(schema);
    if (!patternEntries || patternEntries.length === 0) {
      return;
    }
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      const matchingIndexes = getPatternKeyMatchIndexes(schema, key, patternEntries);
      if (matchingIndexes.length === 0) {
        if (schema.additionalProperties === false && !(schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key))) {
          return defineError("Additional properties are not allowed", {
            item: key,
            data: data[key]
          });
        }
        continue;
      }
      for (let j = 0;j < matchingIndexes.length; j++) {
        const schemaProp = patternEntries[matchingIndexes[j]].schemaProp;
        if (typeof schemaProp === "boolean") {
          if (schemaProp === false) {
            return defineError("Property is not allowed", {
              item: key,
              data: data[key]
            });
          }
          continue;
        }
        if ("$validate" in schemaProp) {
          const error = schemaProp.$validate(data[key]);
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
    return;
  },
  propertyNames(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    const pn = schema.propertyNames;
    if (typeof pn === "boolean") {
      if (pn === false) {
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            return defineError("Properties are not allowed", { data });
          }
        }
      }
      return;
    }
    const validate = pn && pn.$validate;
    if (typeof validate !== "function") {
      return;
    }
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      const error = validate(key);
      if (error) {
        return defineError("Property name is invalid", {
          item: key,
          cause: error,
          data: data[key]
        });
      }
    }
  },
  dependencies(schema, data, defineError) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    for (const key in schema.dependencies) {
      if (key in data === false) {
        continue;
      }
      const dependency = schema.dependencies[key];
      if (Array.isArray(dependency)) {
        for (let i = 0;i < dependency.length; i++) {
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
  then: false,
  else: false,
  default: false,
  definitions: false,
  $id: false,
  $schema: false,
  title: false,
  description: false,
  $comment: false,
  examples: false,
  contentMediaType: false,
  contentEncoding: false,
  discriminator: false,
  nullable: false
};

// lib/keywords/other-keywords.ts
function toBranchEntry(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    if ("$validate" in item && typeof item.$validate === "function") {
      return { kind: "validate", validate: item.$validate };
    }
    return { kind: "alwaysValid" };
  }
  if (typeof item === "boolean") {
    return { kind: item ? "alwaysValid" : "alwaysInvalid" };
  }
  return { kind: "literal", value: item };
}
function getBranchEntries(schema, key) {
  const cacheKey = `_${key}BranchEntries`;
  let entries = schema[cacheKey];
  if (entries) {
    return entries;
  }
  const source = schema[key] || [];
  entries = [];
  for (let i = 0;i < source.length; i++) {
    entries.push(toBranchEntry(source[i]));
  }
  Object.defineProperty(schema, cacheKey, {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return entries;
}
var OtherKeywords = {
  enum(schema, data, defineError) {
    let enumCache = schema._enumCache;
    if (!enumCache) {
      const primitiveSet = new Set;
      const objectValues = [];
      const list = schema.enum;
      for (let i = 0;i < list.length; i++) {
        const enumItem = list[i];
        if (enumItem !== null && typeof enumItem === "object") {
          objectValues.push(enumItem);
        } else {
          primitiveSet.add(enumItem);
        }
      }
      enumCache = { primitiveSet, objectValues };
      Object.defineProperty(schema, "_enumCache", {
        value: enumCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    if (!(typeof data === "number" && Number.isNaN(data)) && enumCache.primitiveSet.has(data)) {
      return;
    }
    if (data !== null && typeof data === "object") {
      for (let i = 0;i < enumCache.objectValues.length; i++) {
        if (!hasChanged(enumCache.objectValues[i], data)) {
          return;
        }
      }
    }
    return defineError("Value is not one of the allowed values", { data });
  },
  allOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "allOf");
    if (branches.length === 1) {
      const onlyBranch = branches[0];
      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        return;
      }
      if (onlyBranch.kind === "alwaysValid") {
        return;
      }
      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }
      if (data !== onlyBranch.value) {
        return defineError("Value is not valid", { data });
      }
      return;
    }
    for (let i = 0;i < branches.length; i++) {
      const branch = branches[i];
      if (branch.kind === "validate") {
        const error = branch.validate(data);
        if (error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        continue;
      }
      if (branch.kind === "alwaysValid") {
        continue;
      }
      if (branch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }
      if (data !== branch.value) {
        return defineError("Value is not valid", { data });
      }
    }
    return;
  },
  anyOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "anyOf");
    if (branches.length === 1) {
      const onlyBranch = branches[0];
      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (!error) {
          return;
        }
        return defineError("Value is not valid", { data });
      }
      if (onlyBranch.kind === "alwaysValid") {
        return;
      }
      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }
      if (data === onlyBranch.value) {
        return;
      }
      return defineError("Value is not valid", { data });
    }
    for (let i = 0;i < branches.length; i++) {
      const branch = branches[i];
      if (branch.kind === "validate") {
        const error = branch.validate(data);
        if (!error) {
          return;
        }
        continue;
      }
      if (branch.kind === "alwaysValid") {
        return;
      }
      if (branch.kind === "alwaysInvalid") {
        continue;
      }
      if (data === branch.value) {
        return;
      }
    }
    return defineError("Value is not valid", { data });
  },
  oneOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "oneOf");
    if (branches.length === 1) {
      const onlyBranch = branches[0];
      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (!error) {
          return;
        }
        return defineError("Value is not valid", { data });
      }
      if (onlyBranch.kind === "alwaysValid") {
        return;
      }
      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }
      if (data === onlyBranch.value) {
        return;
      }
      return defineError("Value is not valid", { data });
    }
    let validCount = 0;
    for (let i = 0;i < branches.length; i++) {
      const branch = branches[i];
      let isValid = false;
      if (branch.kind === "validate") {
        isValid = !branch.validate(data);
      } else if (branch.kind === "alwaysValid") {
        isValid = true;
      } else if (branch.kind === "alwaysInvalid") {
        isValid = false;
      } else {
        isValid = data === branch.value;
      }
      if (isValid) {
        validCount++;
        if (validCount > 1) {
          return defineError("Value is not valid", { data });
        }
      }
    }
    if (validCount === 1) {
      return;
    }
    return defineError("Value is not valid", { data });
  },
  const(schema, data, defineError) {
    if (data === schema.const) {
      return;
    }
    if (data && typeof data === "object" && !Array.isArray(data) && schema.const && typeof schema.const === "object" && !Array.isArray(schema.const) && !hasChanged(data, schema.const) || Array.isArray(data) && Array.isArray(schema.const) && !hasChanged(data, schema.const)) {
      return;
    }
    return defineError("Value is not valid", { data });
  },
  if(schema, data) {
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
    if (schema.not && typeof schema.not === "object" && !Array.isArray(schema.not)) {
      if ("$validate" in schema.not) {
        const error = schema.not.$validate(data);
        if (!error) {
          return defineError("Value is not valid", { data });
        }
        return;
      }
      return defineError("Value is not valid", { data });
    }
    return defineError("Value is not valid", { data });
  },
  $ref(schema, data, defineError, instance) {
    if (schema._resolvedRef) {
      if (schema.$validate !== schema._resolvedRef) {
        schema.$validate = schema._resolvedRef;
      }
      return schema._resolvedRef(data);
    }
    const refPath = schema.$ref;
    let targetSchema = instance.getSchemaRef(refPath);
    if (!targetSchema) {
      targetSchema = instance.getSchemaById(refPath);
    }
    if (!targetSchema) {
      return defineError(`Missing reference: ${refPath}`);
    }
    if (!targetSchema.$validate) {
      return;
    }
    schema._resolvedRef = targetSchema.$validate;
    schema.$validate = schema._resolvedRef;
    return schema._resolvedRef(data);
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
    let patternMatch = schema._patternMatch;
    let patternMatchCache = schema._patternMatchCache;
    if (!patternMatch) {
      try {
        const compiled = compilePatternMatcher(schema.pattern);
        patternMatch = compiled instanceof RegExp ? (value) => compiled.test(value) : compiled;
        Object.defineProperty(schema, "_patternMatch", {
          value: patternMatch,
          enumerable: false,
          configurable: false,
          writable: false
        });
      } catch (error) {
        return defineError("Invalid regular expression", {
          data,
          cause: error
        });
      }
    }
    if (!patternMatchCache) {
      patternMatchCache = {
        data: "",
        result: false,
        hasValue: false
      };
      Object.defineProperty(schema, "_patternMatchCache", {
        value: patternMatchCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (patternMatchCache.hasValue && patternMatchCache.data === data) {
      if (patternMatchCache.result) {
        return;
      }
      return defineError("Value does not match the pattern", { data });
    }
    const isMatch = patternMatch(data);
    patternMatchCache.data = data;
    patternMatchCache.result = isMatch;
    patternMatchCache.hasValue = true;
    if (isMatch) {
      return;
    }
    return defineError("Value does not match the pattern", { data });
  },
  format(schema, data, defineError, instance) {
    if (typeof data !== "string") {
      return;
    }
    let formatValidate = schema._formatValidate;
    let formatResultCacheEnabled = schema._formatResultCacheEnabled;
    let formatResultCache = schema._formatResultCache;
    if (formatValidate === undefined) {
      formatValidate = instance.getFormat(schema.format);
      Object.defineProperty(schema, "_formatValidate", {
        value: formatValidate,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    if (!formatValidate) {
      return;
    }
    if (formatResultCacheEnabled === undefined) {
      formatResultCacheEnabled = instance.isDefaultFormatValidator(schema.format, formatValidate);
      Object.defineProperty(schema, "_formatResultCacheEnabled", {
        value: formatResultCacheEnabled,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    if (!formatResultCacheEnabled) {
      if (formatValidate(data)) {
        return;
      }
      return defineError("Value does not match the format", { data });
    }
    if (!formatResultCache) {
      formatResultCache = {
        data: "",
        result: false,
        hasValue: false
      };
      Object.defineProperty(schema, "_formatResultCache", {
        value: formatResultCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    } else if (formatResultCache.hasValue && formatResultCache.data === data) {
      if (formatResultCache.result) {
        return;
      }
      return defineError("Value does not match the format", { data });
    }
    const isValid = formatValidate(data);
    formatResultCache.data = data;
    formatResultCache.result = isValid;
    formatResultCache.hasValue = true;
    if (isValid) {
      return;
    }
    return defineError("Value does not match the format", { data });
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
class SchemaShield {
  types = {};
  formats = {};
  keywords = {};
  immutable = false;
  rootSchema = null;
  idRegistry = new Map;
  schemaLocations = new WeakSet;
  failFast = true;
  maxDepth;
  guardedValidationDepth = 0;
  depthErrorCount = 0;
  iterativeWorkspaces = [];
  activeIterativeWorkspaces = 0;
  constructor({
    immutable = false,
    failFast = true,
    maxDepth = 1e4
  } = {}) {
    if (typeof maxDepth !== "number" || !Number.isFinite(maxDepth) || !Number.isInteger(maxDepth) || maxDepth <= 0) {
      throw new ValidationError("maxDepth must be a positive integer");
    }
    this.immutable = immutable;
    this.failFast = failFast;
    this.maxDepth = maxDepth;
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
  isDefaultFormatValidator(format, validator) {
    return Formats[format] === validator;
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
  getSchemaRef(path) {
    if (!this.rootSchema) {
      return;
    }
    return resolvePath(this.rootSchema, path);
  }
  getSchemaById(id) {
    return this.idRegistry.get(id);
  }
  compile(schema) {
    this.idRegistry.clear();
    const compiledSchema = this.compileSchema(schema);
    this.rootSchema = compiledSchema;
    if (compiledSchema._hasRef === true) {
      this.linkReferences(compiledSchema);
    }
    const cachePending = [compiledSchema];
    const cacheSeen = new WeakSet;
    while (cachePending.length > 0) {
      const current = cachePending.pop();
      if (!current || typeof current !== "object" || cacheSeen.has(current)) {
        continue;
      }
      cacheSeen.add(current);
      this.prepareObjectKeywordCaches(current);
      this.prepareCombinatorKeywordCaches(current);
      for (const key of Object.keys(current)) {
        const value = current[key];
        if (Array.isArray(value)) {
          for (let i = 0;i < value.length; i++) {
            if (value[i] && typeof value[i] === "object") {
              cachePending.push(value[i]);
            }
          }
        } else if (value && typeof value === "object") {
          cachePending.push(value);
        }
      }
    }
    if (!compiledSchema.$validate) {
      if (schema === false) {
        const defineError = getDefinedErrorFunctionForKey("oneOf", compiledSchema, this.failFast);
        compiledSchema.$validate = getNamedFunction("Validate_False", (data) => defineError("Value is not valid", { data }));
      } else if (schema === true) {
        compiledSchema.$validate = getNamedFunction("Validate_Any", () => {});
      } else if (this.isSchemaLike(schema) === false) {
        throw new ValidationError("Invalid schema");
      } else {
        compiledSchema.$validate = getNamedFunction("Validate_Any", () => {});
      }
    }
    const requiresIterativeValidation = this.requiresIterativeValidation(compiledSchema);
    if (requiresIterativeValidation) {
      this.guardCompiledValidators(compiledSchema);
    }
    const validate = (data) => {
      this.rootSchema = compiledSchema;
      const clonedData = this.immutable ? deepCloneUnfreeze(data) : data;
      const res = requiresIterativeValidation ? this.validateIterative(compiledSchema, clonedData) : compiledSchema.$validate(clonedData);
      if (res) {
        return { data: clonedData, error: res, valid: false };
      }
      return { data: clonedData, error: null, valid: true };
    };
    validate.compiledSchema = compiledSchema;
    return validate;
  }
  createDepthError(data) {
    this.depthErrorCount++;
    if (this.failFast) {
      return true;
    }
    const error = new ValidationError(`Maximum validation depth of ${this.maxDepth} exceeded`);
    error.code = "MAX_DEPTH_EXCEEDED";
    error.keyword = "maxDepth";
    error.schema = { maxDepth: this.maxDepth };
    error.data = data;
    return error;
  }
  guardCompiledValidators(root) {
    const stack = [root];
    const seen = new WeakSet;
    const guardedByValidator = new Map;
    while (stack.length > 0) {
      const schema = stack.pop();
      if (!schema || typeof schema !== "object" || seen.has(schema)) {
        continue;
      }
      seen.add(schema);
      if (typeof schema.$validate === "function" && schema._depthGuarded !== true) {
        const directValidate = schema.$validate;
        let guardedValidate = guardedByValidator.get(directValidate);
        if (!guardedValidate) {
          guardedValidate = getNamedFunction(directValidate.name, (data) => {
            this.guardedValidationDepth++;
            try {
              if (this.guardedValidationDepth > this.maxDepth) {
                return this.createDepthError(data);
              }
              return directValidate(data);
            } catch (error) {
              if (error instanceof RangeError && error.message.toLowerCase().includes("call stack")) {
                return this.createDepthError(data);
              }
              throw error;
            } finally {
              this.guardedValidationDepth--;
            }
          });
          guardedByValidator.set(directValidate, guardedValidate);
        }
        schema.$validate = guardedValidate;
        this.defineHiddenValue(schema, "_depthGuarded", true);
      }
      const resolved = schema._resolvedSchema;
      if (resolved && typeof resolved === "object") {
        stack.push(resolved);
      }
      for (const key of Object.keys(schema)) {
        if (key === "enum" || key === "const" || key === "default" || key === "examples") {
          continue;
        }
        const value = schema[key];
        if (Array.isArray(value)) {
          for (let i = 0;i < value.length; i++) {
            if (value[i] && typeof value[i] === "object") {
              stack.push(value[i]);
            }
          }
        } else if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }
  }
  requiresIterativeValidation(root) {
    const active = new WeakSet;
    const complete = new WeakSet;
    const stack = [{ schema: root, depth: 0, exiting: false }];
    while (stack.length > 0) {
      const frame = stack.pop();
      const schema = frame.schema;
      if (frame.exiting) {
        active.delete(schema);
        complete.add(schema);
        continue;
      }
      if (active.has(schema)) {
        return true;
      }
      if (complete.has(schema)) {
        continue;
      }
      if (frame.depth >= Math.min(256, this.maxDepth)) {
        return true;
      }
      active.add(schema);
      stack.push({ schema, depth: frame.depth, exiting: true });
      const children = [];
      const resolved = schema._resolvedSchema;
      if (resolved && typeof resolved === "object") {
        children.push(resolved);
      }
      for (const key of [
        "additionalItems",
        "additionalProperties",
        "contains",
        "elements",
        "else",
        "if",
        "items",
        "not",
        "propertyNames",
        "then",
        "values"
      ]) {
        const value = schema[key];
        if (Array.isArray(value)) {
          children.push(...value);
        } else if (value && typeof value === "object") {
          children.push(value);
        }
      }
      for (const key of [
        "allOf",
        "anyOf",
        "oneOf"
      ]) {
        if (Array.isArray(schema[key])) {
          children.push(...schema[key]);
        }
      }
      for (const key of [
        "definitions",
        "dependencies",
        "patternProperties",
        "properties"
      ]) {
        const map = schema[key];
        if (map && typeof map === "object" && !Array.isArray(map)) {
          children.push(...Object.values(map));
        }
      }
      for (let i = children.length - 1;i >= 0; i--) {
        const child = children[i];
        if (child && typeof child === "object" && !Array.isArray(child)) {
          stack.push({
            schema: child,
            depth: frame.depth + 1,
            exiting: false
          });
        }
      }
    }
    return false;
  }
  wrapIterativeError(leafError, messages, keywords2, schemas, items, data, pathLength) {
    if (pathLength === 0) {
      return leafError;
    }
    if (pathLength <= 64) {
      let error2 = leafError;
      for (let i = pathLength - 1;i >= 0; i--) {
        error2 = getDefinedErrorFunctionForKey(keywords2[i], schemas[i], false)(messages[i], { item: items[i], cause: error2, data: data[i] });
      }
      error2.code = leafError.code;
      return error2;
    }
    const compactPath = {
      messages: messages.slice(0, pathLength),
      keywords: keywords2.slice(0, pathLength),
      schemas: schemas.slice(0, pathLength),
      items: items.slice(0, pathLength),
      data: data.slice(0, pathLength)
    };
    const error = getDefinedErrorFunctionForKey(compactPath.keywords[0], compactPath.schemas[0], false)(compactPath.messages[0], {
      item: compactPath.items[0],
      data: compactPath.data[0]
    });
    error.setCompactPath(compactPath, leafError);
    error.code = leafError.code;
    return error;
  }
  validateIterative(root, rootData) {
    const workspaceIndex = this.activeIterativeWorkspaces++;
    let workspace = this.iterativeWorkspaces[workspaceIndex];
    if (!workspace) {
      workspace = {
        schemas: [],
        data: [],
        validatorIndexes: [],
        structuralKinds: [],
        structuralIndexes: [],
        secondaryIndexes: [],
        structuralFlags: [],
        restorePathLengths: [],
        completionKinds: [],
        combinatorValidCounts: [],
        pendingDefaults: [],
        pendingDefaultValues: [],
        stagedDefaults: [],
        structuralKeys: [],
        pathMessages: [],
        pathKeywords: [],
        pathSchemas: [],
        pathItems: [],
        pathData: [],
        defaultMutationTargets: [],
        defaultMutationKeys: []
      };
      this.iterativeWorkspaces[workspaceIndex] = workspace;
    }
    const depthErrorCount = this.depthErrorCount;
    try {
      const result = this.runIterativeValidation(root, rootData, workspace);
      if (this.depthErrorCount !== depthErrorCount) {
        for (let i = workspace.defaultMutationTargets.length - 1;i >= 0; i--) {
          delete workspace.defaultMutationTargets[i][workspace.defaultMutationKeys[i]];
        }
      }
      return result;
    } finally {
      workspace.data.fill(undefined);
      workspace.pendingDefaultValues.fill(undefined);
      workspace.stagedDefaults.fill(undefined);
      workspace.structuralKeys.fill(undefined);
      workspace.pathData.fill(undefined);
      workspace.defaultMutationTargets.fill(undefined);
      workspace.defaultMutationTargets.length = 0;
      workspace.defaultMutationKeys.length = 0;
      this.activeIterativeWorkspaces--;
    }
  }
  runIterativeValidation(root, rootData, workspace) {
    const {
      schemas,
      data,
      validatorIndexes,
      structuralKinds,
      structuralIndexes,
      secondaryIndexes,
      structuralFlags,
      restorePathLengths,
      completionKinds,
      combinatorValidCounts,
      pendingDefaults,
      pendingDefaultValues,
      stagedDefaults,
      structuralKeys,
      pathMessages,
      pathKeywords,
      pathSchemas,
      pathItems,
      pathData,
      defaultMutationTargets,
      defaultMutationKeys
    } = workspace;
    defaultMutationTargets.length = 0;
    defaultMutationKeys.length = 0;
    schemas[0] = root;
    data[0] = rootData;
    validatorIndexes[0] = 0;
    structuralKinds[0] = 0;
    structuralIndexes[0] = 0;
    secondaryIndexes[0] = 0;
    structuralFlags[0] = 0;
    restorePathLengths[0] = 0;
    completionKinds[0] = 0;
    combinatorValidCounts[0] = 0;
    pendingDefaults[0] = undefined;
    pendingDefaultValues[0] = undefined;
    stagedDefaults[0] = undefined;
    structuralKeys[0] = undefined;
    let frameCount = 1;
    let pathLength = 0;
    const wrapPath = (error) => {
      if (error === true || !error) {
        return error;
      }
      return this.wrapIterativeError(error, pathMessages, pathKeywords, pathSchemas, pathItems, pathData, pathLength);
    };
    const descend = (childSchema, childData, completionKind, pathMessage, pathKeyword, pathSchema, pathItem) => {
      if (frameCount > this.maxDepth) {
        childSchema = {
          $validate: () => this.createDepthError(childData)
        };
      }
      const restoreLength = pathLength;
      if (pathMessage) {
        pathMessages[pathLength] = pathMessage;
        pathKeywords[pathLength] = pathKeyword;
        pathSchemas[pathLength] = pathSchema;
        pathItems[pathLength] = pathItem;
        pathData[pathLength] = childData;
        pathLength++;
      }
      schemas[frameCount] = childSchema;
      data[frameCount] = childData;
      validatorIndexes[frameCount] = 0;
      structuralKinds[frameCount] = 0;
      structuralIndexes[frameCount] = 0;
      secondaryIndexes[frameCount] = 0;
      structuralFlags[frameCount] = 0;
      restorePathLengths[frameCount] = restoreLength;
      completionKinds[frameCount] = completionKind;
      combinatorValidCounts[frameCount] = 0;
      pendingDefaults[frameCount] = undefined;
      pendingDefaultValues[frameCount] = undefined;
      stagedDefaults[frameCount] = undefined;
      structuralKeys[frameCount] = undefined;
      frameCount++;
    };
    let completedResult;
    const completeFrame = (initialError) => {
      let error = initialError;
      while (frameCount > 0) {
        const depth = frameCount - 1;
        const completionKind = completionKinds[depth];
        const restoreLength = restorePathLengths[depth];
        data[depth] = undefined;
        pendingDefaultValues[depth] = undefined;
        stagedDefaults[depth] = undefined;
        structuralKeys[depth] = undefined;
        frameCount--;
        if (completionKind === 0) {
          completedResult = wrapPath(error);
          return true;
        }
        const parentDepth = frameCount - 1;
        if (completionKind === 1 || completionKind === 2) {
          if (error) {
            continue;
          }
          for (let i = restoreLength;i < pathLength; i++) {
            pathData[i] = undefined;
          }
          pathLength = restoreLength;
          return false;
        }
        if (completionKind === 3) {
          if (error) {
            error = getDefinedErrorFunctionForKey("allOf", schemas[parentDepth].allOf, this.failFast)("Value is not valid", { cause: error, data: data[parentDepth] });
            continue;
          }
          return false;
        }
        if (completionKind === 4) {
          pathLength = restoreLength;
          if (error) {
            return false;
          }
          structuralKinds[parentDepth] = 0;
          return false;
        }
        if (completionKind === 5) {
          pathLength = restoreLength;
          if (!error) {
            combinatorValidCounts[parentDepth]++;
            if (combinatorValidCounts[parentDepth] > 1) {
              error = getDefinedErrorFunctionForKey("oneOf", schemas[parentDepth].oneOf, this.failFast)("Value is not valid", { data: data[parentDepth] });
              continue;
            }
          }
          return false;
        }
        if (completionKind === 6) {
          const entry = pendingDefaults[parentDepth];
          const defaultValue = pendingDefaultValues[parentDepth];
          pendingDefaults[parentDepth] = undefined;
          pendingDefaultValues[parentDepth] = undefined;
          if (error) {
            pathMessages[pathLength] = "Default property is invalid";
            pathKeywords[pathLength] = "properties";
            pathSchemas[pathLength] = schemas[parentDepth].properties;
            pathItems[pathLength] = entry.key;
            pathData[pathLength] = defaultValue;
            pathLength++;
            continue;
          }
          stagedDefaults[parentDepth].push({ entry, value: defaultValue });
          return false;
        }
        if (completionKind === 7) {
          pathLength = restoreLength;
          if (error) {
            return false;
          }
          structuralKinds[parentDepth] = 0;
          return false;
        }
        if (completionKind === 8) {
          pathLength = restoreLength;
          secondaryIndexes[parentDepth] = error ? 2 : 1;
          return false;
        }
        if (completionKind === 9) {
          pathLength = restoreLength;
          if (error) {
            structuralKinds[parentDepth] = 0;
            return false;
          }
          error = getDefinedErrorFunctionForKey("not", schemas[parentDepth].not, this.failFast)("Value is not valid", { data: data[parentDepth] });
          continue;
        }
      }
      completedResult = wrapPath(error);
      return true;
    };
    const failCurrentFrame = (error) => {
      return completeFrame(error) ? completedResult : null;
    };
    while (frameCount > 0) {
      const depth = frameCount - 1;
      let schema = schemas[depth];
      const value = data[depth];
      const resolved = schema._resolvedSchema;
      if (resolved && resolved !== schema) {
        schemas[depth] = resolved;
        validatorIndexes[depth] = 0;
        structuralKinds[depth] = 0;
        structuralIndexes[depth] = 0;
        secondaryIndexes[depth] = 0;
        structuralFlags[depth] = 0;
        continue;
      }
      if (structuralKinds[depth] === 1) {
        const entries2 = schema._propertyValidationEntries;
        if (!entries2 || !value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        if (secondaryIndexes[depth] === 0) {
          if (structuralIndexes[depth] >= entries2.length) {
            const defaults = stagedDefaults[depth];
            for (let i = 0;i < defaults.length; i++) {
              const { entry: entry3, value: defaultValue } = defaults[i];
              if (entry3.key === "__proto__") {
                Object.defineProperty(value, entry3.key, {
                  value: defaultValue,
                  enumerable: true,
                  configurable: true,
                  writable: true
                });
              } else {
                value[entry3.key] = defaultValue;
              }
              defaultMutationTargets.push(value);
              defaultMutationKeys.push(entry3.key);
            }
            secondaryIndexes[depth] = 1;
            structuralIndexes[depth] = 0;
            continue;
          }
          const entry2 = entries2[structuralIndexes[depth]++];
          if (!Object.prototype.hasOwnProperty.call(value, entry2.key) && entry2.hasDefault) {
            const defaultValue = deepCloneUnfreeze(entry2.schemaProp.default);
            pendingDefaults[depth] = entry2;
            pendingDefaultValues[depth] = defaultValue;
            descend(entry2.schemaProp, defaultValue, 6);
          }
          continue;
        }
        if (structuralIndexes[depth] >= entries2.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const entry = entries2[structuralIndexes[depth]++];
        if (!Object.prototype.hasOwnProperty.call(value, entry.key)) {
          continue;
        }
        if (stagedDefaults[depth].some((item) => item.entry.key === entry.key)) {
          continue;
        }
        if (typeof entry.schemaProp === "boolean") {
          if (entry.schemaProp === false) {
            const error = getDefinedErrorFunctionForKey("properties", schema.properties, this.failFast)("Property is not allowed", {
              item: entry.key,
              data: value[entry.key]
            });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
          continue;
        }
        if (entry.schemaProp && typeof entry.schemaProp.$validate === "function") {
          descend(entry.schemaProp, value[entry.key], 1, "Property is invalid", "properties", schema.properties, entry.key);
        }
        continue;
      }
      if (structuralKinds[depth] === 2) {
        const schemaItems = schema.items;
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        const itemLimit = Array.isArray(schemaItems) ? Math.min(schemaItems.length, value.length) : value.length;
        if (itemIndex >= itemLimit) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemSchema = Array.isArray(schemaItems) ? schemaItems[itemIndex] : schemaItems;
        if (typeof itemSchema === "boolean") {
          if (itemSchema === false && value[itemIndex] !== undefined) {
            const error = getDefinedErrorFunctionForKey("items", schemaItems, this.failFast)("Array item is not allowed", {
              item: itemIndex,
              data: value[itemIndex]
            });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
          continue;
        }
        if (itemSchema && typeof itemSchema.$validate === "function") {
          descend(itemSchema, value[itemIndex], 2, "Array item is invalid", "items", schemaItems, itemIndex);
        }
        continue;
      }
      if (structuralKinds[depth] === 6) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth];
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          continue;
        }
        const patternEntries = schema._patternPropertyEntries;
        let patternMatched = false;
        if (patternEntries) {
          for (let i = 0;i < patternEntries.length; i++) {
            if (patternEntries[i].match(key)) {
              patternMatched = true;
              break;
            }
          }
        }
        if (patternMatched) {
          continue;
        }
        const additionalSchema = schema.additionalProperties;
        if (additionalSchema === false) {
          const error = getDefinedErrorFunctionForKey("additionalProperties", additionalSchema, this.failFast)("Additional properties are not allowed", {
            item: key,
            data: value[key]
          });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (additionalSchema && typeof additionalSchema === "object" && typeof additionalSchema.$validate === "function") {
          descend(additionalSchema, value[key], 1, "Additional properties are invalid", "additionalProperties", additionalSchema, key);
        }
        continue;
      }
      if (structuralKinds[depth] === 7) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth];
        const entries2 = schema._patternPropertyEntries;
        if (!entries2 || entries2.length === 0) {
          structuralKinds[depth] = 0;
          continue;
        }
        let keyIndex = structuralIndexes[depth];
        let entryIndex = secondaryIndexes[depth];
        let descended = false;
        while (keyIndex < keys.length && !descended) {
          const key = keys[keyIndex];
          while (entryIndex < entries2.length) {
            const entry = entries2[entryIndex++];
            if (!entry.match(key)) {
              continue;
            }
            structuralFlags[depth] = 1;
            if (entry.schemaProp === false) {
              const error = getDefinedErrorFunctionForKey("patternProperties", schema.patternProperties, this.failFast)("Property is not allowed", { item: key, data: value[key] });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              descended = true;
              break;
            }
            if (entry.schemaProp && typeof entry.schemaProp.$validate === "function") {
              structuralIndexes[depth] = keyIndex;
              secondaryIndexes[depth] = entryIndex;
              descend(entry.schemaProp, value[key], 1, "Property is invalid", "patternProperties", schema.patternProperties, key);
              descended = true;
              break;
            }
          }
          if (!descended) {
            if (structuralFlags[depth] === 0 && schema.additionalProperties === false && !(schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key))) {
              const error = getDefinedErrorFunctionForKey("patternProperties", schema.patternProperties, this.failFast)("Additional properties are not allowed", {
                item: key,
                data: value[key]
              });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              descended = true;
              break;
            }
            keyIndex++;
            entryIndex = 0;
            structuralFlags[depth] = 0;
          }
        }
        if (!descended) {
          structuralKinds[depth] = 0;
        } else if (frameCount - 1 === depth) {
          structuralIndexes[depth] = keyIndex + 1;
          secondaryIndexes[depth] = 0;
        }
        continue;
      }
      if (structuralKinds[depth] === 8) {
        if (!Array.isArray(value) || !Array.isArray(schema.items)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const additionalSchema = schema.additionalItems;
        if (additionalSchema === false) {
          const error = getDefinedErrorFunctionForKey("additionalItems", additionalSchema, this.failFast)("Array is too long", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (additionalSchema && typeof additionalSchema === "object" && typeof additionalSchema.$validate === "function") {
          descend(additionalSchema, value[itemIndex], 2, "Array item is invalid", "additionalItems", additionalSchema, itemIndex);
        }
        continue;
      }
      if (structuralKinds[depth] === 9) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          const error = getDefinedErrorFunctionForKey("contains", schema.contains, this.failFast)("Array must contain at least one item", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }
        if (schema.contains === true) {
          structuralKinds[depth] = 0;
        } else if (schema.contains !== false) {
          descend(schema.contains, value[itemIndex], 7);
        }
        continue;
      }
      if (structuralKinds[depth] === 10) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth];
        const dependencyIndex = structuralIndexes[depth]++;
        if (dependencyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[dependencyIndex];
        if (!(key in value)) {
          continue;
        }
        const dependency = schema.dependencies[key];
        if (Array.isArray(dependency)) {
          for (let i = 0;i < dependency.length; i++) {
            if (!(dependency[i] in value)) {
              const error = getDefinedErrorFunctionForKey("dependencies", schema.dependencies, this.failFast)("Dependency is not satisfied", {
                item: i,
                data: dependency[i]
              });
              const result = failCurrentFrame(error);
              if (result !== null) {
                return result;
              }
              break;
            }
          }
        } else if (dependency === false) {
          const error = getDefinedErrorFunctionForKey("dependencies", schema.dependencies, this.failFast)("Dependency is not satisfied", { data: dependency });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (dependency && typeof dependency === "object" && typeof dependency.$validate === "function") {
          descend(dependency, value, 1, "Dependency is not satisfied", "dependencies", schema.dependencies, key);
        }
        continue;
      }
      if (structuralKinds[depth] === 11) {
        const state = secondaryIndexes[depth];
        if (state === 0) {
          if (schema.if === true) {
            secondaryIndexes[depth] = 1;
          } else if (schema.if === false) {
            secondaryIndexes[depth] = 2;
          } else {
            descend(schema.if, value, 8);
            continue;
          }
        }
        const branch = secondaryIndexes[depth] === 1 ? schema.then : schema.else;
        structuralKinds[depth] = 0;
        if (branch && typeof branch === "object" && typeof branch.$validate === "function") {
          descend(branch, value, 1);
        }
        continue;
      }
      if (structuralKinds[depth] === 12) {
        structuralKinds[depth] = 0;
        if (schema.not === true) {
          const error = getDefinedErrorFunctionForKey("not", schema.not, this.failFast)("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (schema.not !== false) {
          descend(schema.not, value, 9);
        }
        continue;
      }
      if (structuralKinds[depth] === 13) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth];
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.propertyNames === false) {
          const error = getDefinedErrorFunctionForKey("propertyNames", schema.propertyNames, this.failFast)("Properties are not allowed", { item: key, data: value[key] });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (schema.propertyNames && typeof schema.propertyNames.$validate === "function") {
          descend(schema.propertyNames, key, 1, "Property name is invalid", "propertyNames", schema.propertyNames, key);
        }
        continue;
      }
      if (structuralKinds[depth] === 14) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const keys = structuralKeys[depth];
        const keyIndex = structuralIndexes[depth]++;
        if (keyIndex >= keys.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        const key = keys[keyIndex];
        if (schema.values && typeof schema.values.$validate === "function") {
          descend(schema.values, value[key], 1, "Property is invalid", "values", schema.values, key);
        }
        continue;
      }
      if (structuralKinds[depth] === 15) {
        if (!Array.isArray(value)) {
          structuralKinds[depth] = 0;
          continue;
        }
        const itemIndex = structuralIndexes[depth]++;
        if (itemIndex >= value.length) {
          structuralKinds[depth] = 0;
          continue;
        }
        if (schema.elements && typeof schema.elements.$validate === "function") {
          descend(schema.elements, value[itemIndex], 2, "Array item is invalid", "elements", schema.elements, itemIndex);
        }
        continue;
      }
      if (structuralKinds[depth] === 3 || structuralKinds[depth] === 4 || structuralKinds[depth] === 5) {
        const kind = structuralKinds[depth];
        const keyword = kind === 3 ? "allOf" : kind === 4 ? "anyOf" : "oneOf";
        const branches = schema[`_${keyword}BranchEntries`];
        const branchIndex = structuralIndexes[depth]++;
        if (!branches || branchIndex >= branches.length) {
          if (kind === 3 || kind === 5 && combinatorValidCounts[depth] === 1) {
            structuralKinds[depth] = 0;
            continue;
          }
          const error = getDefinedErrorFunctionForKey(keyword, schema[keyword], this.failFast)("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }
        const branch = branches[branchIndex];
        if (branch.kind === "validate") {
          const branchSchema = schema[keyword][branchIndex];
          descend(branchSchema, value, kind);
          continue;
        }
        const branchValid = branch.kind === "alwaysValid" || branch.kind === "literal" && branch.value === value;
        if (kind === 3 && !branchValid) {
          const error = getDefinedErrorFunctionForKey("allOf", schema.allOf, this.failFast)("Value is not valid", { data: value });
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        } else if (kind === 4 && branchValid) {
          structuralKinds[depth] = 0;
        } else if (kind === 5 && branchValid) {
          combinatorValidCounts[depth]++;
          if (combinatorValidCounts[depth] > 1) {
            const error = getDefinedErrorFunctionForKey("oneOf", schema.oneOf, this.failFast)("Value is not valid", { data: value });
            const result = failCurrentFrame(error);
            if (result !== null) {
              return result;
            }
          }
        }
        continue;
      }
      const entries = schema._iterativeValidatorEntries;
      if (!entries) {
        const validate = schema._recursiveValidate || schema.$validate;
        const error = typeof validate === "function" ? validate(value) : undefined;
        if (error) {
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
          continue;
        }
        validatorIndexes[depth] = Number.MAX_SAFE_INTEGER;
      } else if (validatorIndexes[depth] < entries.length) {
        const entry = entries[validatorIndexes[depth]++];
        if (entry.iterativeKeyword === "properties") {
          structuralKinds[depth] = 1;
          structuralIndexes[depth] = 0;
          secondaryIndexes[depth] = 0;
          stagedDefaults[depth] = [];
          continue;
        }
        if (entry.iterativeKeyword === "items") {
          structuralKinds[depth] = 2;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "allOf") {
          structuralKinds[depth] = 3;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "anyOf") {
          structuralKinds[depth] = 4;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "oneOf") {
          structuralKinds[depth] = 5;
          structuralIndexes[depth] = 0;
          combinatorValidCounts[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "additionalProperties") {
          structuralKinds[depth] = 6;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
          continue;
        }
        if (entry.iterativeKeyword === "patternProperties") {
          structuralKinds[depth] = 7;
          structuralIndexes[depth] = 0;
          secondaryIndexes[depth] = 0;
          structuralFlags[depth] = 0;
          structuralKeys[depth] = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
          continue;
        }
        if (entry.iterativeKeyword === "additionalItems") {
          structuralKinds[depth] = 8;
          structuralIndexes[depth] = Array.isArray(schema.items) ? schema.items.length : 0;
          continue;
        }
        if (entry.iterativeKeyword === "contains") {
          structuralKinds[depth] = 9;
          structuralIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "dependencies") {
          structuralKinds[depth] = 10;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] = Object.keys(schema.dependencies || {});
          continue;
        }
        if (entry.iterativeKeyword === "if") {
          structuralKinds[depth] = 11;
          secondaryIndexes[depth] = 0;
          continue;
        }
        if (entry.iterativeKeyword === "not") {
          structuralKinds[depth] = 12;
          continue;
        }
        if (entry.iterativeKeyword === "propertyNames") {
          structuralKinds[depth] = 13;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
          continue;
        }
        if (entry.iterativeKeyword === "values") {
          structuralKinds[depth] = 14;
          structuralIndexes[depth] = 0;
          structuralKeys[depth] = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
          continue;
        }
        if (entry.iterativeKeyword === "elements") {
          structuralKinds[depth] = 15;
          structuralIndexes[depth] = 0;
          continue;
        }
        const error = entry.validate(value);
        if (error) {
          const result = failCurrentFrame(error);
          if (result !== null) {
            return result;
          }
        }
        continue;
      }
      if (completeFrame(undefined)) {
        return completedResult;
      }
    }
  }
  isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  collectSchemaLocations(root) {
    const locations = new WeakSet;
    const stack = [root];
    const schemaMaps = new Set([
      "definitions",
      "dependencies",
      "patternProperties",
      "properties"
    ]);
    const schemaArrays = new Set(["allOf", "anyOf", "oneOf"]);
    const schemaValues = new Set([
      "additionalItems",
      "additionalProperties",
      "contains",
      "elements",
      "else",
      "if",
      "items",
      "not",
      "propertyNames",
      "then",
      "values"
    ]);
    while (stack.length > 0) {
      const schema = stack.pop();
      if (!this.isPlainObject(schema) || locations.has(schema)) {
        continue;
      }
      locations.add(schema);
      for (const key of Object.keys(schema)) {
        const value = schema[key];
        if (schemaMaps.has(key) && this.isPlainObject(value)) {
          for (const subSchema of Object.values(value)) {
            if (!Array.isArray(subSchema)) {
              stack.push(subSchema);
            }
          }
        } else if (schemaArrays.has(key) && Array.isArray(value)) {
          for (const subSchema of value) {
            stack.push(subSchema);
          }
        } else if (schemaValues.has(key)) {
          if (key === "items" && Array.isArray(value)) {
            for (const subSchema of value) {
              stack.push(subSchema);
            }
          } else {
            stack.push(value);
          }
        }
      }
    }
    return locations;
  }
  isTrivialAlwaysValidSubschema(value) {
    return value === true || this.isPlainObject(value) && Object.keys(value).length === 0;
  }
  shallowArrayEquals(a, b) {
    if (a === b) {
      return true;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0;i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  flattenAssociativeBranches(key, branches) {
    const out = [];
    const pending = branches.slice().reverse();
    while (pending.length > 0) {
      const item = pending.pop();
      if (this.isPlainObject(item) && Object.keys(item).length === 1 && Array.isArray(item[key])) {
        for (let i = item[key].length - 1;i >= 0; i--) {
          pending.push(item[key][i]);
        }
        continue;
      }
      out.push(item);
    }
    return out;
  }
  flattenSingleWrapperOneOf(branches) {
    let current = branches;
    while (current.length === 1) {
      const item = current[0];
      if (this.isPlainObject(item) && Object.keys(item).length === 1 && Array.isArray(item.oneOf)) {
        current = item.oneOf;
        continue;
      }
      break;
    }
    return current;
  }
  normalizeSchemaForCompile(schema) {
    let normalized = schema;
    const schemaKeys = Object.keys(schema);
    const hasOnlyKey = (key) => schemaKeys.length === 1 && schemaKeys[0] === key;
    const setNormalized = (key, value) => {
      if (normalized === schema) {
        normalized = { ...schema };
      }
      normalized[key] = value;
    };
    const deleteNormalized = (key) => {
      if (normalized === schema) {
        normalized = { ...schema };
      }
      delete normalized[key];
    };
    if (Array.isArray(schema.allOf)) {
      let flattenedAllOf = this.flattenAssociativeBranches("allOf", schema.allOf);
      let removedAllOf = false;
      for (let i = 0;i < flattenedAllOf.length; i++) {
        if (flattenedAllOf[i] === false) {
          return { oneOf: [] };
        }
      }
      flattenedAllOf = flattenedAllOf.filter((item) => !this.isTrivialAlwaysValidSubschema(item));
      if (flattenedAllOf.length === 0) {
        if (hasOnlyKey("allOf")) {
          return {};
        }
        deleteNormalized("allOf");
        removedAllOf = true;
      }
      if (!removedAllOf && hasOnlyKey("allOf") && flattenedAllOf.length === 1 && this.isPlainObject(flattenedAllOf[0])) {
        return flattenedAllOf[0];
      }
      if (!removedAllOf && !this.shallowArrayEquals(flattenedAllOf, schema.allOf)) {
        setNormalized("allOf", flattenedAllOf);
      }
    }
    if (Array.isArray(schema.anyOf)) {
      let flattenedAnyOf = this.flattenAssociativeBranches("anyOf", schema.anyOf);
      let removedAnyOf = false;
      for (let i = 0;i < flattenedAnyOf.length; i++) {
        if (this.isTrivialAlwaysValidSubschema(flattenedAnyOf[i])) {
          if (hasOnlyKey("anyOf")) {
            return {};
          }
          deleteNormalized("anyOf");
          removedAnyOf = true;
          flattenedAnyOf = [];
          break;
        }
      }
      if (flattenedAnyOf.length > 0) {
        flattenedAnyOf = flattenedAnyOf.filter((item) => item !== false);
      }
      if (!removedAnyOf && flattenedAnyOf.length === 0 && Array.isArray(normalized.anyOf)) {
        return { oneOf: [] };
      }
      if (!removedAnyOf && hasOnlyKey("anyOf") && flattenedAnyOf.length === 1 && this.isPlainObject(flattenedAnyOf[0])) {
        return flattenedAnyOf[0];
      }
      if (!removedAnyOf && !this.shallowArrayEquals(flattenedAnyOf, schema.anyOf)) {
        setNormalized("anyOf", flattenedAnyOf);
      }
    }
    if (Array.isArray(schema.oneOf)) {
      const flattenedOneOf = this.flattenSingleWrapperOneOf(schema.oneOf);
      let removedOneOf = false;
      if (flattenedOneOf.length === 1) {
        if (this.isTrivialAlwaysValidSubschema(flattenedOneOf[0])) {
          if (hasOnlyKey("oneOf")) {
            return {};
          }
          deleteNormalized("oneOf");
          removedOneOf = true;
        } else if (flattenedOneOf[0] === false) {
          return { oneOf: [] };
        }
      }
      if (!removedOneOf && hasOnlyKey("oneOf") && flattenedOneOf.length === 1 && this.isPlainObject(flattenedOneOf[0])) {
        return flattenedOneOf[0];
      }
      if (!removedOneOf && !this.shallowArrayEquals(flattenedOneOf, schema.oneOf)) {
        setNormalized("oneOf", flattenedOneOf);
      }
    }
    return normalized;
  }
  defineHiddenValue(target, key, value) {
    Object.defineProperty(target, key, {
      value,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  prepareObjectKeywordCaches(schema) {
    if (this.isPlainObject(schema.properties)) {
      const propKeys = Object.keys(schema.properties);
      this.defineHiddenValue(schema, "_propKeys", propKeys);
      const requiredSet = Array.isArray(schema.required) ? new Set(schema.required) : null;
      this.defineHiddenValue(schema, "_requiredSet", requiredSet);
      const propertyValidationEntries = [];
      for (let i = 0;i < propKeys.length; i++) {
        const key = propKeys[i];
        const schemaProp = schema.properties[key];
        const hasDefault = !!requiredSet && requiredSet.has(key) && this.isPlainObject(schemaProp) && "default" in schemaProp;
        if (schemaProp === false) {
          propertyValidationEntries.push({ key, schemaProp, hasDefault: false });
          continue;
        }
        if (schemaProp === true) {
          continue;
        }
        if (this.isPlainObject(schemaProp)) {
          const hasValidate = typeof schemaProp.$validate === "function";
          if (hasValidate || hasDefault) {
            propertyValidationEntries.push({ key, schemaProp, hasDefault });
          }
        }
      }
      this.defineHiddenValue(schema, "_propertyValidationEntries", propertyValidationEntries);
      this.defineHiddenValue(schema, "_hasRequiredDefaults", propertyValidationEntries.some((entry) => entry.hasDefault));
    }
    if ("additionalProperties" in schema) {
      this.defineHiddenValue(schema, "_apValidate", this.isPlainObject(schema.additionalProperties) && typeof schema.additionalProperties.$validate === "function" ? schema.additionalProperties.$validate : null);
    }
    if (this.isPlainObject(schema.patternProperties)) {
      const entries = [];
      for (const key of Object.keys(schema.patternProperties)) {
        const compiledMatcher = compilePatternMatcher(key);
        entries.push({
          schemaProp: schema.patternProperties[key],
          match: compiledMatcher instanceof RegExp ? (value) => compiledMatcher.test(value) : compiledMatcher
        });
      }
      this.defineHiddenValue(schema, "_patternPropertyEntries", entries);
    }
  }
  toCombinatorBranchEntry(item) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      if (typeof item.$validate === "function") {
        return { kind: "validate", validate: item.$validate };
      }
      return { kind: "alwaysValid" };
    }
    if (typeof item === "boolean") {
      return { kind: item ? "alwaysValid" : "alwaysInvalid" };
    }
    return { kind: "literal", value: item };
  }
  prepareCombinatorKeywordCaches(schema) {
    const keys = ["allOf", "anyOf", "oneOf"];
    for (let i = 0;i < keys.length; i++) {
      const key = keys[i];
      const branches = schema[key];
      if (!Array.isArray(branches)) {
        continue;
      }
      const entries = [];
      for (let j = 0;j < branches.length; j++) {
        entries.push(this.toCombinatorBranchEntry(branches[j]));
      }
      this.defineHiddenValue(schema, `_${key}BranchEntries`, entries);
    }
  }
  markSchemaHasRef(schema) {
    if (schema._hasRef === true) {
      return;
    }
    Object.defineProperty(schema, "_hasRef", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  shouldSkipKeyword(schema, key) {
    const value = schema[key];
    switch (key) {
      case "required":
        return Array.isArray(value) && value.length === 0;
      case "uniqueItems":
        return value === false;
      case "properties":
      case "patternProperties":
      case "dependencies":
        return this.isPlainObject(value) && Object.keys(value).length === 0;
      case "propertyNames":
      case "items":
        return value === true;
      case "additionalProperties":
        if (value === true) {
          return true;
        }
        return value === false && this.isPlainObject(schema.patternProperties) && Object.keys(schema.patternProperties).length > 0;
      case "additionalItems":
        return value === true || !Array.isArray(schema.items);
      case "allOf": {
        if (!Array.isArray(value)) {
          return false;
        }
        if (value.length === 0) {
          return true;
        }
        for (let i = 0;i < value.length; i++) {
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
        for (let i = 0;i < value.length; i++) {
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
  hasRequiredDefaults(schema) {
    const properties = schema.properties;
    if (!this.isPlainObject(properties) || !Array.isArray(schema.required)) {
      return false;
    }
    for (let i = 0;i < schema.required.length; i++) {
      const subSchema = properties[schema.required[i]];
      if (this.isPlainObject(subSchema) && "default" in subSchema) {
        return true;
      }
    }
    return false;
  }
  isDefaultTypeValidator(type, validator) {
    return Types[type] === validator;
  }
  compileSchema(schema) {
    const clonedRoot = deepCloneUnfreeze(schema);
    this.schemaLocations = this.collectSchemaLocations(clonedRoot);
    let compiledRoot = null;
    let schemaHasRef = false;
    const seen = new WeakSet;
    const compiledBySource = new WeakMap;
    const pending = [
      {
        schema: clonedRoot,
        assign: (compiled) => {
          compiledRoot = compiled;
        }
      }
    ];
    while (pending.length > 0) {
      const item = pending.pop();
      if (item.schema && typeof item.schema === "object") {
        const existing = compiledBySource.get(item.schema);
        if (existing) {
          item.assign(existing);
          continue;
        }
      }
      const compiled = this.compileSchemaNode(item.schema);
      item.assign(compiled);
      if (item.schema && typeof item.schema === "object") {
        compiledBySource.set(item.schema, compiled);
      }
      if (compiled && typeof compiled === "object") {
        if (seen.has(compiled)) {
          continue;
        }
        seen.add(compiled);
      }
      if ("$ref" in compiled) {
        schemaHasRef = true;
      }
      const literalKeywords = new Set(["enum", "const", "default", "examples"]);
      for (const key of Object.keys(compiled)) {
        if (literalKeywords.has(key)) {
          continue;
        }
        const value = compiled[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          if (key === "properties") {
            for (const subKey of Object.keys(value)) {
              pending.push({
                schema: value[subKey],
                assign: (child) => {
                  value[subKey] = child;
                }
              });
            }
          } else {
            pending.push({
              schema: value,
              assign: (child) => {
                compiled[key] = child;
              }
            });
          }
          continue;
        }
        if (Array.isArray(value)) {
          for (let i = 0;i < value.length; i++) {
            if (this.isSchemaLike(value[i])) {
              pending.push({
                schema: value[i],
                assign: (child) => {
                  value[i] = child;
                }
              });
            }
          }
        }
      }
    }
    if (!compiledRoot) {
      throw new ValidationError("Invalid schema");
    }
    if (schemaHasRef) {
      this.markSchemaHasRef(compiledRoot);
    }
    return compiledRoot;
  }
  compileSchemaNode(schema) {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      if (schema === true) {
        schema = { anyOf: [{}] };
      } else if (schema === false) {
        schema = { oneOf: [] };
      } else {
        schema = { oneOf: [schema] };
      }
    }
    const sourceSchema = schema;
    schema = this.normalizeSchemaForCompile(schema);
    const compiledSchema = schema;
    if (this.schemaLocations.has(sourceSchema) && typeof schema.$id === "string") {
      this.idRegistry.set(schema.$id, compiledSchema);
    }
    if ("$ref" in schema) {
      const refValidator = this.getKeyword("$ref");
      if (refValidator) {
        const defineError = getDefinedErrorFunctionForKey("$ref", schema["$ref"], this.failFast);
        compiledSchema.$validate = getNamedFunction("Validate_Reference", (data) => refValidator(compiledSchema, data, defineError, this));
      }
      this.markSchemaHasRef(compiledSchema);
      return compiledSchema;
    }
    const validators = [];
    const activeNames = [];
    if ("type" in schema) {
      const defineTypeError = getDefinedErrorFunctionForKey("type", schema, this.failFast);
      const types = Array.isArray(schema.type) ? schema.type : schema.type.split(",").map((t) => t.trim());
      const typeFunctions = [];
      const typeNames = [];
      const defaultTypeNames = [];
      let allTypesDefault = true;
      for (const type2 of types) {
        const validator = this.getType(type2);
        if (validator) {
          typeFunctions.push(validator);
          typeNames.push(validator.name);
          if (this.isDefaultTypeValidator(type2, validator)) {
            defaultTypeNames.push(type2);
          } else {
            allTypesDefault = false;
          }
        }
      }
      if (typeFunctions.length === 0) {
        throw getDefinedErrorFunctionForKey("type", schema, this.failFast)("Invalid type for schema", { data: schema.type });
      }
      let combinedTypeValidator;
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
            if (allowsNumber || allowsInteger && Number.isInteger(data)) {
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
          for (let i = 0;i < typeFunctions.length; i++) {
            if (typeFunctions[i](data)) {
              return;
            }
          }
          return defineTypeError("Invalid type", { data });
        };
      }
      const typeValidator = {
        name: typeMethodName,
        keyword: "type",
        validate: getNamedFunction(typeMethodName, combinedTypeValidator)
      };
      validators.push(typeValidator);
      activeNames.push(typeMethodName);
    }
    const { type, $id, $ref, $validate, required, ...otherKeys } = schema;
    const otherKeyOrder = Object.keys(otherKeys);
    const appliesRequiredDefaults = required && this.hasRequiredDefaults(schema) && this.getKeyword("properties") === keywords.properties;
    const keyOrder = required ? appliesRequiredDefaults ? [
      "properties",
      ...otherKeyOrder.filter((key) => key !== "properties"),
      "required"
    ] : ["required", ...otherKeyOrder] : otherKeyOrder;
    for (const key of keyOrder) {
      const keywordFn = this.getKeyword(key);
      if (!keywordFn) {
        continue;
      }
      if (this.shouldSkipKeyword(schema, key)) {
        continue;
      }
      const defineError = getDefinedErrorFunctionForKey(key, schema[key], this.failFast);
      const fnName = keywordFn.name || key;
      const keywordValidator = {
        name: fnName,
        keyword: key,
        iterativeKeyword: keywords[key] === keywordFn ? key : undefined,
        validate: getNamedFunction(fnName, (data) => keywordFn(compiledSchema, data, defineError, this))
      };
      validators.push(keywordValidator);
      activeNames.push(fnName);
    }
    this.defineHiddenValue(compiledSchema, "_iterativeValidatorEntries", validators);
    if (validators.length === 0) {
      return compiledSchema;
    }
    if (validators.length === 1) {
      const v = validators[0];
      compiledSchema.$validate = getNamedFunction(v.name, v.validate);
    } else {
      const compositeName = "Validate_" + activeNames.join("_AND_");
      const masterValidator = (data) => {
        for (let i = 0;i < validators.length; i++) {
          const v = validators[i];
          const error = v.validate(data);
          if (error) {
            return error;
          }
        }
        return;
      };
      compiledSchema.$validate = getNamedFunction(compositeName, masterValidator);
    }
    return compiledSchema;
  }
  isSchemaLike(subSchema) {
    if (subSchema && typeof subSchema === "object" && !Array.isArray(subSchema)) {
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
  linkReferences(root) {
    const stack = [root];
    const seen = new WeakSet;
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) {
        continue;
      }
      seen.add(node);
      if (typeof node.$ref === "string" && typeof node.$validate === "function" && node.$validate.name === "Validate_Reference") {
        const refPath = node.$ref;
        let target = this.getSchemaRef(refPath);
        if (typeof target === "undefined") {
          target = this.getSchemaById(refPath);
        }
        if (typeof target === "boolean") {
          if (target === true) {
            node.$validate = getNamedFunction("Validate_Ref_True", () => {});
          } else {
            const defineError = getDefinedErrorFunctionForKey("$ref", node, this.failFast);
            node.$validate = getNamedFunction("Validate_Ref_False", (_data) => defineError("Value is not valid"));
          }
          continue;
        }
        if (target && typeof target.$validate === "function") {
          this.defineHiddenValue(node, "_resolvedSchema", target);
          node.$validate = target.$validate;
        } else if (typeof target === "undefined") {
          const defineError = getDefinedErrorFunctionForKey("$ref", node, this.failFast);
          node.$validate = getNamedFunction("Validate_Ref_Missing", (_data) => defineError(`Missing reference: ${refPath}`));
        }
      }
      for (const key in node) {
        const value = node[key];
        if (!value)
          continue;
        if (Array.isArray(value)) {
          for (let i = 0;i < value.length; i++) {
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

//# debugId=75C7B63AD39E727F64756E2164756E21
