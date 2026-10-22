import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSumopodChatRequest,
  parseOpenAITextStream,
  toSumopodMessages,
} from '../lib/sumopod.ts';
import {
  AET_FRONTIER_QUESTIONS,
  AI_MODELS,
  isFrontierModel,
  isKnownModel,
} from '../lib/ai-models.ts';
import {
  createFrontierAccessToken,
  validateAetFrontierAnswers,
  verifyFrontierAccessToken,
} from '../lib/aet-frontier-access.ts';

test('buildSumopodChatRequest creates a streaming OpenAI-compatible chat request', async () => {
  const request = buildSumopodChatRequest({
    apiKey: 'sk-test',
    baseUrl: 'https://ai.sumopod.com/v1/',
    modelId: 'gpt-4o-mini',
    systemInstruction: 'System rules',
    messages: [{ role: 'user', content: 'Halo' }],
  });

  assert.equal(request.url, 'https://ai.sumopod.com/v1/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer sk-test');
  assert.equal(request.init.headers['Content-Type'], 'application/json');

  const body = JSON.parse(request.init.body);
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1536);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'System rules' },
    { role: 'user', content: 'Halo' },
  ]);
});

test('toSumopodMessages preserves image data URLs for multimodal chat payloads', () => {
  const messages = toSumopodMessages('System rules', [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Jelaskan gambar ini' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
      ],
    },
    { role: 'model', content: 'Baik.' },
  ]);

  assert.deepEqual(messages, [
    { role: 'system', content: 'System rules' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Jelaskan gambar ini' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
      ],
    },
    { role: 'assistant', content: 'Baik.' },
  ]);
});

test('parseOpenAITextStream yields content deltas from Server-Sent Events', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Ha"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  const chunks: string[] = [];
  for await (const chunk of parseOpenAITextStream(new Response(body))) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ['Ha', 'lo']);
});

test('AI model catalog contains the requested models exactly once', () => {
  const requestedModels = [
    'gpt-4o-mini','gpt-4.1-mini','gpt-5-mini','gpt-5.4-mini','gpt-5.4',
    'claude-haiku-4-5','claude-sonnet-5','claude-opus-5',
    'gemini/gemini-3.5-flash','gemini/gemini-3.1-pro-preview',
    'deepseek-v4-flash','deepseek-v4-pro',
  ];
  assert.equal(AI_MODELS.length, 12);

  const catalogIds = AI_MODELS.map((model) => model.id);

  assert.equal(new Set(catalogIds).size, catalogIds.length);
  for (const modelId of requestedModels) {
    assert.equal(isKnownModel(modelId), true, `${modelId} should be available`);
  }
});

test('frontier model detection separates gated and open models', () => {
  assert.equal(isFrontierModel('claude-opus-5'), true);
  assert.equal(isFrontierModel('gpt-5.4'), true);
  assert.equal(isFrontierModel('gemini/gemini-3.1-pro-preview'), true);
  assert.equal(isFrontierModel('gemini/gemini-2.5-flash'), false);
  assert.equal(isFrontierModel('gpt-4o-mini'), false);
});

test('validateAetFrontierAnswers accepts normalized AET knowledge answers only', () => {
  assert.equal(AET_FRONTIER_QUESTIONS.length, 3);
  assert.equal(validateAetFrontierAnswers({
    aetFounded: '1 April 2008',
    aetAttributeDay: 'Selasa',
    aetFullName: 'Association of Electronics Telecommunication',
  }), true);
  assert.equal(validateAetFrontierAnswers({
    aetFounded: '2009',
    aetAttributeDay: 'Rabu',
    aetFullName: 'AET',
  }), false);
});

test('frontier access token verifies valid tokens and rejects expired tokens', () => {
  const secret = 'test-frontier-secret';
  const now = 1_800_000_000_000;
  const token = createFrontierAccessToken({ now, secret });

  assert.equal(verifyFrontierAccessToken(token, { now: now + 1000, secret }), true);
  assert.equal(verifyFrontierAccessToken(token, { now: now + 25 * 60 * 60 * 1000, secret }), false);
});
