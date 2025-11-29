import { FormatFunction } from "./index";

// Regex helpers
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 Duration (P3Y6M4DT12H30M5S)
const DURATION_REGEX =
  /^P(?!$)((\d+Y)?(\d+M)?(\d+W)?(\d+D)?)(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
const DATE_TIME_REGEX =
  /^(\d{4})-(0[0-9]|1[0-2])-(\d{2})T(0[0-9]|1\d|2[0-3]):([0-5]\d):((?:[0-5]\d|60))(?:.\d+)?(?:([+-])(0[0-9]|1\d|2[0-3]):([0-5]\d)|Z)?$/i;
const URI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.$)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i;
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])$/;
const IPV6_REGEX = /(?:\s+|:::+|^\w{5,}|\w{5}$|^:{1}\w|\w:{1}$)/;
const IPV6_SHORT_REGEX = /^[0-9a-fA-F:.]*$/;
const IPV6_FULL_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}(?:[0-9a-fA-F]{1,4}|:))$/;
const IPV6_INVALID_CHAR_REGEX = /(?:[0-9a-fA-F]{5,}|\D[0-9a-fA-F]{3}:)/;
const IPV6_FAST_FAIL_REGEX =
  /^(?:(?:(?:[0-9a-fA-F]{1,4}(?::|$)){1,6}))|(?:::(?:[0-9a-fA-F]{1,4})){0,5}$/;
const HOSTNAME_REGEX =
  /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*[a-z0-9]$/i;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const JSON_POINTER_REGEX = /^\/(?:[^~]|~0|~1)*$/;
const RELATIVE_JSON_POINTER_REGEX = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
const TIME_REGEX =
  /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;
const URI_REFERENCE_REGEX =
  /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
const URI_TEMPLATE_REGEX = /^(?:[^{}]|\{[^}]+\})*$/;
const IRI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
const IRI_REFERENCE_REGEX =
  /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
const IDN_EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const IDN_HOSTNAME_REGEX = /^[^\s!@#$%^&*()_+\=\[\]{};':"\\|,<>\/?]+$/;
const BACK_SLASH_REGEX = /\\/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const Formats: Record<string, FormatFunction | false> = {
  ["date-time"](data) {
    const match = data.match(DATE_TIME_REGEX);
    if (!match) {
      return false;
    }

    const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;

    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr);

    // Mes 1–12
    if (month < 1 || month > 12) {
      return false;
    }
    // Día >= 1
    if (day < 1) {
      return false;
    }

    const maxDays =
      month === 2
        ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
          ? 29
          : 28
        : DAYS_IN_MONTH[month - 1];

    if (!maxDays || day > maxDays) {
      return false;
    }

    // Leap seconds (si quieres seguir permitiendo 60)
    if (second === 60 && (minute !== 59 || hour !== 23)) {
      return false;
    }

    return true;
  },
  uri(data) {
    return URI_REGEX.test(data);
  },
  email(data) {
    return EMAIL_REGEX.test(data);
  },
  ipv4(data) {
    // Matches a string formed by 4 numbers between 0 and 255 separated by dots without leading zeros
    return IPV4_REGEX.test(data);
  },

  // ipv6: isMyIpValid({ version: 6 }),
  ipv6(data) {
    if (data === "::") {
      return true;
    }

    if (data.indexOf(":") === -1 || IPV6_REGEX.test(data)) {
      return false;
    }

    const hasIpv4 = data.indexOf(".") !== -1;
    let addressParts = data;

    if (hasIpv4) {
      addressParts = data.split(":");
      const ipv4Part = addressParts.pop();
      if (!IPV4_REGEX.test(ipv4Part)) {
        return false;
      }
    }

    const isShortened = data.indexOf("::") !== -1;
    const ipv6Part = hasIpv4 ? addressParts.join(":") : data;

    if (isShortened) {
      if (ipv6Part.split("::").length - 1 > 1) {
        return false;
      }

      if (!IPV6_SHORT_REGEX.test(ipv6Part)) {
        return false;
      }

      return IPV6_FAST_FAIL_REGEX.test(ipv6Part);
    }

    const isIpv6Valid = IPV6_FULL_REGEX.test(ipv6Part);
    const hasInvalidChar = IPV6_INVALID_CHAR_REGEX.test(ipv6Part);

    if (hasIpv4) {
      return isIpv6Valid || !hasInvalidChar;
    }

    return isIpv6Valid && !hasInvalidChar;
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

    const maxDays =
      month === 2
        ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
          ? 29
          : 28
        : DAYS_IN_MONTH[month - 1];

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
    if (data === "") {
      return true;
    }

    return JSON_POINTER_REGEX.test(data);
  },
  "relative-json-pointer"(data) {
    if (data === "") {
      return true;
    }

    return RELATIVE_JSON_POINTER_REGEX.test(data);
  },
  time(data) {
    return TIME_REGEX.test(data);
  },
  "uri-reference"(data) {
    if (BACK_SLASH_REGEX.test(data)) {
      return false;
    }

    return URI_REFERENCE_REGEX.test(data);
  },

  "uri-template"(data) {
    return URI_TEMPLATE_REGEX.test(data);
  },

  duration(data) {
    return DURATION_REGEX.test(data);
  },

  uuid(data) {
    return UUID_REGEX.test(data);
  },

  // IRI is like URI but allows Unicode. We reuse a permissive logic.
  iri(data) {
    return IRI_REGEX.test(data);
  },

  "iri-reference"(data) {
    if (BACK_SLASH_REGEX.test(data)) {
      return false;
    }
    return IRI_REFERENCE_REGEX.test(data);
  },

  // Best-effort structural validation for IDN (no punycode/tables)
  "idn-email"(data) {
    return IDN_EMAIL_REGEX.test(data);
  },

  "idn-hostname"(data) {
    // Allows unicode, forbids spaces and typical invalid URL chars
    return IDN_HOSTNAME_REGEX.test(data);
  }
};
