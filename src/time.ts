/** "2024-05-01 21:03:45" → "2024-05-01 21:03"; times without seconds stay as-is. */
export const withoutSeconds = (timestamp: string) =>
  timestamp.replace(/(\d{1,2}:\d{2}):\d{2}$/, "$1");

/** The date part of a parsed timestamp, in whichever format the export used. */
export const dateOf = (timestamp: string) =>
  timestamp.match(/^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/)?.[0] ??
  timestamp.split(/,?\s/)[0];
