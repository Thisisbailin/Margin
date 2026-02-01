import { LLMStreamChunk } from "../core/types";

const encoder = new TextEncoder();

export const iterableToReadableStream = (
  iterable: AsyncIterable<LLMStreamChunk>
): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
};

export const iterableToSSEStream = (
  iterable: AsyncIterable<LLMStreamChunk>
): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
};
