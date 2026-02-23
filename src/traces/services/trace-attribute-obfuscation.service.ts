import { Injectable, Logger } from "@nestjs/common";
import { AttributeVisibilityRuleService } from "../../projects/services/attribute-visibility-rule.service";
import { RoleRetrievalService } from "../../rbac/services/role-retrieval.service";
import type { TempoSpanSetSpanAttribute } from "../backends/tempo/tempo.types";

@Injectable()
export class TraceAttributeObfuscationService {
  private readonly logger = new Logger(TraceAttributeObfuscationService.name);
  private readonly REDACTED_VALUE = "[REDACTED]";

  constructor(
    private readonly visibilityRuleService: AttributeVisibilityRuleService,
    private readonly roleRetrievalService: RoleRetrievalService,
  ) {}

  obfuscateAttributes(
    attributes: TempoSpanSetSpanAttribute[],
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): TempoSpanSetSpanAttribute[] {
    if (hiddenRoleMap.size === 0) {
      return attributes;
    }

    return attributes.map((attr) => {
      const hiddenRoleIds = hiddenRoleMap.get(attr.key);

      if (hiddenRoleIds === undefined) {
        return attr;
      }

      const isHiddenFromUser = userRoleIds.some((roleId) =>
        hiddenRoleIds.includes(roleId),
      );

      if (isHiddenFromUser) {
        return {
          key: attr.key,
          value: { stringValue: this.REDACTED_VALUE },
        };
      }

      return attr;
    });
  }

  async buildObfuscationContext(
    projectId: string,
    organisationId: string,
    userId: string,
  ): Promise<{ hiddenRoleMap: Map<string, string[]>; userRoleIds: string[] }> {
    const visibilityRules =
      await this.visibilityRuleService.getVisibilityRulesForProject(projectId);

    if (visibilityRules.length === 0) {
      return { hiddenRoleMap: new Map(), userRoleIds: [] };
    }

    const userRoles = await this.roleRetrievalService.getUserRoles(
      userId,
      organisationId,
      projectId,
    );
    const userRoleIds = userRoles.map((r) => r.id);

    const hiddenRoleMap = new Map<string, string[]>();
    for (const rule of visibilityRules) {
      hiddenRoleMap.set(rule.attributeName, rule.hiddenRoleIds);
    }

    return { hiddenRoleMap, userRoleIds };
  }

  async obfuscateTraceResponse(
    traceResponse: Record<string, unknown>,
    projectId: string,
    organisationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const batches = (traceResponse as { batches?: unknown[] }).batches;
    if (batches?.length) {
      const { hiddenRoleMap, userRoleIds } = await this.buildObfuscationContext(
        projectId,
        organisationId,
        userId,
      );
      (batches as Array<Record<string, unknown>>).forEach((batch) =>
        this.obfuscateBatch(batch, hiddenRoleMap, userRoleIds),
      );
    }
    return traceResponse;
  }

  private obfuscateBatch(
    batch: Record<string, unknown>,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    this.obfuscateResourceAttributes(
      batch.resource,
      hiddenRoleMap,
      userRoleIds,
    );
    this.obfuscateScopeSpans(batch.scopeSpans, hiddenRoleMap, userRoleIds);
  }

  private obfuscateResourceAttributes(
    resource: unknown,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    const res = resource as
      | { attributes?: TempoSpanSetSpanAttribute[] }
      | undefined;
    if (res?.attributes) {
      res.attributes = this.obfuscateAttributes(
        res.attributes,
        hiddenRoleMap,
        userRoleIds,
      );
    }
  }

  private obfuscateScopeSpans(
    scopeSpans: unknown,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    const spansList = scopeSpans as
      | Array<{ spans?: Array<Record<string, unknown>> }>
      | undefined;
    spansList?.forEach((scopeSpan) =>
      this.obfuscateSpans(scopeSpan.spans, hiddenRoleMap, userRoleIds),
    );
  }

  private obfuscateSpans(
    spans: Array<Record<string, unknown>> | undefined,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    spans?.forEach((span) =>
      this.obfuscateSpan(span, hiddenRoleMap, userRoleIds),
    );
  }

  private obfuscateSpan(
    span: Record<string, unknown>,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    this.obfuscateAttributesInPlace(
      span,
      "attributes",
      hiddenRoleMap,
      userRoleIds,
    );
    this.obfuscateSpanEvents(span, hiddenRoleMap, userRoleIds);
    this.obfuscateSpanLinks(span, hiddenRoleMap, userRoleIds);
  }

  private obfuscateAttributesInPlace(
    obj: Record<string, unknown>,
    key: string,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    const attrs = obj[key] as TempoSpanSetSpanAttribute[] | undefined;
    if (attrs) {
      obj[key] = this.obfuscateAttributes(attrs, hiddenRoleMap, userRoleIds);
    }
  }

  private obfuscateSpanEvents(
    span: Record<string, unknown>,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    const events = span.events as
      | Array<{ attributes?: TempoSpanSetSpanAttribute[] }>
      | undefined;
    events?.forEach((event) =>
      this.obfuscateAttributesInPlace(
        event,
        "attributes",
        hiddenRoleMap,
        userRoleIds,
      ),
    );
  }

  private obfuscateSpanLinks(
    span: Record<string, unknown>,
    hiddenRoleMap: Map<string, string[]>,
    userRoleIds: string[],
  ): void {
    const links = span.links as
      | Array<{ attributes?: TempoSpanSetSpanAttribute[] }>
      | undefined;
    links?.forEach((link) =>
      this.obfuscateAttributesInPlace(
        link,
        "attributes",
        hiddenRoleMap,
        userRoleIds,
      ),
    );
  }

  async obfuscateSearchResponse(
    searchResponse: Record<string, unknown>,
    projectId: string,
    organisationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const traces = (searchResponse as { traces?: unknown[] }).traces;
    if (traces?.length) {
      const { hiddenRoleMap, userRoleIds } = await this.buildObfuscationContext(
        projectId,
        organisationId,
        userId,
      );

      for (const trace of traces as Array<Record<string, unknown>>) {
        const spanSet = trace.spanSet as
          | { spans?: Array<{ attributes?: TempoSpanSetSpanAttribute[] }> }
          | undefined;
        const spans = spanSet?.spans;
        if (!spans) continue;

        for (const span of spans) {
          if (span.attributes) {
            span.attributes = this.obfuscateAttributes(
              span.attributes,
              hiddenRoleMap,
              userRoleIds,
            );
          }
        }
      }
    }

    return searchResponse;
  }
}
