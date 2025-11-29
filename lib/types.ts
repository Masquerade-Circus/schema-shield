import { TypeFunction } from "./index";
import { isObject } from "./utils";

export const Types: Record<string, TypeFunction | false> = {
  object(data) {
    return isObject(data);
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
