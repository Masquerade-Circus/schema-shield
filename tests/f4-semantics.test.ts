import { describe, it } from "mocha";
import expect from "expect";
import { SchemaShield } from "../lib";

function format(name: string, value: string) {
  return new SchemaShield().compile({ format: name })(value).valid;
}

describe("F4 semantic corrections", () => {
  describe("formats", () => {
    it("validates email, URI, IP, date-time, and pointer boundaries", () => {
      expect(format("email", "first.last+tag@example.technology")).toBe(true);
      expect(format("email", ".leading@example.com")).toBe(false);
      expect(format("uri", "https://example.test/a%20b?x=1#ok")).toBe(true);
      expect(format("uri", "https://example.test/%zz")).toBe(false);
      expect(format("uri", "https://example.test/has\\backslash")).toBe(false);
      expect(format("ipv4", "192.168.1.1")).toBe(true);
      expect(format("ipv4", "192.168.01.1")).toBe(false);
      expect(format("ipv6", "2001:db8::1")).toBe(true);
      expect(format("ipv6", "2001::db8::1")).toBe(false);
      expect(format("date-time", "2024-02-29T23:59:60Z")).toBe(true);
      expect(format("date-time", "2023-02-29T00:00:00Z")).toBe(false);
      expect(format("json-pointer", "/a~0b/~1")).toBe(true);
      expect(format("json-pointer", "/bad~2escape")).toBe(false);
      expect(format("relative-json-pointer", "0#")).toBe(true);
      expect(format("relative-json-pointer", "1/a~1b")).toBe(true);
      expect(format("relative-json-pointer", "")).toBe(false);
      expect(format("relative-json-pointer", "01/a")).toBe(false);
    });
  });

  describe("finite numbers", () => {
    it("rejects NaN, infinities, invalid divisors, and decimal mismatches", () => {
      const number = new SchemaShield().compile({ type: "number" });
      expect(number(Number.NaN).valid).toBe(false);

      const integer = new SchemaShield().compile({ type: "integer" });
      expect(integer(Number.NaN).valid).toBe(false);
      expect(integer(Number.POSITIVE_INFINITY).valid).toBe(false);

      const decimal = new SchemaShield().compile({ multipleOf: 0.1 });
      expect(decimal(0.3).valid).toBe(true);
      expect(decimal(0.31).valid).toBe(false);
      expect(decimal(Number.NaN).valid).toBe(false);
      expect(decimal(Number.POSITIVE_INFINITY).valid).toBe(false);

      const zeroDivisor = new SchemaShield().compile({ multipleOf: 0 });
      expect(zeroDivisor(1).valid).toBe(false);
    });
  });

});
