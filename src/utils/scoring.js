// Scoring rules shared by solo tests and races.
//
// - Five characters (letters, punctuation or spaces) make one word.
// - Net WPM only counts words typed exactly right, plus the space after each
//   of them. The word in progress when a timed test ends counts if it is
//   correct so far.
// - Raw WPM counts every character key pressed, including ones later deleted.
// - Accuracy is correct keystrokes over all keystrokes, so a typo you fixed
//   still counts against you.
// - Scores are rounded down, never up.

// Saved with every result so results scored under older rules can be told apart.
export const SCORING_VERSION = 2;

export function wpmFrom(chars, seconds) {
  return seconds > 0 ? (chars / 5) * (60 / seconds) : 0;
}

// Classify the characters an input change added, against the target word.
// Handles multi-character inserts (mobile keyboards) as several keystrokes.
export function classifyInsert(prev, next, target) {
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let correct = 0;
  let incorrect = 0;
  for (let i = p; i < next.length; i++) {
    if (target && next[i] === target[i]) correct++;
    else incorrect++;
  }
  return { correct, incorrect };
}

// `lastIndex` is the final word of a word-count test (no space after it);
// timed tests pass Infinity.
export function countNetChars(words, typed, current, index, lastIndex = Infinity) {
  let chars = 0;
  const end = Math.min(index, lastIndex + 1);
  for (let i = 0; i < end; i++) {
    if (typed[i] === words[i]) chars += words[i].length + (i < lastIndex ? 1 : 0);
  }
  if (index <= lastIndex && current && words[index]?.startsWith(current)) {
    chars += current.length;
  }
  return chars;
}

// Per-character breakdown of the final text, for display.
export function charBreakdown(words, typed, current, index, lastIndex = Infinity) {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;

  const tally = (word = "", input = "", completed) => {
    for (let j = 0; j < word.length; j++) {
      if (j < input.length) {
        if (input[j] === word[j]) correct++;
        else incorrect++;
      } else if (completed) {
        missed++;
      }
    }
    extra += Math.max(0, input.length - word.length);
  };

  const end = Math.min(index, lastIndex + 1);
  for (let i = 0; i < end; i++) {
    tally(words[i], typed[i], true);
    if (typed[i] === words[i] && i < lastIndex) correct++; // the space
  }
  if (index <= lastIndex && current) tally(words[index], current, false);

  return { correct, incorrect, extra, missed };
}

// How even your speed was from second to second, 0–100. Uses the
// coefficient of variation squashed through tanh so it degrades smoothly.
export function consistencyOf(samples) {
  const vals = samples.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return 0;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const cov = sd / mean;
  return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
}
