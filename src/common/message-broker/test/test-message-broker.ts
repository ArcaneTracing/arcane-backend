import { MessageBroker } from "../message-broker.interface";

export interface PublishedEntry {
  topic: string;
  message: object;
  options?: { messageId?: string; key?: string };
}

export class TestMessageBroker implements MessageBroker {
  private readonly published: PublishedEntry[] = [];
  private readonly subscribers = new Map<
    string,
    Array<(payload: unknown) => Promise<void>>
  >();
  private publishError: Error | null = null;
  private publishErrorSequence: (Error | null)[] = [];
  private publishCallCount = 0;

  async publish(
    topic: string,
    message: object,
    options?: { messageId?: string; key?: string },
  ): Promise<void> {
    const err =
      this.publishError ??
      this.publishErrorSequence[this.publishCallCount] ??
      null;
    this.publishCallCount += 1;
    if (err) {
      throw err;
    }
    this.published.push({ topic, message, options });
  }
  setPublishError(error: Error | null): void {
    this.publishError = error;
    this.publishErrorSequence = [];
  }
  setPublishErrorSequence(errors: (Error | null)[]): void {
    this.publishError = null;
    this.publishErrorSequence = errors;
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<void>): void {
    const handlers = this.subscribers.get(topic) ?? [];
    handlers.push(handler);
    this.subscribers.set(topic, handlers);
  }
  async emit(topic: string, message: unknown): Promise<void> {
    const handlers = this.subscribers.get(topic) ?? [];
    for (const handler of handlers) {
      await handler(message);
    }
  }
  getPublished(): ReadonlyArray<PublishedEntry> {
    return [...this.published];
  }
  getPublishedForTopic(topic: string): ReadonlyArray<PublishedEntry> {
    return this.published.filter((p) => p.topic === topic);
  }
  clearPublished(): void {
    this.published.length = 0;
    this.publishCallCount = 0;
  }
  clearSubscribers(): void {
    this.subscribers.clear();
  }
  reset(): void {
    this.clearPublished();
    this.clearSubscribers();
    this.publishError = null;
    this.publishErrorSequence = [];
    this.publishCallCount = 0;
  }
}
