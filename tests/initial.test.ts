import { describe, it } from "mocha";

import SchemaShield from "../lib";
import expect from "expect";

describe("SchemaShield", () => {
  it("Should create a SchemaShield instance", () => {
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

    let schemaShield = new SchemaShield();
    let validate = schemaShield.compile(schema);

    expect(validate(data)).toEqual({
      data: { ...data, hello: "world" },
      errors: [],
      valid: true
    });
  });
});
