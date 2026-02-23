import { ConfigService } from "@nestjs/config";
import { getBroker } from "../../../src/common/message-broker/broker-provider";
import { RabbitMQBrokerService } from "../../../src/common/message-broker/rabbitmq/rabbitmq-broker.service";
import { KafkaBrokerService } from "../../../src/common/message-broker/kafka/kafka-broker.service";

describe("getBroker", () => {
  const mockRabbitBroker = { publish: jest.fn(), subscribe: jest.fn() };
  const mockKafkaBroker = { publish: jest.fn(), subscribe: jest.fn() };

  it("returns RabbitMQ broker when MESSAGE_BROKER=rabbitmq", () => {
    const config = { get: jest.fn(() => "rabbitmq") } as any;
    const broker = getBroker(
      config,
      mockRabbitBroker as any,
      mockKafkaBroker as any,
    );
    expect(broker).toBe(mockRabbitBroker);
  });

  it("returns Kafka broker when MESSAGE_BROKER=kafka", () => {
    const config = { get: jest.fn(() => "kafka") } as any;
    const broker = getBroker(
      config,
      mockRabbitBroker as any,
      mockKafkaBroker as any,
    );
    expect(broker).toBe(mockKafkaBroker);
  });

  it("throws when MESSAGE_BROKER=rabbitmq but rabbit broker is null", () => {
    const config = { get: jest.fn(() => "rabbitmq") } as any;
    expect(() => getBroker(config, null, mockKafkaBroker as any)).toThrow(
      "Unsupported MESSAGE_BROKER",
    );
  });

  it("throws when MESSAGE_BROKER=kafka but kafka broker is null", () => {
    const config = { get: jest.fn(() => "kafka") } as any;
    expect(() => getBroker(config, mockRabbitBroker as any, null)).toThrow(
      "Unsupported MESSAGE_BROKER",
    );
  });

  it("throws for unknown broker type", () => {
    const config = { get: jest.fn(() => "nats") } as any;
    expect(() =>
      getBroker(config, mockRabbitBroker as any, mockKafkaBroker as any),
    ).toThrow("Unsupported MESSAGE_BROKER: nats");
  });

  it("accepts MESSAGE_BROKER=Kafka (case-insensitive)", () => {
    const config = { get: jest.fn(() => "Kafka") } as any;
    const broker = getBroker(
      config,
      mockRabbitBroker as any,
      mockKafkaBroker as any,
    );
    expect(broker).toBe(mockKafkaBroker);
  });

  it("accepts MESSAGE_BROKER=RABBITMQ (case-insensitive)", () => {
    const config = { get: jest.fn(() => "RABBITMQ") } as any;
    const broker = getBroker(
      config,
      mockRabbitBroker as any,
      mockKafkaBroker as any,
    );
    expect(broker).toBe(mockRabbitBroker);
  });
});
