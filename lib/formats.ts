import { FormatFunction } from "./index";

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

    const daysInMonth = [31, , 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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
    return /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/.test(data);
  },
  email(data) {
    return /^(?!\.)(?!.*\.$)[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i.test(
      data
    );
  },
  ipv4(data) {
    // Matches a string formed by 4 numbers between 0 and 255 separated by dots without leading zeros
    // /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])$/
    return /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])$/.test(
      data
    );
  },

  // ipv6: isMyIpValid({ version: 6 }),
  ipv6(data) {
    if (data === "::") {
      return true;
    }

    if (
      data.indexOf(":") === -1 ||
      /(?:\s+|:::+|^\w{5,}|\w{5}$|^:{1}\w|\w:{1}$)/.test(data)
    ) {
      return false;
    }

    const hasIpv4 = data.indexOf(".") !== -1;
    let addressParts = data;

    if (hasIpv4) {
      addressParts = data.split(":");
      const ipv4Part = addressParts.pop();
      if (
        !/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])$/.test(
          ipv4Part
        )
      ) {
        return false;
      }
    }

    const isShortened = data.indexOf("::") !== -1;
    const ipv6Part = hasIpv4 ? addressParts.join(":") : data;

    if (isShortened) {
      if (ipv6Part.split("::").length - 1 > 1) {
        return false;
      }

      if (!/^[0-9a-fA-F:.]*$/.test(ipv6Part)) {
        return false;
      }

      return /^(?:(?:(?:[0-9a-fA-F]{1,4}(?::|$)){1,6}))|(?:::(?:[0-9a-fA-F]{1,4})){0,5}$/.test(
        ipv6Part
      );
    }

    const isIpv6Valid =
      /^(?:(?:[0-9a-fA-F]{1,4}:){7}(?:[0-9a-fA-F]{1,4}|:))$/.test(ipv6Part);

    const hasInvalidChar = /(?:[0-9a-fA-F]{5,}|\D[0-9a-fA-F]{3}:)/.test(
      ipv6Part
    );

    if (hasIpv4) {
      return isIpv6Valid || !hasInvalidChar;
    }

    return isIpv6Valid && !hasInvalidChar;
  },

  hostname(data) {
    return /^[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*[a-z0-9]$/i.test(
      data
    );
  },
  date(data) {
    if (/^(\d{4})-(\d{2})-(\d{2})$/.test(data) === false) {
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

    return /^\/(?:[^~]|~0|~1)*$/.test(data);
  },
  "relative-json-pointer"(data) {
    if (data === "") {
      return true;
    }

    return /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/.test(data);
  },
  time(data) {
    return /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.test(
      data
    );
  },
  "uri-reference"(data) {
    if (/\\/.test(data)) {
      return false;
    }

    return /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#((?![^#]*\\)[^#]*))?/i.test(
      data
    );
  },
  "uri-template"(data) {
    return /^(?:(?:https?:\/\/[\w.-]+)?\/?)?[\w- ;,.\/?%&=]*(?:\{[\w-]+(?::\d+)?\}[\w- ;,.\/?%&=]*)*\/?$/.test(
      data
    );
  },

  // Not supported yet
  duration: false,
  uuid: false,
  "idn-email": false,
  "idn-hostname": false,
  iri: false,
  "iri-reference": false
};
