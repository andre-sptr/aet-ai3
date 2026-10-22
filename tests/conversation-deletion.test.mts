import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  conversationKey, legacyKey, newConversation, loadConversationStore,
  persistConversationStore, deleteStoredConversation, saveCurrentSnapshot,
  savedConversations, historyForModel, retryHistory, type ConversationStore,
} from '../lib/conversations.ts';
import { RequestLifecycle } from '../lib/request-lifecycle.ts';
import type { Message } from '../types/index.ts';

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;
  failRemoval = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, value);
  }
  removeItem(key: string) {
    if (this.failRemoval) throw new Error('SecurityError');
    this.values.delete(key);
  }
}
function user(content: string): Message {
  return { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date(), status: 'complete' };
}
function fixture(count = 2) {
  const storage = new MemoryStorage();
  const conversations = Array.from({ length: count }, (_, i) => newConversation('daily', [user(`pesan ${i}`)]));
  const store: ConversationStore = { version: 2, activeId: conversations[0].id, conversations };
  persistConversationStore(storage, 'daily', store);
  return { storage, store, conversations };
}

test('active deletion removes exactly its ID and payload from state and the per-mode storage key', () => {
  const { storage, store, conversations: [first, second] } = fixture();
  const next = deleteStoredConversation(storage, 'daily', store, first.id);
  assert.deepEqual(next.conversations.map(c => c.id), [second.id]);
  assert.equal(next.activeId, second.id);
  const persisted = storage.getItem(conversationKey('daily'))!;
  assert.ok(!persisted.includes(first.id));
  assert.ok(!persisted.includes(first.messages[0].content));
  assert.ok(persisted.includes(second.id));
  assert.equal(loadConversationStore(storage, 'daily').activeId, second.id);
  assert.equal(store.conversations.length, 2, 'input snapshot remains immutable');
});

test('inactive item deletion retains the active conversation and all other items', () => {
  const { storage, store, conversations: [first, second, third] } = fixture(3);
  const next = deleteStoredConversation(storage, 'daily', store, second.id);
  assert.equal(next.activeId, first.id);
  assert.deepEqual(next.conversations.map(c => c.id), [first.id, third.id]);
});
test('active deletion prefers another saved conversation over an old greeting-only draft', () => {
  const { storage, store, conversations: [first, second] } = fixture();
  store.conversations.splice(1, 0, newConversation('daily'));
  const next = deleteStoredConversation(storage, 'daily', store, first.id);
  assert.equal(next.activeId, second.id);
});

test('last deletion leaves an empty session, durable empty history, and no resurrection after repeated reloads', () => {
  const { storage, store, conversations: [first] } = fixture(1);
  const next = deleteStoredConversation(storage, 'daily', store, first.id);
  assert.notEqual(next.activeId, first.id);
  assert.deepEqual(savedConversations(next), []);
  assert.deepEqual(next.conversations[0].messages, []);
  assert.deepEqual(JSON.parse(storage.getItem(conversationKey('daily'))!), { version: 2, activeId: '', conversations: [] });
  for (let i = 0; i < 3; i++) {
    const reloaded = loadConversationStore(storage, 'daily');
    assert.equal(reloaded.conversations.length, 1);
    assert.notEqual(reloaded.activeId, first.id);
    assert.deepEqual(savedConversations(reloaded), []);
    persistConversationStore(storage, 'daily', reloaded);
  }
});

test('durable empty v2 store prevents legacy re-import; deleting migrated history removes its old local copy', () => {
  const { storage, store, conversations: [first] } = fixture(1);
  storage.setItem(legacyKey('daily'), JSON.stringify(first.messages));
  deleteStoredConversation(storage, 'daily', store, first.id);
  assert.equal(storage.getItem(legacyKey('daily')), null);
  // An old browser tab restoring the legacy key still cannot override a v2 tombstone.
  storage.setItem(legacyKey('daily'), JSON.stringify(first.messages));
  assert.deepEqual(savedConversations(loadConversationStore(storage, 'daily')), []);
});

test('a pending autosave and effect cleanup cannot restore a deleted conversation', async () => {
  const { storage, store, conversations: [first] } = fixture();
  let current: ConversationStore = store;
  const oldEffectCleanup = () => saveCurrentSnapshot(storage, 'daily', store, current);
  const pendingTimer = delay(5).then(oldEffectCleanup);
  current = deleteStoredConversation(storage, 'daily', current, first.id);
  assert.equal(oldEffectCleanup(), false);
  assert.equal(await pendingTimer, false);
  assert.ok(!storage.getItem(conversationKey('daily'))!.includes(first.id));
  assert.equal(saveCurrentSnapshot(storage, 'daily', current, current), true);
});

test('request and attachment invalidation block deferred responses after deletion or switching', async () => {
  const { storage, store, conversations: [first] } = fixture();
  const generation = new RequestLifecycle();
  const attachments = new RequestLifecycle();
  const ticket = generation.begin(), upload = attachments.begin();
  let current = store;
  let visibleMessages = first.messages;
  let attached = false;
  const lateReply = delay(5).then(() => {
    if (generation.canApply(ticket)) visibleMessages = [...visibleMessages, user('late output')];
    if (attachments.canApply(upload)) attached = true;
  });
  generation.cancel(); attachments.cancel();
  current = deleteStoredConversation(storage, 'daily', current, first.id);
  visibleMessages = current.conversations[0].messages;
  await lateReply;
  assert.equal(ticket.controller.signal.aborted, true);
  assert.equal(upload.controller.signal.aborted, true);
  assert.equal(attached, false);
  assert.ok(visibleMessages.every(m => m.content !== 'late output'));
  assert.ok(!storage.getItem(conversationKey('daily'))!.includes(first.id));
});

test('stopping keeps ownership for cancelled status; finishing an old request cannot release a new request', () => {
  const lifecycle = new RequestLifecycle();
  const old = lifecycle.begin(); lifecycle.stop();
  assert.equal(lifecycle.canApply(old), false);
  assert.equal(lifecycle.owns(old), true);
  const fresh = lifecycle.begin(); lifecycle.finish(old);
  assert.equal(lifecycle.pending, true);
  assert.equal(lifecycle.canApply(fresh), true);
  lifecycle.finish(fresh);
  assert.equal(lifecycle.pending, false);
  assert.equal(lifecycle.owns(fresh), true, 'queued final React updates retain ownership until next view');
  lifecycle.cancel();
  assert.equal(lifecycle.owns(fresh), false);
});

test('write failure throws before callers publish deletion; original durable data remains', () => {
  const { storage, store, conversations: [first] } = fixture();
  const original = storage.getItem(conversationKey('daily'));
  storage.failWrites = true;
  assert.throws(() => deleteStoredConversation(storage, 'daily', store, first.id), /QuotaExceeded/);
  assert.equal(storage.getItem(conversationKey('daily')), original);
  assert.equal(store.activeId, first.id);
});

test('failed legacy removal preserves a durable migration and does not silently delete anything', () => {
  const { storage, store, conversations: [first] } = fixture();
  storage.setItem(legacyKey('daily'), JSON.stringify(first.messages));
  storage.failRemoval = true;
  assert.throws(() => deleteStoredConversation(storage, 'daily', store, first.id), /SecurityError/);
  assert.ok(storage.getItem(legacyKey('daily')));
  assert.equal(loadConversationStore(storage, 'daily').conversations.length, 2);
});

test('mode isolation, search, rename, new session, edit and retry still work after deletion', () => {
  const { storage, store, conversations: [first, second] } = fixture();
  const report = newConversation('report', [user('laporan')]);
  persistConversationStore(storage, 'report', { version: 2, activeId: report.id, conversations: [report] });
  const otherMode = storage.getItem(conversationKey('report'));
  let next = deleteStoredConversation(storage, 'daily', store, first.id);
  const remaining = { ...second, title: 'Nama baru', messages: [user('koreksi terbaru')] };
  next = { ...next, conversations: [remaining] };
  persistConversationStore(storage, 'daily', next);
  const reloaded = loadConversationStore(storage, 'daily');
  assert.equal(reloaded.conversations.filter(c => c.title.toLowerCase().includes('nama baru')).length, 1);
  assert.equal(reloaded.conversations[0].messages[0].content, 'koreksi terbaru');
  const fresh = newConversation('daily');
  next = { ...reloaded, activeId: fresh.id, conversations: [fresh, ...reloaded.conversations] };
  persistConversationStore(storage, 'daily', next);
  assert.equal(savedConversations(next).length, 1);
  assert.equal(storage.getItem(conversationKey('report')), otherMode);
  const failed: Message = { ...user('incomplete'), role: 'assistant', status: 'error' };
  const history = [...remaining.messages, failed];
  assert.deepEqual(retryHistory(history), remaining.messages);
  assert.deepEqual(historyForModel(history), remaining.messages);
  assert.equal(saveCurrentSnapshot(storage, 'report', next, next), false);
});
