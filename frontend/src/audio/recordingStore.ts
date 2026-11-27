/**
 * Recall recordings live only in this browser (IndexedDB). They are never uploaded.
 * One recording per track: saving again replaces the earlier audio.
 */
export interface StoredRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  recordedAt: number;
}

const DB_NAME = "cursed-cassette";
const STORE = "recordings";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest<T>[] | null,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const made = work(tx.objectStore(STORE));
      const first = Array.isArray(made) ? made[0] : made;
      tx.oncomplete = () => resolve(first ? first.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  } finally {
    db.close();
  }
}

/** Stores the recording under the track id, replacing any earlier one. */
export async function save(trackId: string, rec: StoredRecording): Promise<void> {
  await run("readwrite", (s) => s.put(rec, trackId));
}

export async function get(trackId: string): Promise<StoredRecording | undefined> {
  return (await run<StoredRecording | undefined>("readonly", (s) => s.get(trackId))) ?? undefined;
}

export async function remove(trackId: string): Promise<void> {
  await run("readwrite", (s) => s.delete(trackId));
}

export async function removeMany(trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  await run("readwrite", (s) => trackIds.map((id) => s.delete(id)));
}
