export function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds =
    typeof timestamp.seconds === "number"
      ? timestamp.seconds
      : Math.floor(timestamp / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString();
}

export function computeStats(tests) {
  if (!tests.length) return null;

  const totalTests = tests.length;
  const bestWpm = Math.max(...tests.map((t) => t.wpm));
  const avgWpm = Math.round(
    tests.reduce((s, t) => s + t.wpm, 0) / totalTests
  );
  const avgAccuracy = Math.round(
    tests.reduce((s, t) => s + t.accuracy, 0) / totalTests
  );
  const totalTime = tests.reduce((s, t) => s + (t.duration || 0), 0);

  const wordTests = tests.filter((t) => t.mode === "words");
  const sentenceTests = tests.filter((t) => t.mode === "sentences");
  const avgWpmWords = wordTests.length
    ? Math.round(wordTests.reduce((s, t) => s + t.wpm, 0) / wordTests.length)
    : null;
  const avgWpmSentences = sentenceTests.length
    ? Math.round(
        sentenceTests.reduce((s, t) => s + t.wpm, 0) / sentenceTests.length
      )
    : null;

  const recent10 = tests.slice(0, 10);
  const prev10 = tests.slice(10, 20);
  const recentAvg = recent10.length
    ? Math.round(recent10.reduce((s, t) => s + t.wpm, 0) / recent10.length)
    : 0;
  const prevAvg = prev10.length
    ? Math.round(prev10.reduce((s, t) => s + t.wpm, 0) / prev10.length)
    : 0;
  const trend = prev10.length ? recentAvg - prevAvg : 0;

  return {
    totalTests,
    bestWpm,
    avgWpm,
    avgAccuracy,
    totalTime,
    avgWpmWords,
    avgWpmSentences,
    trend,
  };
}
