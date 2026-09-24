// Product limits, sized for chat models with 128K-token context windows.
export const MAX_MESSAGES = 2000;
export const MAX_TEXT_CHARS = 60000;
// Earlier messages shown around each per-line batch; later ones are capped at 20.
export const LINE_CONTEXT_MESSAGES = 150;
export const LINE_CONTEXT_CHARS = 15000;
// Messages per line-by-line request. 20 halves how often the surrounding chat
// is resent (the main uncached cost) versus 10; 30 saved nothing more.
export const BATCH_SIZE = 20;

/** How much one analysis request may carry; depends on the model in use. */
export type RequestLimits = {
  /** Which kind of model these limits are for. */
  provider: "openai" | "jev";
  /** Messages and characters the overview may read in one request. */
  messages: number;
  chars: number;
  /** Earlier messages sent around each line-by-line batch. */
  lineContext: number;
  lineChars: number;
  /** Messages per line-by-line request. */
  batch: number;
  /** Messages and characters of one trend period. */
  periodMessages: number;
  periodChars: number;
  /** Line-by-line requests in flight at once. */
  workers: number;
};
export const CHAT_LIMITS: RequestLimits = {
  provider: "openai",
  messages: MAX_MESSAGES,
  chars: MAX_TEXT_CHARS,
  lineContext: LINE_CONTEXT_MESSAGES,
  lineChars: LINE_CONTEXT_CHARS,
  batch: BATCH_SIZE,
  periodMessages: 900,
  periodChars: 25000,
  workers: 9,
};
// The original project's limits for Jev: 500 messages or 12,000 characters.
export const JEV_LIMITS: RequestLimits = {
  provider: "jev",
  messages: 500,
  chars: 12000,
  lineContext: 80,
  lineChars: 8000,
  batch: 10,
  periodMessages: 500,
  periodChars: 12000,
  // The original project's concurrency: Jev platforms rate-limit bursts.
  workers: 2,
};
/**
 * The limits in force. The page switches them when the model changes; the
 * server keeps the chat-model values, which are the larger ones.
 */
export const requestLimits: RequestLimits = { ...CHAT_LIMITS };
export function setRequestLimits(limits: RequestLimits) {
  Object.assign(requestLimits, limits);
}
/**
 * What the overview itself may read: the rest of the request is headroom for
 * the originals of remembered events, a quarter of it and at most 5,000 chars.
 */
export function overviewBudget() {
  return {
    count: requestLimits.messages - 50,
    chars: requestLimits.chars - Math.min(5000, requestLimits.chars / 4),
  };
}
/** Whether the overview cannot read the whole chat, so it is sent in pieces. */
export function overLimit(texts: string[]) {
  const budget = overviewBudget();
  return (
    texts.length > budget.count ||
    texts.reduce((n, t) => n + Array.from(t).length, 0) > budget.chars
  );
}
