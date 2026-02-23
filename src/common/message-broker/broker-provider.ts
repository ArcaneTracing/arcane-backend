import { ConfigService } from "@nestjs/config";
import { MessageBroker } from "./message-broker.interface";
import { RabbitMQBrokerService } from "./rabbitmq/rabbitmq-broker.service";
import { KafkaBrokerService } from "./kafka/kafka-broker.service";
export function getBroker(
  configService: ConfigService,
  rabbitMQBroker: RabbitMQBrokerService | null,
  kafkaBroker: KafkaBrokerService | null,
): MessageBroker {
  const raw = configService.get<string>("MESSAGE_BROKER", "rabbitmq");
  const brokerType = (raw?.toLowerCase() ?? "rabbitmq").trim() || "rabbitmq";
  if (brokerType === "rabbitmq" && rabbitMQBroker) {
    return rabbitMQBroker;
  }
  if (brokerType === "kafka" && kafkaBroker) {
    return kafkaBroker;
  }
  throw new Error(
    `Unsupported MESSAGE_BROKER: ${brokerType}. Use 'rabbitmq' or 'kafka'.`,
  );
}
