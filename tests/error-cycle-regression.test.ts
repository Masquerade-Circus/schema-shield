import { describe, it } from "mocha";
import expect from "expect";
import { ValidationError } from "../lib";

function error(message: string, keyword: string) {
  const value = new ValidationError(message);
  value.keyword = keyword;
  return value;
}

describe("ValidationError cycle safety", () => {
  it("terminates getCause and getTree for a self-cause", () => {
    const root = error("root", "properties");
    root.cause = root;

    expect(root.getCause()).toBe(root);
    expect(root.getTree()).toEqual({
      message: "root",
      keyword: "properties",
      item: undefined,
      schemaPath: "#/properties",
      instancePath: "#",
      data: undefined
    });
  });

  it("terminates getCause and getTree for a two-node cause cycle", () => {
    const first = error("first", "properties");
    const second = error("second", "type");
    first.cause = second;
    second.cause = first;

    expect(first.getCause()).toBe(second);
    expect(first.getTree()).toEqual({
      message: "first",
      keyword: "properties",
      item: undefined,
      schemaPath: "#/properties",
      instancePath: "#",
      data: undefined,
      cause: {
        message: "second",
        keyword: "type",
        item: undefined,
        schemaPath: "#/properties/type",
        instancePath: "#",
        data: undefined
      }
    });
  });
});
