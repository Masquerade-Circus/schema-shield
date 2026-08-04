import { describe, it } from "mocha";

import expect from "expect";
import { deepClone as deepCloneFromRoot } from "../lib";
import {
  ValidationError,
  deepClone,
  definePropertyOrThrow,
  hasOwn
} from "../lib/utils";

describe("internal utility behavior", () => {
  it("rejects values unsupported by structuredClone", () => {
    const unsupportedValues = [
      () => true,
      Promise.resolve(true),
      new WeakMap(),
      new WeakSet()
    ];

    for (const value of unsupportedValues) {
      expect(() => deepClone(value)).toThrow();
    }
  });

  it("provides the internal deepClone alias", () => {
    const source = {
      foo: {
        bar: [1, 2, 3]
      }
    };

    const cloned = deepClone(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.foo).not.toBe(source.foo);
  });

  it("constructs the internal ValidationError class", () => {
    const error = new ValidationError("Boom");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("exports deepClone from root index", () => {
    const source = { one: { two: 2 } };
    const cloned = deepCloneFromRoot(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.one).not.toBe(source.one);
  });

  it("preserves symbol descriptors and throws when definition fails", () => {
    const symbol = Symbol("hidden");
    const target: Record<PropertyKey, any> = {};

    definePropertyOrThrow(target, symbol, {
      value: "value",
      enumerable: false,
      configurable: false,
      writable: false
    });

    expect(hasOwn(target, symbol)).toBe(true);
    expect(Reflect.getOwnPropertyDescriptor(target, symbol)).toEqual({
      value: "value",
      enumerable: false,
      configurable: false,
      writable: false
    });
    expect(Reflect.preventExtensions(target)).toBe(true);
    expect(() =>
      definePropertyOrThrow(target, "blocked", { value: true })
    ).toThrow(TypeError);
  });

  it("preserves intrinsic own-property semantics", () => {
    expect(hasOwn("text", "length")).toBe(true);
    expect(hasOwn(42, "toString")).toBe(false);
    expect(() => hasOwn(null, "value")).toThrow(TypeError);
    expect(() => hasOwn(undefined, "value")).toThrow(TypeError);

    const nullPrototype = Object.create(null);
    nullPrototype.value = true;
    expect(hasOwn(nullPrototype, "value")).toBe(true);
    expect(hasOwn(nullPrototype, "toString")).toBe(false);

    const symbol = Symbol("own");
    nullPrototype[symbol] = true;
    expect(hasOwn(nullPrototype, symbol)).toBe(true);

    let descriptorReads = 0;
    const proxy = new Proxy(
      { value: true },
      {
        getOwnPropertyDescriptor(target, key) {
          descriptorReads++;
          return Reflect.getOwnPropertyDescriptor(target, key);
        }
      }
    );
    expect(hasOwn(proxy, "value")).toBe(true);
    expect(hasOwn(proxy, "missing")).toBe(false);
    expect(descriptorReads).toBe(2);
  });
});
