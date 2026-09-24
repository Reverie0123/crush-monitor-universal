// Question shapes sent to the model: pick one label, score on a rubric, or yes/no.
// Replaces the few helpers this project used from the TypeSafe SDK.
export type EntryType = string | { [key: string]: unknown } | unknown[] | null;
export type ChoiceQuestion = {
  type: "choice";
  instructions: EntryType;
  /** Labels mapped to descriptions; null leaves a label undescribed. */
  criteria: Record<string, EntryType>;
};
export type ScoreQuestion = {
  type: "score";
  instructions: EntryType;
  /** Rubric descriptions indexed by score, lowest first. */
  criteria: readonly EntryType[];
};
export type NoulQuestion = {
  type: "noul";
  instructions?: EntryType;
  criteria?: { true?: EntryType; false?: EntryType } | null;
};
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;
export type Questions = Record<string, Question>;

export const choice = (
  instructions: EntryType,
  criteria: Record<string, EntryType>,
): ChoiceQuestion => ({ type: "choice", instructions, criteria });
export const score = (
  instructions: EntryType,
  criteria: readonly EntryType[],
): ScoreQuestion => ({ type: "score", instructions, criteria });
export const noul = (instructions?: EntryType): NoulQuestion => ({
  type: "noul",
  instructions: instructions ?? null,
});
