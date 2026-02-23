import { ConfigService } from "@nestjs/config";
import { TopicConfigService } from "../../../src/common/message-broker/topic-config.service";
import {
  EVALUATION_JOBS_TOPIC,
  EVALUATION_RESULTS_TOPIC,
  EXPERIMENT_JOBS_TOPIC,
  EXPERIMENT_RESULTS_TOPIC,
} from "../../../src/common/message-broker/topic-config.constants";

describe("TopicConfigService", () => {
  let configService: ConfigService;
  let service: TopicConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => undefined),
    } as unknown as ConfigService;
    service = new TopicConfigService(configService);
  });

  describe("getKafkaTopic", () => {
    it("throws for unknown logical topic", () => {
      expect(() => service.getKafkaTopic("unknown-topic")).toThrow(
        "Unknown logical topic",
      );
    });

    it("returns topic name for known topics", () => {
      expect(service.getKafkaTopic(EVALUATION_JOBS_TOPIC)).toBe(
        EVALUATION_JOBS_TOPIC,
      );
      expect(service.getKafkaTopic(EVALUATION_RESULTS_TOPIC)).toBe(
        EVALUATION_RESULTS_TOPIC,
      );
      expect(service.getKafkaTopic(EXPERIMENT_JOBS_TOPIC)).toBe(
        EXPERIMENT_JOBS_TOPIC,
      );
      expect(service.getKafkaTopic(EXPERIMENT_RESULTS_TOPIC)).toBe(
        EXPERIMENT_RESULTS_TOPIC,
      );
    });

    it("uses env override when set (EVALUATION_JOBS_TOPIC)", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) =>
        key === "EVALUATION_JOBS_TOPIC" ? "custom-eval-jobs" : undefined,
      );

      expect(service.getKafkaTopic(EVALUATION_JOBS_TOPIC)).toBe(
        "custom-eval-jobs",
      );
    });
  });

  describe("getTopicToRabbitPublish", () => {
    it("returns config for all publish topics", () => {
      const config = service.getTopicToRabbitPublish();
      expect(config[EVALUATION_JOBS_TOPIC]).toBeDefined();
      expect(config[EVALUATION_RESULTS_TOPIC]).toBeDefined();
      expect(config[EXPERIMENT_JOBS_TOPIC]).toBeDefined();
      expect(config[EXPERIMENT_RESULTS_TOPIC]).toBeDefined();
    });

    it("uses unified topic names for exchange and routingKey", () => {
      const config = service.getTopicToRabbitPublish();
      expect(config[EVALUATION_JOBS_TOPIC].exchange).toBe(
        EVALUATION_JOBS_TOPIC,
      );
      expect(config[EVALUATION_JOBS_TOPIC].routingKey).toBe(
        EVALUATION_JOBS_TOPIC,
      );
    });
  });

  describe("getTopicToRabbitConsume", () => {
    it("returns config only for consume topics", () => {
      const config = service.getTopicToRabbitConsume();
      expect(config[EVALUATION_RESULTS_TOPIC]).toBeDefined();
      expect(config[EXPERIMENT_RESULTS_TOPIC]).toBeDefined();
      expect(config[EVALUATION_JOBS_TOPIC]).toBeUndefined();
    });
  });

  describe("getTopicToKafkaConsume", () => {
    it("returns config only for consume topics", () => {
      const config = service.getTopicToKafkaConsume();
      expect(config[EVALUATION_RESULTS_TOPIC]).toBeDefined();
      expect(config[EXPERIMENT_RESULTS_TOPIC]).toBeDefined();
      expect(config[EVALUATION_JOBS_TOPIC]).toBeUndefined();
    });

    it("uses per-topic consumer group (FastStream-style, no env override)", () => {
      const config = service.getTopicToKafkaConsume();
      expect(config[EVALUATION_RESULTS_TOPIC].groupId).toBe(
        `arcane-backend-${EVALUATION_RESULTS_TOPIC}`,
      );
      expect(config[EXPERIMENT_RESULTS_TOPIC].groupId).toBe(
        `arcane-backend-${EXPERIMENT_RESULTS_TOPIC}`,
      );
    });

    it("uses env override for topic name when set (groupId still per-topic)", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) =>
        key === "EVALUATION_RESULTS_TOPIC" ? "custom-eval-results" : undefined,
      );

      const config = service.getTopicToKafkaConsume();
      expect(config[EVALUATION_RESULTS_TOPIC].topic).toBe(
        "custom-eval-results",
      );
      expect(config[EVALUATION_RESULTS_TOPIC].groupId).toBe(
        "arcane-backend-custom-eval-results",
      );
    });
  });
});
