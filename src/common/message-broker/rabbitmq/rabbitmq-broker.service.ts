import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
} from "@golevelup/nestjs-rabbitmq";
import { MessageBroker } from "../message-broker.interface";
import { TopicConfigService } from "../topic-config.service";

interface PendingSubscription {
  topic: string;
  handler: (payload: unknown) => Promise<void>;
}

@Injectable()
export class RabbitMQBrokerService
  implements MessageBroker, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMQBrokerService.name);
  private readonly pendingSubscriptions: PendingSubscription[] = [];

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly topicConfig: TopicConfigService,
  ) {}

  async publish(
    topic: string,
    message: object,
    options?: { messageId?: string; key?: string },
  ): Promise<void> {
    if (message == null) {
      throw new Error("Message cannot be null or undefined");
    }
    const config = this.topicConfig.getTopicToRabbitPublish()[topic];
    if (!config) {
      throw new Error(`Unknown topic for publish: ${topic}`);
    }

    if (!this.amqpConnection.connected) {
      this.logger.warn("RabbitMQ connection not ready, initializing...");
      await this.amqpConnection.init();
    }

    const messageId = options?.messageId ?? `${topic}-${Date.now()}`;
    const published = await this.amqpConnection.publish(
      config.exchange,
      config.routingKey,
      message,
      {
        messageId,
        persistent: true,
      },
    );

    if (!published) {
      throw new Error(
        `Failed to confirm message publication for topic ${topic}`,
      );
    }
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<void>): void {
    const config = this.topicConfig.getTopicToRabbitConsume()[topic];
    if (!config) {
      throw new Error(`Unknown topic for subscribe: ${topic}`);
    }
    if (!config.queue) {
      throw new Error(`Topic ${topic} has no queue configured for consumption`);
    }
    this.pendingSubscriptions.push({ topic, handler });
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const { topic, handler } of this.pendingSubscriptions) {
      await this.setupConsumer(topic, handler);
    }
    this.pendingSubscriptions.length = 0;
  }

  private async setupConsumer(
    topic: string,
    handler: (payload: unknown) => Promise<void>,
  ): Promise<void> {
    const config = this.topicConfig.getTopicToRabbitConsume()[topic];
    if (!config?.queue) return;

    const wrappedHandler = async (
      msg: unknown,
      _rawMessage?: { content?: Buffer },
    ): Promise<void> => {
      let payload = msg;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          const err = parseError as Error;
          const rawPreview =
            typeof payload === "string" ? payload : JSON.stringify(payload);
          this.logger.error(
            `Failed to parse message as JSON: ${err.message}. Raw: ${rawPreview}`,
          );
          throw new Error(`Failed to parse message: ${err.message}`);
        }
      }
      await handler(payload);
    };

    await this.amqpConnection.createSubscriber(
      wrappedHandler,
      {
        exchange: config.exchange,
        routingKey: config.routingKey,
        queue: config.queue,
        queueOptions: {
          durable: true,
          channel: topic,
        },
        allowNonJsonMessages: true,
        errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
      },
      `RabbitMQBroker.${topic}`,
    );

    this.logger.log(`Subscribed to topic ${topic} (queue: ${config.queue})`);
  }

  async onApplicationShutdown(): Promise<void> {}
}
