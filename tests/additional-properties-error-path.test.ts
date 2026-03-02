import { describe, it } from "mocha";
import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";

describe("additionalProperties: false - Error Path Functions", () => {
  it("should return correct paths for additionalProperties: false error", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      additionalProperties: false
    };

    const schemaShield = new SchemaShield({ failFast: false });
    const validate = schemaShield.compile(schema);
    const result = validate({ name: "John", age: 30 });

    expect(result.valid).toEqual(false);
    expect(result.error).not.toBeNull();
    expect(result.error instanceof ValidationError).toEqual(true);

    if (result.error instanceof ValidationError) {
      const path = result.error.getPath();
      expect(path.schemaPath).toEqual("#/additionalProperties");
      expect(path.instancePath).toEqual("#/age");

      const cause = result.error.getCause();
      expect(cause.message).toEqual("Additional properties are not allowed");
      expect(cause.keyword).toEqual("additionalProperties");
      expect(cause.item).toEqual("age");

      const tree = result.error.getTree();
      expect(tree.message).toEqual("Additional properties are not allowed");
      expect(tree.keyword).toEqual("additionalProperties");
      expect(tree.instancePath).toEqual("#/age");
      expect(tree.schemaPath).toEqual("#/additionalProperties");
      expect(tree.item).toEqual("age");
      expect(tree.data).toEqual(30);
    }
  });

  it("should return correct paths for nested additionalProperties: false error", () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" }
          },
          additionalProperties: false
        }
      }
    };

    const schemaShield = new SchemaShield({ failFast: false });
    const validate = schemaShield.compile(schema);
    const result = validate({ user: { name: "John", age: 30 } });

    expect(result.valid).toEqual(false);
    expect(result.error instanceof ValidationError).toEqual(true);

    if (result.error instanceof ValidationError) {
      const path = result.error.getPath();
      expect(path.schemaPath).toEqual("#/properties/user/additionalProperties");
      expect(path.instancePath).toEqual("#/user/age");

      const cause = result.error.getCause();
      expect(cause.keyword).toEqual("additionalProperties");
      expect(cause.item).toEqual("age");

      const tree = result.error.getTree();
      expect(tree.instancePath).toEqual("#/user");
      expect(tree.schemaPath).toEqual("#/properties/user");
      expect(tree.cause).toBeDefined();
    }
  });

  it("should return correct paths when additionalProperties is an object schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      additionalProperties: { type: "number" }
    };

    const schemaShield = new SchemaShield({ failFast: false });
    const validate = schemaShield.compile(schema);
    const result = validate({ name: "John", age: "not-a-number" });

    expect(result.valid).toEqual(false);
    expect(result.error instanceof ValidationError).toEqual(true);

    if (result.error instanceof ValidationError) {
      const path = result.error.getPath();
      expect(path.instancePath).toEqual("#/age");

      const cause = result.error.getCause();
      expect(cause.keyword).toEqual("type");

      const tree = result.error.getTree();
      expect(tree.instancePath).toEqual("#/age");
      expect(tree.keyword).toEqual("additionalProperties");
      expect(tree.cause).toBeDefined();
      if (tree.cause) {
        expect(tree.cause.keyword).toEqual("type");
      }
    }
  });
});
