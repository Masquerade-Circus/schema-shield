const fs = require("node:fs");
const path = require("node:path");

function assertAbsoluteBundlePath(bundlePath, label) {
  if (typeof bundlePath !== "string" || !path.isAbsolute(bundlePath)) {
    throw new Error(`${label} must be an absolute path`);
  }
  if (path.extname(bundlePath) !== ".js") {
    throw new Error(`${label} must be a CJS JavaScript bundle`);
  }
  if (!fs.existsSync(bundlePath) || !fs.statSync(bundlePath).isFile()) {
    throw new Error(`${label} bundle does not exist`);
  }
  return bundlePath;
}

function parsePositiveDeadline(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("timeout-ms must be a positive integer");
  }
  const deadline = Number(value);
  if (!Number.isSafeInteger(deadline) || deadline <= 0) {
    throw new Error("timeout-ms must be a positive integer");
  }
  return deadline;
}

function stableCaseId(relativePath, groupIndex, testIndex) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error("relative corpus path is invalid");
  }
  if (
    !Number.isSafeInteger(groupIndex) ||
    groupIndex < 0 ||
    !Number.isSafeInteger(testIndex) ||
    testIndex < 0
  ) {
    throw new Error("case coordinates must be non-negative integers");
  }
  return `${relativePath}#${groupIndex}:${testIndex}`;
}

function resultMatchesContract(result, contract) {
  if (contract.correctionAccepted) {
    return result.error === null && result.observed === contract.expected;
  }
  if (contract.production !== null) {
    return (
      result.observed === contract.production.observed &&
      result.error === contract.production.error
    );
  }
  return result.error === null && result.observed === contract.expected;
}

function geometricMean(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("geometric mean needs at least one ratio");
  }
  let logSum = 0;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error("geometric mean accepts finite positive ratios");
    }
    logSum += Math.log(value);
  }
  return Math.exp(logSum / values.length);
}

module.exports = {
  assertAbsoluteBundlePath,
  geometricMean,
  parsePositiveDeadline,
  resultMatchesContract,
  stableCaseId
};
