import { ClickHouseQueryBuilder } from "./clickhouse.query.builder";
export class ClickHouseQueryParser {
  static parse(query: string): string {
    if (!query || query.trim().length === 0) {
      return "";
    }
    const normalized = query
      .replaceAll(/\s+AND\s+/gi, " __AND__ ")
      .replaceAll(/\s+OR\s+/gi, " __OR__ ")
      .trim();
    const parts = normalized.split(/\s+(__AND__|__OR__)\s+/);
    const conditions = this.processQueryParts(parts);
    return conditions.length > 0 ? `(${conditions.join(" ")})` : "";
  }

  private static processQueryParts(parts: string[]): string[] {
    const conditions: string[] = [];
    let operator: string | null = null;

    for (const partRaw of parts) {
      const part = partRaw.trim();
      if (part === "__AND__" || part === "__OR__") {
        operator = part === "__AND__" ? "AND" : "OR";
        continue;
      }
      const sqlCondition = this.parseConditionFromPart(part);
      if (sqlCondition) {
        if (operator && conditions.length > 0) conditions.push(operator);
        conditions.push(sqlCondition);
        operator = null;
      }
    }
    return conditions;
  }

  private static parseConditionFromPart(part: string): string {
    let condition = part;
    if (condition.startsWith("(") && condition.endsWith(")")) {
      condition = condition.slice(1, -1).trim();
    }
    return this.parseSingleCondition(condition);
  }
  private static parseSingleCondition(condition: string): string {
    condition = condition.trim();

    if (condition.includes("EXISTS")) {
      const attribute = condition.replace(/\s+EXISTS.*$/i, "").trim();
      if (attribute) {
        const escapedAttr = ClickHouseQueryBuilder.escapeString(attribute);
        return `(mapContains(SpanAttributes, '${escapedAttr}') OR mapContains(ResourceAttributes, '${escapedAttr}'))`;
      }
    }

    const hasRegex = /has\s*\(\s*([^)]{1,500})\s*\)/i;
    const hasMatch = hasRegex.exec(condition);
    if (hasMatch) {
      const attribute = hasMatch[1].trim();
      const escapedAttr = ClickHouseQueryBuilder.escapeString(attribute);
      return `(mapContains(SpanAttributes, '${escapedAttr}') OR mapContains(ResourceAttributes, '${escapedAttr}'))`;
    }

    const equalsRegex = /^([^=]{1,500})=\s*"([^"]{0,10000})"$/;
    const equalsMatch = equalsRegex.exec(condition);
    if (equalsMatch) {
      const attribute = equalsMatch[1].trim();
      const value = equalsMatch[2];
      const escapedAttr = ClickHouseQueryBuilder.escapeString(attribute);
      const escapedValue = ClickHouseQueryBuilder.escapeString(value);

      return `((mapContains(SpanAttributes, '${escapedAttr}') AND mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), '${escapedAttr}')] = '${escapedValue}') OR (mapContains(ResourceAttributes, '${escapedAttr}') AND mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), '${escapedAttr}')] = '${escapedValue}'))`;
    }

    return "";
  }
}
