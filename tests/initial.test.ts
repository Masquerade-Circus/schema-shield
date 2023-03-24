import { describe, it } from "mocha";

import FastSchema from "../lib";
import expect from "expect";

describe("FastSchema", () => {
  it("Should create a FastSchema instance", () => {
    let schema = {
      type: "object",
      properties: {
        foo: {
          type: "string"
        },
        bar: {
          type: "integer"
        },
        array: {
          type: "array",
          items: {
            type: "string"
          }
        },
        hello: {
          type: "string",
          default: "world"
        }
      },
      required: ["foo", "bar", "array"]
    };

    let data = {
      foo: "hello",
      bar: 42,
      array: ["hello", "world"]
    };

    let fastSchema = new FastSchema();
    let validate = fastSchema.compile(schema);

    expect(validate(data)).toEqual({
      data: { ...data, hello: "world" },
      errors: [],
      valid: true
    });
  });
});
