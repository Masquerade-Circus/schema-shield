const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const {
  assertAbsoluteBundlePath,
  geometricMean,
  parsePositiveDeadline,
  resultMatchesContract
} = require("./external-gate-lib.cjs");

function parseArguments(argv) {
  const allowed = new Set([
    "--baseline",
    "--candidate",
    "--previous",
    "--timeout-ms",
    "--report",
    "--smoke"
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
  for (const key of ["baseline", "candidate", "previous", "timeout-ms"]) {
    if (typeof values[key] !== "string") {
      throw new Error(`${key} is required`);
    }
  }
  return values;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function runWorker({
  mode,
  bundle,
  manifest,
  caseIds,
  deadlineEpochMs,
  benchmarkOptions
}) {
  const worker = path.resolve(__dirname, "external-worker.cjs");
  const args = [
    "--expose-gc",
    worker,
    "--mode",
    mode,
    "--bundle",
    bundle,
    "--manifest",
    manifest,
    "--deadline-epoch-ms",
    String(deadlineEpochMs)
  ];
  if (mode === "benchmark") {
    args.push("--case-ids", caseIds);
    for (const [key, value] of Object.entries(benchmarkOptions)) {
      args.push(`--${key}`, String(value));
    }
  }
  const child = spawnSync(process.execPath, args, {
    cwd: __dirname,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (child.signal !== null) {
    throw new Error(`worker ended by signal ${child.signal}`);
  }
  if (child.status !== 0) {
    throw new Error(`worker failed: ${child.stderr || child.stdout}`);
  }
  return JSON.parse(child.stdout);
}

function aggregateMeasurements(samples) {
  const byId = new Map();
  let compileNanoseconds = 0;
  for (const sample of samples) {
    compileNanoseconds += sample.compileNanoseconds;
    for (const measurement of sample.measurements) {
      const values = byId.get(measurement.id) || [];
      values.push(measurement.nanosecondsPerOperation);
      byId.set(measurement.id, values);
    }
  }
  return {
    compileNanoseconds: compileNanoseconds / samples.length,
    rates: new Map(
      [...byId].map(([id, values]) => [id, median(values)])
    )
  };
}

function ratioReport(candidate, reference, casesById) {
  const ratios = [];
  const cohorts = new Map();
  const cases = {};
  for (const [id, candidateRate] of candidate.rates) {
    const referenceRate = reference.rates.get(id);
    const ratio = referenceRate / candidateRate;
    ratios.push(ratio);
    cases[id] = ratio;
    const item = casesById.get(id);
    const keys = [
      `file:${item.relativePath}`,
      `valid:${item.expected}`
    ];
    for (const key of keys) {
      const values = cohorts.get(key) || [];
      values.push(ratio);
      cohorts.set(key, values);
    }
  }
  return {
    global: geometricMean(ratios),
    cases,
    cohorts: Object.fromEntries(
      [...cohorts].map(([name, values]) => [name, geometricMean(values)])
    )
  };
}

function main() {
  const startedAt = Date.now();
  const args = parseArguments(process.argv.slice(2));
  const timeoutMs = parsePositiveDeadline(args["timeout-ms"]);
  const smoke = args.smoke === "true";
  const deadlineEpochMs = startedAt + timeoutMs;
  for (const key of ["baseline", "candidate", "previous"]) {
    assertAbsoluteBundlePath(args[key], key);
  }

  const corpusRoot = path.resolve(__dirname, "../tmp/corpus/bcf1dc81");
  const manifestPath = path.join(corpusRoot, "manifest.json");
  const allowlistPath = path.join(corpusRoot, "production-allowlist.json");
  const caseIdsPath = path.join(corpusRoot, "throughput-cases.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  const throughputCases = JSON.parse(fs.readFileSync(caseIdsPath, "utf8"));
  const correctionPath = path.resolve(__dirname, "accepted-corrections.json");
  const acceptedCorrections = fs.existsSync(correctionPath)
    ? new Set(JSON.parse(fs.readFileSync(correctionPath, "utf8")))
    : new Set();
  const productionById = new Map(allowlist.map((item) => [item.id, item]));
  const casesById = new Map(manifest.cases.map((item) => [item.id, item]));

  const parity = runWorker({
    mode: "parity",
    bundle: args.candidate,
    manifest: manifestPath,
    caseIds: caseIdsPath,
    deadlineEpochMs
  });
  const divergences = [];
  for (const result of parity.results) {
    const item = casesById.get(result.id);
    const production = productionById.get(result.id) || null;
    if (
      !resultMatchesContract(result, {
        expected: item.expected,
        production,
        correctionAccepted: acceptedCorrections.has(result.id)
      })
    ) {
      divergences.push({
        id: result.id,
        expected: item.expected,
        production,
        candidate: result
      });
    }
  }
  if (divergences.length > 0) {
    const report = { status: "FAIL_PARITY", divergences };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const bundles = {
    baseline: args.baseline,
    candidate: args.candidate,
    previous: args.previous
  };
  const hashes = Object.fromEntries(
    Object.entries(bundles).map(([name, bundle]) => [name, sha256File(bundle)])
  );
  const samplesByHash = new Map();
  const uniqueRoles = [];
  for (const role of ["baseline", "candidate", "previous"]) {
    if (!uniqueRoles.some((other) => hashes[other] === hashes[role])) {
      uniqueRoles.push(role);
    }
  }
  const rounds = smoke ? 1 : 5;
  const benchmarkOptions = smoke
    ? {
        "case-limit": 24,
        "warmup-count": 8,
        "sample-count": 1,
        "target-ns": 100000,
        "max-iterations": 64
      }
    : {
        "case-limit": throughputCases.caseIds.length,
        "warmup-count": 200,
        "sample-count": 3,
        "target-ns": 2000000,
        "max-iterations": 4096
      };
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 === 0 ? uniqueRoles : [...uniqueRoles].reverse();
    for (const role of order) {
      if (Date.now() >= deadlineEpochMs) {
        throw new Error("COOPERATIVE_DEADLINE_EXCEEDED");
      }
      const hash = hashes[role];
      const samples = samplesByHash.get(hash) || [];
      samples.push(
        runWorker({
          mode: "benchmark",
          bundle: bundles[role],
          manifest: manifestPath,
          caseIds: caseIdsPath,
          deadlineEpochMs,
          benchmarkOptions
        })
      );
      samplesByHash.set(hash, samples);
    }
  }

  const measurements = {};
  for (const role of ["baseline", "candidate", "previous"]) {
    measurements[role] = aggregateMeasurements(samplesByHash.get(hashes[role]));
  }
  const candidateVsProduction = ratioReport(
    measurements.candidate,
    measurements.baseline,
    casesById
  );
  const candidateVsPrevious = ratioReport(
    measurements.candidate,
    measurements.previous,
    casesById
  );
  const failedCohorts = Object.entries(candidateVsProduction.cohorts)
    .filter(([, ratio]) => ratio < 0.95)
    .map(([name, ratio]) => ({ name, ratio }));
  const durationMs = Date.now() - startedAt;
  const passed = smoke
    ? durationMs < timeoutMs
    : candidateVsProduction.global >= 0.98 &&
      failedCohorts.length === 0 &&
      durationMs < timeoutMs;
  const report = {
    status: passed ? (smoke ? "SMOKE_PASS" : "PASS") : "FAIL_PERFORMANCE",
    smoke,
    durationMs,
    timeoutMs,
    manifestSha256: sha256File(manifestPath),
    allowlistSha256: sha256File(allowlistPath),
    throughputSha256: sha256File(caseIdsPath),
    throughputCaseCount: throughputCases.caseIds.length,
    throughputSource: throughputCases.source,
    bundlePaths: bundles,
    bundleSha256: hashes,
    compileNanoseconds: Object.fromEntries(
      Object.entries(measurements).map(([name, value]) => [
        name,
        value.compileNanoseconds
      ])
    ),
    candidateVsProduction,
    candidateVsPrevious,
    failedCohorts,
    parityDivergences: divergences
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (typeof args.report === "string") {
    if (!path.isAbsolute(args.report)) {
      throw new Error("report must be an absolute path");
    }
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, output);
  }
  process.stdout.write(output);
  if (!passed) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
