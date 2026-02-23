import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";
import { MessageBroker } from "../message-broker.interface";
import { TopicConfigService } from "../topic-config.service";

interface PendingSubscription {
  topic: string;
  handler: (payload: unknown) => Promise<void>;
  groupId?: string;
}

@Injectable()
export class KafkaBrokerService
  implements MessageBroker, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaBrokerService.name);
  private readonly pendingSubscriptions: PendingSubscription[] = [];
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private producerConnectPromise: Promise<Producer> | null = null;
  private consumers: Consumer[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly topicConfig: TopicConfigService,
  ) {}

  private getKafka(): Kafka {
    if (!this.kafka) {
      const brokersRaw =
        this.configService.get<string>("KAFKA_BROKERS") ??
        process.env.KAFKA_BROKERS ??
        "localhost:9092";

      const brokers = brokersRaw.split(",").map((b) => b.trim());
      const clientId =
        this.configService.get<string>("KAFKA_CLIENT_ID") ?? "arcane";

      const sslEnabled = this.configService.get<string>("KAFKA_SSL_ENABLED");
      const saslEnabled = this.configService.get<string>("KAFKA_SASL_ENABLED");

      const config: Record<string, unknown> = {
        clientId,
        brokers,
      };

      if (sslEnabled === "true") {
        config.ssl = true;
      }

      if (saslEnabled === "true") {
        const mechanism = (
          this.configService.get<string>("KAFKA_SASL_MECHANISM") ?? "plain"
        ).toLowerCase();
        const username = this.configService.get<string>("KAFKA_SASL_USERNAME");
        const password = this.configService.get<string>("KAFKA_SASL_PASSWORD");

        if (username && password) {
          config.sasl = {
            mechanism,
            username,
            password,
          };
          if (!config.ssl) {
            config.ssl = true;
          }
        }
      }

      this.kafka = new Kafka(
        config as unknown as ConstructorParameters<typeof Kafka>[0],
      );
    }
    return this.kafka;
  }

  private async getProducer(): Promise<Producer> {
    this.producerConnectPromise ??= (async () => {
      const p = this.getKafka().producer();
      await p.connect();
      this.producer = p;
      this.logger.log("Kafka producer connected");
      return p;
    })();
    return this.producerConnectPromise;
  }

  async publish(
    topic: string,
    message: object,
    options?: { messageId?: string; key?: string },
  ): Promise<void> {
    if (message == null) {
      throw new Error("Message cannot be null or undefined");
    }
    const kafkaTopic = this.topicConfig.getKafkaTopic(topic);
    const producer = await this.getProducer();

    const value = JSON.stringify(message);
    const key = options?.key ?? options?.messageId ?? undefined;

    await producer.send({
      topic: kafkaTopic,
      messages: [
        {
          key: key ? Buffer.from(key) : undefined,
          value: Buffer.from(value),
          headers: options?.messageId
            ? { messageId: options.messageId }
            : undefined,
        },
      ],
    });
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<void>): void {
    const kafkaTopic = this.topicConfig.getKafkaTopic(topic);
    const consumeConfig = this.topicConfig.getTopicToKafkaConsume()[topic];
    if (!consumeConfig) {
      throw new Error(`Unknown topic for subscribe: ${topic}`);
    }
    this.pendingSubscriptions.push({
      topic: kafkaTopic,
      handler,
      groupId: consumeConfig.groupId,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.pendingSubscriptions.length === 0) return;

    const subs = [...this.pendingSubscriptions];
    this.pendingSubscriptions.length = 0;

    try {
      for (const sub of subs) {
        const groupId = sub.groupId;
        if (!groupId) {
          throw new Error(`Missing groupId for topic ${sub.topic}`);
        }
        const consumer = this.getKafka().consumer({ groupId });
        await consumer.connect();
        this.consumers.push(consumer);

        await consumer.subscribe({
          topics: [sub.topic],
          fromBeginning: false,
        });

        const handler = sub.handler;
        consumer
          .run({
            eachMessage: async (payload: EachMessagePayload) => {
              this.logger.log(
                `Kafka message received on topic ${payload.topic} partition ${payload.partition} offset ${payload.message.offset}`,
              );
              const value = payload.message.value;
              if (!value) {
                this.logger.warn(`Empty message on topic ${payload.topic}`);
                return;
              }

              let parsed: unknown;
              try {
                parsed = JSON.parse(value.toString());
              } catch (err) {
                const error = err as Error;
                this.logger.error(
                  `Failed to parse Kafka message: ${error.message}. Raw: ${value.toString()}`,
                );
                throw err;
              }

              await handler(parsed);
            },
          })
          .catch((err: Error) => {
            this.logger.error(
              `Kafka consumer crashed for topic ${sub.topic}: ${err.message}`,
              err.stack,
            );
          });

        this.logger.log(
          `Kafka consumer subscribed to topic ${sub.topic} (group: ${sub.groupId})`,
        );
      }
    } catch (err) {
      for (const consumer of this.consumers) {
        try {
          await consumer.disconnect();
        } catch (error_) {
          this.logger.warn(
            `Failed to disconnect consumer during bootstrap rollback: ${(error_ as Error).message}`,
          );
        }
      }
      this.consumers = [];
      throw err;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const errors: Error[] = [];
    if (this.producer) {
      try {
        await this.producer.disconnect();
        this.logger.log("Kafka producer disconnected");
      } catch (err) {
        errors.push(err as Error);
        this.logger.error(
          `Failed to disconnect Kafka producer: ${(err as Error).message}`,
        );
      }
      this.producer = null;
      this.producerConnectPromise = null;
    }
    for (const consumer of this.consumers) {
      try {
        await consumer.disconnect();
        this.logger.log("Kafka consumer disconnected");
      } catch (err) {
        errors.push(err as Error);
        this.logger.error(
          `Failed to disconnect Kafka consumer: ${(err as Error).message}`,
        );
      }
    }
    this.consumers = [];
    if (errors.length > 0) {
      throw new AggregateError(errors, "Kafka shutdown had errors");
    }
  }
}
