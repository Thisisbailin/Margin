import { LLMProvider } from "../core/types";
import { LLMError } from "../core/errors";

export const createOpenRouterProvider = (): LLMProvider => {
  const notImplemented = () => {
    throw new LLMError("InvalidRequest", "OpenRouter provider not implemented yet");
  };

  return {
    generate: async () => notImplemented(),
    stream: async function* () {
      notImplemented();
    },
  };
};
