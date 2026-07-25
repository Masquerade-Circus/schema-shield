import fs from "node:fs";
import path from "node:path";
import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield } from "../lib";

function ownShape(root: any) {
  const entries: string[] = [];
  const pending: Array<{ value: any; pointer: string }> = [
    { value: root, pointer: "#" }
  ];
  const seen = new Set<any>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (
      current.value === null ||
      typeof current.value !== "object" ||
      seen.has(current.value)
    ) {
      continue;
    }
    seen.add(current.value);
    for (const key of Object.getOwnPropertyNames(current.value).sort()) {
      entries.push(`${current.pointer}/${key}`);
      pending.push({
        value: current.value[key],
        pointer: `${current.pointer}/${key}`
      });
    }
  }
  return entries;
}

function guardShape(root: any) {
  return ownShape(root).filter((entry) =>
    /context|guard|depth|wrapper/i.test(entry)
  );
}

describe("production architecture contracts", () => {
  it("keeps the local validator order and stops at the first error", () => {
    const calls: string[] = [];
    const shield = new SchemaShield({ failFast: false });
    shield.addKeyword("firstContractKeyword", (_schema, data, defineError) => {
      calls.push("first");
      return defineError("first rejected", { data });
    });
    shield.addKeyword("secondContractKeyword", () => {
      calls.push("second");
    });
    const validate = shield.compile({
      firstContractKeyword: true,
      secondContractKeyword: true
    });

    const result = validate("value");

    expect(result.valid).toBe(false);
    expect(calls).toEqual(["first"]);
  });

  it("does not add runtime context or lazy guard state on the builtin fast path", () => {
    const validate = new SchemaShield().compile({
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"]
    });
    const before = guardShape(validate.compiledSchema);
    const callable = validate.compiledSchema.$validate;
    const rootSource = String(validate.compiledSchema.$validate);

    for (let index = 0; index < 10; index++) {
      expect(validate({ value: "ok" }).valid).toBe(true);
    }

    expect(guardShape(validate.compiledSchema)).toEqual(before);
    expect(validate.compiledSchema.$validate).toBe(callable);
    expect(rootSource).not.toMatch(/context|guard|depth/i);
  });

  it("classifies builtin identity separately from custom keyword overrides", () => {
    const builtin = new SchemaShield().compile({ type: "string" });
    expect(
      Object.prototype.hasOwnProperty.call(
        builtin.compiledSchema,
        "_requiresDepthGuard"
      )
    ).toBe(false);

    const customShield = new SchemaShield();
    customShield.addKeyword("customDescent", () => {});
    const custom = customShield.compile({ customDescent: true });
    expect(
      Object.prototype.hasOwnProperty.call(
        custom.compiledSchema,
        "_requiresDepthGuard"
      )
    ).toBe(true);
  });

  it("supports legacy graph $validate calls and the fifth guarded helper", () => {
    let helperType = "missing";
    const shield = new SchemaShield();
    shield.addKeyword(
      "validateNested",
      (schema: any, data: any, _defineError: any, _instance: any, validateSubschema: any) => {
        helperType = typeof validateSubschema;
        const directError = schema.nested.$validate(data);
        if (directError) {
          return directError;
        }
        return validateSubschema(schema.nested, data);
      }
    );
    const validate = shield.compile({
      validateNested: true,
      nested: { type: "string" }
    });

    expect(validate("ok").valid).toBe(true);
    expect(helperType).toBe("function");
  });

  it("keeps getKeyword as a public four-argument function", () => {
    const shield = new SchemaShield();
    shield.addKeyword("publicKeyword", () => {});
    const keyword = shield.getKeyword("publicKeyword");

    expect(typeof keyword).toBe("function");
    expect((keyword as Function).length).toBeLessThanOrEqual(4);
  });

  it("contains no codegen or global interpreter structures", () => {
    const files: string[] = [];
    const pending = [path.resolve("lib")];
    while (pending.length > 0) {
      const directory = pending.pop()!;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(absolute);
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          files.push(absolute);
        }
      }
    }
    const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\b/);
    expect(source).not.toMatch(/\b(opcodes?|continuations?|workspaces?|frames?)\b/i);
  });
});
