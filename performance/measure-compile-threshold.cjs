const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parseArguments(argv) {
  const allowed = new Set([
    "--operation",
    "--depths",
    "--phase",
    "--deadline-ms"
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

  if (
    !new Set([
      "compile",
      "validate",
      "validate-defaults",
      "validate-fail-fast",
      "compile-cycle"
    ]).has(values.operation)
  ) {
    throw new Error("unsupported operation");
  }
  if (!new Set(["pre-guard", "post-guard"]).has(values.phase)) {
    throw new Error("phase must be pre-guard or post-guard");
  }

  const depths = String(values.depths || "")
    .split(",")
    .map((value) => Number(value));
  if (
    depths.length === 0 ||
    depths.some((value) => !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error("depths must be comma-separated non-negative integers");
  }
  if (values.phase === "pre-guard" && depths.some((depth) => depth > 128)) {
    throw new Error("pre-guard probes cannot exceed depth 128");
  }

  const deadlineMs = Number(values["deadline-ms"] || "295000");
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
    throw new Error("deadline-ms must be a positive integer");
  }

  return {
    operation: values.operation,
    depths,
    phase: values.phase,
    deadlineMs
  };
}

function runProbe(operation, depth) {
  const worker = path.resolve(__dirname, "depth-probe-worker.cjs");
  const child = spawnSync(
    process.execPath,
    [worker, "--operation", operation, "--depth", String(depth)],
    {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }
  );

  if (child.signal !== null) {
    throw new Error(`DEPTH_PROBE_SIGNAL:${child.signal}`);
  }
  if (child.stdout.trim().length === 0) {
    throw new Error(
      `DEPTH_PROBE_EMPTY_OUTPUT:${child.status}:${child.stderr.trim()}`
    );
  }

  let result;
  try {
    result = JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(`DEPTH_PROBE_INVALID_OUTPUT:${child.stdout.trim()}`);
  }

  if (child.status !== 0 || result.controlled !== true) {
    throw new Error(
      `DEPTH_PROBE_UNCONTROLLED:${child.status}:${JSON.stringify(result)}`
    );
  }
  return result;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const deadlineEpochMs = Date.now() + args.deadlineMs;
  const probes = [];

  for (const depth of args.depths) {
    if (Date.now() >= deadlineEpochMs) {
      throw new Error("COOPERATIVE_DEADLINE_EXCEEDED");
    }
    probes.push(runProbe(args.operation, depth));
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        runtime:
          typeof Bun === "object" ? `bun-${Bun.version}` : `node-${process.version}`,
        operation: args.operation,
        phase: args.phase,
        probes
      },
      null,
      2
    )}\n`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
