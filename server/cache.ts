// Model replies are cached so the same content is never paid for twice. On the
// server the cache is a folder (.cache/llm); in the browser it is IndexedDB.
// Cached replies contain chat text, so entries expire and the store stays
// bounded. A cache that fails only costs money, never correctness.
import { isNode } from "./env";

const TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_ENTRIES = 4000;

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    return isNode ? await nodeGet<T>(key) : await webGet<T>(key);
  } catch {
    return undefined;
  }
}
export async function cachePut(key: string, value: unknown) {
  try {
    if (isNode) await nodePut(key, value);
    else await webPut(key, value);
  } catch {
    // Nothing to do: the reply is still returned, just not remembered.
  }
}
/** Deletes expired entries, then the oldest ones while over the cap. */
export async function pruneCache() {
  if (isNode) await nodePrune();
  else await webPrune();
}
export async function clearCache() {
  if (isNode) await nodeClear();
  else await webClear();
}

// ---------- Server: one JSON file per reply ----------

// Loaded by name so the browser build never bundles Node's modules.
async function fs() {
  const [fsName, pathName] = ["node:fs/promises", "node:path"];
  const fs: typeof import("node:fs/promises") = await import(
    /* @vite-ignore */ fsName
  );
  const path: typeof import("node:path") = await import(
    /* @vite-ignore */ pathName
  );
  const dir = path.join(process.cwd(), ".cache", "llm");
  return { ...fs, dir, file: (key: string) => path.join(dir, `${key}.json`) };
}
async function nodeGet<T>(key: string) {
  const { stat, readFile, file } = await fs();
  if (Date.now() - (await stat(file(key))).mtimeMs > TTL_MS) return undefined;
  return JSON.parse(await readFile(file(key), "utf8")) as T;
}
async function nodePut(key: string, value: unknown) {
  const { mkdir, writeFile, dir, file } = await fs();
  await mkdir(dir, { recursive: true });
  await writeFile(file(key), JSON.stringify(value));
}
async function nodePrune() {
  const { readdir, stat, rm, dir, file } = await fs();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const files = (
    await Promise.all(
      names.map(async (name) => {
        const path = file(name.replace(/\.json$/, ""));
        try {
          const s = await stat(path);
          return { path, size: s.size, mtime: s.mtimeMs };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => a.mtime - b.mtime);
  let total = files.reduce((n, f) => n + f.size, 0);
  for (const f of files) {
    if (Date.now() - f.mtime <= TTL_MS && total <= MAX_BYTES) break;
    try {
      await rm(f.path, { force: true });
    } catch {
      // Locked by a concurrent write (Windows EBUSY/EPERM): try again next hour.
    }
    total -= f.size;
  }
}
async function nodeClear() {
  const { rm, dir } = await fs();
  await rm(dir, { recursive: true, force: true });
}

// ---------- Browser: an IndexedDB store ----------

type Entry = { value: unknown; at: number };
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("crush-monitor-web-cache", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("replies");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      connection = undefined;
      reject(req.error);
    };
  }));
}
async function store(mode: IDBTransactionMode) {
  const tx = (await db()).transaction("replies", mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { store: tx.objectStore("replies"), done };
}
const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function webGet<T>(key: string) {
  const { store: s } = await store("readonly");
  const entry = (await result(s.get(key))) as Entry | undefined;
  if (!entry || Date.now() - entry.at > TTL_MS) return undefined;
  return entry.value as T;
}
async function webPut(key: string, value: unknown) {
  const { store: s, done } = await store("readwrite");
  s.put({ value, at: Date.now() } satisfies Entry, key);
  await done;
}
async function webPrune() {
  const { store: s, done } = await store("readwrite");
  const keys = (await result(s.getAllKeys())) as IDBValidKey[];
  const entries = (await result(s.getAll())) as Entry[];
  const rows = keys
    .map((key, i) => ({ key, at: entries[i]?.at ?? 0 }))
    .sort((a, b) => a.at - b.at);
  let count = rows.length;
  for (const row of rows) {
    if (Date.now() - row.at <= TTL_MS && count <= MAX_ENTRIES) break;
    s.delete(row.key);
    count--;
  }
  await done;
}
async function webClear() {
  const { store: s, done } = await store("readwrite");
  s.clear();
  await done;
}
