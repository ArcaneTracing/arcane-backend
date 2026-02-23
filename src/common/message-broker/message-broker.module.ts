import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  RabbitMQModule,
  MessageHandlerErrorBehavior,
} from "@golevelup/nestjs-rabbitmq";
import { config as loadEnv } from "dotenv";

loadEnv();
import { MESSAGE_BROKER } from "./message-broker.interface";
import { RabbitMQBrokerService } from "./rabbitmq/rabbitmq-broker.service";
import { KafkaBrokerService } from "./kafka/kafka-broker.service";
import { TopicConfigService } from "./topic-config.service";
import { getBroker } from "./broker-provider";

function buildRabbitMQUrl(configService: ConfigService): string {
  const rabbitmqUrl = configService.get<string>("RABBITMQ_URL");
  if (rabbitmqUrl) {
    return rabbitmqUrl;
  }
  const host = configService.get<string>("RABBITMQ_HOST") || "localhost";
  const port = configService.get<string>("RABBITMQ_PORT") || "5672";
  const username = configService.get<string>("RABBITMQ_USERNAME") || "guest";
  const password = configService.get<string>("RABBITMQ_PASSWORD") || "guest";
  const vhost = configService.get<string>("RABBITMQ_VHOST") || "/";
  const encodedVhost = vhost === "/" ? "" : encodeURIComponent(vhost);
  return `amqp://${username}:${password}@${host}:${port}${encodedVhost ? "/" + encodedVhost : ""}`;
}

@Module({})
export class MessageBrokerModule {
  static forRoot(): DynamicModule {
    const raw = process.env.MESSAGE_BROKER || "rabbitmq";
    const brokerType = (raw?.toLowerCase() ?? "rabbitmq").trim() || "rabbitmq";
    const isRabbitMQ = brokerType === "rabbitmq";
    const isKafka = brokerType === "kafka";

    const imports: DynamicModule["imports"] = [ConfigModule];

    if (isRabbitMQ) {
      imports.push(
        RabbitMQModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const topicConfig = new TopicConfigService(configService);
            const topology = topicConfig.getRabbitMQTopology();
            return {
              uri: buildRabbitMQUrl(configService),
              exchanges: topology.exchanges,
              queues: topology.queues,
              prefetchCount: 10,
              defaultSubscribeErrorBehavior:
                MessageHandlerErrorBehavior.REQUEUE,
              registerHandlers: false,
              channels: {
                "evaluation-results": { prefetchCount: 10 },
                "experiment-results": { prefetchCount: 10 },
              },
            };
          },
          inject: [ConfigService],
        }),
      );
    }

    const providers: DynamicModule["providers"] = [
      TopicConfigService,
      {
        provide: MESSAGE_BROKER,
        useFactory: (
          configService: ConfigService,
          rabbitMQBroker: RabbitMQBrokerService | null,
          kafkaBroker: KafkaBrokerService | null,
        ) => getBroker(configService, rabbitMQBroker, kafkaBroker),
        inject: [
          ConfigService,
          { token: RabbitMQBrokerService, optional: true },
          { token: KafkaBrokerService, optional: true },
        ],
      },
    ];

    if (isRabbitMQ) {
      providers.push(RabbitMQBrokerService);
    }
    if (isKafka) {
      providers.push(KafkaBrokerService);
    }

    return {
      module: MessageBrokerModule,
      imports,
      providers,
      exports: [MESSAGE_BROKER],
    };
  }
}
