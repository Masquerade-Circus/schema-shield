const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "meta-schemas", "manifest.json");
const outputPath = path.join(root, "lib", "official-meta-schemas.json");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function generateOfficialMetaSchemas({ check = false } = {}) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    manifest.repository !==
    "https://github.com/json-schema-org/json-schema-spec"
  ) {
    throw new Error("Unexpected official metaschema repository");
  }
  if (manifest.resources.length !== 18) {
    throw new Error("Official metaschema manifest must contain 18 resources");
  }
  const license = readFileSync(
    path.join(root, "meta-schemas", manifest.license.localPath)
  );
  if (sha256(license) !== manifest.license.sha256) {
    throw new Error("Hash mismatch for the official metaschema license");
  }

  const keys = new Set();
  const uris = new Set();
  const snapshot = {};
  for (const resource of manifest.resources) {
    if (
      !resource.localPath.startsWith("sources/") ||
      resource.localPath.includes("..")
    ) {
      throw new Error(`Unsafe metaschema source path: ${resource.localPath}`);
    }
    if (resource.sourcePath.endsWith("meta/format-assertion.json")) {
      throw new Error("format-assertion is not a supported builtin resource");
    }
    if (keys.has(resource.key) || uris.has(resource.uri)) {
      throw new Error(`Duplicate official metaschema identity: ${resource.uri}`);
    }
    keys.add(resource.key);
    uris.add(resource.uri);

    const sourcePath = path.join(root, "meta-schemas", resource.localPath);
    const source = readFileSync(sourcePath);
    const actualHash = sha256(source);
    if (actualHash !== resource.sha256) {
      throw new Error(`Hash mismatch for ${resource.localPath}`);
    }

    const schema = JSON.parse(source.toString("utf8"));
    const identity = resource.dialect === "draft4" ? schema.id : schema.$id;
    if (identity !== resource.uri) {
      throw new Error(`Identity mismatch for ${resource.localPath}`);
    }
    snapshot[resource.key] = schema;
  }

  const generated = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (check) {
    if (readFileSync(outputPath, "utf8") !== generated) {
      throw new Error("lib/official-meta-schemas.json is stale");
    }
    return;
  }
  writeFileSync(outputPath, generated);
}

if (require.main === module) {
  generateOfficialMetaSchemas({ check: process.argv.includes("--check") });
}

module.exports = generateOfficialMetaSchemas;
