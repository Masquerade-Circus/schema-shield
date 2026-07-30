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
      const proto = Reflect.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype) {
        deepFreeze(proto, freezeClassInstances, seen);
      }
    }
  }

  Object.freeze(obj);

  return obj;
}

export function deepCloneUnfreeze<T>(obj: T): T {
  return structuredClone(obj);
}
