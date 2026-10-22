export type Capability = boolean | 'unknown';
export type AiModelTier = 'Fast / Everyday' | 'Balanced' | 'Advanced / Frontier';
export type AiModel = {
  id: string; name: string; desc: string; provider: string; tier: AiModelTier;
  isFrontier: boolean; isDefault: boolean;
  accessPolicy: 'public' | 'frontier';
  availability: 'available' | 'unverified' | 'unavailable';
  verification: 'live' | 'metadata' | 'none';
  supportsStreaming: Capability; supportsImageInput: Capability;
  supportsNativeTools: Capability; supportsReasoning: Capability;
  contextCapacity?: number;
  relativeCost: 'unknown';
};
// Availability and capabilities reflect the recorded gateway tests, not upstream claims.
export const AI_MODELS: readonly AiModel[] = [
  {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI", "tier": "Fast / Everyday", "isFrontier": false, "isDefault": true, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": true, "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Chat dan input gambar telah lulus uji dasar gateway.", "contextCapacity": 128000},
  {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini", "provider": "OpenAI", "tier": "Balanced", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1047576},
  {"id": "gpt-5-mini", "name": "GPT-5 Mini", "provider": "OpenAI", "tier": "Balanced", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 272000},
  {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini", "provider": "OpenAI", "tier": "Balanced", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 272000},
  {"id": "gpt-5.4", "name": "GPT-5.4", "provider": "OpenAI", "tier": "Advanced / Frontier", "isFrontier": true, "isDefault": false, "accessPolicy": "frontier", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1050000},
  {"id": "claude-haiku-4-5", "name": "Claude Haiku 4.5", "provider": "Anthropic", "tier": "Fast / Everyday", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 200000},
  {"id": "claude-sonnet-5", "name": "Claude Sonnet 5", "provider": "Anthropic", "tier": "Advanced / Frontier", "isFrontier": true, "isDefault": false, "accessPolicy": "frontier", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1000000},
  {"id": "claude-opus-5", "name": "Claude Opus 5", "provider": "Anthropic", "tier": "Advanced / Frontier", "isFrontier": true, "isDefault": false, "accessPolicy": "frontier", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1000000},
  {"id": "gemini/gemini-3.5-flash", "name": "Gemini 3.5 Flash", "provider": "Google", "tier": "Fast / Everyday", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1048576},
  {"id": "gemini/gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro Preview", "provider": "Google", "tier": "Advanced / Frontier", "isFrontier": true, "isDefault": false, "accessPolicy": "frontier", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1048576},
  {"id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "provider": "DeepSeek", "tier": "Fast / Everyday", "isFrontier": false, "isDefault": false, "accessPolicy": "public", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1000000},
  {"id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "DeepSeek", "tier": "Advanced / Frontier", "isFrontier": true, "isDefault": false, "accessPolicy": "frontier", "availability": "available", "verification": "live", "supportsStreaming": true, "supportsImageInput": "unknown", "supportsNativeTools": "unknown", "supportsReasoning": "unknown", "relativeCost": "unknown", "desc": "Model chat terkurasi; kemampuan tambahan belum diuji.", "contextCapacity": 1000000},
];

export const AET_FRONTIER_QUESTIONS = [
  {
    id: 'aetFounded',
    question: 'Tanggal berapa AET resmi berdiri?',
    placeholder: 'Contoh: 1 Januari 2000',
  },
  {
    id: 'aetAttributeDay',
    question: 'Setiap hari apa anggota AET wajib memakai atribut AET?',
    placeholder: 'Contoh: Senin',
  },
  {
    id: 'aetFullName',
    question: 'Apa kepanjangan dari AET?',
    placeholder: 'Tulis kepanjangan lengkapnya',
  },
] as const;

export type AetFrontierQuestionId = (typeof AET_FRONTIER_QUESTIONS)[number]['id'];


export function getModelById(modelId: string): AiModel | undefined { return AI_MODELS.find(model => model.id === modelId); }
export function isKnownModel(modelId: string): boolean { return Boolean(getModelById(modelId)); }
export function isAvailableModel(modelId: string): boolean { return getModelById(modelId)?.availability === 'available'; }
export function isFrontierModel(modelId: string): boolean { return getModelById(modelId)?.isFrontier === true; }
export function historicalModelLabel(modelId: string): string { return getModelById(modelId)?.name ?? `${modelId} (model lama)`; }
