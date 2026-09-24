/**
 * Unset means 0.3: steady enough that re-running the same chat gives similar
 * scores. Reasoning models (effort set) reject temperature, so none is sent.
 */
export function pickTemperature(value: number | undefined, effort: string) {
  if (effort) return undefined;
  return value !== undefined && Number.isFinite(value)
    ? value
    : DEFAULT_TEMPERATURE;
}
export const DEFAULT_TEMPERATURE = 0.3;
