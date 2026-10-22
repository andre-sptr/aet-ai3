export type GatewayErrorKind = 'authentication' | 'billing' | 'permission' | 'model_or_endpoint' | 'request' | 'rate_limit' | 'provider' | 'http';

/** Categories describe the observed HTTP failure, not an unverified root cause. */
export function gatewayErrorKind(status: number): GatewayErrorKind {
  if (status === 401) return 'authentication';
  if (status === 402) return 'billing';
  if (status === 403) return 'permission';
  if (status === 404) return 'model_or_endpoint';
  if (status === 400 || status === 422) return 'request';
  if (status === 429) return 'rate_limit';
  return status >= 500 ? 'provider' : 'http';
}

export function redactGatewayText(value: unknown, secret = ''): string {
  let text = String(value);
  if (secret) text = text.replaceAll(secret, '[REDACTED]');
  return text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[^\s"'<>;,}]+/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:api[_-]?key|authorization|access[_-]?token)["']?\s*[:=]\s*["']?)[^\s"'<>;,}]+/gi, '$1[REDACTED]');
}

export async function boundedResponseText(response: Response, maxBytes = 4096): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - size);
      chunks.push(chunk); size += chunk.length;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

/** Safe evidence for operator reports only. Never return raw provider text to clients. */
export async function readGatewayError(response: Response, secret = '') {
  const raw = await boundedResponseText(response);
  let providerCode: string | null = null;
  let message = raw;
  try {
    const data = JSON.parse(raw);
    const error = data?.error ?? data;
    if (typeof error?.code === 'string' && /^[\w.-]{1,80}$/.test(error.code)) providerCode = error.code;
    if (typeof error?.message === 'string') message = error.message;
  } catch { /* A bounded proxy error page is useful evidence, not proof of provider policy. */ }
  return { kind: gatewayErrorKind(response.status), httpStatus: response.status,
    providerCode: providerCode ? redactGatewayText(providerCode, secret) : null,
    message: redactGatewayText(message, secret).replace(/[\u0000-\u001f]/g, ' ').slice(0, 500),
    causeVerified: false };
}
