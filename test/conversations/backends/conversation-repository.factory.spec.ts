import { ConversationRepositoryFactory } from "../../../src/conversations/backends/conversation-repository.factory";
import { DatasourceSource } from "../../../src/datasources/entities/datasource.entity";

describe("ConversationRepositoryFactory", () => {
  const tempoRepo = { getConversations: jest.fn() } as any;
  const jaegerRepo = { getConversations: jest.fn() } as any;
  const clickHouseRepo = { getConversations: jest.fn() } as any;
  const customApiRepo = { getConversations: jest.fn() } as any;

  it("should return Tempo repository for Tempo source", () => {
    const factory = new ConversationRepositoryFactory(
      tempoRepo,
      jaegerRepo,
      clickHouseRepo,
      customApiRepo,
    );

    const repo = factory.getRepository(DatasourceSource.TEMPO);

    expect(repo).toBe(tempoRepo);
  });

  it("should return Jaeger repository for Jaeger source", () => {
    const factory = new ConversationRepositoryFactory(
      tempoRepo,
      jaegerRepo,
      clickHouseRepo,
      customApiRepo,
    );

    const repo = factory.getRepository(DatasourceSource.JAEGER);

    expect(repo).toBe(jaegerRepo);
  });

  it("should return ClickHouse repository for ClickHouse source", () => {
    const factory = new ConversationRepositoryFactory(
      tempoRepo,
      jaegerRepo,
      clickHouseRepo,
      customApiRepo,
    );

    const repo = factory.getRepository(DatasourceSource.CLICKHOUSE);

    expect(repo).toBe(clickHouseRepo);
  });

  it("should return Custom API repository for Custom API source", () => {
    const factory = new ConversationRepositoryFactory(
      tempoRepo,
      jaegerRepo,
      clickHouseRepo,
      customApiRepo,
    );

    const repo = factory.getRepository(DatasourceSource.CUSTOM_API);

    expect(repo).toBe(customApiRepo);
  });

  it("should throw for unsupported datasource source", () => {
    const factory = new ConversationRepositoryFactory(
      tempoRepo,
      jaegerRepo,
      clickHouseRepo,
      customApiRepo,
    );

    expect(() => factory.getRepository("custom" as DatasourceSource)).toThrow(
      "Unsupported datasource source: custom",
    );
  });
});
