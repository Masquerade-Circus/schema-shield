import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it } from "mocha";
import { expect } from "expect";

const manifest = JSON.parse(readFileSync("meta-schemas/manifest.json", "utf8"));
const snapshot = JSON.parse(
  readFileSync("lib/official-meta-schemas.json", "utf8")
);

describe("official metaschema sources", () => {
  it("pins the complete supported resource set including format-assertion", () => {
    const commits = {
      draft4: "dba92b702c94858162f653590230e7573c8b7dd0",
      draft6: "59ed5f6fc6f6386e23ca51d7f31d7fe9cf696713",
      draft7: "567f768506aaa33a38e552c85bf0586029ef1b32",
      "2019-09": "41014ea723120ce70b314d72f863c6929d9f3cfd",
      "2020-12": "769daad75a9553562333a8937a187741cb708c72"
    };

    expect(manifest.repository).toBe(
      "https://github.com/json-schema-org/json-schema-spec"
    );
    expect(manifest.resources).toHaveLength(19);
    expect(
      new Set(manifest.resources.map((resource: any) => resource.key)).size
    ).toBe(19);
    expect(
      new Set(manifest.resources.map((resource: any) => resource.uri)).size
    ).toBe(19);
    expect(
      manifest.resources.find(
        (resource: any) => resource.key === "draft2020FormatAssertion"
      )
    ).toEqual(
      expect.objectContaining({
        sourcePath: "meta/format-assertion.json",
        uri: "https://json-schema.org/draft/2020-12/meta/format-assertion"
      })
    );
    for (const resource of manifest.resources) {
      expect(resource.commit).toBe(
        commits[resource.dialect as keyof typeof commits]
      );
    }
  });

  it("matches every source hash and generated snapshot entry", () => {
    const license = readFileSync(`meta-schemas/${manifest.license.localPath}`);
    expect(createHash("sha256").update(license).digest("hex")).toBe(
      manifest.license.sha256
    );

    for (const resource of manifest.resources) {
      const source = readFileSync(`meta-schemas/${resource.localPath}`);
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        resource.sha256
      );
      expect(snapshot[resource.key]).toEqual(JSON.parse(source.toString("utf8")));
    }
  });

  it("reports a reproducible snapshot without writing files", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/generate-official-meta-schemas.cjs", "--check"],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
