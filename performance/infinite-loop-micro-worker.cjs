const fs = require("node:fs");

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[argv[index].replace(/^--/, "")] = argv[index + 1];
  }
  return values;
}

function assertBeforeDeadline(deadlineEpochMs) {
  if (Date.now() >= deadlineEpochMs) {
    throw new Error("COOPERATIVE_DEADLINE_EXCEEDED");
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const deadlineEpochMs = Number(args["deadline-epoch-ms"]);
  const manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  const ids = new Set([
    "infinite-loop-detection.json#0:0",
    "infinite-loop-detection.json#0:1"
  ]);
  const cases = manifest.cases.filter((item) => ids.has(item.id));
  if (cases.length !== 2) {
    throw new Error("infinite-loop cohort must contain exactly two cases");
  }
  const exported = require(args.bundle);
  const warmupCount = 2000;
  const iterations = 100000;
  let sink = 0;
  const measurements = [];

  for (const item of cases) {
    assertBeforeDeadline(deadlineEpochMs);
    const validate = new exported.SchemaShield().compile(cloneJson(item.schema));
    const data = cloneJson(item.data);
    for (let index = 0; index < warmupCount; index++) {
      if ((index & 1023) === 0) {
        assertBeforeDeadline(deadlineEpochMs);
      }
      sink += validate(data).valid ? 1 : 0;
    }
    const started = process.hrtime.bigint();
    for (let index = 0; index < iterations; index++) {
      if ((index & 1023) === 0) {
        assertBeforeDeadline(deadlineEpochMs);
      }
      sink += validate(data).valid ? 1 : 0;
    }
    const elapsed = Number(process.hrtime.bigint() - started);
    measurements.push({
      id: item.id,
      nanosecondsPerOperation: elapsed / iterations
    });
  }

  process.stdout.write(JSON.stringify({ measurements, sink }));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
