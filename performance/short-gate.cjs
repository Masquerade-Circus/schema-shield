const fs = require("fs");
const path = require("path");

const CASE_COUNT = 1_003;
const WARMUP_ITERATIONS = 200;
const ITERATIONS = 1_000;
const REPETITIONS = 3;
const MAX_DURATION_SECONDS = 300;
const MAX_GLOBAL_RATIO = 1.05;
const MAX_COHORT_RATIO = 1.1;

const root = path.resolve(__dirname, "..");
const baselinePath = process.env.SHORT_GATE_BASELINE || process.argv[2];
const candidatePath =
  process.env.SHORT_GATE_CANDIDATE || process.argv[3] || "lib/index.ts";

if (typeof baselinePath !== "string" || baselinePath.length === 0) {
  throw new Error(
    "Baseline entrypoint is required. Run: npm run benchmark:short -- <baseline> [candidate]"
  );
}

const resolvedBaseline = path.resolve(root, baselinePath);
const resolvedCandidate = path.resolve(root, candidatePath);
if (resolvedBaseline === resolvedCandidate) {
  throw new Error("Baseline and candidate entrypoints must be different");
}
if (!fs.existsSync(resolvedBaseline)) {
  throw new Error(`Baseline entrypoint does not exist: ${resolvedBaseline}`);
}
if (!fs.existsSync(resolvedCandidate)) {
  throw new Error(`Candidate entrypoint does not exist: ${resolvedCandidate}`);
}

const skippedGroups = new Map([
  ["items and subitems", true],
  ["$id inside an unknown keyword is not a real identifier", true],
  ["validate definition against metaschema", true],
  ["remote ref, containing refs itself", true],
  ["Location-independent identifier with base URI change in subschema", true],
  ["refs with relative uris and defs", true],
  ["relative refs with absolute uris and defs", true],
  ["RN base URI with URN and JSON pointer ref", true],
  ["URN base URI with URN and JSON pointer ref", true],
  ["URN base URI with URN and anchor ref", true],
  ["ref with absolute-path-reference", true],
  [
    "evaluating the same schema location against the same data location twice is not a sign of an infinite loop",
    true
  ]
]);
const skippedTests = new Map([
  [
    "maxLength validation\0two supplementary Unicode code points is long enough",
    true
  ],
  [
    "minLength validation\0one supplementary Unicode code point is not long enough",
    true
  ],
  [
    "float division = inf\0always invalid, but naive implementations may raise an overflow error",
    true
  ]
]);

function loadCases() {
  const suiteRoot = path.dirname(
    require.resolve("json-schema-test-suite/package.json")
  );
  const draftRoot = path.join(suiteRoot, "tests", "draft6");
  const inputs = [];

  for (const file of fs.readdirSync(draftRoot).sort()) {
    if (file.endsWith(".json")) {
      inputs.push({
        path: path.join(draftRoot, file),
        file: file.slice(0, -5),
        cohort: "core"
      });
    }
  }

  const formatRoot = path.join(draftRoot, "optional", "format");
  for (const file of fs.readdirSync(formatRoot).sort()) {
    if (file.endsWith(".json")) {
      inputs.push({
        path: path.join(formatRoot, file),
        file: `optional/format/${file.slice(0, -5)}`,
        cohort: "optional-format"
      });
    }
  }

  for (const file of ["ecmascript-regex.json", "non-bmp-regex.json"]) {
    inputs.push({
      path: path.join(draftRoot, "optional", file),
      file: `optional/${file.slice(0, -5)}`,
      cohort: "optional-regex"
    });
  }

  const skippedFiles = new Set([
    "refRemote",
    "id",
    "optional/format/unknown"
  ]);
  const cases = [];
  for (const input of inputs) {
    if (skippedFiles.has(input.file)) {
      continue;
    }
    const groups = JSON.parse(fs.readFileSync(input.path, "utf8"));
    for (const group of groups) {
      if (skippedGroups.has(group.description)) {
        continue;
      }
      for (const test of group.tests) {
        if (skippedTests.has(`${group.description}\0${test.description}`)) {
          continue;
        }
        cases.push({
          id: cases.length,
          file: input.file,
          cohort: `${input.cohort}:${test.valid ? "valid" : "invalid"}`,
          schema: group.schema,
          data: test.data,
          valid: test.valid
        });
      }
    }
  }

  if (cases.length !== CASE_COUNT) {
    throw new Error(
      `Dataset contract changed: expected ${CASE_COUNT} cases, received ${cases.length}`
    );
  }
  return cases;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function geometricMean(values) {
  return Math.exp(
    values.reduce((sum, value) => sum + Math.log(value), 0) / values.length
  );
}

function run(validator, data, count) {
  let sink = 0;
  for (let index = 0; index < count; index++) {
    sink += validator(data).valid ? 1 : 0;
  }
  return sink;
}

const startedAt = process.hrtime.bigint();
const cases = loadCases();
const baselineModule = require(resolvedBaseline);
const candidateModule = require(resolvedCandidate);
if (
  baselineModule.SchemaShield === candidateModule.SchemaShield ||
  baselineModule.SchemaShield.prototype === candidateModule.SchemaShield.prototype
) {
  throw new Error("Baseline and candidate must load isolated SchemaShield classes");
}

const ratios = { global: [] };
let sink = 0;
for (const benchmarkCase of cases) {
  const baselineData = structuredClone(benchmarkCase.data);
  const candidateData = structuredClone(benchmarkCase.data);
  const baseline = new baselineModule.SchemaShield({ failFast: true }).compile(
    structuredClone(benchmarkCase.schema)
  );
  const candidate = new candidateModule.SchemaShield({ failFast: true }).compile(
    structuredClone(benchmarkCase.schema)
  );

  if (
    baseline(baselineData).valid !== benchmarkCase.valid ||
    candidate(candidateData).valid !== benchmarkCase.valid
  ) {
    throw new Error(`Parity failed for case ${benchmarkCase.id}`);
  }
  sink += run(baseline, baselineData, WARMUP_ITERATIONS);
  sink += run(candidate, candidateData, WARMUP_ITERATIONS);

  const baselineSamples = [];
  const candidateSamples = [];
  for (let repetition = 0; repetition < REPETITIONS; repetition++) {
    const candidateFirst = (benchmarkCase.id + repetition) % 2 === 0;
    const engines = candidateFirst
      ? [
          [candidate, candidateData, candidateSamples],
          [baseline, baselineData, baselineSamples]
        ]
      : [
          [baseline, baselineData, baselineSamples],
          [candidate, candidateData, candidateSamples]
        ];
    for (const [validator, data, samples] of engines) {
      const start = process.hrtime.bigint();
      sink += run(validator, data, ITERATIONS);
      samples.push(Number(process.hrtime.bigint() - start) / ITERATIONS);
    }
  }

  const ratio = median(candidateSamples) / median(baselineSamples);
  ratios.global.push(ratio);
  if (!ratios[benchmarkCase.cohort]) {
    ratios[benchmarkCase.cohort] = [];
  }
  ratios[benchmarkCase.cohort].push(ratio);
}

const summary = Object.fromEntries(
  Object.entries(ratios).map(([cohort, values]) => [
    cohort,
    Number(geometricMean(values).toFixed(4))
  ])
);
const durationSeconds =
  Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
const failedCohorts = Object.entries(summary)
  .filter(([cohort, ratio]) =>
    cohort === "global"
      ? ratio > MAX_GLOBAL_RATIO
      : ratio > MAX_COHORT_RATIO
  )
  .map(([cohort]) => cohort);
const passed =
  durationSeconds < MAX_DURATION_SECONDS && failedCohorts.length === 0;

process.stdout.write(
  `${JSON.stringify(
    {
      baseline: resolvedBaseline,
      candidate: resolvedCandidate,
      cases: cases.length,
      iterations: ITERATIONS,
      warmupIterations: WARMUP_ITERATIONS,
      repetitions: REPETITIONS,
      durationSeconds: Number(durationSeconds.toFixed(3)),
      sink,
      ratios: summary,
      limits: {
        durationSeconds: MAX_DURATION_SECONDS,
        globalRatio: MAX_GLOBAL_RATIO,
        cohortRatio: MAX_COHORT_RATIO
      },
      passed,
      failedCohorts
    },
    null,
    2
  )}\n`
);

if (!passed) {
  process.exitCode = 1;
}
