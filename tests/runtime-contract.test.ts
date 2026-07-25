import { describe, it } from "mocha";

import { expect } from "expect";
import * as fs from "fs";
import { SchemaShield } from "../lib";

describe("runtime contract", () => {
  it("requires Node 18 or newer in package metadata", () => {
    const packageJson = JSON.parse(
      fs.readFileSync("package.json", "utf8")
    );
    const packageLock = JSON.parse(
      fs.readFileSync("package-lock.json", "utf8")
    );

    expect(packageJson.engines.node).toBe(">=18.0.0");
    expect(packageLock.packages[""].engines.node).toBe(">=18.0.0");
  });

  it("uses the Node 18 structuredClone contract without an availability branch", () => {
    const cloneSource = fs.readFileSync(
      "lib/utils/deep-freeze.ts",
      "utf8"
    );

    expect(cloneSource).toContain("structuredClone(source)");
    expect(cloneSource).not.toContain('typeof structuredClone !== "function"');
  });

  it("supports direct public invocation of builtin combinator keywords", () => {
    const shield = new SchemaShield();
    const defineError = () => true as const;
    const matchesNumber = {
      $validate: (data: any) => (typeof data === "number" ? undefined : true)
    };
    const matchesString = {
      $validate: (data: any) => (typeof data === "string" ? undefined : true)
    };

    const cases = [
      { keyword: "allOf", schema: { allOf: [matchesNumber] }, valid: 1 },
      {
        keyword: "anyOf",
        schema: { anyOf: [matchesNumber, matchesString] },
        valid: "value"
      },
      {
        keyword: "oneOf",
        schema: { oneOf: [matchesNumber, matchesString] },
        valid: 1
      }
    ];

    for (const testCase of cases) {
      const keyword = shield.getKeyword(testCase.keyword);
      expect(keyword).not.toBe(false);
      expect(
        keyword!(testCase.schema, testCase.valid, defineError, shield)
      ).toBeUndefined();
      expect(keyword!(testCase.schema, null, defineError, shield)).toBe(true);
    }
  });

  it("supports direct public invocation of properties without private metadata", () => {
    const shield = new SchemaShield();
    const properties = shield.getKeyword("properties");
    const schema = {
      properties: {
        value: {
          $validate: (data: any) => (data === "allowed" ? undefined : true)
        }
      }
    };

    expect(properties).not.toBe(false);
    expect(
      properties!(schema, { value: "allowed" }, () => true, shield)
    ).toBeUndefined();
    expect(properties!(schema, { value: "blocked" }, () => true, shield)).toBe(
      true
    );
  });

  it("supports direct public invocation of additionalProperties without private metadata", () => {
    const shield = new SchemaShield();
    const additionalProperties = shield.getKeyword("additionalProperties");
    const schema = {
      additionalProperties: {
        $validate: (data: any) => (typeof data === "number" ? undefined : true)
      }
    };

    expect(additionalProperties).not.toBe(false);
    expect(
      additionalProperties!(schema, { extra: "blocked" }, () => true, shield)
    ).toBe(true);
  });
});
