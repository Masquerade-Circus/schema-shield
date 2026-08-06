import fs from "node:fs";
import { describe, it } from "mocha";
import expect from "expect";

import { SchemaShield, ValidationError } from "../lib";

const documentation: Record<string, string> = {
  "README.md": fs.readFileSync("README.md", "utf8"),
  "llms.txt": fs.readFileSync("llms.txt", "utf8"),
  "SKILL.md": fs.readFileSync("SKILL.md", "utf8")
};
const reference = fs.readFileSync("REFERENCE.md", "utf8");

function getJavaScriptSnippet(
  file: string,
  document: string,
  marker: string
): string {
  const matches = Array.from(
    document.matchAll(/```javascript\n([\s\S]*?)\n```/g)
  ).filter((match) => match[1].includes(marker));

  if (matches.length !== 1) {
    throw new Error(
      `${file} must contain one JavaScript block marked by ${marker}`
    );
  }

  return matches[0][1];
}

describe("canonical documentation contracts", () => {
  it("keeps required integration guidance in every adoption document", () => {
    const requiredPatterns = [
      /error: true/,
      /failFast: false/,
      /getPath\(\)/,
      /getCause\(\)/,
      /getTree\(\)/,
      /Unicode code points/,
      /process or isolate/
    ];

    for (const [file, document] of Object.entries(documentation)) {
      for (const pattern of requiredPatterns) {
        if (!pattern.test(document)) {
          throw new Error(`${file} must contain ${pattern}`);
        }
      }
    }
  });

  it("keeps performance claims synchronized and cold execution scoped", () => {
    const requiredClaims = {
      "README.md": [
        "Zero runtime code generation. Near-zero validation overhead on cold starts.",
        "High sustained validation throughput"
      ],
      "llms.txt": [
        "Near-zero validator overhead at cold start, with no runtime source-code generation.",
        "High sustained validation throughput and near-zero validator overhead at cold start."
      ],
      "SKILL.md": [
        "High-performance synchronous JSON Schema validation",
        "reusable validators",
        "near-zero validator overhead at cold start",
        "cold-start-sensitive workloads"
      ]
    };

    for (const [file, claims] of Object.entries(requiredClaims)) {
      const document = documentation[file];
      for (const claim of claims) {
        if (!document.includes(claim)) {
          throw new Error(`${file} must contain: ${claim}`);
        }
      }
    }

    const readmeColdClaimCount = documentation["README.md"].split(
      "Near-zero validation overhead on cold starts"
    ).length - 1;
    expect(readmeColdClaimCount).toBeGreaterThanOrEqual(2);

    for (const [file, document] of Object.entries(documentation)) {
      const normalized = document.replace(/\s+/g, " ");
      expect(normalized).toMatch(
        /Cold execution .*validator construction, configuration, registrations and setup.*first validation/i
      );
      expect(normalized).toMatch(/excludes .*process startup.*module import/i);
      expect(normalized).toMatch(
        /validator overhead (?:only|rather than runtime or platform startup)/i
      );

      for (const invalidClaim of [
        /near-zero process startup/i,
        /near-zero module import/i,
        /near-zero isolate startup/i,
        /near-zero Worker startup/i,
        /near-zero function startup/i,
        /near-zero serverless startup/i,
        /near-zero platform startup/i,
        /cold execution (?:includes|measures|covers|accounts for)[^.]{0,120}(?:process startup|module import|isolate startup|Worker startup|function startup|serverless function startup|platform startup)/i
      ]) {
        if (invalidClaim.test(document)) {
          throw new Error(`${file} contains an overbroad cold-start claim`);
        }
      }
    }
  });

  it("keeps external benchmarks, relative percentages, and competitors out", () => {
    for (const [file, document] of Object.entries(documentation)) {
      expect(document).not.toMatch(/json-schema-validator-bench/i);
      expect(document).not.toMatch(/\b\d+(?:\.\d+)?\s*%/);
      expect(document).not.toMatch(/\b\d+(?:\.\d+)?\s+percent\b/i);
      expect(document).not.toMatch(/~\s*\d/);
      expect(document).not.toMatch(/\b(?:faster|slower) than\b/i);
      expect(document).not.toMatch(/\bvs\.?\b/i);

      const beforeAcknowledgments = document.split(/^## Acknowledgments$/m)[0];
      if (/\bAJV\b/i.test(beforeAcknowledgments)) {
        throw new Error(`${file} names AJV outside acknowledgments`);
      }
    }
  });

  it("returns the documented default and detailed error modes", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2 },
        age: { type: "integer", minimum: 18 }
      },
      required: ["name", "age"]
    };
    const invalidData = { name: "J", age: 16 };

    const defaultResult = new SchemaShield().compile(schema)(invalidData);
    expect(defaultResult).toEqual({
      data: invalidData,
      error: true,
      valid: false
    });

    const detailedResult = new SchemaShield({ failFast: false })
      .compile(schema)(invalidData);
    expect(detailedResult.valid).toBe(false);
    expect(detailedResult.error).toBeInstanceOf(ValidationError);

    const error = detailedResult.error as ValidationError;
    expect(error.getPath()).toEqual({
      schemaPath: "#/properties/name/minLength",
      instancePath: "#/name"
    });
    expect(error.getCause().keyword).toBe("minLength");
    expect(error.getTree().cause?.keyword).toBe("minLength");
  });

  it("executes each documented custom ticket format snippet", () => {
    for (const [file, document] of Object.entries(documentation)) {
      const snippet = getJavaScriptSnippet(file, document, '"ticket-id"');
      const createValidator = new Function(
        "SchemaShield",
        `"use strict";\n${snippet}\nreturn typeof validateTicket === "function"\n  ? validateTicket\n  : shield.compile({ type: "string", format: "ticket-id" });`
      );
      const validateTicket = createValidator(SchemaShield);

      expect(validateTicket("TKT-123456").valid).toBe(true);
      expect(validateTicket("ticket-123456").valid).toBe(false);
      expect(validateTicket("TKT-12345").valid).toBe(false);
      expect(validateTicket("TKT-1234567").valid).toBe(false);
    }
  });

  it("executes each documented HTTPS local-resource snippet", () => {
    const addressSchema = {
      $id: "address.json",
      type: "object",
      properties: { city: { type: "string", minLength: 1 } },
      required: ["city"]
    };

    for (const [file, document] of Object.entries(documentation)) {
      const snippet = getJavaScriptSnippet(
        file,
        document,
        '"https://schemas.example/address"'
      );
      const createValidator = new Function(
        "SchemaShield",
        "addressSchema",
        `"use strict";\n${snippet}\nreturn typeof validateCustomer === "function"\n  ? validateCustomer\n  : validate;`
      );
      const validateAddress = createValidator(SchemaShield, addressSchema);

      expect(validateAddress({ address: { city: "London" } }).valid).toBe(true);
      expect(validateAddress({ address: { city: "" } }).valid).toBe(false);
      expect(validateAddress({ address: {} }).valid).toBe(false);
    }
  });

  it("counts Unicode code points for string lengths", () => {
    const validateOneCodePoint = new SchemaShield().compile({
      type: "string",
      minLength: 1,
      maxLength: 1
    });

    expect(validateOneCodePoint("😀").valid).toBe(true);
    expect(validateOneCodePoint("😀😀").valid).toBe(false);
  });

  it("reuses one compiled validator across calls", () => {
    const validate = new SchemaShield().compile({ type: "integer" });
    const compiledSchema = validate.compiledSchema;

    expect(validate(1).valid).toBe(true);
    expect(validate("1").valid).toBe(false);
    expect(validate(2).valid).toBe(true);
    expect(validate.compiledSchema).toBe(compiledSchema);
  });

  it("executes each documented Worker snippet with parsed payloads", async () => {
    const responseApi = {
      json(body: any, options: { status?: number } = {}) {
        return { body, status: options.status ?? 200 };
      }
    };

    for (const [file, document] of Object.entries(documentation)) {
      let compilationCount = 0;
      class CountingSchemaShield extends SchemaShield {
        compile(schema: any, options: { validateSchema?: boolean } = {}) {
          compilationCount++;
          return super.compile(schema, options);
        }
      }
      const snippet = getJavaScriptSnippet(file, document, "async fetch(request)")
        .replace(
          /^import\s+\{\s*SchemaShield\s*\}\s+from\s+"schema-shield";\s*/,
          ""
        )
        .replace(/export default\s+\{/, "const worker = {");
      const createWorker = new Function(
        "SchemaShield",
        "Response",
        `"use strict";\n${snippet}\nreturn worker;`
      );
      const worker = createWorker(CountingSchemaShield, responseApi);
      expect(compilationCount).toBe(1);

      const malformed = await worker.fetch({
        async json() {
          throw new SyntaxError("Invalid JSON");
        }
      });
      const rejected = await worker.fetch({
        async json() {
          return { name: "Ada", email: "invalid" };
        }
      });
      const accepted = await worker.fetch({
        async json() {
          return { name: "Ada", email: "ada@example.com" };
        }
      });

      expect(malformed).toEqual({
        body: { error: "Invalid JSON" },
        status: 400
      });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error).toEqual({
        schemaPath: "#/properties/email/format",
        instancePath: "#/email"
      });
      expect(accepted).toEqual({
        body: { name: "Ada", email: "ada@example.com" },
        status: 200
      });
      expect(compilationCount).toBe(1);
    }
  });

  it("keeps the literal compilation opt-out explicit and executable", () => {
    const optOutReferences = reference.match(
      /compile\(value, \{ validateSchema: false \}\)/g
    );
    expect(optOutReferences?.length).toBeGreaterThanOrEqual(3);

    try {
      new SchemaShield().compile(42);
      throw new Error(
        "Expected default metavalidation to reject a literal root"
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe("INVALID_SCHEMA");
    }

    const validateLiteral = new SchemaShield().compile(42, {
      validateSchema: false
    });
    expect(validateLiteral(42).valid).toBe(true);
    expect(validateLiteral(43).valid).toBe(false);
  });

  it("includes the linked reference in the npm package", () => {
    const packageMetadata = JSON.parse(fs.readFileSync("package.json", "utf8"));

    expect(packageMetadata.files).toContain("REFERENCE.md");
  });
});
