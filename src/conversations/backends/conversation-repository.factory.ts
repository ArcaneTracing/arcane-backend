import { Injectable } from "@nestjs/common";
import { DatasourceSource } from "src/datasources/entities/datasource.entity";
import { ConversationRepository } from "./conversation-repository.interface";
import { TempoConversationRepository } from "./tempo/tempo.conversation.repository";
import { JaegerConversationRepository } from "./jaeger/jaeger.conversation.repository";
import { ClickHouseConversationRepository } from "./clickhouse/clickhouse.conversation.repository";
import { CustomApiConversationRepository } from "./custom-api/custom-api.conversation.repository";

@Injectable()
export class ConversationRepositoryFactory {
  constructor(
    private readonly tempoConversationRepository: TempoConversationRepository,
    private readonly jaegerConversationRepository: JaegerConversationRepository,
    private readonly clickHouseConversationRepository: ClickHouseConversationRepository,
    private readonly customApiConversationRepository: CustomApiConversationRepository,
  ) {}

  getRepository(source: DatasourceSource): ConversationRepository {
    switch (source) {
      case DatasourceSource.TEMPO:
        return this.tempoConversationRepository;
      case DatasourceSource.JAEGER:
        return this.jaegerConversationRepository;
      case DatasourceSource.CLICKHOUSE:
        return this.clickHouseConversationRepository;
      case DatasourceSource.CUSTOM_API:
        return this.customApiConversationRepository;
      default:
        throw new Error(`Unsupported datasource source: ${source}`);
    }
  }
}
