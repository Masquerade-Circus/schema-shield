import { FormatFunction } from "./index";

// Regex helpers
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 Duration (P3Y6M4DT12H30M5S)
const DURATION_REGEX =
  /^P(?!$)((\d+Y)?(\d+M)?(\d+W)?(\d+D)?)(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
const URI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.$)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i;
const HOSTNAME_REGEX =
  /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*[a-z0-9]$/i;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_REGEX =
  /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;
const URI_REFERENCE_REGEX =
  /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
const IRI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
const IRI_REFERENCE_REGEX =
  /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
const IDN_EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const IDN_HOSTNAME_REGEX = /^[^\s!@#$%^&*()_+\=\[\]{};':"\\|,<>\/?]+$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDigitCharCode(code: number) {
  return code >= 48 && code <= 57;
}

function parseTwoDigits(data: string, index: number) {
  const first = data.charCodeAt(index) - 48;
  const second = data.charCodeAt(index + 1) - 48;

  if (first < 0 || first > 9 || second < 0 || second > 9) {
    return -1;
  }

  return first * 10 + second;
}

function parseFourDigits(data: string, index: number) {
  const a = data.charCodeAt(index) - 48;
  const b = data.charCodeAt(index + 1) - 48;
  const c = data.charCodeAt(index + 2) - 48;
  const d = data.charCodeAt(index + 3) - 48;

  if (
    a < 0 ||
    a > 9 ||
    b < 0 ||
    b > 9 ||
    c < 0 ||
    c > 9 ||
    d < 0 ||
    d > 9
  ) {
    return -1;
  }

  return a * 1000 + b * 100 + c * 10 + d;
}

function isValidIpv4Range(data: string, start: number, end: number) {
  let segmentCount = 0;
  let segmentStart = start;

  for (let i = start; i <= end; i++) {
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
    for (let j = segmentStart; j < i; j++) {
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

function isValidIpv4(data: string) {
  return isValidIpv4Range(data, 0, data.length);
}

function isHexCharCode(code: number) {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 70) ||
    (code >= 97 && code <= 102)
  );
}

function isValidIpv6(data: string) {
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

function isValidJsonPointer(data: string) {
  if (data === "") {
    return true;
  }

  if (data.charCodeAt(0) !== 47) {
    return false;
  }

  for (let i = 1; i < data.length; i++) {
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

function isValidRelativeJsonPointer(data: string) {
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

  for (i = i + 1; i < data.length; i++) {
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

function isValidUriTemplate(data: string) {
  for (let i = 0; i < data.length; i++) {
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

export const Formats: Record<string, FormatFunction | false> = {
  ["date-time"](data) {
    const length = data.length;
    if (length < 19) {
      return false;
    }

    if (
      data.charCodeAt(4) !== 45 ||
      data.charCodeAt(7) !== 45 ||
      data.charCodeAt(13) !== 58 ||
      data.charCodeAt(16) !== 58
    ) {
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

    if (
      year < 0 ||
      month < 0 ||
      day < 0 ||
      hour < 0 ||
      minute < 0 ||
      second < 0
    ) {
      return false;
    }

    if (hour > 23 || minute > 59 || second > 60) {
      return false;
    }

    let cursor = 19;
    let offsetSign: "+" | "-" | null = null;
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

        if (
          offsetHour < 0 ||
          offsetMinute < 0 ||
          offsetHour > 23 ||
          offsetMinute > 59
        ) {
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

    if (second === 60) {
      let utcTotalMinutes = hour * 60 + minute;

      if (offsetSign) {
        const offsetTotalMinutes = offsetHour * 60 + offsetMinute;
        utcTotalMinutes +=
          offsetSign === "+" ? -offsetTotalMinutes : offsetTotalMinutes;
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

  // IRI is like URI but allows Unicode. We reuse a permissive logic.
  iri(data) {
    return IRI_REGEX.test(data);
  },

  "iri-reference"(data) {
    if (data.includes("\\")) {
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
