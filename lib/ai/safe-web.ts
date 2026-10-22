import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request, Agent } from 'node:https';
import { connect } from 'node:tls';
import { ApiError } from '../http.ts';
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18,19,51].includes(b) || a === 203 && b === 0 || a >= 224);
  }
  if (isIP(address) === 6) {
    const a = new URL(`https://[${address}]/`).hostname.slice(1,-1).toLowerCase();
    // Accept global unicast only; block mapped IPv4, documentation, Teredo/6to4.
    return /^[23]/.test(a) && !/^(2001::|2001:(db8|0|10|20):|2002:)/.test(a);
  }
  return false;
}
export function validateWebUrl(value: string): URL {
  const u = new URL(value);
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(host) || isIP(host) && !isPublicAddress(host)) throw new ApiError(400, 'URL web tidak diizinkan.');
  return u;
}
export async function safeReadWeb(value: string, redirects = 0, parentSignal?: AbortSignal): Promise<{ text: string; url: string }> {
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
  signal.throwIfAborted();
  if (redirects > 2) throw new ApiError(400, 'Terlalu banyak pengalihan URL.');
  const u = validateWebUrl(value);
  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    lookup(u.hostname.replace(/^\[|\]$/g, ''), { all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new ApiError(400, 'Alamat tujuan web tidak diizinkan.');
  // Pin the TLS connection to the vetted IP to prevent DNS rebinding.
  const result = await new Promise<{ text: string; location?: string }>((resolve, reject) => {
    const agent = new Agent({ keepAlive: false });
    agent.createConnection = () => connect({ host: addresses[0].address, port: 443, servername: u.hostname, rejectUnauthorized: true });
    const req = request(u, {
      method: 'GET', agent, signal,
      headers: { 'User-Agent': 'AET-AI/2.1', Accept: 'text/html,text/plain', 'Accept-Encoding': 'identity' },
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); resolve({ text: '', location: new URL(res.headers.location, u).href }); return; }
      if (res.statusCode !== 200 || !/^(text\/html|text\/plain)/.test(res.headers['content-type'] || '')) { res.resume(); reject(new Error('Web source unavailable.')); return; }
      let bytes = 0; const chunks: Buffer[] = [];
      res.on('data', chunk => { bytes += chunk.length; if (bytes > 256_000) req.destroy(new Error('Web source exceeds size limit.')); else chunks.push(Buffer.from(chunk)); });
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
      res.on('aborted', () => reject(new Error('Web source interrupted.')));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('Web source timeout.')), 5000);
    req.on('close', () => { clearTimeout(timer); agent.destroy(); }); req.on('error', reject); req.end();
  });
  if (result.location) return safeReadWeb(result.location, redirects + 1, signal);
  return { url: u.href, text: result.text.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0,6000) };
}
export async function boundedJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const timeout = AbortSignal.timeout(5000);
  const response = await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout, redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('Tool source unavailable.');
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const {value,done} = await reader.read(); if(done) break; size += value.length; if(size>256_000) throw new Error('Tool source too large.'); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
