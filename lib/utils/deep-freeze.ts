export function deepFreeze(
  obj: any,
  freezeClassInstances: boolean = false,
  seen = new WeakSet()
): any {
  if (
    obj === null ||
    typeof obj !== "object" ||
    seen.has(obj) ||
    Object.isFrozen(obj)
  ) {
    return obj;
  }

  seen.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0, l = obj.length; i < l; i++) {
      deepFreeze(obj[i], freezeClassInstances, seen);
    }
  } else {
    const props = Reflect.ownKeys(obj);
    for (let i = 0, l = props.length; i < l; i++) {
      deepFreeze(obj[props[i]], freezeClassInstances, seen);
    }

    // If the object is an instance of a class (not a plain object or array) we need to freeze the prototype
    if (freezeClassInstances) {
      const proto = Object.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype) {
        deepFreeze(proto, freezeClassInstances, seen);
      }
    }
  }

  Object.freeze(obj);

  return obj;
}

function isPlainObject(value: any): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export { isPlainObject };

function canUseStructuredClone(value: any): boolean {
  if (typeof structuredClone !== "function") {
    return false;
  }

  if (typeof Buffer !== "undefined" && value instanceof Buffer) {
    return false;
  }

  return (
    Array.isArray(value) ||
    isPlainObject(value) ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

export function deepCloneUnfreeze<T>(
  obj: T,
  cloneClassInstances = false,
  seen = new WeakMap()
): T {
  if (typeof obj === "undefined" || obj === null || typeof obj !== "object") {
    return obj;
  }

  const source = obj as any;

  if (seen.has(source)) {
    return seen.get(source);
  }

  if (canUseStructuredClone(source)) {
    const cloned = structuredClone(source);
    seen.set(source, cloned);
    return cloned;
  }

  let clone: any;

  switch (true) {
    case Array.isArray(source): {
      clone = [];
      seen.set(source, clone);
      for (let i = 0, l = source.length; i < l; i++) {
        clone[i] = deepCloneUnfreeze(source[i], cloneClassInstances, seen);
      }
      return clone;
    }
    case source instanceof Date: {
      clone = new Date(source.getTime());
      seen.set(source, clone);
      return clone;
    }
    case source instanceof RegExp: {
      clone = new RegExp(source.source, source.flags);
      seen.set(source, clone);
      return clone;
    }
    case source instanceof Map: {
      clone = new Map();
      seen.set(source, clone);
      for (const [key, value] of source.entries()) {
        clone.set(
          deepCloneUnfreeze(key, cloneClassInstances, seen),
          deepCloneUnfreeze(value, cloneClassInstances, seen)
        );
      }
      return clone;
    }
    case source instanceof Set: {
      clone = new Set();
      seen.set(source, clone);
      for (const value of source.values()) {
        clone.add(deepCloneUnfreeze(value, cloneClassInstances, seen));
      }
      return clone;
    }
    case source instanceof ArrayBuffer: {
      clone = source.slice(0);
      seen.set(source, clone);
      return clone;
    }
    // TypedArrays and DataView
    case ArrayBuffer.isView(source): {
      clone = new source.constructor(source.buffer.slice(0));
      seen.set(source, clone);
      return clone;
    }
    // Node.js Buffer
    case typeof Buffer !== "undefined" && source instanceof Buffer: {
      clone = Buffer.from(source);
      seen.set(source, clone);
      return clone;
    }
    case source instanceof Error: {
      clone = new source.constructor(source.message);
      seen.set(source, clone);
      break;
    }
    // Non clonable objects
    case source instanceof Promise ||
      source instanceof WeakMap ||
      source instanceof WeakSet: {
      clone = source;
      seen.set(source, clone);
      return clone;
    }
    // Instance of a class
    case source.constructor && source.constructor !== Object: {
      if (!cloneClassInstances) {
        clone = source;
        seen.set(source, clone);
        return clone;
      }
      clone = Object.create(Object.getPrototypeOf(source));
      seen.set(source, clone);
      break;
    }

    // Plain objects
    default: {
      clone = {};
      seen.set(source, clone);

      const keys = Reflect.ownKeys(source);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        clone[key as string] = deepCloneUnfreeze(
          source[key as string],
          cloneClassInstances,
          seen
        );
      }
      return clone;
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(source);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as string];
    if ("value" in descriptor) {
      descriptor.value = deepCloneUnfreeze(
        descriptor.value,
        cloneClassInstances,
        seen
      );
    }
    Object.defineProperty(clone, key, descriptor);
  }

  return clone;
}
