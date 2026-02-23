import { DynamicModule, Module } from "@nestjs/common";

export enum MessageHandlerErrorBehavior {
  ACK = "ACK",
  NACK = "NACK",
  REQUEUE = "REQUEUE",
}

export const RabbitSubscribe =
  (_options?: Record<string, unknown>) =>
  (_target: object, _key?: string, _descriptor?: PropertyDescriptor) =>
    _descriptor ?? {};

const noOpChannel = {
  assertExchange: () => Promise.resolve(),
  assertQueue: () => Promise.resolve({ queue: "mock" }),
  bindQueue: () => Promise.resolve(),
  publish: () => true,
  checkExchange: () => Promise.resolve(),
  checkQueue: () => Promise.resolve({ queue: "mock" }),
  prefetch: () => Promise.resolve(),
  consume: () => Promise.resolve({ consumerTag: "mock" }),
  ack: () => {},
  nack: () => {},
  cancel: () => Promise.resolve(),
  close: () => Promise.resolve(),
};

const mockAmqpConnection = {
  get connected(): boolean {
    return true;
  },
  get channel() {
    return noOpChannel;
  },
  get connection() {
    return {};
  },
  get managedChannel() {
    return {
      publish: () => true,
      addSetup: () => Promise.resolve(),
      cancelAll: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
  },
  get managedConnection() {
    return { isConnected: () => true, close: () => Promise.resolve() };
  },
  get configuration() {
    return {};
  },
  get channels() {
    return {};
  },
  get managedChannels() {
    return {};
  },
  init: () => Promise.resolve(),
  publish: () => Promise.resolve(true),
  request: () => Promise.resolve({}),
  createSubscriber: () => Promise.resolve({ consumerTag: "mock" }),
  createBatchSubscriber: () => Promise.resolve({ consumerTag: "mock" }),
  createRpc: () => Promise.resolve({ consumerTag: "mock" }),
  get consumerTags() {
    return [];
  },
  cancelConsumer: () => Promise.resolve(),
  resumeConsumer: () => Promise.resolve(null),
  close: () => Promise.resolve(),
};

export class AmqpConnection {}

@Module({})
class RabbitMQModuleMock {
  static forRoot(): DynamicModule {
    return {
      module: RabbitMQModuleMock,
      global: true,
      providers: [
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
      exports: [AmqpConnection],
    };
  }

  static forRootAsync(): DynamicModule {
    return {
      module: RabbitMQModuleMock,
      global: true,
      providers: [
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
      exports: [AmqpConnection],
    };
  }
}

export { RabbitMQModuleMock as RabbitMQModule };
