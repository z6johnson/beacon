import OpenAI from "openai";
import type { Config } from "../config.js";

export function createLLMClient(config: Config) {
  return new OpenAI({
    baseURL: config.litellm.baseUrl,
    apiKey: config.litellm.apiKey,
  });
}

export type LLMClient = ReturnType<typeof createLLMClient>;
