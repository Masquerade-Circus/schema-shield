export function deepFreeze(
  obj: any,
  freezeClassInstances: boolean = false,
  seen?: WeakSet<object>
): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const visited = seen ?? new WeakSet<object>();
  if (visited.has(obj) || Object.isFrozen(obj)) {
    return obj;
  }

  visited.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0, l = obj.length; i < l; i++) {
      deepFreeze(obj[i], freezeClassInstances, visited);
    }
  } else {
    const props = Reflect.ownKeys(obj);
    for (let i = 0, l = props.length; i < l; i++) {
      deepFreeze(obj[props[i]], freezeClassInstances, visited);
    }

    // If the object is an instance of a class (not a plain object or array) we need to freeze the prototype
    if (freezeClassInstances) {
      const proto = Object.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype) {
        deepFreeze(proto, freezeClassInstances, visited);
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

function clonePlainObjectOrArrayIteratively<T>(
  value: T,
  cloneClassInstances: boolean,
  seen: WeakMap<object, any>
): T {
  const sourceRoot = value as any;
  const cloneRoot: any = Array.isArray(sourceRoot)
    ? []
    : Object.create(Object.getPrototypeOf(sourceRoot));
  seen.set(sourceRoot, cloneRoot);
  const pending: Array<{ source: any; clone: any }> = [
    { source: sourceRoot, clone: cloneRoot }
  ];

  while (pending.length > 0) {
    const current = pending.pop()!;
    const keys = Reflect.ownKeys(current.source);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const descriptor = Object.getOwnPropertyDescriptor(current.source, key)!;

      if (!("value" in descriptor)) {
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }

      const item = descriptor.value;
      if (item === null || typeof item !== "object") {
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }

      if (!Array.isArray(item) && !isPlainObject(item)) {
        descriptor.value = deepCloneUnfreeze(
          item,
          cloneClassInstances,
          seen
        );
        Object.defineProperty(current.clone, key, descriptor);
        continue;
      }

      let clonedItem = seen.get(item);
      if (!clonedItem) {
        clonedItem = Array.isArray(item)
          ? []
          : Object.create(Object.getPrototypeOf(item));
        seen.set(item, clonedItem);
        pending.push({ source: item, clone: clonedItem });
      }

      descriptor.value = clonedItem;
      Object.defineProperty(current.clone, key, descriptor);
    }
  }

  return cloneRoot;
}

export function deepCloneUnfreeze<T>(
  obj: T,
  cloneClassInstances = false,
  seen?: WeakMap<object, any>
): T {
  if (typeof obj === "undefined" || obj === null || typeof obj !== "object") {
    return obj;
  }

  const source = obj as any;
  const clones = seen ?? new WeakMap<object, any>();

  if (clones.has(source)) {
    return clones.get(source);
  }

  if (canUseStructuredClone(source)) {
    try {
      const cloned = structuredClone(source);
      clones.set(source, cloned);
      return cloned;
    } catch (error) {
      if (
        !(error instanceof RangeError) ||
        (!Array.isArray(source) && !isPlainObject(source))
      ) {
        throw error;
      }

      return clonePlainObjectOrArrayIteratively(
        source,
        cloneClassInstances,
        clones
      );
    }
  }

  let clone: any;

  switch (true) {
    case source instanceof Date: {
      clone = new Date(source.getTime());
      clones.set(source, clone);
      return clone;
    }
    case source instanceof RegExp: {
      clone = new RegExp(source.source, source.flags);
      clones.set(source, clone);
      return clone;
    }
    case source instanceof Map: {
      clone = new Map();
      clones.set(source, clone);
      for (const [key, value] of source.entries()) {
        clone.set(
          deepCloneUnfreeze(key, cloneClassInstances, clones),
          deepCloneUnfreeze(value, cloneClassInstances, clones)
        );
      }
      return clone;
    }
    case source instanceof Set: {
      clone = new Set();
      clones.set(source, clone);
      for (const value of source.values()) {
        clone.add(deepCloneUnfreeze(value, cloneClassInstances, clones));
      }
      return clone;
    }
    case source instanceof ArrayBuffer: {
      clone = source.slice(0);
      clones.set(source, clone);
      return clone;
    }
    // TypedArrays and DataView
    case ArrayBuffer.isView(source): {
      clone = new source.constructor(source.buffer.slice(0));
      clones.set(source, clone);
      return clone;
    }
    // Node.js Buffer
    case typeof Buffer !== "undefined" && source instanceof Buffer: {
      clone = Buffer.from(source);
      clones.set(source, clone);
      return clone;
    }
    case source instanceof Error: {
      clone = new source.constructor(source.message);
      clones.set(source, clone);
      break;
    }
    // Non clonable objects
    case source instanceof Promise ||
      source instanceof WeakMap ||
      source instanceof WeakSet: {
      clone = source;
      clones.set(source, clone);
      return clone;
    }
    // Instance of a class
    case source.constructor && source.constructor !== Object: {
      if (!cloneClassInstances) {
        clone = source;
        clones.set(source, clone);
        return clone;
      }
      clone = Object.create(Object.getPrototypeOf(source));
      clones.set(source, clone);
      break;
    }

    // Plain objects
    default: {
      clone = {};
      clones.set(source, clone);

      const keys = Reflect.ownKeys(source);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        clone[key as string] = deepCloneUnfreeze(
          source[key as string],
          cloneClassInstances,
          clones
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
        clones
      );
    }
    Object.defineProperty(clone, key, descriptor);
  }

  return clone;
}
