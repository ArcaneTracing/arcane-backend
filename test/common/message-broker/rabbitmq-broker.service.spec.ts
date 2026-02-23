import { RabbitMQBrokerService } from "../../../src/common/message-broker/rabbitmq/rabbitmq-broker.service";
import { TopicConfigService } from "../../../src/common/message-broker/topic-config.service";
import {
  EVALUATION_RESULTS_TOPIC,
  EXPERIMENT_RESULTS_TOPIC,
} from "../../../src/common/message-broker/topic-config.constants";

const mockAmqpConnection = {
  connected: true,
  init: jest.fn(),
  publish: jest.fn(),
  createSubscriber: jest.fn(),
};

describe("RabbitMQBrokerService", () => {
  let topicConfig: TopicConfigService;
  let service: RabbitMQBrokerService;

  const rabbitPublish = {
    [EVALUATION_RESULTS_TOPIC]: {
      exchange: "evaluations-results",
      routingKey: "evaluation-queue-result",
    },
    [EXPERIMENT_RESULTS_TOPIC]: {
      exchange: "experiments-results",
      routingKey: "experiment-results-queue",
    },
  };

  const rabbitConsume = {
    [EVALUATION_RESULTS_TOPIC]: {
      exchange: "evaluations-results",
      routingKey: "evaluation-queue-result",
      queue: "evaluation-queue-result",
    },
    [EXPERIMENT_RESULTS_TOPIC]: {
      exchange: "experiments-results",
      routingKey: "experiment-results-queue",
      queue: "experiment-results-queue",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    topicConfig = {
      getTopicToRabbitPublish: jest.fn(() => rabbitPublish),
      getTopicToRabbitConsume: jest.fn(() => rabbitConsume),
    } as unknown as TopicConfigService;
    service = new RabbitMQBrokerService(mockAmqpConnection as any, topicConfig);

    mockAmqpConnection.connected = true;
    mockAmqpConnection.publish.mockResolvedValue(true);
    mockAmqpConnection.createSubscriber.mockResolvedValue({
      consumerTag: "tag-1",
    });
  });

  describe("publish", () => {
    it("throws for unknown topic", async () => {
      (topicConfig.getTopicToRabbitPublish as jest.Mock).mockReturnValue({});

      await expect(
        service.publish("invalid-topic", { foo: "bar" }),
      ).rejects.toThrow("Unknown topic for publish");
    });

    it("throws for null/undefined message", async () => {
      await expect(
        service.publish(EVALUATION_RESULTS_TOPIC, null as unknown as object),
      ).rejects.toThrow("Message cannot be null or undefined");
    });

    it("throws when publish returns false", async () => {
      mockAmqpConnection.publish.mockResolvedValue(false);

      await expect(
        service.publish(EVALUATION_RESULTS_TOPIC, { foo: "bar" }),
      ).rejects.toThrow("Failed to confirm message publication");
    });

    it("calls init when not connected", async () => {
      mockAmqpConnection.connected = false;
      mockAmqpConnection.init.mockResolvedValue(undefined);

      await service.publish(EVALUATION_RESULTS_TOPIC, { foo: "bar" });

      expect(mockAmqpConnection.init).toHaveBeenCalled();
    });

    it("throws when init fails", async () => {
      mockAmqpConnection.connected = false;
      mockAmqpConnection.init.mockRejectedValue(
        new Error("Connection refused"),
      );

      await expect(
        service.publish(EVALUATION_RESULTS_TOPIC, { foo: "bar" }),
      ).rejects.toThrow("Connection refused");
    });
  });

  describe("subscribe", () => {
    it("throws for unknown topic", () => {
      (topicConfig.getTopicToRabbitConsume as jest.Mock).mockReturnValue({});

      expect(() => service.subscribe("invalid-topic", jest.fn())).toThrow(
        "Unknown topic for subscribe",
      );
    });

    it("throws when topic has no queue", () => {
      (topicConfig.getTopicToRabbitConsume as jest.Mock).mockReturnValue({
        [EVALUATION_RESULTS_TOPIC]: {
          exchange: "ex",
          routingKey: "rk",
          queue: undefined,
        },
      });

      expect(() =>
        service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn()),
      ).toThrow("no queue configured for consumption");
    });
  });

  describe("onApplicationBootstrap", () => {
    it("stops on createSubscriber failure", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockAmqpConnection.createSubscriber
        .mockResolvedValueOnce({ consumerTag: "tag-1" })
        .mockRejectedValueOnce(new Error("Queue not found"));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Queue not found",
      );

      expect(mockAmqpConnection.createSubscriber).toHaveBeenCalledTimes(2);
    });

    it("handler throw propagates (REQUEUE behavior)", async () => {
      let capturedHandler: (msg: unknown) => Promise<void>;
      mockAmqpConnection.createSubscriber.mockImplementation(
        (handler: (msg: unknown) => Promise<void>) => {
          capturedHandler = handler;
          return Promise.resolve({ consumerTag: "tag-1" });
        },
      );

      service.subscribe(
        EVALUATION_RESULTS_TOPIC,
        jest.fn().mockRejectedValue(new Error("Handler crashed")),
      );
      await service.onApplicationBootstrap();

      await expect(capturedHandler!({ foo: "bar" })).rejects.toThrow(
        "Handler crashed",
      );
    });

    it("parses string payload as JSON", async () => {
      let capturedHandler: (msg: unknown) => Promise<void>;
      mockAmqpConnection.createSubscriber.mockImplementation(
        (handler: (msg: unknown) => Promise<void>) => {
          capturedHandler = handler;
          return Promise.resolve({ consumerTag: "tag-1" });
        },
      );

      const handler = jest.fn().mockResolvedValue(undefined);
      service.subscribe(EVALUATION_RESULTS_TOPIC, handler);
      await service.onApplicationBootstrap();

      await capturedHandler!(
        JSON.stringify({ evaluationId: "e1", scoreId: "s1", score: 0.5 }),
      );

      expect(handler).toHaveBeenCalledWith({
        evaluationId: "e1",
        scoreId: "s1",
        score: 0.5,
      });
    });

    it("throws on invalid JSON string payload", async () => {
      let capturedHandler: (msg: unknown) => Promise<void>;
      mockAmqpConnection.createSubscriber.mockImplementation(
        (handler: (msg: unknown) => Promise<void>) => {
          capturedHandler = handler;
          return Promise.resolve({ consumerTag: "tag-1" });
        },
      );

      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      await expect(capturedHandler!("not-json")).rejects.toThrow(
        "Failed to parse message",
      );
    });

    it("late subscribe after bootstrap never starts consumer (documented limitation)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());

      expect(mockAmqpConnection.createSubscriber).toHaveBeenCalledTimes(1);
      expect(service["pendingSubscriptions"]).toHaveLength(1);
    });

    it("double subscribe to same topic creates two subscribers (competing consumers)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      await service.onApplicationBootstrap();

      expect(mockAmqpConnection.createSubscriber).toHaveBeenCalledTimes(2);
    });

    it("bootstrap partial failure: first consumer registered, second fails, throws (no rollback)", async () => {
      service.subscribe(EVALUATION_RESULTS_TOPIC, jest.fn());
      service.subscribe(EXPERIMENT_RESULTS_TOPIC, jest.fn());
      mockAmqpConnection.createSubscriber
        .mockResolvedValueOnce({ consumerTag: "tag-1" })
        .mockRejectedValueOnce(new Error("Queue not found"));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        "Queue not found",
      );

      expect(mockAmqpConnection.createSubscriber).toHaveBeenCalledTimes(2);
    });
  });
});
