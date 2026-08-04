const fs = require("node:fs");
const path = require("node:path");
let benchmarkSink = 0;

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[argv[index].replace(/^--/, "")] = argv[index + 1];
  }
  return values;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedError(error) {
  return `${error?.name || "Error"}: ${error?.message || String(error)}`;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function createEngine(bundlePath) {
  const exported = require(bundlePath);
  return {
    compile(schema) {
      return new exported.SchemaShield().compile(cloneJson(schema));
    },
    execute(validate, data) {
      return validate(data).valid;
    }
  };
}

function assertBeforeDeadline(deadlineEpochMs) {
  if (Date.now() >= deadlineEpochMs) {
    throw new Error("COOPERATIVE_DEADLINE_EXCEEDED");
  }
}

function compileGroups(engine, cases, deadlineEpochMs) {
  const validators = new Map();
  let compileNanoseconds = 0;
  for (const item of cases) {
    const key = `${item.relativePath}#${item.groupIndex}`;
    if (validators.has(key)) {
      continue;
    }
    assertBeforeDeadline(deadlineEpochMs);
    const started = process.hrtime.bigint();
    const validate = engine.compile(item.schema);
    compileNanoseconds += Number(process.hrtime.bigint() - started);
    validators.set(key, validate);
  }
  return { validators, compileNanoseconds };
}

function runParity(engine, cases, deadlineEpochMs) {
  const results = [];
  const validators = new Map();
  const compileErrors = new Map();
  for (const item of cases) {
    if (item.excluded) {
      continue;
    }
    assertBeforeDeadline(deadlineEpochMs);
    const key = `${item.relativePath}#${item.groupIndex}`;
    if (!validators.has(key) && !compileErrors.has(key)) {
      try {
        validators.set(key, engine.compile(item.schema));
      } catch (error) {
        compileErrors.set(key, normalizedError(error));
      }
    }
    if (compileErrors.has(key)) {
      results.push({
        id: item.id,
        observed: null,
        error: compileErrors.get(key)
      });
      continue;
    }
    try {
      results.push({
        id: item.id,
        observed: engine.execute(validators.get(key), cloneJson(item.data)),
        error: null
      });
    } catch (error) {
      results.push({ id: item.id, observed: null, error: normalizedError(error) });
    }
  }
  return { mode: "parity", results };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildInputs(data, count, deadlineEpochMs) {
  const inputs = new Array(count);
  for (let index = 0; index < count; index++) {
    if ((index & 255) === 0) {
      assertBeforeDeadline(deadlineEpochMs);
    }
    inputs[index] = cloneJson(data);
  }
  return inputs;
}

function calibrate(
  engine,
  validate,
  data,
  deadlineEpochMs,
  targetNanoseconds,
  maxIterations
) {
  const inputs = Array.from({ length: 16 }, () => cloneJson(data));
  const started = process.hrtime.bigint();
  for (let index = 0; index < inputs.length; index++) {
    assertBeforeDeadline(deadlineEpochMs);
    benchmarkSink += engine.execute(validate, inputs[index]) ? 1 : 0;
  }
  const elapsed = Number(process.hrtime.bigint() - started);
  if (elapsed <= 0) {
    return maxIterations;
  }
  const estimated = Math.round((targetNanoseconds * inputs.length) / elapsed);
  return Math.max(16, Math.min(maxIterations, estimated));
}

function runBenchmark(engine, cases, caseIds, deadlineEpochMs, options) {
  const selected = cases
    .filter((item) => caseIds.has(item.id))
    .slice(0, options.caseLimit);
  const { validators, compileNanoseconds } = compileGroups(
    engine,
    selected,
    deadlineEpochMs
  );
  if (typeof global.gc === "function") {
    global.gc();
  }
  const measurements = [];
  for (const item of selected) {
    assertBeforeDeadline(deadlineEpochMs);
    const validate = validators.get(`${item.relativePath}#${item.groupIndex}`);
    for (let index = 0; index < options.warmupCount; index++) {
      if ((index & 31) === 0) {
        assertBeforeDeadline(deadlineEpochMs);
      }
      benchmarkSink += engine.execute(validate, cloneJson(item.data)) ? 1 : 0;
    }
    const iterations = calibrate(
      engine,
      validate,
      item.data,
      deadlineEpochMs,
      options.targetNanoseconds,
      options.maxIterations
    );
    const sampleRates = [];
    for (let sample = 0; sample < options.sampleCount; sample++) {
      assertBeforeDeadline(deadlineEpochMs);
      const inputs = buildInputs(item.data, iterations, deadlineEpochMs);
      const started = process.hrtime.bigint();
      for (let index = 0; index < inputs.length; index++) {
        if ((index & 255) === 0) {
          assertBeforeDeadline(deadlineEpochMs);
        }
        benchmarkSink += engine.execute(validate, inputs[index]) ? 1 : 0;
      }
      const elapsed = Number(process.hrtime.bigint() - started);
      sampleRates.push(elapsed / iterations);
    }
    measurements.push({
      id: item.id,
      nanosecondsPerOperation: median(sampleRates),
      iterations
    });
  }
  return {
    mode: "benchmark",
    compileNanoseconds,
    benchmarkSink,
    measurements
  };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  const deadlineEpochMs = Number(args["deadline-epoch-ms"]);
  if (!Number.isFinite(deadlineEpochMs)) {
    throw new Error("deadline-epoch-ms is required");
  }
  const engine = createEngine(path.resolve(args.bundle));
  if (args.mode === "parity") {
    process.stdout.write(
      JSON.stringify(runParity(engine, manifest.cases, deadlineEpochMs))
    );
    return;
  }
  if (args.mode === "benchmark") {
    const caseIdsFile = JSON.parse(
      fs.readFileSync(args["case-ids"], "utf8")
    );
    const options = {
      caseLimit: positiveInteger(args["case-limit"], Number.MAX_SAFE_INTEGER),
      warmupCount: positiveInteger(args["warmup-count"], 200),
      sampleCount: positiveInteger(args["sample-count"], 3),
      targetNanoseconds: positiveInteger(args["target-ns"], 2000000),
      maxIterations: positiveInteger(args["max-iterations"], 4096)
    };
    process.stdout.write(
      JSON.stringify(
        runBenchmark(
          engine,
          manifest.cases,
          new Set(caseIdsFile.caseIds),
          deadlineEpochMs,
          options
        )
      )
    );
    return;
  }
  throw new Error(`Unsupported worker mode: ${args.mode}`);
}

main();
