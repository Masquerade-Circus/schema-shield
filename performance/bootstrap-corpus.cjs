const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  assertAbsoluteBundlePath,
  stableCaseId
} = require("./external-gate-lib.cjs");

function parseArguments(argv) {
  const allowed = new Set([
    "--source",
    "--destination",
    "--baseline",
    "--ajv",
    "--schemasafe"
  ]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || typeof value !== "string") {
      throw new Error(`Unsupported or incomplete argument: ${key || "<missing>"}`);
    }
    values[key.slice(2)] = value;
  }
  for (const key of ["source", "destination", "baseline", "ajv", "schemasafe"]) {
    if (typeof values[key] !== "string" || !path.isAbsolute(values[key])) {
      throw new Error(`${key} must be an absolute path`);
    }
  }
  return values;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function listJsonFiles(directory, prefix = "") {
  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(absolute, relative));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(relative);
    }
  }
  return files;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedError(error) {
  if (error === null || typeof error !== "object") {
    return String(error);
  }
  return `${error.name || "Error"}: ${error.message || String(error)}`;
}

function createProductionEngine(bundlePath) {
  const exported = require(bundlePath);
  return {
    name: "schema-shield-production",
    version: "1.0.5",
    compile(schema) {
      return new exported.SchemaShield().compile(cloneJson(schema));
    },
    execute(validate, data) {
      return validate(cloneJson(data)).valid;
    }
  };
}

function createAjvEngine(modulePath) {
  const Ajv = require(modulePath);
  const version = require(path.join(modulePath, "package.json")).version;
  return {
    name: "ajv",
    version,
    compile(schema) {
      const ajv = new Ajv({ schemaId: "auto", unknownFormats: "ignore" });
      return ajv.compile(cloneJson(schema));
    },
    execute(validate, data) {
      return Boolean(validate(cloneJson(data)));
    }
  };
}

function createSchemasafeEngine(modulePath) {
  const schemasafe = require(modulePath);
  const version = require(path.join(modulePath, "package.json")).version;
  return {
    name: "@exodus/schemasafe",
    version,
    compile(schema) {
      return schemasafe.validator(cloneJson(schema), {
        includeErrors: false,
        allErrors: false,
        requireSchema: false,
        mode: "default"
      });
    },
    execute(validate, data) {
      return Boolean(validate(cloneJson(data)));
    }
  };
}

function evaluateCase(engine, schema, data) {
  try {
    const validate = engine.compile(schema);
    return { observed: engine.execute(validate, data), error: null };
  } catch (error) {
    return { observed: null, error: normalizedError(error) };
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  assertAbsoluteBundlePath(args.baseline, "baseline");
  if (!fs.statSync(args.source).isDirectory()) {
    throw new Error("source must be a corpus directory");
  }

  fs.mkdirSync(args.destination, { recursive: true });
  const files = listJsonFiles(args.source);
  const sourceFiles = [];
  const cases = [];
  let order = 0;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const relativePath = files[fileIndex];
    const sourcePath = path.join(args.source, relativePath);
    const destinationPath = path.join(args.destination, relativePath);
    const content = fs.readFileSync(sourcePath);
    const sourceHash = sha256(content);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, content);
    sourceFiles.push({ path: relativePath, size: content.length, sha256: sourceHash });

    const groups = JSON.parse(content.toString("utf8"));
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      for (let testIndex = 0; testIndex < group.tests.length; testIndex++) {
        const test = group.tests[testIndex];
        const excluded = relativePath === "refRemote.json";
        cases.push({
          id: stableCaseId(relativePath, groupIndex, testIndex),
          relativePath,
          fileIndex,
          groupIndex,
          testIndex,
          order,
          sourceSha256: sourceHash,
          groupDescription: group.description,
          testDescription: test.description,
          schema: group.schema,
          data: test.data,
          expected: Boolean(test.valid),
          excluded,
          exclusionReason: excluded
            ? "external references are outside the hermetic product contract"
            : null
        });
        order++;
      }
    }
  }

  const production = createProductionEngine(args.baseline);
  const ajv = createAjvEngine(args.ajv);
  const schemasafe = createSchemasafeEngine(args.schemasafe);
  const productionResults = new Map();
  const allowlist = [];
  const intersection = [];

  for (const item of cases) {
    if (item.excluded) {
      continue;
    }
    const productionResult = evaluateCase(
      production,
      item.schema,
      item.data
    );
    productionResults.set(item.id, productionResult);
    if (
      productionResult.error !== null ||
      productionResult.observed !== item.expected
    ) {
      allowlist.push({
        id: item.id,
        expected: item.expected,
        observed: productionResult.observed,
        error: productionResult.error,
        reason: "divergence present in schema-shield@1.0.5"
      });
    }

    if (productionResult.error !== null) {
      continue;
    }
    const ajvResult = evaluateCase(ajv, item.schema, item.data);
    const schemasafeResult = evaluateCase(schemasafe, item.schema, item.data);
    if (
      ajvResult.error === null &&
      schemasafeResult.error === null &&
      ajvResult.observed === item.expected &&
      schemasafeResult.observed === item.expected
    ) {
      intersection.push(item.id);
    }
  }

  const manifest = {
    corpusCommit: "bcf1dc81ae099ade2a9642c672c06ee1af1bb489",
    draft: "draft6",
    files: sourceFiles,
    cases
  };
  const manifestPath = path.join(args.destination, "manifest.json");
  const sourceFilesPath = path.join(args.destination, "source-files.json");
  const allowlistPath = path.join(args.destination, "production-allowlist.json");
  const intersectionPath = path.join(args.destination, "throughput-intersection.json");
  writeJson(sourceFilesPath, sourceFiles);
  writeJson(manifestPath, manifest);
  writeJson(allowlistPath, allowlist);
  writeJson(intersectionPath, {
    engines: [
      { name: production.name, version: production.version },
      { name: ajv.name, version: ajv.version },
      { name: schemasafe.name, version: schemasafe.version }
    ],
    caseIds: intersection
  });

  const report = {
    sourceFileCount: sourceFiles.length,
    caseCount: cases.length,
    excludedCount: cases.filter((item) => item.excluded).length,
    productionAllowlistCount: allowlist.length,
    throughputIntersectionCount: intersection.length,
    manifestSha256: sha256(fs.readFileSync(manifestPath)),
    allowlistSha256: sha256(fs.readFileSync(allowlistPath)),
    intersectionSha256: sha256(fs.readFileSync(intersectionPath))
  };
  writeJson(path.join(args.destination, "bootstrap-report.json"), report);
  console.log(JSON.stringify(report, null, 2));
}

main();
