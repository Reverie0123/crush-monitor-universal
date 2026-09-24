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
  analyzedWith?: { relation: Relation; note: string };
};
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("crush-monitor", 1);
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
  return new Promise((resolve, reject) => {
    const req = database
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
        tx.onabort = () => reject(tx.error ?? new Error("保存被中断"));
      });
    });
  queue = operation;
  return operation;
}
