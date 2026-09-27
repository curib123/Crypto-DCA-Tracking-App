const DB_NAME = "crypto-dca-tracking";
const PENDING_STORE = "pending-transactions";
const CACHE_STORE = "app-cache";
const VERSION = 2;

export type OfflineUser = {
  id: string;
  email: string;
  baseCurrency: string;
};

type CacheEnvelope<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: "_offlineId" });
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putCache<T>(key: string, value: T) {
  const db = await openDb();
  const row: CacheEnvelope<T> = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return row;
}

async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const db = await openDb();

  const row = await new Promise<CacheEnvelope<T> | null>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly");
    const request = tx.objectStore(CACHE_STORE).get(key);
    request.onsuccess = () => resolve((request.result as CacheEnvelope<T> | undefined) || null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return row;
}

async function deleteCache(key: string) {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function setActiveUser(user: OfflineUser) {
  return putCache("active-user", user);
}

export async function getActiveUser(): Promise<OfflineUser | null> {
  const cached = await readCache<OfflineUser>("active-user");
  return cached?.value || null;
}

export async function clearActiveUser() {
  await deleteCache("active-user");
}

function userKey(userId: string, resource: string) {
  return `user:${userId}:${resource}`;
}

export async function cacheUserResource<T>(userId: string, resource: string, value: T) {
  return putCache(userKey(userId, resource), value);
}

export async function getCachedUserResource<T>(userId: string, resource: string) {
  return readCache<T>(userKey(userId, resource));
}

export async function cacheMarket<T>(currency: string, value: T) {
  return putCache(`market:${currency.toUpperCase()}`, value);
}

export async function getCachedMarket<T>(currency: string) {
  return readCache<T>(`market:${currency.toUpperCase()}`);
}

export async function clearUserOfflineData(userId: string) {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CACHE_STORE, PENDING_STORE], "readwrite");
    const cache = tx.objectStore(CACHE_STORE);
    const pending = tx.objectStore(PENDING_STORE);

    const cacheCursor = cache.openCursor();
    cacheCursor.onsuccess = () => {
      const cursor = cacheCursor.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`user:${userId}:`)) {
        cursor.delete();
      }
      cursor.continue();
    };

    const pendingCursor = pending.openCursor();
    pendingCursor.onsuccess = () => {
      const cursor = pendingCursor.result;
      if (!cursor) return;
      const row = cursor.value as Record<string, unknown>;
      if (row._userId === userId) cursor.delete();
      cursor.continue();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function queueTransaction(
  userId: string,
  payload: Record<string, unknown>,
) {
  const db = await openDb();
  const row = {
    ...payload,
    _userId: userId,
    _offlineId: crypto.randomUUID(),
    _queuedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return row;
}

export async function pendingTransactions(
  userId?: string,
): Promise<Record<string, unknown>[]> {
  const db = await openDb();

  const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readonly");
    const request = tx.objectStore(PENDING_STORE).getAll();
    request.onsuccess = () => {
      const all = request.result as Record<string, unknown>[];
      resolve(userId ? all.filter((row) => row._userId === userId) : all);
    };
    request.onerror = () => reject(request.error);
  });

  db.close();
  return rows;
}

export async function removePending(id: string) {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}
