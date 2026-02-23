import { Test, TestingModule } from "@nestjs/testing";
import { TraceRepositoryFactory } from "../../../src/traces/backends/trace-repository.factory";
import { TempoTraceRepository } from "../../../src/traces/backends/tempo/tempo.trace.repository";
import { JaegerTraceRepository } from "../../../src/traces/backends/jaeger/jaeger.trace.repository";
import { ClickHouseTraceRepository } from "../../../src/traces/backends/clickhouse/clickhouse.trace.repository";
import { CustomApiTraceRepository } from "../../../src/traces/backends/custom-api/custom-api.trace.repository";
import { DatasourceSource } from "../../../src/datasources/entities/datasource.entity";

describe("TraceRepositoryFactory", () => {
  let factory: TraceRepositoryFactory;
  let tempoRepository: TempoTraceRepository;
  let jaegerRepository: JaegerTraceRepository;
  let clickHouseRepository: ClickHouseTraceRepository;
  let customApiRepository: CustomApiTraceRepository;

  const mockTempoRepository = {} as TempoTraceRepository;
  const mockJaegerRepository = {} as JaegerTraceRepository;
  const mockClickHouseRepository = {} as ClickHouseTraceRepository;
  const mockCustomApiRepository = {} as CustomApiTraceRepository;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        TraceRepositoryFactory,
        {
          provide: TempoTraceRepository,
          useValue: mockTempoRepository,
        },
        {
          provide: JaegerTraceRepository,
          useValue: mockJaegerRepository,
        },
        {
          provide: ClickHouseTraceRepository,
          useValue: mockClickHouseRepository,
        },
        {
          provide: CustomApiTraceRepository,
          useValue: mockCustomApiRepository,
        },
      ],
    }).compile();

    factory = module.get<TraceRepositoryFactory>(TraceRepositoryFactory);
    tempoRepository = module.get<TempoTraceRepository>(TempoTraceRepository);
    jaegerRepository = module.get<JaegerTraceRepository>(JaegerTraceRepository);
    clickHouseRepository = module.get<ClickHouseTraceRepository>(
      ClickHouseTraceRepository,
    );
    customApiRepository = module.get<CustomApiTraceRepository>(
      CustomApiTraceRepository,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRepository", () => {
    it("should return TempoTraceRepository for TEMPO source", () => {
      const repository = factory.getRepository(DatasourceSource.TEMPO);
      expect(repository).toBe(mockTempoRepository);
    });

    it("should return JaegerTraceRepository for JAEGER source", () => {
      const repository = factory.getRepository(DatasourceSource.JAEGER);
      expect(repository).toBe(mockJaegerRepository);
    });

    it("should return ClickHouseTraceRepository for CLICKHOUSE source", () => {
      const repository = factory.getRepository(DatasourceSource.CLICKHOUSE);
      expect(repository).toBe(mockClickHouseRepository);
    });

    it("should return CustomApiTraceRepository for CUSTOM_API source", () => {
      const repository = factory.getRepository(DatasourceSource.CUSTOM_API);
      expect(repository).toBe(mockCustomApiRepository);
    });

    it("should throw error for unsupported datasource source", () => {
      const unsupportedSource = "UNSUPPORTED" as DatasourceSource;
      expect(() => factory.getRepository(unsupportedSource)).toThrow(
        "Unsupported datasource source: UNSUPPORTED",
      );
    });
  });
});
