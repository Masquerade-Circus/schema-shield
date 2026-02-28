export function isEmpty(value: any) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && Object.keys(value).length === 0)
  );
}

export function is<T>(value: any, type: string | any): value is T {
  if (typeof type !== "string") {
    return value instanceof type;
  }

  if (type === "array") {
    return Array.isArray(value);
  }

  if (type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  if (type === "number") {
    return typeof value === "number" && !isNaN(value);
  }

  return typeof value === type;
}

export function isFunction(value: any): value is Function {
  return typeof value === "function";
}

export function isString(value: any): value is string {
  return typeof value === "string";
}

export function isNumber(value: any): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isFiniteNumber(value: any): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBoolean(value: any): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: any): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasLength(value: any, length: number) {
  if (typeof value === "string") {
    return value.length === length;
  }
  return Array.isArray(value) && value.length === length;
}

export function hasMinLength(value: any, length: number) {
  if (typeof value === "string") {
    return value.length >= length;
  }
  return Array.isArray(value) && value.length >= length;
}

export function hasMaxLength(value: any, length: number) {
  if (typeof value === "string") {
    return value.length <= length;
  }
  return Array.isArray(value) && value.length <= length;
}

export function hasLengthBetween(value: any, min: number, max: number) {
  if (typeof value === "string") {
    return value.length >= min && value.length <= max;
  }
  return Array.isArray(value) && value.length >= min && value.length <= max;
}

export function isLessThan(value: any, limit: number) {
  return typeof value === "number" && !Number.isNaN(value) && value < limit;
}

export function isGreaterThan(value: any, limit: number) {
  return typeof value === "number" && !Number.isNaN(value) && value > limit;
}

export function isBetween(value: any, min: number, max: number) {
  return (
    typeof value === "number" &&
    !Number.isNaN(value) &&
    value >= min &&
    value <= max
  );
}

export function pick<T extends object, K extends keyof T>(
  source: any,
  keys: K[]
): Pick<T, K> {
  const result: Partial<T> = {};
  if (!source || typeof source !== "object") {
    return result as Pick<T, K>;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      (result as any)[key] = (source as any)[key];
    }
  }

  return result as Pick<T, K>;
}

export function ensureIn<T>(value: T, allowed: readonly T[]): boolean {
  return allowed.includes(value);
}

export function areCloseEnough(a: number, b: number, epsilon = 1e-15): boolean {
  return Math.abs(a - b) <= epsilon * Math.max(Math.abs(a), Math.abs(b));
}
