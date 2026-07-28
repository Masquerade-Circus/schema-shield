import { describe, it } from "mocha";
import { expect } from "expect";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SchemaShield, ValidationError } from "../lib";

function isolatedProbe(operation: string, depth: number) {
  const coordinator = path.resolve("performance/measure-compile-threshold.cjs");
  const child = spawnSync(
    process.execPath,
    [
      coordinator,
      "--operation",
      operation,
      "--depths",
      String(depth),
      "--phase",
      "post-guard"
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }
  );
  if (child.signal !== null || child.status !== 0 || child.stdout.trim() === "") {
    throw new Error(
      `isolated probe failed: signal=${child.signal} status=${child.status} stderr=${child.stderr}`
    );
  }
  return JSON.parse(child.stdout).probes[0];
}

describe("compile safety contracts", () => {
  it("rejects identity cycles with a controlled compile error before cloning", () => {
    const result = isolatedProbe("compile-cycle", 0);
    expect(result.outcome).toBe("rejected");
    expect(result.error.message).toMatch(/cyclic schema graph/i);
    expect(result.error.rangeError).toBe(false);
  });

  it("rejects depth 129 in an isolated process without stack overflow", () => {
    const result = isolatedProbe("compile", 129);
    expect(result.outcome).toBe("rejected");
    expect(result.error.code).toBe("MAX_COMPILE_DEPTH_EXCEEDED");
    expect(result.error.rangeError).toBe(false);
  });

  it("rejects recursive validation at depth 129 in an isolated process", () => {
    const result = isolatedProbe("validate", 129);
    expect(result.outcome).toBe("rejected");
    expect(result.error.code).toBe("MAX_DEPTH_EXCEEDED");
    expect(result.error.rangeError).toBe(false);
  });

  it("rolls back defaults after a depth rejection", () => {
    const schema = {
      definitions: {
        node: {
          type: "object",
          properties: {
            marker: { type: "string", default: "inserted" },
            child: { $ref: "#/definitions/node" }
          },
          required: ["marker"]
        }
      },
      $ref: "#/definitions/node"
    };
    type ProbeNode = { marker?: string; child?: ProbeNode };
    const input: ProbeNode = {};
    let current = input;

    for (let index = 0; index < 129; index++) {
      current.child = {};
      current = current.child;
    }

    const result = new SchemaShield({ failFast: false, useDefaults: true })
      .compile(schema)(input);

    expect(result.valid).toBe(false);
    expect((result.error as ValidationError).getCause().code).toBe(
      "MAX_DEPTH_EXCEEDED"
    );

    let insertedDefaults = 0;
    let node: ProbeNode | undefined = input;
    while (node !== undefined) {
      if (Object.prototype.hasOwnProperty.call(node, "marker")) {
        insertedDefaults++;
      }
      node = node.child;
    }
    expect(insertedDefaults).toBe(0);
  });

  it("uses the historical fail-fast sentinel in an isolated process", () => {
    const result = isolatedProbe("validate-fail-fast", 129);
    expect(result.outcome).toBe("rejected");
    expect(result.failFastSentinel).toBe(true);
  });
});
