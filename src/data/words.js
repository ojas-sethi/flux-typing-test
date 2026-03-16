export const COMMON_WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "her", "she", "or", "an",
  "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
  "out", "if", "about", "who", "get", "which", "go", "me", "when", "make",
  "can", "like", "time", "no", "just", "him", "know", "take", "people", "into",
  "year", "your", "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also", "back", "after",
  "use", "two", "how", "our", "work", "first", "well", "way", "even", "new",
  "want", "because", "any", "these", "give", "day", "most", "us", "great", "between",
  "need", "large", "often", "those", "turn", "long", "thing", "much", "right", "hand",
  "old", "place", "small", "still", "found", "live", "where", "before", "must", "home",
  "big", "high", "end", "point", "last", "next", "should", "keep", "start", "might",
  "story", "city", "never", "run", "while", "away", "help", "every", "line", "world",
  "near", "own", "left", "late", "hard", "move", "house", "change", "play", "same",
  "name", "put", "different", "under", "read", "try", "kind", "head", "school", "each",
  "state", "land", "three", "close", "open", "seem", "both", "life", "few", "part",
  "around", "number", "water", "call", "write", "many", "side", "word", "group", "food",
  "family", "body", "young", "real", "set", "car", "feel", "fact", "off", "face",
  "let", "down", "room", "sure", "best", "study", "power", "eye", "light", "thought",
  "again", "stand", "second", "show", "form", "air", "plan", "say", "tell", "ask",
  "man", "door", "went", "child", "night", "love", "lot", "country", "full", "done",
  "once", "enough", "almost", "above", "such", "paper", "learn", "begin", "music", "mark",
  "river", "clear", "table", "south", "since", "figure", "field", "class", "system", "front",
  "voice", "town", "given", "mean", "build", "question", "hold", "whole", "until", "along",
  "always", "answer", "able", "against", "area", "among", "free", "already", "reason", "idea",
  "bring", "east", "simple", "note", "though", "person", "better", "early", "strong", "grow",
  "result", "game", "return", "offer", "half", "order", "test", "record", "become", "issue",
  "mind", "notice"
];

export const SENTENCES = [
  "The quick brown fox jumps over the lazy dog near the riverbank on a warm summer afternoon.",
  "Practice does not make perfect, only perfect practice makes perfect and leads to lasting improvement.",
  "In the middle of difficulty lies opportunity, and those who seek it will always find a way forward.",
  "She opened the door to find the garden covered in fresh snow, quiet and still under the pale morning light.",
  "The only way to do great work is to love what you do and keep looking until you find it.",
  "Every morning brings new potential, but if you dwell on the misfortunes of the day before you tend to overlook tremendous opportunities.",
  "He picked up the old book from the shelf, blew the dust off its cover, and began to read the first chapter aloud.",
  "Type every word as if it matters, because in the end precision and consistency will always beat raw speed alone.",
  "The best time to plant a tree was twenty years ago and the second best time is now.",
  "A room without books is like a body without a soul, so fill your shelves and fill your mind with words.",
  "The rain fell steadily through the night, drumming against the windows and pooling in the garden paths below.",
  "Success is not final and failure is not fatal, it is the courage to continue that counts the most.",
  "She typed quickly and accurately, her fingers dancing across the keyboard like a pianist performing a well rehearsed concerto.",
  "Do not judge each day by the harvest you reap but by the seeds that you plant along the way.",
  "The old clock on the wall ticked steadily, marking each second with a quiet persistence that filled the empty room.",
  "Sometimes the smallest step in the right direction ends up being the biggest step of your entire life.",
  "Knowledge is of no value unless you put it into practice and share it with those around you.",
  "The mountain stood silent against the evening sky, its peak dusted with the first snow of the coming winter.",
  "Life is what happens when you are busy making other plans and it often takes you by surprise.",
  "Write it on your heart that every day is the best day of the year and live accordingly.",
];

export function generateWordList(mode, count = 200) {
  if (mode === "words") {
    const result = [];
    let lastWord = "";
    for (let i = 0; i < count; i++) {
      let word;
      do {
        word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
      } while (word === lastWord);
      lastWord = word;
      result.push(word);
    }
    return result;
  }

  // Sentences mode: shuffle and concatenate sentence words
  const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5);
  const result = [];
  for (const sentence of shuffled) {
    result.push(...sentence.split(" "));
  }
  // Ensure we have enough words
  while (result.length < count) {
    const s = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    result.push(...s.split(" "));
  }
  return result;
}
