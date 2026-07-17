/**
 * PatriMoi — Outbox Pattern (Phase 3 DAT v2.0)
 *
 * Phase 2 : AsyncStorage (async reads)
 * Phase 3 : MMKV (sync reads — plus rapide, plus simple, atomique)
 *
 * API publique inchangée :
 *   enqueueSync(userId, data)   → appelé dans setData du store
 *   startSyncWorker()           → appelé au boot (AppBootstrap)
 *   stopSyncWorker()            → appelé à la déconnexion
 *   clearSyncState()            → vide outbox + verrou après signOut
 *   peekQueue()                 → nb mutations en attente (debug/UI)
 *   loadLocalData()             → dernière copie locale (offline fallback)
 */

import { storage } from './storage';
import { savePatrimoineDataWithLock } from './auth';

// ── Clés MMKV ────────────────────────────────────────────────
const OUTBOX_KEY = 'outbox_v2';   // file de mutations
const LOCAL_KEY  = 'local_v2';    // copie locale la plus récente
const LOCK_KEY   = 'lock_v2';     // updated_at dernier upsert réussi

// ── Config ────────────────────────────────────────────────────
const MAX_RETRIES   = 5;
const BASE_DELAY_MS = 1000;
const FLUSH_DELAY   = 800;
const MAX_QUEUE     = 50;

// ── État interne ──────────────────────────────────────────────
let _workerTimer = null;
let _flushTimer  = null;
let _running     = false;
let _retryCount  = 0;

// ── Queue (sync MMKV) ─────────────────────────────────────────
function readQueue()        { return storage.get(OUTBOX_KEY) ?? []; }
function writeQueue(queue)  { storage.set(OUTBOX_KEY, queue); }

// ── API publique ──────────────────────────────────────────────

/** Ajoute une mutation à la file et flush avec debounce. */
export function enqueueSync(userId, data) {
  if (!userId) return;

  // Écriture locale immédiate (lecture offline instantanée)
  storage.set(LOCAL_KEY, data);

  const mutation = {
    id:         `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    data,
    enqueuedAt: Date.now(),
    retries:    0,
  };

  const queue = readQueue();
  const trimmed = queue.length >= MAX_QUEUE ? queue.slice(-MAX_QUEUE + 1) : queue;
  trimmed.push(mutation);
  writeQueue(trimmed);

  scheduleFLush();
}

/** Charge la dernière copie locale (fallback offline). */
export function loadLocalData() {
  return storage.get(LOCAL_KEY);
}

/** Vide l'outbox et le verrou (appeler après signOut). */
export function clearSyncState() {
  storage.deleteAll([OUTBOX_KEY, LOCAL_KEY, LOCK_KEY]);
  _retryCount = 0;
}

/** Retourne le nombre de mutations en attente. */
export function peekQueue() {
  return readQueue().length;
}

// ── Flush ─────────────────────────────────────────────────────

function scheduleFLush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flush, FLUSH_DELAY);
}

/** Flush immédiat (à appeler quand l'app passe en arrière-plan). */
export function flushNow() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  flush();
}

async function flush() {
  _flushTimer = null;
  const queue = readQueue();
  if (queue.length === 0) { _retryCount = 0; return; }

  const mutation = queue[0];
  const knownUpdatedAt = storage.getString(LOCK_KEY);

  const { error, updatedAt } = await savePatrimoineDataWithLock(
    mutation.userId,
    mutation.data,
    knownUpdatedAt,
  );

  if (!error) {
    queue.shift();
    writeQueue(queue);
    _retryCount = 0;
    if (updatedAt) storage.setString(LOCK_KEY, updatedAt);
    if (queue.length > 0) setTimeout(flush, 100);
  } else {
    mutation.retries = (mutation.retries || 0) + 1;
    _retryCount++;

    if (mutation.retries >= MAX_RETRIES) {
      console.warn('[syncQueue] Mutation abandonnée après', MAX_RETRIES, 'tentatives:', error);
      queue.shift();
      writeQueue(queue);
      _retryCount = 0;
    } else {
      queue[0] = mutation;
      writeQueue(queue);
    }
  }
}

// ── Worker ────────────────────────────────────────────────────

/** Lance le worker périodique. Idempotent — appeler au boot. */
export function startSyncWorker() {
  if (_running) return;
  _running = true;

  _workerTimer = setInterval(() => {
    if (!_flushTimer) flush();
  }, 5000);

  // Flush immédiat — vide les mutations offline accumulées
  flush();
}

/** Arrête le worker. Appeler à la déconnexion. */
export function stopSyncWorker() {
  _running = false;
  if (_workerTimer) { clearInterval(_workerTimer); _workerTimer = null; }
  if (_flushTimer)  { clearTimeout(_flushTimer);   _flushTimer  = null; }
}
