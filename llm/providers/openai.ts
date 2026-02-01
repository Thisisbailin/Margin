import { LLMProvider } from "../core/types";
import { LLMError } from "../core/errors";

export const createOpenAIProvider = (): LLMProvider => {
  const notImplemented = () => {
    throw new LLMError("InvalidRequest", "OpenAI provider not implemented yet");
  };

  return {
    generate: async () => notImplemented(),
    stream: async function* () {
      notImplemented();
    },
  };
};
