import { TestMessageBroker } from "../../../src/common/message-broker/test/test-message-broker";
import { EVALUATION_RESULTS_TOPIC } from "../../../src/common/message-broker/topic-config";

describe("TestMessageBroker", () => {
  let broker: TestMessageBroker;

  beforeEach(() => {
    broker = new TestMessageBroker();
  });

  it("buffers publishes for assertions", async () => {
    await broker.publish("topic-1", { foo: "bar" });
    await broker.publish("topic-2", { baz: 1 }, { messageId: "id-1" });

    expect(broker.getPublished()).toEqual([
      { topic: "topic-1", message: { foo: "bar" }, options: undefined },
      {
        topic: "topic-2",
        message: { baz: 1 },
        options: { messageId: "id-1" },
      },
    ]);
    expect(broker.getPublishedForTopic("topic-1")).toHaveLength(1);
  });

  it("delivers emitted messages to subscribers", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    broker.subscribe(EVALUATION_RESULTS_TOPIC, handler);

    await broker.emit(EVALUATION_RESULTS_TOPIC, {
      evaluationId: "eval-1",
      scoreId: "score-1",
      score: 0.5,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      evaluationId: "eval-1",
      scoreId: "score-1",
      score: 0.5,
    });
  });

  it("throws when setPublishError is set", async () => {
    broker.setPublishError(new Error("Broker error"));

    await expect(broker.publish("t", {})).rejects.toThrow("Broker error");
    expect(broker.getPublished()).toHaveLength(0);
  });

  it("supports per-call error sequence", async () => {
    broker.setPublishErrorSequence([null, new Error("Second fails"), null]);

    await broker.publish("t", { a: 1 });
    await expect(broker.publish("t", { b: 2 })).rejects.toThrow("Second fails");
    await broker.publish("t", { c: 3 });

    expect(broker.getPublished()).toEqual([
      { topic: "t", message: { a: 1 }, options: undefined },
      { topic: "t", message: { c: 3 }, options: undefined },
    ]);
  });

  it("clears state with reset", async () => {
    broker.subscribe("t", jest.fn());
    await broker.publish("t", {});
    broker.reset();

    expect(broker.getPublished()).toHaveLength(0);
    await broker.emit("t", {});
  });
});
