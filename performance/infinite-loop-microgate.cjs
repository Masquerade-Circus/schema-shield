const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  assertAbsoluteBundlePath,
  geometricMean
} = require("./external-gate-lib.cjs");

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[argv[index].replace(/^--/, "")] = argv[index + 1];
  }
  return values;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function runWorker(bundle, manifest, deadlineEpochMs) {
  const worker = path.resolve(__dirname, "infinite-loop-micro-worker.cjs");
  const child = spawnSync(
    process.execPath,
    [
      worker,
      "--bundle",
      bundle,
      "--manifest",
      manifest,
      "--deadline-epoch-ms",
      String(deadlineEpochMs)
    ],
    {
      cwd: __dirname,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }
  );
  if (child.signal !== null) {
    throw new Error(`micro worker ended by signal ${child.signal}`);
  }
  if (child.status !== 0 || child.stdout.trim() === "") {
    throw new Error(`micro worker failed: ${child.stderr || child.stdout}`);
  }
  return JSON.parse(child.stdout);
}

function summarize(values) {
  return {
    min: Math.min(...values),
    median: median(values),
    max: Math.max(...values),
    samples: values
  };
}

function main() {
  const startedAt = Date.now();
  const args = parseArguments(process.argv.slice(2));
  const baseline = assertAbsoluteBundlePath(args.baseline, "baseline");
  const candidate = assertAbsoluteBundlePath(args.candidate, "candidate");
  const manifest = path.resolve(__dirname, "../tmp/corpus/bcf1dc81/manifest.json");
  const deadlineEpochMs = startedAt + 25000;
  const rates = {
    baseline: new Map(),
    candidate: new Map()
  };

  for (let round = 0; round < 7; round++) {
    const order = round % 2 === 0
      ? ["baseline", "candidate"]
      : ["candidate", "baseline"];
    for (const role of order) {
      if (Date.now() >= deadlineEpochMs) {
        throw new Error("COOPERATIVE_DEADLINE_EXCEEDED");
      }
      const result = runWorker(
        role === "baseline" ? baseline : candidate,
        manifest,
        deadlineEpochMs
      );
      for (const measurement of result.measurements) {
        const values = rates[role].get(measurement.id) || [];
        values.push(measurement.nanosecondsPerOperation);
        rates[role].set(measurement.id, values);
      }
    }
  }

  const cases = {};
  const ratios = [];
  for (const [id, baselineValues] of rates.baseline) {
    const candidateValues = rates.candidate.get(id);
    const baselineSummary = summarize(baselineValues);
    const candidateSummary = summarize(candidateValues);
    const ratio = baselineSummary.median / candidateSummary.median;
    ratios.push(ratio);
    cases[id] = {
      baseline: baselineSummary,
      candidate: candidateSummary,
      ratio
    };
  }
  const cohortRatio = geometricMean(ratios);
  const durationMs = Date.now() - startedAt;
  const passed =
    durationMs < 30000 &&
    cohortRatio >= 0.95 &&
    ratios.every((ratio) => ratio >= 0.95);
  const report = {
    status: passed ? "PASS" : "FAIL_PERFORMANCE",
    durationMs,
    rounds: 7,
    warmupCount: 2000,
    iterations: 100000,
    order: "alternating baseline/candidate",
    cohortRatio,
    cases
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (typeof args.report === "string") {
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
