import { responseLength, requestedWordCount } from './personas/response-policy.ts';
import type { ChatMode } from '../../types/index.ts';
export function getGenerationConfig(modelId: string, mode: ChatMode = 'daily', text = '', maxTokens?: number): Record<string, number> {
  const depth = responseLength(text);
  const words = requestedWordCount(text);
  const requested = maxTokens ?? (words ? Math.max(512, Math.ceil(words * 3 + 128)) : depth === 'short' ? 512 : depth === 'long' ? 4096 : mode === 'daily' ? 1536 : 2560);
  const budget = Math.max(16, Math.min(4096, Math.floor(requested)));
  // Only the output-limit parameter validated by each family is sent.
  // Optional temperature/reasoning/tools are deliberately omitted until tested.
  return modelId.startsWith('gpt-5') ? { max_completion_tokens: budget } : { max_tokens: modelId.startsWith('gemini/') ? Math.max(1024, budget) : budget };
}
