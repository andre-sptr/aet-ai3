import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { mkdtemp, copyFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
await access('.next/BUILD_ID').catch(() => { throw new Error('Run npm run build before npm run test:http.'); });
async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
const directory = await mkdtemp(join(tmpdir(), 'aet-http-'));
const database = join(directory, 'test.db');
await copyFile('prisma/dev.db', database);
const port = await freePort();
const mockPort = await freePort();
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, NODE_ENV: 'production', NODE_USE_ENV_PROXY: '0',
  DATABASE_URL: `file:${database}`, APP_ORIGIN: origin,
  SUMOPOD_API_KEY: 'local-test-placeholder', SUMOPOD_BASE_URL: `http://127.0.0.1:${mockPort}/v1`,
  AET_ALLOW_LOCAL_TEST_GATEWAY: 'true', AET_MOCK_PORT: String(mockPort),
  ADMIN_USERNAME: 'qa-admin', ADMIN_PASSWORD: randomBytes(18).toString('hex'),
  ADMIN_SESSION_SECRET: randomBytes(32).toString('hex'), AET_FRONTIER_ACCESS_SECRET: randomBytes(32).toString('hex'),
  ENABLE_FRONTIER: 'true', TRUST_PROXY: 'true', CHAT_HOURLY_LIMIT: '1000',
  TAVILY_API_KEY: '', BLOB_READ_WRITE_TOKEN: '',
  AET_TEST_DISPOSABLE_DB: 'true', AET_TEST_ORIGIN: origin,
};
env.AET_TEST_ADMIN_USERNAME = env.ADMIN_USERNAME;
env.AET_TEST_ADMIN_PASSWORD = env.ADMIN_PASSWORD;
let server, tests;
const stop = () => { tests?.kill('SIGTERM'); server?.kill('SIGTERM'); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.on('data', data => { output = (output + data).slice(-6000); });
  server.stderr.on('data', data => { output = (output + data).slice(-6000); });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Local test server exited.\n${output}`);
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* starting */ }
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error(`Local test server did not start.\n${output}`);
  tests = spawn(process.execPath, ['scripts/http-regression.mjs'], { env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { tests.once('error', reject); tests.once('exit', resolve); });
  process.exitCode = code ?? 1;
} finally {
  stop();
  if (server && server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
  await rm(directory, { recursive: true, force: true });
}
