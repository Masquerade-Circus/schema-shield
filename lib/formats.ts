import { FormatFunction, ValidationError, ValidatorFunction } from "./utils";

const RegExps = {
  "date-time":
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  email:
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?=(?:[0-9a-fA-F]{0,4}:){0,7}[0-9a-fA-F]{0,4}(?![:.\w]))(([0-9a-fA-F]{1,4}:){1,7}|:)((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  hostname: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*$/
};

function notImplementedFormat(data: any) {
  throw new ValidationError(
    `Format "${data}" is not implemented yet. Please open an issue on GitHub.`
  );

  return false;
}

export const Formats: Record<string, FormatFunction> = {
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
