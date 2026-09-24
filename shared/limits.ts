// Product limits, sized for chat models with 128K-token context windows.
export const MAX_MESSAGES = 2000;
export const MAX_TEXT_CHARS = 60000;
// Earlier messages shown around each per-line batch; later ones are capped at 20.
export const LINE_CONTEXT_MESSAGES = 150;
export const LINE_CONTEXT_CHARS = 15000;
// Messages per line-by-line request. 20 halves how often the surrounding chat
// is resent (the main uncached cost) versus 10; 30 saved nothing more.
export const BATCH_SIZE = 20;
