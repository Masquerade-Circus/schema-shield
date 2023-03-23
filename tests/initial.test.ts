import { describe, it } from "mocha";

import FJV from "../lib";
import expect from "expect";

describe.only("Fjv", () => {
  it("Should create a fjv instance", () => {
    let schema = {
      type: "object",
      properties: {
        foo: {
          type: "string"
        },
        bar: {
          type: "integer"
        }
      },
      required: ["foo", "bar"]
    };

    let data = {
      foo: "hello",
      bar: 42
    };

    let fjv = new FJV();
    let validate = fjv.compile(schema);

    console.log(validate.compiledSchema);
    expect(validate(data)).toEqual({ valid: true, errors: [] });
  });
});
