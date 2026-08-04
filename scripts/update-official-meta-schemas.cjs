const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sourceRoot = path.join(root, "meta-schemas");
const manifestPath = path.join(sourceRoot, "manifest.json");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      { headers: { "User-Agent": "schema-shield-metaschema-updater" } },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(
            new Error(`Download failed with HTTP ${response.statusCode}: ${url}`)
          );
          return;
        }
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 100000) {
            response.destroy(
              new Error(`Download exceeded 100000 bytes: ${url}`)
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      }
    ).on("error", reject);
  });
}

function assertLocalPath(localPath) {
  if (!localPath.startsWith("sources/") || localPath.includes("..")) {
    throw new Error(`Unsafe metaschema source path: ${localPath}`);
  }
}

function assertUpstreamResource(resource) {
  assertLocalPath(resource.localPath);
  if (!/^[0-9a-f]{40}$/.test(resource.commit)) {
    throw new Error(`Invalid upstream commit: ${resource.commit}`);
  }
  if (
    resource.sourcePath.startsWith("/") ||
    resource.sourcePath.includes("..")
  ) {
    throw new Error(`Unsafe upstream path: ${resource.sourcePath}`);
  }
}

async function update() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expectedLicenseSource =
    "https://api.github.com/repos/json-schema-org/json-schema-spec/git/blobs/" +
    manifest.license.gitBlobSha1;
  if (
    !/^[0-9a-f]{40}$/.test(manifest.license.gitBlobSha1) ||
    manifest.license.source !== expectedLicenseSource ||
    manifest.license.localPath !== "LICENSE"
  ) {
    throw new Error("Invalid upstream license metadata");
  }
  const downloads = [];
  for (const resource of manifest.resources) {
    assertUpstreamResource(resource);
    const url =
      `https://raw.githubusercontent.com/json-schema-org/json-schema-spec/` +
      `${resource.commit}/${resource.sourcePath}`;
    const content = await download(url);
    const schema = JSON.parse(content.toString("utf8"));
    const identity = resource.dialect === "draft4" ? schema.id : schema.$id;
    if (identity !== resource.uri) {
      throw new Error(`Upstream identity mismatch for ${resource.sourcePath}`);
    }
    downloads.push({ resource, content });
  }

  const licenseResponse = JSON.parse(
    (await download(manifest.license.source)).toString("utf8")
  );
  if (licenseResponse.sha !== manifest.license.gitBlobSha1) {
    throw new Error("Upstream license blob identity mismatch");
  }
  const license = Buffer.from(licenseResponse.content, "base64");

  for (const { resource, content } of downloads) {
    const localPath = path.join(sourceRoot, resource.localPath);
    mkdirSync(path.dirname(localPath), { recursive: true });
    writeFileSync(localPath, content);
    resource.sha256 = sha256(content);
  }
  writeFileSync(path.join(sourceRoot, manifest.license.localPath), license);
  manifest.license.sha256 = sha256(license);

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  require("./generate-official-meta-schemas.cjs")();
}

update().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
