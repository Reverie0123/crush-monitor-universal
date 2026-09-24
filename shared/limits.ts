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
};
export const CHAT_LIMITS: RequestLimits = {
  messages: MAX_MESSAGES,
  chars: MAX_TEXT_CHARS,
  lineContext: LINE_CONTEXT_MESSAGES,
  lineChars: LINE_CONTEXT_CHARS,
  batch: BATCH_SIZE,
  periodMessages: 900,
  periodChars: 25000,
};
// The original project's limits for Jev: 500 messages or 12,000 characters.
export const JEV_LIMITS: RequestLimits = {
  messages: 500,
  chars: 12000,
  lineContext: 80,
  lineChars: 8000,
  batch: 10,
  periodMessages: 500,
  periodChars: 12000,
};
/**
 * The limits in force. The page switches them when the model changes; the
 * server keeps the chat-model values, which are the larger ones.
 */
export const requestLimits: RequestLimits = { ...CHAT_LIMITS };
export function setRequestLimits(limits: RequestLimits) {
  Object.assign(requestLimits, limits);
}
/** Whether the whole chat is too long for one request under the current limits. */
export function overLimit(texts: string[]) {
  return (
    texts.length > requestLimits.messages ||
    texts.reduce((n, t) => n + Array.from(t).length, 0) > requestLimits.chars
  );
}
