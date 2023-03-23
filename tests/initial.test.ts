import { describe, it } from "mocha";

import FJV from "../lib";
import expect from "expect";

describe("Fjv", () => {
  it("Should create a fjv instance", () => {
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
        }
      },
      required: ["foo", "bar", "array"]
    };

    let data = {
      foo: "hello",
      bar: 42,
      array: ["hello", "world"]
    };

    let fjv = new FJV();
    let validate = fjv.compile(schema);

    expect(validate(data)).toEqual({ valid: true, errors: null });
  });
});
