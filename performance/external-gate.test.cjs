const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertAbsoluteBundlePath,
  geometricMean,
  parsePositiveDeadline,
  resultMatchesContract,
  stableCaseId
} = require("./external-gate-lib.cjs");

test("rejects relative, TypeScript, and missing bundle paths", () => {
  assert.throws(
    () => assertAbsoluteBundlePath("dist/index.js", "baseline"),
    /baseline must be an absolute path/
  );
  assert.throws(
    () => assertAbsoluteBundlePath("/repo/lib/index.ts", "candidate"),
    /candidate must be a CJS JavaScript bundle/
  );
  assert.throws(
    () => assertAbsoluteBundlePath("/definitely/missing/index.js", "previous"),
    /previous bundle does not exist/
  );
});

test("accepts only the cooperative deadline required by the plan", () => {
  for (const value of ["", "0", "-1", "295000.5", "NaN", "Infinity"]){
    assert.throws(
      () => parsePositiveDeadline(value),
      /timeout-ms must be a positive integer/
    );
  }
  assert.equal(parsePositiveDeadline("295000"), 295000);
});

test("builds stable case IDs from manifest coordinates", () => {
  assert.equal(
    stableCaseId("optional/format/email.json", 2, 4),
    "optional/format/email.json#2:4"
  );
  assert.throws(
    () => stableCaseId("../email.json", 0, 0),
    /relative corpus path is invalid/
  );
});

test("rejects new parity errors and accepts frozen production outcomes", () => {
  assert.equal(
    resultMatchesContract(
      { observed: true, error: null },
      { expected: true, production: null, correctionAccepted: false }
    ),
    true
  );
  assert.equal(
    resultMatchesContract(
      { observed: false, error: null },
      {
        expected: true,
        production: { observed: false, error: null },
        correctionAccepted: false
      }
    ),
    true
  );
  assert.equal(
    resultMatchesContract(
      { observed: true, error: null },
      {
        expected: true,
        production: { observed: false, error: null },
        correctionAccepted: true
      }
    ),
    true
  );
  assert.equal(
    resultMatchesContract(
      { observed: null, error: "RangeError: overflow" },
      { expected: true, production: null, correctionAccepted: false }
    ),
    false
  );
});

test("computes geometric means and rejects invalid ratios", () => {
  assert.equal(geometricMean([1, 1, 1]), 1);
  assert.ok(Math.abs(geometricMean([0.5, 2]) - 1) < 1e-12);
  assert.throws(() => geometricMean([]), /at least one ratio/);
  assert.throws(() => geometricMean([1, 0]), /finite positive ratios/);
});
