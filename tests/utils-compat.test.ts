import { describe, it } from "mocha";

import expect from "expect";
import { deepClone as deepCloneFromRoot } from "../lib";
import { ValidationError, deepClone } from "../lib/utils";

describe("utils compatibility exports", () => {
  it("exports deepClone alias", () => {
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

  it("exports ValidationError", () => {
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
});
