import { TypeFunction } from "./index";
import { isObject } from "./utils";

export const Types: Record<string, TypeFunction> = {
  object(data) {
    return isObject(data);
  },
  array(data) {
    if (Array.isArray(data)) {
      return true;
    }

    return (
      typeof data === "object" &&
      data !== null &&
      "length" in data &&
      "0" in data &&
      Object.keys(data).length - 1 === data.length
    );
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
