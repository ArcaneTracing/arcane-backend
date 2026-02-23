import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EVALUATION_JOBS_TOPIC,
  EVALUATION_RESULTS_TOPIC,
  EXPERIMENT_JOBS_TOPIC,
  EXPERIMENT_RESULTS_TOPIC,
} from "./topic-config.constants";
import type { RabbitTopicConfig } from "./topic-config.constants";

export interface KafkaTopicConfig {
  topic: string;
  groupId?: string;
}

export interface RabbitTopicConfigMap {
  publish: Record<string, Omit<RabbitTopicConfig, "queue">>;
  consume: Record<string, RabbitTopicConfig>;
}

export interface RabbitMQTopologyConfig {
  exchanges: Array<{
    name: string;
    type: string;
    options: { durable: boolean };
  }>;
  queues: Array<{
    name: string;
    exchange: string;
    routingKey: string;
    options: { durable: boolean };
  }>;
}

@Injectable()
export class TopicConfigService {
  constructor(private readonly configService: ConfigService) {}

  private get(key: string, defaultValue: string): string {
    return this.configService.get<string>(key) ?? defaultValue;
  }

  private getTopicName(logicalTopic: string): string {
    const mapping: Record<string, { envKey: string; default: string }> = {
      [EVALUATION_JOBS_TOPIC]: {
        envKey: "EVALUATION_JOBS_TOPIC",
        default: EVALUATION_JOBS_TOPIC,
      },
      [EVALUATION_RESULTS_TOPIC]: {
        envKey: "EVALUATION_RESULTS_TOPIC",
        default: EVALUATION_RESULTS_TOPIC,
      },
      [EXPERIMENT_JOBS_TOPIC]: {
        envKey: "EXPERIMENT_JOBS_TOPIC",
        default: EXPERIMENT_JOBS_TOPIC,
      },
      [EXPERIMENT_RESULTS_TOPIC]: {
        envKey: "EXPERIMENT_RESULTS_TOPIC",
        default: EXPERIMENT_RESULTS_TOPIC,
      },
    };
    const config = mapping[logicalTopic];
    if (!config) {
      throw new Error(`Unknown logical topic: ${logicalTopic}`);
    }
    return this.get(config.envKey, config.default);
  }

  getTopicToRabbitPublish(): Record<string, Omit<RabbitTopicConfig, "queue">> {
    const evalJobs = this.getTopicName(EVALUATION_JOBS_TOPIC);
    const evalResults = this.getTopicName(EVALUATION_RESULTS_TOPIC);
    const expJobs = this.getTopicName(EXPERIMENT_JOBS_TOPIC);
    const expResults = this.getTopicName(EXPERIMENT_RESULTS_TOPIC);
    return {
      [EVALUATION_JOBS_TOPIC]: { exchange: evalJobs, routingKey: evalJobs },
      [EVALUATION_RESULTS_TOPIC]: {
        exchange: evalResults,
        routingKey: evalResults,
      },
      [EXPERIMENT_JOBS_TOPIC]: { exchange: expJobs, routingKey: expJobs },
      [EXPERIMENT_RESULTS_TOPIC]: {
        exchange: expResults,
        routingKey: expResults,
      },
    };
  }

  getTopicToRabbitConsume(): Record<string, RabbitTopicConfig> {
    const evalResults = this.getTopicName(EVALUATION_RESULTS_TOPIC);
    const expResults = this.getTopicName(EXPERIMENT_RESULTS_TOPIC);
    return {
      [EVALUATION_RESULTS_TOPIC]: {
        exchange: evalResults,
        routingKey: evalResults,
        queue: evalResults,
      },
      [EXPERIMENT_RESULTS_TOPIC]: {
        exchange: expResults,
        routingKey: expResults,
        queue: expResults,
      },
    };
  }

  getRabbitMQTopology(): RabbitMQTopologyConfig {
    const evalJobs = this.getTopicName(EVALUATION_JOBS_TOPIC);
    const evalResults = this.getTopicName(EVALUATION_RESULTS_TOPIC);
    const expJobs = this.getTopicName(EXPERIMENT_JOBS_TOPIC);
    const expResults = this.getTopicName(EXPERIMENT_RESULTS_TOPIC);
    return {
      exchanges: [
        { name: evalJobs, type: "topic", options: { durable: true } },
        { name: evalResults, type: "topic", options: { durable: true } },
        { name: expJobs, type: "topic", options: { durable: true } },
        { name: expResults, type: "topic", options: { durable: true } },
      ],
      queues: [
        {
          name: evalJobs,
          exchange: evalJobs,
          routingKey: evalJobs,
          options: { durable: true },
        },
        {
          name: evalResults,
          exchange: evalResults,
          routingKey: evalResults,
          options: { durable: true },
        },
        {
          name: expJobs,
          exchange: expJobs,
          routingKey: expJobs,
          options: { durable: true },
        },
        {
          name: expResults,
          exchange: expResults,
          routingKey: expResults,
          options: { durable: true },
        },
      ],
    };
  }

  getKafkaTopic(logicalTopic: string): string {
    return this.getTopicName(logicalTopic);
  }

  getTopicToKafkaConsume(): Record<string, KafkaTopicConfig> {
    const evalTopic = this.getKafkaTopic(EVALUATION_RESULTS_TOPIC);
    const expTopic = this.getKafkaTopic(EXPERIMENT_RESULTS_TOPIC);
    return {
      [EVALUATION_RESULTS_TOPIC]: {
        topic: evalTopic,
        groupId: `arcane-backend-${evalTopic}`,
      },
      [EXPERIMENT_RESULTS_TOPIC]: {
        topic: expTopic,
        groupId: `arcane-backend-${expTopic}`,
      },
    };
  }
}
