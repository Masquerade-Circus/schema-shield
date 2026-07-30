import { FormatFunction } from "./index";

// Regex helpers
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURATION_REGEX =
  /^P(?!$)((\d+Y)?(\d+M)?(\d+W)?(\d+D)?)(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
const URI_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.$)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i;
const URI_REFERENCE_REGEX =
  /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i;
const IRI_REGEX = URI_REGEX;
const IRI_REFERENCE_REGEX = URI_REFERENCE_REGEX;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const VIRAMA_END_REGEX =
  /[\u094d\u09cd\u0a4d\u0acd\u0b4d\u0bcd\u0c4d\u0ccd\u0d4d\u0dca\u0e3a\u0f84\u1039\u1714\u1734\u17d2\u1a60\u1b44\ua806\ua8c4\ua953\ua9c0\uaaf6\uabed]$/u;

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

function hasOnlyUriCharacters(data: string, allowUnicode: boolean) {
  for (let index = 0; index < data.length; index++) {
    const code = data.charCodeAt(index);
    if (code <= 32 || code === 127 || code === 92) {
      return false;
    }
    if (!allowUnicode && code > 127) {
      return false;
    }
    if (
      code === 34 ||
      code === 60 ||
      code === 62 ||
      code === 94 ||
      code === 96 ||
      code === 123 ||
      code === 124 ||
      code === 125
    ) {
      return false;
    }
    if (code === 37) {
      if (
        index + 2 >= data.length ||
        !isHexCharCode(data.charCodeAt(index + 1)) ||
        !isHexCharCode(data.charCodeAt(index + 2))
      ) {
        return false;
      }
      index += 2;
    }
  }
  return true;
}

function hasValidAuthority(data: string, schemeEnd: number) {
  if (
    data.charCodeAt(schemeEnd) !== 47 ||
    data.charCodeAt(schemeEnd + 1) !== 47
  ) {
    return true;
  }
  const authorityStart = schemeEnd + 2;
  let authorityEnd = data.length;
  let at = -1;
  for (let index = authorityStart; index < data.length; index++) {
    const code = data.charCodeAt(index);
    if (code === 47 || code === 63 || code === 35) {
      authorityEnd = index;
      break;
    }
    if (code === 64) {
      at = index;
    }
  }
  if (at !== -1) {
    for (let index = authorityStart; index < at; index++) {
      const code = data.charCodeAt(index);
      if (code === 91 || code === 93) {
        return false;
      }
    }
  }
  const hostStart = at === -1 ? authorityStart : at + 1;
  if (data.charCodeAt(hostStart) === 91) {
    let close = -1;
    for (let index = hostStart + 1; index < authorityEnd; index++) {
      if (data.charCodeAt(index) === 93) {
        close = index;
        break;
      }
    }
    if (close === -1) {
      return false;
    }
    if (close + 1 === authorityEnd) {
      return true;
    }
    if (data.charCodeAt(close + 1) !== 58) {
      return false;
    }
    for (let index = close + 2; index < authorityEnd; index++) {
      if (!isDigitCharCode(data.charCodeAt(index))) {
        return false;
      }
    }
    return true;
  }
  let colon = -1;
  for (let index = hostStart; index < authorityEnd; index++) {
    const code = data.charCodeAt(index);
    if (code === 91 || code === 93) {
      return false;
    }
    if (code === 58) {
      if (colon !== -1) {
        return false;
      }
      colon = index;
    }
  }
  for (let index = colon + 1; colon !== -1 && index < authorityEnd; index++) {
    if (!isDigitCharCode(data.charCodeAt(index))) {
      return false;
    }
  }
  return true;
}

function isValidTime(data: string) {
  if (
    data.length < 9 ||
    data.charCodeAt(2) !== 58 ||
    data.charCodeAt(5) !== 58
  ) {
    return false;
  }
  const hour = parseTwoDigits(data, 0);
  const minute = parseTwoDigits(data, 3);
  const second = parseTwoDigits(data, 6);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 60) {
    return false;
  }

  let cursor = 8;
  if (data.charCodeAt(cursor) === 46) {
    cursor++;
    const fractionStart = cursor;
    while (cursor < data.length && isDigitCharCode(data.charCodeAt(cursor))) {
      cursor++;
    }
    if (cursor === fractionStart) {
      return false;
    }
  }

  let offsetMinutes = 0;
  const zone = data.charCodeAt(cursor);
  if (zone === 90 || zone === 122) {
    cursor++;
  } else if (zone === 43 || zone === 45) {
    if (cursor + 6 !== data.length || data.charCodeAt(cursor + 3) !== 58) {
      return false;
    }
    const offsetHour = parseTwoDigits(data, cursor + 1);
    const offsetMinute = parseTwoDigits(data, cursor + 4);
    if (offsetHour < 0 || offsetHour > 23 || offsetMinute < 0 || offsetMinute > 59) {
      return false;
    }
    offsetMinutes = offsetHour * 60 + offsetMinute;
    if (zone === 43) {
      offsetMinutes = -offsetMinutes;
    }
    cursor += 6;
  } else {
    return false;
  }

  if (cursor !== data.length) {
    return false;
  }
  if (second !== 60) {
    return true;
  }
  let utcMinutes = (hour * 60 + minute + offsetMinutes) % (24 * 60);
  if (utcMinutes < 0) {
    utcMinutes += 24 * 60;
  }
  return utcMinutes === 23 * 60 + 59;
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
    return false;
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

  if (i > 1 && data.charCodeAt(0) === 48) {
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

function isValidAsciiHostnameSyntax(data: string) {
  if (data.length === 0 || data.length > 253 || data.endsWith(".")) {
    return false;
  }

  let labelLength = 0;
  for (let index = 0; index < data.length; index++) {
    const code = data.charCodeAt(index);
    if (code === 46) {
      if (
        labelLength === 0 ||
        labelLength > 63 ||
        data.charCodeAt(index - 1) === 45
      ) {
        return false;
      }
      labelLength = 0;
      continue;
    }
    const alphanumeric =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122);
    if (!alphanumeric && code !== 45) {
      return false;
    }
    if (labelLength === 0 && code === 45) {
      return false;
    }
    labelLength++;
  }

  return (
    labelLength > 0 &&
    labelLength <= 63 &&
    data.charCodeAt(data.length - 1) !== 45
  );
}

function decodePunycodeDigit(code: number) {
  if (code >= 48 && code <= 57) {
    return code - 22;
  }
  if (code >= 65 && code <= 90) {
    return code - 65;
  }
  if (code >= 97 && code <= 122) {
    return code - 97;
  }
  return -1;
}

function adaptPunycodeBias(delta: number, points: number, first: boolean) {
  delta = first ? Math.floor(delta / 700) : delta >> 1;
  delta += Math.floor(delta / points);
  let k = 0;
  while (delta > 455) {
    delta = Math.floor(delta / 35);
    k += 36;
  }
  return k + Math.floor((36 * delta) / (delta + 38));
}

function decodePunycode(label: string) {
  const input = label.slice(4).toLowerCase();
  const output: number[] = [];
  const delimiter = input.lastIndexOf("-");
  let cursor = 0;

  if (delimiter !== -1) {
    for (let index = 0; index < delimiter; index++) {
      const code = input.charCodeAt(index);
      if (code > 127) {
        return null;
      }
      output.push(code);
    }
    cursor = delimiter + 1;
  }

  let codePoint = 128;
  let insertion = 0;
  let bias = 72;
  while (cursor < input.length) {
    const previousInsertion = insertion;
    let weight = 1;
    for (let k = 36; ; k += 36) {
      if (cursor >= input.length) {
        return null;
      }
      const digit = decodePunycodeDigit(input.charCodeAt(cursor++));
      if (digit < 0 || digit > Math.floor((0x7fffffff - insertion) / weight)) {
        return null;
      }
      insertion += digit * weight;
      const threshold = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < threshold) {
        break;
      }
      const multiplier = 36 - threshold;
      if (weight > Math.floor(0x7fffffff / multiplier)) {
        return null;
      }
      weight *= multiplier;
    }

    const pointCount = output.length + 1;
    bias = adaptPunycodeBias(
      insertion - previousInsertion,
      pointCount,
      previousInsertion === 0
    );
    const increment = Math.floor(insertion / pointCount);
    if (increment > 0x10ffff - codePoint) {
      return null;
    }
    codePoint += increment;
    insertion %= pointCount;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return null;
    }
    output.splice(insertion, 0, codePoint);
    insertion++;
  }

  try {
    return String.fromCodePoint(...output);
  } catch (_error) {
    return null;
  }
}

function hasValidIdnaContext(label: string) {
  if (/^[\p{M}]/u.test(label)) {
    return false;
  }
  if (/[\u0640\u07fa\u302e\u302f\u3031-\u3035\u303b]/u.test(label)) {
    return false;
  }
  if (
    !/^[\p{L}\p{M}\p{Nd}\-\u00b7\u0375\u05f3\u05f4\u06fd\u06fe\u0f0b\u200c\u200d\u3007\u30fb]+$/u.test(
      label
    )
  ) {
    return false;
  }

  for (let index = 0; index < label.length; index++) {
    const character = label[index];
    if (
      character === "·" &&
      (label[index - 1] !== "l" || label[index + 1] !== "l")
    ) {
      return false;
    }
    if (
      character === "͵" &&
      !/^\p{Script=Greek}$/u.test(label[index + 1] || "")
    ) {
      return false;
    }
    if (
      (character === "׳" || character === "״") &&
      !/^\p{Script=Hebrew}$/u.test(label[index - 1] || "")
    ) {
      return false;
    }
    if (
      character === "・" &&
      !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(
        label
      )
    ) {
      return false;
    }
    if (
      character === "‍" &&
      !VIRAMA_END_REGEX.test(label.slice(0, index))
    ) {
      return false;
    }
    if (
      character === "‌" &&
      !VIRAMA_END_REGEX.test(label.slice(0, index)) &&
      !/^\p{Script=Arabic}$/u.test(label[index - 1] || "") &&
      !/^\p{Script=Arabic}$/u.test(label[index + 1] || "")
    ) {
      return false;
    }
  }

  return !(/[\u0660-\u0669]/u.test(label) && /[\u06f0-\u06f9]/u.test(label));
}

function toAsciiHostname(data: string) {
  try {
    return new URL(`http://${data}/`).hostname.toLowerCase();
  } catch (_error) {
    return null;
  }
}

function decodeIdnaLabel(label: string) {
  const normalized = label.normalize("NFC");
  if (!/^xn--/i.test(normalized)) {
    return normalized;
  }

  const decoded = decodePunycode(normalized);
  if (
    decoded === null ||
    !/[^\x00-\x7f]/u.test(decoded) ||
    toAsciiHostname(decoded) !== normalized.toLowerCase()
  ) {
    return null;
  }
  return decoded.normalize("NFC");
}

function hasRtlCharacter(label: string) {
  return [...label].some(isRtlCharacter);
}

function isRtlCharacter(character: string) {
  return (
    /^[\p{Script=Arabic}\p{Script=Hebrew}]$/u.test(character) &&
    !/^[\p{Nd}\p{M}]$/u.test(character)
  );
}

function hasValidIdnaBidi(labels: string[]) {
  if (!labels.some(hasRtlCharacter)) {
    return true;
  }

  for (const label of labels) {
    const characters = [...label];
    const significant = characters.filter(
      (character) => !/^\p{M}$/u.test(character)
    );
    const first = significant[0] || "";
    const last = significant[significant.length - 1] || "";
    if (hasRtlCharacter(label)) {
      if (
        !isRtlCharacter(first) ||
        characters.some(
          (character) => /^\p{L}$/u.test(character) && !isRtlCharacter(character)
        ) ||
        !(isRtlCharacter(last) || /^[0-9\u0660-\u06f9]$/u.test(last)) ||
        (/[0-9]/u.test(label) && /[\u0660-\u0669]/u.test(label))
      ) {
        return false;
      }
    } else if (
      !/^\p{L}$/u.test(first) ||
      !(/^\p{L}$/u.test(last) || /^[0-9\u06f0-\u06f9]$/u.test(last))
    ) {
      return false;
    }
  }

  return true;
}

function validatedIdnaLabels(labels: string[]) {
  const decoded: string[] = [];
  for (const label of labels) {
    const value = decodeIdnaLabel(label);
    if (
      value === null ||
      value.startsWith("-") ||
      value.endsWith("-") ||
      (/[^\x00-\x7f]/u.test(value) && value[2] === "-" && value[3] === "-") ||
      !hasValidIdnaContext(value.toLowerCase())
    ) {
      return null;
    }
    decoded.push(value);
  }
  return hasValidIdnaBidi(decoded) ? decoded : null;
}

function isValidHostname(data: string) {
  if (!isValidAsciiHostnameSyntax(data)) {
    return false;
  }
  if (!/xn--/i.test(data)) {
    return true;
  }
  return validatedIdnaLabels(data.split(".")) !== null;
}

function isValidIdnHostname(data: string) {
  if (
    data.length === 0 ||
    /[.\u3002\uff0e\uff61]$/u.test(data)
  ) {
    return false;
  }

  const labels = data.split(/[.\u3002\uff0e\uff61]/u);
  if (labels.some((label) => label.length === 0)) {
    return false;
  }
  if (validatedIdnaLabels(labels) === null) {
    return false;
  }

  const ascii = toAsciiHostname(data);
  if (ascii === null || !isValidAsciiHostnameSyntax(ascii)) {
    return false;
  }

  const asciiLabels = (
    ascii.endsWith(".") ? ascii.slice(0, -1) : ascii
  ).split(".");
  for (let index = 0; index < labels.length; index++) {
    if (
      /^xn--/i.test(labels[index]) &&
      asciiLabels[index] !== labels[index].toLowerCase()
    ) {
      return false;
    }
  }

  return true;
}

function utf8ByteLength(data: string) {
  let bytes = 0;
  for (let index = 0; index < data.length; index++) {
    const code = data.charCodeAt(index);
    if (code <= 0x7f) {
      bytes++;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = data.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return -1;
      }
      bytes += 4;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return -1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function isValidInternationalLocalPart(local: string) {
  const byteLength = utf8ByteLength(local);
  if (byteLength < 1 || byteLength > 64) {
    return false;
  }

  if (local.startsWith('"') || local.endsWith('"')) {
    if (!(local.startsWith('"') && local.endsWith('"')) || local.length < 2) {
      return false;
    }
    for (let index = 1; index < local.length - 1; index++) {
      const character = local[index];
      const code = local.charCodeAt(index);
      if (character === "\\") {
        index++;
        if (index >= local.length - 1) {
          return false;
        }
        const escapedCode = local.charCodeAt(index);
        if (escapedCode < 32 || escapedCode > 126) {
          return false;
        }
        continue;
      }
      if (
        character === '"' ||
        code < 32 ||
        code === 127 ||
        (code > 127 && /[\p{C}\p{Z}]/u.test(character))
      ) {
        return false;
      }
    }
    return true;
  }

  const atoms = local.split(".");
  if (atoms.some((atom) => atom.length === 0)) {
    return false;
  }
  for (const atom of atoms) {
    for (const character of atom) {
      if (/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]$/.test(character)) {
        continue;
      }
      if (character.charCodeAt(0) <= 127 || /[\p{C}\p{Z}]/u.test(character)) {
        return false;
      }
    }
  }
  return true;
}

function isValidIdnEmail(data: string) {
  if (utf8ByteLength(data) > 254) {
    return false;
  }
  const at = data.lastIndexOf("@");
  if (at < 1 || at === data.length - 1) {
    return false;
  }

  const local = data.slice(0, at);
  const domain = data.slice(at + 1);
  if (!isValidInternationalLocalPart(local)) {
    return false;
  }
  if (!local.startsWith('"') && local.includes("@")) {
    return false;
  }
  if (domain.startsWith("[") && domain.endsWith("]")) {
    const literal = domain.slice(1, -1);
    return literal.startsWith("IPv6:")
      ? isValidIpv6(literal.slice(5))
      : isValidIpv4(literal);
  }
  return isValidIdnHostname(domain);
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
    const scheme = data.indexOf(":") + 1;
    return (
      URI_REGEX.test(data) &&
      hasOnlyUriCharacters(data, false) &&
      hasValidAuthority(data, scheme)
    );
  },
  email(data) {
    if (EMAIL_REGEX.test(data)) {
      return true;
    }
    const at = data.lastIndexOf("@");
    if (at < 1 || at === data.length - 1) {
      return false;
    }
    const local = data.slice(0, at);
    const domain = data.slice(at + 1);
    const quotedLocal =
      local.length >= 2 &&
      local.startsWith('"') &&
      local.endsWith('"') &&
      !/[\r\n]/.test(local.slice(1, -1));
    if (!quotedLocal && !EMAIL_REGEX.test(`${local}@example.com`)) {
      return false;
    }
    if (quotedLocal && EMAIL_REGEX.test(`x@${domain}`)) {
      return true;
    }
    if (!domain.startsWith("[") || !domain.endsWith("]")) {
      return false;
    }
    const literal = domain.slice(1, -1);
    return literal.startsWith("IPv6:")
      ? isValidIpv6(literal.slice(5))
      : isValidIpv4(literal);
  },
  ipv4(data) {
    return isValidIpv4(data);
  },

  ipv6(data) {
    return isValidIpv6(data);
  },

  hostname(data) {
    return isValidHostname(data);
  },
  date(data) {
    if (
      data.length !== 10 ||
      data.charCodeAt(4) !== 45 ||
      data.charCodeAt(7) !== 45
    ) {
      return false;
    }

    const year = parseFourDigits(data, 0);
    const month = parseTwoDigits(data, 5);
    const day = parseTwoDigits(data, 8);

    if (year < 0 || month < 1 || month > 12) {
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
      new RegExp(data, "u");
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
    return isValidTime(data);
  },
  "uri-reference"(data) {
    if (!hasOnlyUriCharacters(data, false)) {
      return false;
    }
    const colon = data.indexOf(":");
    const schemeEnd =
      colon !== -1 && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(data.slice(0, colon))
        ? colon + 1
        : 0;
    return URI_REFERENCE_REGEX.test(data) && hasValidAuthority(data, schemeEnd);
  },

  "uri-template"(data) {
    return isValidUriTemplate(data);
  },

  duration(data) {
    if (!DURATION_REGEX.test(data)) {
      return false;
    }
    const timeStart = data.indexOf("T");
    const datePart = timeStart === -1 ? data : data.slice(0, timeStart);
    const timePart = timeStart === -1 ? "" : data.slice(timeStart + 1);
    if (data.includes("W")) {
      return /^P\d+W$/.test(data);
    }
    if (datePart.includes("Y") && datePart.includes("D") && !datePart.includes("M")) {
      return false;
    }
    if (timePart.includes("H") && timePart.includes("S") && !timePart.includes("M")) {
      return false;
    }
    return true;
  },

  uuid(data) {
    return UUID_REGEX.test(data);
  },

  // IRI is like URI but allows Unicode. We reuse a permissive logic.
  iri(data) {
    const scheme = data.indexOf(":") + 1;
    return (
      IRI_REGEX.test(data) &&
      hasOnlyUriCharacters(data, true) &&
      hasValidAuthority(data, scheme)
    );
  },

  "iri-reference"(data) {
    if (!hasOnlyUriCharacters(data, true)) {
      return false;
    }
    const colon = data.indexOf(":");
    const schemeEnd =
      colon !== -1 && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(data.slice(0, colon))
        ? colon + 1
        : 0;
    return IRI_REFERENCE_REGEX.test(data) && hasValidAuthority(data, schemeEnd);
  },

  "idn-email"(data) {
    return isValidIdnEmail(data);
  },

  "idn-hostname"(data) {
    return isValidIdnHostname(data);
  }
};
