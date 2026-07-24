import { describe, it } from "mocha";

import { expect } from "expect";
import * as fs from "fs";

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
});
