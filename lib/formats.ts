import isMyIpValid from 'is-my-ip-valid';
import { FormatFunction } from './index';
import { ValidationError } from './utils';

// The datetime 1990-02-31T15:59:60.123-08:00 must be rejected.
const RegExps = {
  'date-time': /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  time: /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  email:
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  hostname: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*[a-zA-Z0-9]$/,
  date: /^(\d{4})-(\d{2})-(\d{2})$/,
  'json-pointer': /^\/(?:[^~]|~0|~1)*$/,
  'relative-json-pointer': /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/,
};

export const Formats: Record<string, FormatFunction | false> = {
  ['date-time'](data) {
    const upperCaseData = data.toUpperCase();
    if (!RegExps['date-time'].test(upperCaseData)) {
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

    const [local, domain] = data.split('@');

    if (local.length > 64 || local.indexOf('..') !== -1 || local[0] === '.' || local[local.length - 1] === '.') {
      return false;
    }

    if (domain.length > 255 || domain.indexOf('..') !== -1 || domain[0] === '.' || domain[domain.length - 1] === '.') {
      return false;
    }

    return true;
  },
  ipv4: isMyIpValid({ version: 4 }),
  ipv6: isMyIpValid({ version: 6 }),

  hostname(data) {
    return RegExps.hostname.test(data);
  },
  date(data) {
    if (typeof data !== 'string') {
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
  'json-pointer'(data) {
    if (data === '') {
      return true;
    }

    return RegExps['json-pointer'].test(data);
  },
  'relative-json-pointer'(data) {
    if (data === '') {
      return true;
    }

    return RegExps['relative-json-pointer'].test(data);
  },
  time(data) {
    return RegExps.time.test(data);
  },

  // Not supported yet
  duration: false,
  'idn-email': false,
  'idn-hostname': false,
  uuid: false,
  'uri-reference': false,
  iri: false,
  'iri-reference': false,
  'uri-template': false,
};
