import { ClickHouseQueryParser } from "../../../../src/traces/backends/clickhouse/clickhouse.query.parser";

describe("ClickHouseQueryParser", () => {
  describe("parse", () => {
    it("should return empty string for empty input", () => {
      expect(ClickHouseQueryParser.parse("")).toBe("");
      expect(ClickHouseQueryParser.parse("   ")).toBe("");
    });

    it('should parse EQUALS condition: attribute = "value"', () => {
      const result = ClickHouseQueryParser.parse('session.id = "453"');

      expect(result).toContain("mapContains(SpanAttributes");
      expect(result).toContain("mapContains(ResourceAttributes");
      expect(result).toContain("'session.id'");
      expect(result).toContain("'453'");
    });

    it("should parse EXISTS condition", () => {
      const result = ClickHouseQueryParser.parse("session.id EXISTS");

      expect(result).toContain("mapContains(SpanAttributes");
      expect(result).toContain("mapContains(ResourceAttributes");
      expect(result).toContain("'session.id'");
    });

    it("should parse has(attribute) condition", () => {
      const result = ClickHouseQueryParser.parse("has(session.id)");

      expect(result).toContain("mapContains(SpanAttributes");
      expect(result).toContain("mapContains(ResourceAttributes");
      expect(result).toContain("'session.id'");
    });

    it("should parse OR combination", () => {
      const result = ClickHouseQueryParser.parse(
        'session.id = "453" OR user.id = "123"',
      );

      expect(result).toContain("OR");
      expect(result).toContain("'session.id'");
      expect(result).toContain("'user.id'");
    });

    it("should parse AND combination", () => {
      const result = ClickHouseQueryParser.parse(
        'session.id = "453" AND status = "active"',
      );

      expect(result).toContain("AND");
      expect(result).toContain("'session.id'");
      expect(result).toContain("'status'");
    });

    it("should parse condition with parentheses", () => {
      const result = ClickHouseQueryParser.parse(
        '(session.id = "453" OR user.id = "123") AND status = "active"',
      );

      expect(result).toContain("AND");
      expect(result).toContain("OR");
      expect(result.length).toBeGreaterThan(0);
      expect(result.startsWith("(") && result.endsWith(")")).toBe(true);
    });

    it("should wrap result in parentheses", () => {
      const result = ClickHouseQueryParser.parse('session.id = "453"');

      expect(result).toMatch(/^\(.+\)$/);
    });

    it("should escape single quotes in attribute and value", () => {
      const result = ClickHouseQueryParser.parse('session.id = "453\'s"');

      expect(result).toContain("'453''s'");
    });

    it("should handle attribute names with dots", () => {
      const result = ClickHouseQueryParser.parse(
        'input.mime_type = "application/json"',
      );

      expect(result).toContain("'input.mime_type'");
      expect(result).toContain("'application/json'");
    });

    it("should handle case-insensitive AND and OR", () => {
      const andResult = ClickHouseQueryParser.parse('a = "1" and b = "2"');
      const orResult = ClickHouseQueryParser.parse('a = "1" or b = "2"');

      expect(andResult).toContain("AND");
      expect(orResult).toContain("OR");
    });

    it("should handle has() with spaces", () => {
      const result = ClickHouseQueryParser.parse("has( session.id )");

      expect(result).toContain("'session.id'");
    });

    it("should return empty string for unparseable condition", () => {
      const result = ClickHouseQueryParser.parse("invalid");

      expect(result).toBe("");
    });

    it("should parse dot-notation attribute used in trace queries", () => {
      const result = ClickHouseQueryParser.parse('.service.name = "test"');

      expect(result).toContain("'.service.name'");
      expect(result).toContain("'test'");
    });
  });
});
