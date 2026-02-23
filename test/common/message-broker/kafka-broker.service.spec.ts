import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { KafkaBrokerService } from "../../../src/common/message-broker/kafka/kafka-broker.service";
import { TopicConfigService } from "../../../src/common/message-broker/topic-config.service";
import {
  EVALUATION_JOBS_TOPIC,
  EVALUATION_RESULTS_TOPIC,
  EXPERIMENT_RESULTS_TOPIC,
} from "../../../src/common/message-broker/topic-config.constants";

const mockProducer = {
  connect: jest.fn(),
  send: jest.fn(),
  disconnect: jest.fn(),
};

const mockConsumer = {
  connect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
  disconnect: jest.fn(),
};

const mockConsumerFn = jest.fn((opts: { groupId: string }) => mockConsumer);

jest.mock("kafkajs", () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => mockProducer,
    consumer: mockConsumerFn,
  })),
}));

describe("KafkaBrokerService", () => {
  let configService: ConfigService;
  let topicConfig: TopicConfigService;
  let service: KafkaBrokerService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          KAFKA_BROKERS: "localhost:9092",
          KAFKA_CLIENT_ID: "arcane",
        };
        return map[key] ?? defaultValue ?? undefined;
      }),
    } as unknown as ConfigService;
    topicConfig = {
      getKafkaTopic: jest.fn((t: string) => t),
      getTopicToKafkaConsume: jest.fn(() => ({
        [EVALUATION_RESULTS_TOPIC]: {
          topic: EVALUATION_RESULTS_TOPIC,
          groupId: `arcane-backend-${EVALUATION_RESULTS_TOPIC}`,
        },
        [EXPERIMENT_RESULTS_TOPIC]: {
          topic: EXPERIMENT_RESULTS_TOPIC,
          groupId: `arcane-backend-${EXPERIMENT_RESULTS_TOPIC}`,
        },
      })),
    } as unknown as TopicConfigService;
    service = new KafkaBrokerService(configService, topicConfig);

    mockProducer.connect.mockResolvedValue(undefined);
    mockProducer.send.mockResolvedValue(undefined);
    mockProducer.disconnect.mockResolvedValue(undefined);
    mockConsumer.connect.mockResolvedValue(undefined);
    mockConsumer.subscribe.mockResolvedValue(undefined);
    mockConsumer.run.mockResolvedValue(undefined);
    mockConsumer.disconnect.mockResolvedValue(undefined);
  });

  describe("publish", () => {
    it("throws for unknown topic", async () => {
      (topicConfig.getKafkaTopic as jest.Mock).mockImplementation(() => {
        throw new Error("Unknown topic for Kafka: invalid-topic");
      });

      await expect(
        service.publish("invalid-topic", { foo: "bar" }),
      ).rejects.toThrow("Unknown topic for Kafka");
    });

    it("throws when producer.send fails", async () => {
      mockProducer.send.mockRejectedValue(
        new Error("Kafka broker unreachable"),
      );

      await expect(
        service.publish(EVALUATION_JOBS_TOPIC, { foo: "bar" }),
      ).rejects.toThrow("Kafka broker unreachable");
    });

    it("handles JSON.stringify failure (circular reference)", async () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      await expect(
        service.publish(EVALUATION_JOBS_TOPIC, circular),
      ).rejects.toThrow();
    });

    it("throws for null/undefined message", async () => {
      await expect(
        service.publish(EVALUATION_JOBS_TOPIC, null as unknown as object),
      ).rejects.toThrow("Message cannot be null or undefined");
    });

    it("handles producer.connect failure on first publish", async () => {
      mockProducer.connect.mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      await expect(
        service.publish(EVALUATION_JOBS_TOPIC, { foo: "bar" }),
      ).rejects.toThrow("Connection refused");
    });
  });

  describe("subscribe", () => {
    it("throws for unknown topic", () => {
      (topicConfig.getTopicToKafkaConsume as jest.Mock).mockReturnValue({});

      expect(() => service.subscribe("invalid-topic", jest.fn())).toThrow(
        "Unknown topic for subscribe",
      );
    });

    it("registers pending subscription without connecting", () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());

      expect(mockConsumer.connect).not.toHaveBeenCalled();
      expect(mockConsumer.subscribe).not.toHaveBeenCalled();
    });
  });

  describe("onApplicationBootstrap", () => {
    it("does nothing when no pending subscriptions", async () => {
      await service.onApplicationBootstrap();

      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });

    it("disconnects first consumer and throws when second consumer.connect fails (rollback)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockConsumer.connect
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Connect failed"));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Connect failed",
      );

      expect(mockConsumer.connect).toHaveBeenCalledTimes(2);
      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
    });

    it("stops on consumer.subscribe failure", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      mockConsumer.subscribe.mockRejectedValue(
        new Error("Topic does not exist"),
      );

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Topic does not exist",
      );
    });

    it("handles consumer.run rejection asynchronously (does not block bootstrap)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockConsumer.run.mockReturnValue(Promise.reject(new Error("Run failed")));

      await service.onApplicationBootstrap();

      expect(mockConsumer.connect).toHaveBeenCalledTimes(2);
      expect(mockConsumer.subscribe).toHaveBeenCalledTimes(2);
      expect(mockConsumer.run).toHaveBeenCalledTimes(2);
    });

    it("registers one consumer per subscription in consumers array", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      expect(service["consumers"]).toHaveLength(2);
    });

    it("uses per-topic consumer group IDs (FastStream-style)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      expect(mockConsumerFn).toHaveBeenCalledTimes(2);
      expect(mockConsumerFn).toHaveBeenNthCalledWith(1, {
        groupId: `arcane-backend-${EVALUATION_RESULTS_TOPIC}`,
      });
      expect(mockConsumerFn).toHaveBeenNthCalledWith(2, {
        groupId: `arcane-backend-${EXPERIMENT_RESULTS_TOPIC}`,
      });
    });

    it("disconnects already-connected consumers when subscribe fails (rollback)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockConsumer.subscribe
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Topic does not exist"));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Topic does not exist",
      );

      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(2);
      expect(service["consumers"]).toHaveLength(0);
    });

    it("rollback continues when consumer.disconnect throws (logs and rethrows original)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockConsumer.subscribe
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Topic does not exist"));
      mockConsumer.disconnect.mockRejectedValue(
        new Error("Already disconnected"),
      );

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Topic does not exist",
      );

      expect(service["consumers"]).toHaveLength(0);
    });

    it("handler throw propagates to consumer (Kafka will retry)", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("Handler crashed"));
      service.subscribe(EVALUATION_RESULTS_TOPIC, handler);
      await service.onApplicationBootstrap();

      const eachMessage = mockConsumer.run.mock.calls[0][0].eachMessage;
      await expect(
        eachMessage({
          topic: EVALUATION_RESULTS_TOPIC,
          partition: 0,
          message: { value: Buffer.from(JSON.stringify({ foo: "bar" })) },
        } as any),
      ).rejects.toThrow("Handler crashed");

      expect(service["consumers"]).toHaveLength(1);
    });

    it("handles empty message value", async () => {
      const handler = jest.fn();
      service.subscribe(EVALUATION_RESULTS_TOPIC, handler);
      await service.onApplicationBootstrap();

      const eachMessage = mockConsumer.run.mock.calls[0][0].eachMessage;
      await eachMessage({
        topic: EVALUATION_RESULTS_TOPIC,
        partition: 0,
        message: { value: null },
      } as any);

      expect(handler).not.toHaveBeenCalled();
    });

    it("handles invalid JSON in message", async () => {
      const handler = jest.fn();
      service.subscribe(EVALUATION_RESULTS_TOPIC, handler);
      await service.onApplicationBootstrap();

      const eachMessage = mockConsumer.run.mock.calls[0][0].eachMessage;
      await expect(
        eachMessage({
          topic: EVALUATION_RESULTS_TOPIC,
          partition: 0,
          message: { value: Buffer.from("not-json") },
        } as any),
      ).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it("late subscribe after bootstrap never starts consumer (documented limitation)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());

      expect(service["consumers"]).toHaveLength(1);
      expect(service["pendingSubscriptions"]).toHaveLength(1);
    });

    it("double subscribe to same topic creates two consumers (partition sharing)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      expect(service["consumers"]).toHaveLength(2);
      expect(mockConsumer.run).toHaveBeenCalledTimes(2);
    });

    it("logs when consumer.run() rejects (consumer crash)", async () => {
      const logSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      mockConsumer.run.mockReturnValue(
        Promise.reject(new Error("Broker down")),
      );

      await service.onApplicationBootstrap();

      expect(logSpy).toHaveBeenCalledWith(
        "Kafka consumer crashed for topic evaluation-results: Broker down",
        expect.any(String),
      );
      logSpy.mockRestore();
    });
  });

  describe("onApplicationShutdown", () => {
    it("handles producer.disconnect failure, throws AggregateError", async () => {
      await service.publish(EVALUATION_JOBS_TOPIC, {});
      mockProducer.disconnect.mockRejectedValue(new Error("Disconnect failed"));

      await expect(service.onApplicationShutdown()).rejects.toThrow(
        "Kafka shutdown had errors",
      );

      expect(mockProducer.disconnect).toHaveBeenCalled();
    });

    it("continues disconnecting all consumers when one fails, then throws AggregateError", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();
      mockConsumer.disconnect
        .mockRejectedValueOnce(new Error("First consumer disconnect failed"))
        .mockResolvedValueOnce(undefined);

      await expect(service.onApplicationShutdown()).rejects.toThrow(
        "Kafka shutdown had errors",
      );

      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(2);
    });

    it("is idempotent when called multiple times", async () => {
      await service.publish(EVALUATION_JOBS_TOPIC, {});
      await service.onApplicationShutdown();
      await service.onApplicationShutdown();

      expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
