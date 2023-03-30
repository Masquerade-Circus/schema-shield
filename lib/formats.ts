import { FormatFunction } from "./index";
import { ValidationError } from "./utils";
import isMyIpValid from "is-my-ip-valid";

// The datetime 1990-02-31T15:59:60.123-08:00 must be rejected.
const RegExps = {
  time: /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/,
  hostname:
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})*[a-zA-Z0-9]$/,
  date: /^(\d{4})-(\d{2})-(\d{2})$/,
  "json-pointer": /^\/(?:[^~]|~0|~1)*$/,
  "relative-json-pointer": /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/
};

const daysInMonth = [31, , 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const Formats: Record<string, FormatFunction | false> = {
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

    const maxDays =
      month === 2
        ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
          ? 29
          : 28
        : daysInMonth[month - 1];

    if (day > maxDays) {
      return false;
    }

    // Leap seconds
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
  ipv4: isMyIpValid({ version: 4 }),
  ipv6: isMyIpValid({ version: 6 }),

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
