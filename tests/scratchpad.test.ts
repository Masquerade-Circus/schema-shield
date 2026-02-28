import { after, before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import schemasafe from "@exodus/schemasafe";
import fs from "fs";

describe("SchemaShield instance", () => {
  it("Should create a SchemaShield instance and validate", () => {
    let schema = {
      type: "object",
      properties: {
        foo: {
          type: "string"
        },
        bar: {
          type: "integer"
        },
        array: {
          type: "array",
          items: {
            type: "string"
          }
        },
        hello: {
          type: "string",
          default: "world"
        },
        world: {
          type: "string",
          default: "hello"
        }
      },
      required: ["foo", "bar", "array", "hello"]
    };

    let data = {
      foo: "hello",
      bar: 42,
      array: ["hello", "world"]
    };

    let schemaShield = new SchemaShield();
    let validate = schemaShield.compile(schema);

    expect(validate(data)).toEqual({
      data: { ...data, hello: "world" },
      error: null,
      valid: true
    });
  });
});

describe("Scratchpad", () => {
  // const testGroup = {
  //   description: "integer type matches integers",
  //   schema: {
  //     type: "integer"
  //   },
  //   tests: [
  //     {
  //       description: "a float is not an integer",
  //       data: 1.1,
  //       valid: false
  //     },
  //     {
  //       description: "an integer is an integer",
  //       data: 1,
  //       valid: true
  //     }
  //   ]
  // };

  const testGroup = {
    description: "nested items",
    schema: {
      type: "array",
      items: {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "number"
            }
          }
        }
      }
    },
    tests: [
      {
        description: "valid nested array",
        data: [[[[1]], [[2], [3]]], [[[4], [5], [6]]]],
        valid: true
      },
      {
        description: "nested array with invalid type",
        data: [[[["1"]], [[2], [3]]], [[[4], [5], [6]]]],
        valid: false
      },
      {
        description: "not deep enough",
        data: [
          [[1], [2], [3]],
          [[4], [5], [6]]
        ],
        valid: false
      }
    ]
  };

  const count = 100000;

  let validate;

  before(() => {
    const schemaShield = new SchemaShield();
    schemaShield.addFormat("hex", (value) => /^0x[0-9A-Fa-f]*$/.test(value));

    validate = schemaShield.compile(testGroup.schema);
    // console.log(JSON.stringify(testGroup.schema, null, 2));
    // console.log(stringifySchema(validate, false));
  });

  for (const { valid, data, description } of testGroup.tests) {
    it(description, () => {
      expect(validate(data)).toEqual({
        valid,
        error: valid ? null : expect.anything(),
        data: data === null ? null : expect.anything()
      });
    });
  }

  for (const test of testGroup.tests) {
    it(`Benchmark ${test.description}`, () => {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        try {
          validate(test.data);
        } catch (error) {
          // Ignore
        }
      }
      const diff = process.hrtime(initTime);
      // Log time in seconds
      console.log(`    Time: ${(diff[0] * 1e9 + diff[1]) / 1e9} seconds`);
    });
  }
});

describe("ValidationError", () => {
  it("should get the correct properties within an error", () => {
    const schemaShield = new SchemaShield({ immutable: true });

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: {
          type: "number",
          minimum: 18
        }
      }
    };

    const validator = schemaShield.compile(schema);

    const invalidData = {
      name: "John Doe",
      age: 15
    };

    const validationResult = validator(invalidData);

    expect(validationResult.valid).toEqual(false);
    expect(validationResult.error).not.toBeNull();

    // Validating error property again just to make TS happy in the next lines
    if (validationResult.error instanceof ValidationError) {
      expect(validationResult.error.message).toEqual("Property is invalid");
      const errorCause = validationResult.error.getCause();
      expect(errorCause.message).toEqual("Value is less than the minimum");
      expect(errorCause.schemaPath).toEqual("#/properties/age/minimum");
      expect(errorCause.instancePath).toEqual("#/age");
      expect(errorCause.data).toEqual(15);
      expect(errorCause.schema).toEqual(18);
      expect(errorCause.keyword).toEqual("minimum");
    }
  });

  it("should get the correct path within an error", () => {
    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        shouldLoadDb: { type: "boolean" },
        enableNetConnectFor: { type: "array", items: { type: "string" } },
        params: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              description: { type: "string" },
              default: { type: "string" }
            },
            required: ["description"]
          }
        },
        run: { type: "string" }
      },
      required: [
        "description",
        "shouldLoadDb",
        "enableNetConnectFor",
        "params",
        "run"
      ]
    };

    const schemaShield = new SchemaShield({ immutable: true });
    schemaShield.addType("function", (value) => typeof value === "function");

    const schemaShieldValidate = schemaShield.compile(schema);

    const command = {
      description: "Say hello to the bot.",
      shouldLoadDb: false,
      enableNetConnectFor: [],
      params: {
        color: {
          type: "string",
          // description: "The color of the text", // Missing description on purpose
          default: "red"
        }
      },
      run: "run"
    };

    const result = schemaShieldValidate(command);

    expect(result).toHaveProperty("valid", false);
    expect(result).toHaveProperty("error", expect.anything());

    // Validate if just to make TS happy
    if (result.error instanceof ValidationError) {
      // Test the methods of the error
      expect(result.error).toHaveProperty("getCause", expect.any(Function));
      expect(result.error).toHaveProperty("getTree", expect.any(Function));
      expect(result.error).toHaveProperty("getPath", expect.any(Function));

      // Test the cause
      const cause = result.error.getCause();
      expect(cause).toBeInstanceOf(ValidationError);
      expect(cause).toHaveProperty("message", "Required property is missing");
      expect(cause).toHaveProperty("keyword", "required");
      expect(cause).toHaveProperty("item", "description");
      expect(cause).toHaveProperty(
        "schemaPath",
        "#/properties/params/additionalProperties/required"
      );
      expect(cause).toHaveProperty(
        "instancePath",
        "#/params/color/description"
      );
      expect(cause).toHaveProperty("schema", ["description"]);
      expect(cause).toHaveProperty("data"); // undefined

      // Test the tree
      const tree = result.error.getTree();
      expect(tree).toEqual({
        message: "Property is invalid",
        keyword: "properties",
        item: "params",
        schemaPath: "#/properties/params",
        instancePath: "#/params",
        data: { color: { type: "string", default: "red" } },
        cause: {
          message: "Additional properties are invalid",
          keyword: "additionalProperties",
          item: "color",
          schemaPath: "#/properties/params/additionalProperties",
          instancePath: "#/params/color",
          data: { type: "string", default: "red" },
          cause: {
            message: "Required property is missing",
            keyword: "required",
            item: "description",
            schemaPath: "#/properties/params/additionalProperties/required",
            instancePath: "#/params/color/description",
            data: undefined
          }
        }
      });

      // Test the path
      const path = result.error.getPath();
      expect(path).toEqual({
        schemaPath: "#/properties/params/additionalProperties/required",
        instancePath: "#/params/color/description"
      });
    }
  });

  it('should test the "getPath" README.md example', () => {
    const schemaShield = new SchemaShield();

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        shouldLoadDb: { type: "boolean" },
        enableNetConnectFor: { type: "array", items: { type: "string" } },
        params: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              description: { type: "string" },
              default: { type: "string" }
            },
            required: ["description"]
          }
        },
        run: { type: "string" }
      }
    };

    const validator = schemaShield.compile(schema);

    const invalidData = {
      description: "Say hello to the bot.",
      shouldLoadDb: false,
      enableNetConnectFor: [],
      params: {
        color: {
          type: "string",
          // description: "The color of the text", // Missing description on purpose
          default: "red"
        }
      },
      run: "run"
    };

    const validationResult = validator(invalidData);

    if (validationResult.error instanceof ValidationError) {
      console.error("Validation error:", validationResult.error.message); // "Property is invalid"

      // Get the full error chain as a tree
      const errorTree = validationResult.error.getTree();
      console.error(errorTree);

      /*
    {
      message: "Property is invalid",
      keyword: "properties",
      item: "params",
      schemaPath: "#/properties/params",
      instancePath: "#/params",
      data: { color: { type: "string", default: "red" } },
      cause: {
        message: "Additional properties are invalid",
        keyword: "additionalProperties",
        item: "color",
        schemaPath: "#/properties/params/additionalProperties",
        instancePath: "#/params/color",
        data: { type: "string", default: "red" },
        cause: {
          message: "Required property is missing",
          keyword: "required",
          item: "description",
          schemaPath: "#/properties/params/additionalProperties/required",
          instancePath: "#/params/color/description",
          data: undefined
        }
      }
    }
  */
    }
  });
});

describe("Vs schemasafe", () => {
  const BENCHMARK_WARMUP_COUNT = 500;
  const BENCHMARK_SAMPLES = 3;
  const BENCHMARK_CALIBRATION_PROBE_ITERATIONS = 200;
  const BENCHMARK_TARGET_SECONDS = 0.0015;
  const BENCHMARK_MIN_ITERATIONS = 2000;
  const BENCHMARK_MAX_ITERATIONS = 50000;

  const draft6Files = fs.readdirSync(
    "./node_modules/json-schema-test-suite/tests/draft6"
  );
  const optionalFormatFiles = fs.readdirSync(
    "./node_modules/json-schema-test-suite/tests/draft6/optional/format"
  );
  const optionalRegexFiles = ["ecmascript-regex.json", "non-bmp-regex.json"];

  const jsonTestFiles = draft6Files.reduce(
    (acc: Record<string, any[]>, file) => {
      if (!file.endsWith(".json")) {
        return acc;
      }

      acc[file.replace(".json", "")] = require(
        `json-schema-test-suite/tests/draft6/${file}`
      );

      return acc;
    },
    {}
  );

  for (let i = 0; i < optionalFormatFiles.length; i++) {
    const file = optionalFormatFiles[i];
    if (!file.endsWith(".json")) {
      continue;
    }

    jsonTestFiles[`optional/format/${file.replace(".json", "")}`] = require(
      `json-schema-test-suite/tests/draft6/optional/format/${file}`
    );
  }

  for (let i = 0; i < optionalRegexFiles.length; i++) {
    const file = optionalRegexFiles[i];
    jsonTestFiles[`optional/${file.replace(".json", "")}`] = require(
      `json-schema-test-suite/tests/draft6/optional/${file}`
    );
  }

  const jsonTestsToSkip = {
    "maxLength validation": {
      "two supplementary Unicode code points is long enough":
        "No one supports this"
    },
    "minLength validation": {
      "one supplementary Unicode code point is not long enough":
        "No one supports this"
    },

    "items and subitems": "Not implemented",

    "$id inside an unknown keyword is not a real identifier": "Not implemented",
    "validate definition against metaschema": "Not implemented",
    "remote ref, containing refs itself": "Not supported",
    "Location-independent identifier with base URI change in subschema":
      "Not supported",
    "refs with relative uris and defs": "Not supported",
    "relative refs with absolute uris and defs": "Not supported",
    "RN base URI with URN and JSON pointer ref": "Not supported",
    "URN base URI with URN and JSON pointer ref": "Not supported",
    "URN base URI with URN and anchor ref": "Not supported",
    "ref with absolute-path-reference": "Not supported",

    "evaluating the same schema location against the same data location twice is not a sign of an infinite loop":
      "Needs investigation",
    "float division = inf": {
      "always invalid, but naive implementations may raise an overflow error":
        "Needs investigation"
    }
  };

  const filesToSkip = ["refRemote", "id", "optional/format/unknown"];

  interface BenchmarkCase {
    file: string;
    groupDescription: string;
    schema: any;
    testDescription: string;
    data: any;
    valid: boolean;
  }

  interface BenchmarkResult {
    file: string;
    group: string;
    test: string;
    iterations: number;
    schemaShieldSeconds: number;
    schemaSafeSeconds: number;
    ratio: number;
    winner: "SchemaShield" | "SchemaSafe";
  }

  function getSkipReason(groupDescription: string, testDescription: string) {
    const groupSkip = (jsonTestsToSkip as any)[groupDescription];

    if (typeof groupSkip === "string") {
      return groupSkip;
    }

    if (groupSkip && typeof groupSkip === "object") {
      const testSkip = groupSkip[testDescription];
      if (typeof testSkip === "string") {
        return testSkip;
      }
    }

    return null;
  }

  function toSeconds(startNs: bigint) {
    return Number(process.hrtime.bigint() - startNs) / 1e9;
  }

  function runBenchmarkLoop(
    validate: (data: any) => any,
    data: any,
    iterations: number
  ) {
    for (let i = 0; i < iterations; i++) {
      validate(data);
    }
  }

  function clamp(value: number, min: number, max: number) {
    if (value < min) {
      return min;
    }

    if (value > max) {
      return max;
    }

    return value;
  }

  function calibrateIterations(validate: (data: any) => any, data: any) {
    const probeStart = process.hrtime.bigint();
    runBenchmarkLoop(validate, data, BENCHMARK_CALIBRATION_PROBE_ITERATIONS);
    const probeSeconds = toSeconds(probeStart);

    if (probeSeconds <= 0) {
      return BENCHMARK_MIN_ITERATIONS;
    }

    const estimatedIterations = Math.ceil(
      (BENCHMARK_TARGET_SECONDS / probeSeconds) *
        BENCHMARK_CALIBRATION_PROBE_ITERATIONS
    );

    return clamp(
      estimatedIterations,
      BENCHMARK_MIN_ITERATIONS,
      BENCHMARK_MAX_ITERATIONS
    );
  }

  function median(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);

    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }

    return sortedValues[mid];
  }

  function measureMedianSeconds(
    validate: (data: any) => any,
    data: any,
    iterations: number
  ) {
    const sampleTimes: number[] = [];

    for (let sample = 0; sample < BENCHMARK_SAMPLES; sample++) {
      const start = process.hrtime.bigint();
      runBenchmarkLoop(validate, data, iterations);
      sampleTimes.push(toSeconds(start));
    }

    return median(sampleTimes);
  }

  it("benchmarks draft6 plus optional format suites case-by-case", function () {
    this.timeout(0);

    const benchmarkCases: BenchmarkCase[] = [];
    const skippedCases: {
      file: string;
      group: string;
      test: string;
      reason: string;
    }[] = [];

    for (const file in jsonTestFiles) {
      if (filesToSkip.includes(file)) {
        continue;
      }

      const jsonTests = jsonTestFiles[file];

      for (let i = 0; i < jsonTests.length; i++) {
        const { description: groupDescription, schema, tests } = jsonTests[i];

        const groupSkipReason = getSkipReason(groupDescription, "");
        if (groupSkipReason) {
          skippedCases.push({
            file,
            group: groupDescription,
            test: "*",
            reason: groupSkipReason
          });
          continue;
        }

        for (let j = 0; j < tests.length; j++) {
          const { description: testDescription, data, valid } = tests[j];

          const testSkipReason = getSkipReason(
            groupDescription,
            testDescription
          );
          if (testSkipReason) {
            skippedCases.push({
              file,
              group: groupDescription,
              test: testDescription,
              reason: testSkipReason
            });
            continue;
          }

          benchmarkCases.push({
            file,
            groupDescription,
            schema,
            testDescription,
            data,
            valid
          });
        }
      }
    }

    expect(benchmarkCases.length).toBeGreaterThan(0);

    const schemaShield = new SchemaShield({ failFast: true });

    const results: BenchmarkResult[] = [];
    const mismatches: {
      file: string;
      group: string;
      test: string;
      expected: boolean;
      schemaShield: boolean;
      schemaSafe: boolean;
    }[] = [];
    const compileErrors: {
      engine: "SchemaShield" | "SchemaSafe";
      file: string;
      group: string;
      test: string;
      error: string;
    }[] = [];

    for (let i = 0; i < benchmarkCases.length; i++) {
      const benchmarkCase = benchmarkCases[i];

      let schemaShieldValidate: ReturnType<SchemaShield["compile"]>;
      let schemaSafeValidate: (data: any) => boolean;

      try {
        schemaShieldValidate = schemaShield.compile(benchmarkCase.schema);
      } catch (error: any) {
        compileErrors.push({
          engine: "SchemaShield",
          file: benchmarkCase.file,
          group: benchmarkCase.groupDescription,
          test: benchmarkCase.testDescription,
          error: error?.message || String(error)
        });
        continue;
      }

      try {
        schemaSafeValidate = schemasafe.validator(benchmarkCase.schema, {
          allowUnusedKeywords: true,
          includeErrors: false,
          allowUnreachable: true,
          $schemaDefault: "https://json-schema.org/draft-06/schema"
        });
      } catch (error: any) {
        compileErrors.push({
          engine: "SchemaSafe",
          file: benchmarkCase.file,
          group: benchmarkCase.groupDescription,
          test: benchmarkCase.testDescription,
          error: error?.message || String(error)
        });
        continue;
      }

      const schemaShieldValid = schemaShieldValidate(benchmarkCase.data).valid;
      const schemaSafeValid = schemaSafeValidate(benchmarkCase.data);

      if (
        schemaShieldValid !== benchmarkCase.valid ||
        schemaSafeValid !== benchmarkCase.valid
      ) {
        mismatches.push({
          file: benchmarkCase.file,
          group: benchmarkCase.groupDescription,
          test: benchmarkCase.testDescription,
          expected: benchmarkCase.valid,
          schemaShield: schemaShieldValid,
          schemaSafe: schemaSafeValid
        });
      }

      const schemaShieldIterations = calibrateIterations(
        schemaShieldValidate,
        benchmarkCase.data
      );
      const schemaSafeIterations = calibrateIterations(
        schemaSafeValidate,
        benchmarkCase.data
      );

      const benchmarkIterations = Math.max(
        schemaShieldIterations,
        schemaSafeIterations
      );

      const warmupIterations = Math.min(
        BENCHMARK_WARMUP_COUNT,
        benchmarkIterations
      );

      runBenchmarkLoop(schemaShieldValidate, benchmarkCase.data, warmupIterations);
      runBenchmarkLoop(schemaSafeValidate, benchmarkCase.data, warmupIterations);

      let schemaShieldSeconds: number;
      let schemaSafeSeconds: number;

      // Alternate order to reduce execution-order bias.
      if (i % 2 === 0) {
        schemaShieldSeconds = measureMedianSeconds(
          schemaShieldValidate,
          benchmarkCase.data,
          benchmarkIterations
        );
        schemaSafeSeconds = measureMedianSeconds(
          schemaSafeValidate,
          benchmarkCase.data,
          benchmarkIterations
        );
      } else {
        schemaSafeSeconds = measureMedianSeconds(
          schemaSafeValidate,
          benchmarkCase.data,
          benchmarkIterations
        );
        schemaShieldSeconds = measureMedianSeconds(
          schemaShieldValidate,
          benchmarkCase.data,
          benchmarkIterations
        );
      }

      const ratio =
        schemaSafeSeconds === 0
          ? Number.POSITIVE_INFINITY
          : schemaShieldSeconds / schemaSafeSeconds;

      results.push({
        file: benchmarkCase.file,
        group: benchmarkCase.groupDescription,
        test: benchmarkCase.testDescription,
        iterations: benchmarkIterations,
        schemaShieldSeconds,
        schemaSafeSeconds,
        ratio,
        winner:
          schemaShieldSeconds < schemaSafeSeconds
            ? "SchemaShield"
            : "SchemaSafe"
      });
    }

    expect(results.length).toBeGreaterThan(0);

    const TOP_SLOWER_LIMIT = 20;

    const slowerResults = results.filter(
      (result) => result.schemaShieldSeconds > result.schemaSafeSeconds
    );

    const slowerSchemaShieldByRatio = [...slowerResults]
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, TOP_SLOWER_LIMIT)
      .map((result) => ({
        file: result.file,
        group: result.group,
        test: result.test,
        iterations: result.iterations,
        schemaShieldSeconds: Number(result.schemaShieldSeconds.toFixed(6)),
        schemaSafeSeconds: Number(result.schemaSafeSeconds.toFixed(6)),
        deltaSeconds: Number(
          (result.schemaShieldSeconds - result.schemaSafeSeconds).toFixed(6)
        ),
        ratio: Number(result.ratio.toFixed(4))
      }));

    const slowerSchemaShieldByDelta = [...slowerResults]
      .sort(
        (a, b) =>
          b.schemaShieldSeconds -
          b.schemaSafeSeconds -
          (a.schemaShieldSeconds - a.schemaSafeSeconds)
      )
      .slice(0, TOP_SLOWER_LIMIT)
      .map((result) => ({
        file: result.file,
        group: result.group,
        test: result.test,
        iterations: result.iterations,
        schemaShieldSeconds: Number(result.schemaShieldSeconds.toFixed(6)),
        schemaSafeSeconds: Number(result.schemaSafeSeconds.toFixed(6)),
        deltaSeconds: Number(
          (result.schemaShieldSeconds - result.schemaSafeSeconds).toFixed(6)
        ),
        ratio: Number(result.ratio.toFixed(4))
      }));

    const fileTotals = Object.entries(
      slowerResults.reduce(
        (
          acc: Record<string, { count: number; totalDelta: number; ratioSum: number }>,
          result
        ) => {
          const current = acc[result.file] || {
            count: 0,
            totalDelta: 0,
            ratioSum: 0
          };

          current.count++;
          current.totalDelta += result.schemaShieldSeconds - result.schemaSafeSeconds;
          current.ratioSum += result.ratio;

          acc[result.file] = current;
          return acc;
        },
        {}
      )
    )
      .map(([file, totals]) => ({
        file,
        count: totals.count,
        avgRatio: Number((totals.ratioSum / totals.count).toFixed(2)),
        totalDelta: Number(totals.totalDelta.toFixed(4))
      }))
      .sort((a, b) => b.totalDelta - a.totalDelta)
      .slice(0, 10);

    const groupTotals = Object.entries(
      slowerResults.reduce(
        (
          acc: Record<string, { count: number; totalDelta: number; ratioSum: number }>,
          result
        ) => {
          const key = `${result.file} :: ${result.group}`;
          const current = acc[key] || {
            count: 0,
            totalDelta: 0,
            ratioSum: 0
          };

          current.count++;
          current.totalDelta += result.schemaShieldSeconds - result.schemaSafeSeconds;
          current.ratioSum += result.ratio;

          acc[key] = current;
          return acc;
        },
        {}
      )
    )
      .map(([group, totals]) => ({
        group,
        count: totals.count,
        avgRatio: Number((totals.ratioSum / totals.count).toFixed(2)),
        totalDelta: Number(totals.totalDelta.toFixed(4))
      }))
      .sort((a, b) => b.totalDelta - a.totalDelta)
      .slice(0, 10);

    const iterationStats = {
      min: Math.min(...results.map((result) => result.iterations)),
      max: Math.max(...results.map((result) => result.iterations)),
      avg: Number(
        (
          results.reduce((sum, result) => sum + result.iterations, 0) /
          results.length
        ).toFixed(0)
      )
    };

    console.log("Benchmark methodology:", {
      warmupIterations: BENCHMARK_WARMUP_COUNT,
      samplesPerCase: BENCHMARK_SAMPLES,
      calibrationProbeIterations: BENCHMARK_CALIBRATION_PROBE_ITERATIONS,
      targetSecondsPerSample: BENCHMARK_TARGET_SECONDS,
      minIterations: BENCHMARK_MIN_ITERATIONS,
      maxIterations: BENCHMARK_MAX_ITERATIONS
    });
    console.log("Adaptive iteration stats:", iterationStats);
    console.log("Benchmark cases executed:", results.length);
    console.log("Cases where SchemaShield is slower:", slowerResults.length);
    console.log("Skipped draft6/optional cases:", skippedCases.length);
    console.log("Compile/runtime errors:", compileErrors.length);
    console.log("Result mismatches:", mismatches.length);

    if (compileErrors.length > 0) {
      console.table(compileErrors.slice(0, 30));
    }

    if (mismatches.length > 0) {
      console.table(mismatches.slice(0, 30));
    }

    console.log(
      `Top ${TOP_SLOWER_LIMIT} where SchemaShield is slower vs SchemaSafe (by ratio):`
    );
    console.table(slowerSchemaShieldByRatio);

    console.log(
      `Top ${TOP_SLOWER_LIMIT} where SchemaShield is slower vs SchemaSafe (by delta):`
    );
    console.table(slowerSchemaShieldByDelta);

    console.log("Top 10 files by total delta:");
    console.table(fileTotals);

    console.log("Top 10 groups by total delta:");
    console.table(groupTotals);
  });
});
