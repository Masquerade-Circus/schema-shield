import { after, before, describe, it } from "mocha";

import { SchemaShield } from "../lib";
import { ValidationError } from "../lib/utils";
import expect from "expect";
import { stringifySchema } from "./test-utils";

const schemasafe = require("@exodus/schemasafe");

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
        }
      },
      required: ["foo", "bar", "array"]
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
        error: valid ? null : expect.any(ValidationError),
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
    if (validationResult.error !== null) {
      expect(validationResult.error.message).toEqual("Property is invalid");
      const errorCause = validationResult.error.getCause();
      expect(errorCause.message).toEqual("Value is less than the minimum");
      expect(errorCause.path).toEqual("#/properties/age/minimum");
      expect(errorCause.data).toEqual(15);
      expect(errorCause.schema).toEqual(18);
      expect(errorCause.keyword).toEqual("minimum");
    }
  });
});

describe.only("Vs schemasafe", () => {
  const testGroup = {
    description: "validation of IPv6 addresses",
    schema: { format: "ipv6" },
    tests: [
      {
        description: "all string formats ignore integers",
        data: 12,
        valid: true
      },
      {
        description: "all string formats ignore floats",
        data: 13.7,
        valid: true
      },
      {
        description: "all string formats ignore objects",
        data: {},
        valid: true
      },
      {
        description: "all string formats ignore arrays",
        data: [],
        valid: true
      },
      {
        description: "all string formats ignore booleans",
        data: false,
        valid: true
      },
      {
        description: "all string formats ignore nulls",
        data: null,
        valid: true
      },
      {
        description: "a valid IPv6 address",
        data: "::1",
        valid: true
      },
      {
        description: "an IPv6 address with out-of-range values",
        data: "12345::",
        valid: false
      },
      {
        description: "trailing 4 hex symbols is valid",
        data: "::abef",
        valid: true
      },
      {
        description: "trailing 5 hex symbols is invalid",
        data: "::abcef",
        valid: false
      },
      {
        description: "an IPv6 address with too many components",
        data: "1:1:1:1:1:1:1:1:1:1:1:1:1:1:1:1",
        valid: false
      },
      {
        description: "an IPv6 address containing illegal characters",
        data: "::laptop",
        valid: false
      },
      {
        description: "no digits is valid",
        data: "::",
        valid: true
      },
      {
        description: "leading colons is valid",
        data: "::42:ff:1",
        valid: true
      },
      {
        description: "trailing colons is valid",
        data: "d6::",
        valid: true
      },
      {
        description: "missing leading octet is invalid",
        data: ":2:3:4:5:6:7:8",
        valid: false
      },
      {
        description: "missing trailing octet is invalid",
        data: "1:2:3:4:5:6:7:",
        valid: false
      },
      {
        description: "missing leading octet with omitted octets later",
        data: ":2:3:4::8",
        valid: false
      },
      {
        description: "single set of double colons in the middle is valid",
        data: "1:d6::42",
        valid: true
      },
      {
        description: "two sets of double colons is invalid",
        data: "1::d6::42",
        valid: false
      },
      {
        description: "mixed format with the ipv4 section as decimal octets",
        data: "1::d6:192.168.0.1",
        valid: true
      },
      {
        description: "mixed format with double colons between the sections",
        data: "1:2::192.168.0.1",
        valid: true
      },
      {
        description: "mixed format with ipv4 section with octet out of range",
        data: "1::2:192.168.256.1",
        valid: false
      },
      {
        description: "mixed format with ipv4 section with a hex octet",
        data: "1::2:192.168.ff.1",
        valid: false
      },
      {
        description:
          "mixed format with leading double colons (ipv4-mapped ipv6 address)",
        data: "::ffff:192.168.0.1",
        valid: true
      },
      {
        description: "triple colons is invalid",
        data: "1:2:3:4:5:::8",
        valid: false
      },
      {
        description: "8 octets",
        data: "1:2:3:4:5:6:7:8",
        valid: true
      },
      {
        description: "insufficient octets without double colons",
        data: "1:2:3:4:5:6:7",
        valid: false
      },
      {
        description: "no colons is invalid",
        data: "1",
        valid: false
      },
      {
        description: "ipv4 is not ipv6",
        data: "127.0.0.1",
        valid: false
      },
      {
        description: "ipv4 segment must have 4 octets",
        data: "1:2:3:4:1.2.3",
        valid: false
      },
      {
        description: "leading whitespace is invalid",
        data: "  ::1",
        valid: false
      },
      {
        description: "trailing whitespace is invalid",
        data: "::1  ",
        valid: false
      },
      {
        description: "netmask is not a part of ipv6 address",
        data: "fe80::/64",
        valid: false
      },
      {
        description: "zone id is not a part of ipv6 address",
        data: "fe80::a%eth1",
        valid: false
      },
      {
        description: "a long valid ipv6",
        data: "1000:1000:1000:1000:1000:1000:255.255.255.255",
        valid: true
      },
      {
        description: "a long invalid ipv6, below length limit, first",
        data: "100:100:100:100:100:100:255.255.255.255.255",
        valid: false
      },
      {
        description: "a long invalid ipv6, below length limit, second",
        data: "100:100:100:100:100:100:100:255.255.255.255",
        valid: false
      },
      {
        description: "invalid non-ASCII '৪' (a Bengali 4)",
        data: "1:2:3:4:5:6:7:৪",
        valid: false
      },
      {
        description: "invalid non-ASCII '৪' (a Bengali 4) in the IPv4 portion",
        data: "1:2::192.16৪.0.1",
        valid: false
      }
    ]
  };

  const count = 100000;
  const times: any = [];

  before(() => {
    for (let test of testGroup.tests) {
      console.log(
        JSON.stringify({ data: test.data }),
        "is",
        test.valid ? "valid" : "invalid"
      );
    }
  });

  after(() => {
    for (let key in times) {
      times[key].winner =
        times[key].schemaShield < times[key].schemaSafe
          ? "SchemaShield"
          : "SchemaSafe";
      times[key].ratio = times[key].schemaShield / times[key].schemaSafe;
    }

    const sumOfRatios = Object.values(times).reduce(
      (sum: any, time: any) => sum + time.ratio,
      0
    );

    const timesSortedByRatio = Object.values(times)
      .sort((a: any, b: any) => b.ratio - a.ratio)
      .reverse();

    console.log("Times:", timesSortedByRatio);
    console.log("Sum of ratios:", sumOfRatios);
  });

  it("SchemaShield", () => {
    const schemaShield = new SchemaShield();
    const validate = schemaShield.compile(testGroup.schema);
    console.log(stringifySchema(validate, true));
    for (let test of testGroup.tests) {
      try {
        const result = validate(test.data);
        if (result.valid !== test.valid) {
          console.log(
            result.error?.getCause() || result.error,
            "\nThe Input data:",
            test.data,
            "Must be",
            test.valid ? "valid" : "invalid"
          );
        }

        expect(result).toHaveProperty("valid", test.valid);
        times.push({
          data: JSON.stringify({ data: test.data }),
          valid: test.valid,
          schemaShield: 0,
          schemaSafe: 0
        });
      } catch (error) {
        console.log(error.message);
        process.exit();
        return;
      }
    }

    // return;
    for (let idx = 0, len = testGroup.tests.length; idx < len; idx++) {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        validate(testGroup.tests[idx].data);
      }
      const diff = process.hrtime(initTime);
      const seconds = (diff[0] * 1e9 + diff[1]) / 1e9;
      times[idx].schemaShield = seconds;
    }
  });

  it("SchemaSafe", () => {
    const validate = schemasafe.validator(testGroup.schema, {
      allowUnusedKeywords: true,
      includeErrors: true,
      $schemaDefault: "https://json-schema.org/draft-06/schema"
    });

    console.log(validate.toString());
    for (let test of testGroup.tests) {
      expect(validate(test.data)).toEqual(test.valid);
    }

    for (let idx = 0, len = testGroup.tests.length; idx < len; idx++) {
      const initTime = process.hrtime();
      for (let i = 0; i < count; i++) {
        validate(testGroup.tests[idx].data);
      }
      const diff = process.hrtime(initTime);
      const seconds = (diff[0] * 1e9 + diff[1]) / 1e9;
      times[idx].schemaSafe = seconds;
    }
  });
});
