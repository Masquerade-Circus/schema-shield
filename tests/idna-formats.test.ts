import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield } from "../lib";

const drafts = [
  "draft6",
  "draft7",
  "draft2019-09",
  "draft2020-12"
];
const formats = ["hostname", "idn-hostname", "idn-email"];

describe("official hostname and IDNA format suites", () => {
  for (const draft of drafts) {
    for (const format of formats) {
      let groups: Array<{
        schema: Record<string, unknown>;
        tests: Array<{ description: string; data: unknown; valid: boolean }>;
      }>;

      try {
        groups = require(
          `json-schema-test-suite/tests/${draft}/optional/format/${format}.json`
        );
      } catch (error: any) {
        if (error?.code === "MODULE_NOT_FOUND") {
          continue;
        }
        throw error;
      }

      describe(`${draft} ${format}`, () => {
        const cases = groups.flatMap((group) =>
          group.tests.map((test) => ({ schema: group.schema, ...test }))
        );

        for (const test of cases.filter((test) => !test.valid)) {
          it(`rejects ${test.description}`, () => {
            const validate = new SchemaShield({ format: true }).compile(
              test.schema
            );
            expect(validate(test.data).valid).toBe(false);
          });
        }

        for (const test of cases.filter((test) => test.valid)) {
          it(`accepts ${test.description}`, () => {
            const validate = new SchemaShield({ format: true }).compile(
              test.schema
            );
            expect(validate(test.data).valid).toBe(true);
          });
        }
      });
    }
  }
});

describe("hostname and IDNA boundary regressions", () => {
  const shield = new SchemaShield();

  it("rejects identity escapes outside ECMAScript Unicode regex syntax", () => {
    const validate = shield.compile({ format: "regex" });
    expect(validate("\\a").valid).toBe(false);
  });

  it("rejects malformed hostname boundaries", () => {
    const validate = shield.compile({ format: "hostname" });
    const invalid = [
      "",
      ".",
      "example..com",
      `${"a".repeat(64)}.example`,
      `${Array(5).fill("a".repeat(63)).join(".")}.com`,
      "example_com",
      "-example.com",
      "example-.com",
      "example.",
      "xn--X",
      "xn--07jt112bpxg.xn--9t4b11yi5a",
      "xn--al-0ea",
      "xn--0ca24w",
      "xn---9uc"
    ];

    for (const hostname of invalid) {
      expect(validate(hostname).valid).toBe(false);
    }
  });

  it("rejects malformed IDNA and internationalized email boundaries", () => {
    const validateHostname = shield.compile({ format: "idn-hostname" });
    const validateEmail = shield.compile({ format: "idn-email" });

    for (const hostname of [
      "example..com",
      "a·l.example",
      "α͵.example",
      "A׳ב.example",
      "def・abc.example",
      "실〮례.테스트",
      "example.",
      "0a.א",
      "0ا",
      "aא",
      "xn--7a",
      "xn--0ca24w",
      "xn---9uc"
    ]) {
      expect(validateHostname(hostname).valid).toBe(false);
    }

    for (const email of [
      ".실례@실례.테스트",
      "실례.@실례.테스트",
      "실..례@실례.테스트",
      `${"é".repeat(33)}@실례.테스트`,
      `user@${"실".repeat(64)}.테스트`,
      "user@실〮례.테스트"
    ]) {
      expect(validateEmail(email).valid).toBe(false);
    }
  });

  it("rejects controls and DEL in idn-email quoted pairs", () => {
    const validate = shield.compile({ format: "idn-email" });
    for (const code of [0, 9, 10, 13, 31, 127]) {
      const email = `"left\\${String.fromCharCode(code)}right"@example.com`;
      expect(validate(email).valid).toBe(false);
    }
    expect(validate(`"left${String.fromCharCode(127)}right"@example.com`).valid).toBe(
      false
    );
  });

  it("accepts allowed idn-email quoted pairs", () => {
    const validate = shield.compile({ format: "idn-email" });
    for (const email of [
      '"left\\ right"@example.com',
      '"left\\"right"@example.com',
      '"left\\\\right"@example.com',
      '"실례\\!값"@실례.테스트'
    ]) {
      expect(validate(email).valid).toBe(true);
    }
  });

  it("accepts hostname and IDNA boundary values", () => {
    const validateHostname = shield.compile({ format: "hostname" });
    const validateIdnHostname = shield.compile({ format: "idn-hostname" });
    const validateEmail = shield.compile({ format: "idn-email" });

    for (const hostname of ["a", "1.2.3", "ab--cd.example", "example.com"]) {
      expect(validateHostname(hostname).valid).toBe(true);
    }

    for (const hostname of ["실례.테스트", "l·l.example", "例え.テスト"]) {
      expect(validateIdnHostname(hostname).valid).toBe(true);
    }

    for (const email of [
      "실례@실례.테스트",
      "joe.bloggs@example.com",
      "user@café.com",
      `${"é".repeat(32)}@example.com`
    ]) {
      expect(validateEmail(email).valid).toBe(true);
    }
  });
});
