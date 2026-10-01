import { currentLang, messages } from "./i18n";
import type {
  Message,
  Relation,
  LineResult,
  Overview,
  Period,
} from "../shared/types";
import type { MemoryEvent } from "../shared/memory";
import type { UsageTotal } from "./useAnalysis";
import type { Scope } from "../shared/plan";
import { DEMO, WEB, demoConversation } from "./demo";
export type Trend = { at: string; value: number | null; count: number };
export type SavedConversation = {
  schema: 1;
  rubric: string;
  messages: Message[];
  self: string;
  other: string;
  relation: Relation;
  lines: Record<string, LineResult>;
  events: Record<string, MemoryEvent>;
  overview: Overview | null;
  trend: Trend[];
  analyzedCount: number;
  completed: boolean;
  note?: string;
  usage?: UsageTotal;
  periods?: Period[];
  scope?: Scope;
  corrections?: Record<string, string>;
  /** Relation and note the saved results were produced with. */
  analyzedWith?: { relation: Relation; note: string; language?: "zh" | "en" };
};
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    // The demo keeps its own copy per language and version, so a visitor's
    // edits never mix with the real app's data or an older sample. The online
    // version keeps real chats, so its store outlives versions and languages.
    const name = WEB
      ? "crush-monitor-web"
      : DEMO
        ? `crush-monitor-demo-${currentLang()}-${__APP_VERSION__}`
        : "crush-monitor";
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("workspace");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      connection = undefined;
      reject(req.error);
    };
  }));
}
export async function loadConversation(): Promise<
  SavedConversation | undefined
> {
  const database = await db();
  return new Promise<SavedConversation | undefined>((resolve, reject) => {
    const req = database
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).then(async (saved) => saved ?? (DEMO ? demoConversation() : undefined));
}
/** Custom avatars as small data URLs. Kept apart from the chat so they survive clearing it. */
export type Avatars = { self?: string; other?: string };
export async function loadAvatars(): Promise<Avatars> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database
      .transaction("workspace")
      .objectStore("workspace")
      .get("avatars");
    req.onsuccess = () => resolve(req.result ?? {});
    req.onerror = () => reject(req.error);
  });
}
export async function saveAvatars(value: Avatars) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(value, "avatars");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// Serial transactions ensure clearing cannot be followed by an older queued save.
let queue: Promise<void> = Promise.resolve();
export function saveConversation(value: SavedConversation | null) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction("workspace", "readwrite");
        if (value) tx.objectStore("workspace").put(value, "current");
        else tx.objectStore("workspace").delete("current");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error(messages().errors.saveInterrupted));
      });
    });
  queue = operation;
  return operation;
}

// ---------- Chats put aside ----------
// The chat on screen is "current"; the others wait under conv:<id>, with a
// small index under "library". Opening one makes it current and takes it
// off the shelf, so a chat is never in two places.

export type LibraryEntry = {
  id: string;
  other: string;
  self: string;
  count: number;
  updatedAt: string;
};

/** A read-write transaction on the workspace, queued behind pending saves. */
function write<T>(run: (store: IDBObjectStore) => Promise<T> | T) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      const tx = database.transaction("workspace", "readwrite");
      const store = tx.objectStore("workspace");
      const result = await run(store);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error(messages().errors.saveInterrupted));
      });
      return result;
    });
  queue = operation.then(
    () => {},
    () => {},
  );
  return operation;
}
const request = <T,>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function listLibrary(): Promise<LibraryEntry[]> {
  const database = await db();
  const list = await request(
    database.transaction("workspace").objectStore("workspace").get("library"),
  );
  return Array.isArray(list) ? (list as LibraryEntry[]) : [];
}

/** Puts a chat on the shelf. Returns its id. */
export function shelve(value: SavedConversation) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return write(async (store) => {
    const list = ((await request(store.get("library"))) ?? []) as LibraryEntry[];
    store.put(value, `conv:${id}`);
    store.put(
      [
        {
          id,
          other: value.other,
          self: value.self,
          count: value.messages.length,
          updatedAt: new Date().toISOString(),
        },
        ...list,
      ],
      "library",
    );
    return id;
  });
}

/** Reads a shelved chat without taking it down. */
export async function readShelved(id: string) {
  const database = await db();
  return request(
    database.transaction("workspace").objectStore("workspace").get(`conv:${id}`),
  ) as Promise<SavedConversation | undefined>;
}

/** Takes a chat off the shelf, to become the current one. */
export function takeOut(id: string) {
  return write(async (store) => {
    const value = (await request(store.get(`conv:${id}`))) as
      | SavedConversation
      | undefined;
    const list = ((await request(store.get("library"))) ?? []) as LibraryEntry[];
    store.delete(`conv:${id}`);
    store.put(
      list.filter((e) => e.id !== id),
      "library",
    );
    return value;
  });
}

export function removeShelved(id: string) {
  return write(async (store) => {
    const list = ((await request(store.get("library"))) ?? []) as LibraryEntry[];
    store.delete(`conv:${id}`);
    store.put(
      list.filter((e) => e.id !== id),
      "library",
    );
  });
}

/** Whether a parsed JSON file is a chat this app exported. */
export function isSavedConversation(v: unknown): v is SavedConversation {
  const o = v as SavedConversation;
  return (
    !!o &&
    typeof o === "object" &&
    o.schema === 1 &&
    Array.isArray(o.messages) &&
    typeof o.self === "string" &&
    typeof o.other === "string" &&
    typeof o.relation === "string" &&
    o.lines !== null &&
    typeof o.lines === "object"
  );
}
