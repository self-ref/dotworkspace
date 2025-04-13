import { createProviderRegistry } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";

export type LanguageModelName = Parameters<typeof providerRegistry.languageModel>[0];

export const providerRegistry = createProviderRegistry({
  anthropic,
  openai,
  google,
  xai,
});
