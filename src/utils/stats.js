export function formatDuration(totalSeconds) {
  totalSeconds = Math.round(totalSeconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function toSeconds(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.seconds === "number") return timestamp.seconds;
  return Math.floor(timestamp / 1000);
}

export function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds = toSeconds(timestamp);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDate(timestamp) {
  const s = toSeconds(timestamp);
  if (!s) return "";
  return new Date(s * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "words · 30s" / "sentences · 25w"
export function configLabel(item) {
  const length =
    item.testType === "wordcount"
      ? `${item.wordCount}w`
      : `${Math.round(item.duration || 0)}s`;
  return `${item.mode || "words"} · ${length}`;
}

const avg = (arr, key) =>
  arr.length ? Math.round(arr.reduce((s, t) => s + (t[key] || 0), 0) / arr.length) : 0;

// Filter keys: "solo" | "words" | "sentences" | "races"
export function filterHistory(tests, races, filter) {
  if (filter === "races") return races;
  if (filter === "words" || filter === "sentences") {
    return tests.filter((t) => (t.mode || "words") === filter);
  }
  return tests;
}

// Summary for any newest-first list of tests or races
export function summarize(items) {
  if (!items.length) return null;
  const recent = items.slice(0, 10);
  const previous = items.slice(10, 20);
  const recentAvg = avg(recent, "wpm");
  const trend = previous.length ? recentAvg - avg(previous, "wpm") : null;

  let best = items[0];
  for (const t of items) if (t.wpm > best.wpm) best = t;

  const wins = items.filter((r) => r.won).length;

  return {
    count: items.length,
    recentAvg,
    recentCount: recent.length,
    trend,
    best,
    avgWpm: avg(items, "wpm"),
    avgAccuracy: avg(items, "accuracy"),
    totalTime: items.reduce((s, t) => s + (t.duration || 0), 0),
    wins,
    winRate: Math.round((wins / items.length) * 100),
  };
}

export const PB_TIME = [15, 30, 60, 120];
export const PB_WORDS = [10, 25, 50, 100];

// Best result per (mode, length) — the personal-best matrix
export function personalBests(tests) {
  const map = {};
  for (const t of tests) {
    const mode = t.mode || "words";
    const isWords = t.testType === "wordcount";
    const len = isWords ? t.wordCount : Math.round(t.duration || 0);
    const key = `${mode}|${isWords ? "w" : "t"}|${len}`;
    if (!map[key] || t.wpm > map[key].wpm) map[key] = t;
  }
  return map;
}

// Kept for any callers that want the old shape
export function computeStats(tests) {
  const s = summarize(tests);
  if (!s) return null;
  const words = tests.filter((t) => t.mode === "words");
  const sentences = tests.filter((t) => t.mode === "sentences");
  return {
    totalTests: s.count,
    bestWpm: s.best.wpm,
    avgWpm: s.avgWpm,
    avgAccuracy: s.avgAccuracy,
    totalTime: s.totalTime,
    avgWpmWords: words.length ? avg(words, "wpm") : null,
    avgWpmSentences: sentences.length ? avg(sentences, "wpm") : null,
    trend: s.trend || 0,
  };
}
