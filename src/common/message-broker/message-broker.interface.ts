export const MESSAGE_BROKER = Symbol("MESSAGE_BROKER");

export interface MessageBroker {
  publish(
    topic: string,
    message: object,
    options?: { messageId?: string; key?: string },
  ): Promise<void>;

  subscribe(topic: string, handler: (payload: unknown) => Promise<void>): void;
}
