import { SENTENCES } from "./sentences";

// Common English words, most frequent first. Order matters: picks are
// weighted by position so everyday words come up about as often as they do
// in real text, while the long tail still appears regularly.
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
  "mind", "notice", "said", "made", "came", "find", "very", "may", "did", "been",
  "were", "has", "had", "more", "here", "why", "picture", "spell", "animal", "page",
  "letter", "mother", "below", "plant", "father", "tree", "earth", "saw", "something", "example",
  "together", "got", "children", "feet", "mile", "walk", "white", "sea", "began", "took",
  "four", "carry", "book", "hear", "stop", "without", "later", "miss", "eat", "watch",
  "far", "really", "girl", "sometimes", "mountain", "cut", "talk", "soon", "list", "song",
  "being", "leave", "color", "sun", "fish", "dog", "horse", "bird", "problem", "complete",
  "knew", "ever", "piece", "told", "usually", "friend", "easy", "heard", "red", "top",
  "ship", "across", "today", "during", "short", "however", "low", "hour", "black", "product",
  "happen", "measure", "remember", "wave", "reach", "listen", "wind", "rock", "space", "cover",
  "fast", "several", "himself", "toward", "five", "step", "morning", "pass", "true", "hundred",
  "pattern", "north", "slowly", "money", "map", "farm", "pull", "draw", "seen", "cold",
  "cry", "sing", "ground", "fall", "king", "unit", "certain", "travel", "wood", "fire",
  "upon", "road", "ten", "fly", "gave", "box", "finally", "wait", "correct", "quickly",
  "became", "shown", "minute", "inch", "street", "decide", "contain", "course", "surface", "produce",
  "building", "ocean", "nothing", "rest", "carefully", "inside", "wheel", "stay", "green", "known",
  "island", "week", "less", "machine", "base", "ago", "stood", "plane", "behind", "ran",
  "round", "boat", "force", "brought", "understand", "warm", "common", "explain", "dry", "language",
  "shape", "deep", "thousand", "yes", "yet", "government", "fill", "heat", "hot", "check",
  "object", "bread", "rule", "cannot", "six", "size", "dark", "ball", "material", "special",
  "heavy", "fine", "pair", "circle", "include", "built", "matter", "square", "perhaps", "bill",
  "felt", "suddenly", "direction", "center", "farmer", "ready", "anything", "divide", "general", "energy",
  "subject", "moon", "region", "believe", "dance", "member", "pick", "cell", "paint", "cause",
  "rain", "exercise", "egg", "train", "blue", "wish", "drop", "develop", "window", "difference",
  "distance", "heart", "sit", "sum", "summer", "wall", "forest", "probably", "leg", "sat",
  "main", "winter", "wide", "written", "length", "kept", "interest", "arm", "brother", "race",
  "present", "beautiful", "store", "job", "edge", "past", "sign", "finish", "discover", "wild",
  "happy", "beside", "gone", "sky", "glass", "million", "west", "lay", "weather", "root",
  "meet", "third", "month", "raise", "represent", "soft", "whether", "clothes", "flower", "shall",
  "teacher", "held", "describe", "drive", "cross", "speak", "solve", "appear", "metal", "son",
  "either", "ice", "sleep", "village", "factor", "jump", "snow", "ride", "care", "floor",
  "hill", "push", "baby", "buy", "century", "outside", "everything", "tall", "instead", "phrase",
  "soil", "bed", "copy", "hope", "spring", "case", "laugh", "nation", "quite", "type",
  "themselves", "temperature", "bright", "lead", "everyone", "method", "section", "lake", "within", "dictionary",
  "hair", "age", "amount", "scale", "pound", "although", "per", "broken", "moment", "tiny",
  "possible", "gold", "milk", "quiet", "natural", "stone", "act", "middle", "speed", "count",
  "cat", "someone", "sail", "roll", "bear", "wonder", "smile", "angle", "fraction", "melody",
  "bottom", "trip", "hole", "poor", "surprise", "dress", "skin", "uncle", "grass", "key",
  "weight", "ring", "thin", "fresh", "catch", "reply", "suggest", "clean", "break", "lady",
  "yard", "rise", "bad", "blow", "oil", "blood", "touch", "grew", "cent", "mix",
  "team", "wire", "cost", "lost", "brown", "wear", "garden", "equal", "sent", "choose",
  "fell", "fit", "flow", "fair", "bank", "collect", "save", "control", "decimal", "gentle",
  "woman", "captain", "practice", "separate", "difficult", "doctor", "please", "protect", "noon", "whose",
  "locate", "dear", "crop", "modern", "element", "hit", "student", "corner", "party", "supply",
  "bone", "rail", "imagine", "provide", "agree", "thus", "capital", "chair", "danger", "fruit",
  "rich", "thick", "soldier", "process", "operate", "guess", "necessary", "sharp", "wing", "create",
  "neighbor", "wash", "bat", "rather", "crowd", "corn", "compare", "poem", "string", "bell",
  "depend", "meat", "rub", "tube", "famous", "dollar", "stream", "fear", "sight", "triangle",
  "planet", "hurry", "chief", "colony", "clock", "mine", "tie", "enter", "major", "sudden",
  "duck", "branch", "match", "suffix", "especially", "fig", "afraid", "huge", "sister", "steel",
  "discuss", "forward", "similar", "guide", "experience", "score", "apple", "evening", "condition", "feed",
  "tool", "total", "basic", "smell", "valley", "nor", "double", "seat", "continue", "block",
  "chart", "hat", "sell", "success", "company", "subtract", "event", "particular", "deal", "swim",
  "term", "opposite", "wife", "shoe", "shoulder", "spread", "arrange", "camp", "invent", "cotton",
  "born", "determine", "quart", "nine", "truck", "noise", "level", "chance", "gather", "shop",
  "stretch", "throw", "shine", "property", "column", "molecule", "select", "wrong", "gray", "repeat",
  "require", "broad", "prepare", "salt", "nose", "plural", "anger", "claim", "continent", "oxygen",
  "sugar", "pretty", "skill", "season", "solution", "magnet", "silver", "thank", "lunch", "favor",
  "desert", "sweet", "print", "spot", "suit", "current", "lift", "rose", "arrive", "master",
  "track", "parent", "shore", "division", "sheet", "substance", "spend", "chord", "fat", "glad",
  "original", "share", "station", "dad", "charge", "proper", "bar", "segment", "instant", "market",
  "degree", "populate", "chick", "enemy", "drink", "occur", "support", "speech", "nature", "range",
  "steam", "motion", "path", "liquid", "log", "meant", "quotient", "teeth", "shell", "neck",
  "action", "activity", "actually", "address", "admit", "adult", "affect", "afternoon", "agency", "agent",
  "agreement", "ahead", "allow", "alone", "analysis", "another", "anyone", "apply", "approach", "argue",
  "article", "artist", "assume", "attention", "audience", "author", "available", "avoid", "bag", "beat",
  "behavior", "benefit", "beyond", "billion", "board", "budget", "business", "camera", "campaign", "candidate",
  "career", "central", "character", "choice", "citizen", "coach", "collection", "college", "commercial", "community",
  "computer", "concern", "conference", "consider", "consumer", "cultural", "culture", "cup", "customer", "daughter",
  "debate", "decade", "decision", "defense", "design", "despite", "detail", "dinner", "director", "discussion",
  "dream", "economy", "education", "effect", "effort", "eight", "election", "else", "employee", "environment",
  "establish", "evidence", "exactly", "executive", "expect", "expert", "fail", "federal", "feeling", "film",
  "final", "financial", "firm", "focus", "foot", "foreign", "forget", "former", "future", "generation",
  "goal", "growth", "hang", "health", "history", "hospital", "hotel", "human", "husband", "identify",
  "image", "impact", "improve", "increase", "indeed", "individual", "industry", "information", "institution", "interview",
  "investment", "involve", "item", "itself", "join", "kitchen", "knowledge", "lawyer", "leader", "least",
  "legal", "lie", "likely", "little", "local", "lose", "loss", "magazine", "maintain", "manage",
  "management", "manager", "marriage", "maybe", "media", "medical", "meeting", "memory", "mention", "message",
  "mission", "model", "mouth", "movement", "movie", "myself", "national", "nearly", "network", "news",
  "newspaper", "nice", "official", "officer", "operation", "opportunity", "option", "organization", "others", "owner",
  "pain", "painting", "partner", "patient", "pay", "peace", "perform", "performance", "period", "personal",
  "phone", "physical", "player", "popular", "population", "position", "positive", "pressure", "prevent", "price",
  "private", "professional", "professor", "program", "project", "prove", "public", "purpose", "quality", "radio",
  "rate", "reality", "realize", "receive", "recent", "recognize", "reduce", "reflect", "relate", "relationship",
  "remain", "remove", "report", "research", "resource", "respond", "response", "responsibility", "reveal", "risk",
  "role", "safe", "scene", "science", "security", "seek", "senior", "sense", "series", "serious",
  "serve", "service", "seven", "significant", "simply", "single", "situation", "social", "society", "somebody",
  "sort", "sound", "source", "southern", "specific", "sport", "staff", "stage", "standard", "star",
  "statement", "stock", "strategy", "structure", "stuff", "style", "suffer", "task", "teach", "technology",
  "television", "tend", "theory", "therefore", "throughout", "tonight", "tough", "trade", "traditional", "training",
  "treat", "treatment", "trial", "trouble", "truth", "twice", "value", "various", "view", "visit",
  "vote", "western", "whatever", "worker", "worry", "yourself", "honest", "clever", "brave", "calm",
  "careful", "curious", "eager", "fancy", "fierce", "golden", "hollow", "humble", "lively", "lonely",
  "lucky", "narrow", "nervous", "noble", "odd", "plain", "polite", "proud", "rapid", "rare",
  "rough", "royal", "rural", "silent", "silly", "smooth", "solid", "steady", "sticky", "strange",
  "sunny", "swift", "tender", "tidy", "tired", "vast", "wise", "wooden", "basket", "blanket",
  "bottle", "bridge", "bucket", "butter", "button", "candle", "canvas", "carpet", "castle", "cherry",
  "circus", "clover", "coffee", "copper", "cradle", "crayon", "diamond", "dragon", "engine", "feather",
  "fiddle", "fountain", "garage", "giant", "ginger", "guitar", "hammer", "harbor", "helmet", "honey",
  "jacket", "jungle", "kettle", "kitten", "ladder", "lantern", "lemon", "library", "lizard", "marble",
  "meadow", "mirror", "muffin", "needle", "orange", "paddle", "parrot", "pencil", "pepper", "pillow",
  "pirate", "pocket", "potato", "puzzle", "rabbit", "radish", "ribbon", "rocket", "saddle", "salmon",
  "shadow", "sketch", "spider", "sponge", "spoon", "stamp", "statue", "tablet", "teapot", "thunder",
  "ticket", "tiger", "tomato", "tower", "tunnel", "turtle", "umbrella", "velvet", "violin", "wagon",
  "walnut", "whistle", "wizard", "yellow", "zipper", "borrow", "breathe", "climb", "cook", "crawl",
  "dig", "dive", "explore", "fix", "float", "fold", "greet", "hide", "hunt", "jog",
  "juggle", "kick", "kneel", "knit", "knock", "lend", "lick", "march", "melt", "mend",
  "nod", "pour", "quit", "recycle", "rescue", "rinse", "scrub", "sew", "shake", "shout",
  "skip", "slide", "sneeze", "spill", "squeeze", "stir", "sweep", "swing", "tickle", "tumble",
  "twist", "wander", "wiggle", "wink", "yawn",
];

// Weight for the word at `rank` (0 = most common). An exponent of 0.7 puts
// the average generated word at ~4.6 letters, close to real English (~4.7).
const WEIGHT_EXPONENT = 0.7;
const CUMULATIVE = (() => {
  const out = [];
  let total = 0;
  for (let rank = 0; rank < COMMON_WORDS.length; rank++) {
    total += 1 / (rank + 10) ** WEIGHT_EXPONENT;
    out.push(total);
  }
  return out;
})();

function weightedWord() {
  const target = Math.random() * CUMULATIVE[CUMULATIVE.length - 1];
  let lo = 0;
  let hi = CUMULATIVE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (CUMULATIVE[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return COMMON_WORDS[lo];
}

function randomNumberWord() {
  const digits = Math.floor(Math.random() * 4) + 1;
  // No leading zeros: "7", "42", "308", "1945"
  let num = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < digits; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

function applyPunctuationAndNumbers(words, { punctuation, numbers }) {
  const result = [];
  let capitalizeNext = punctuation;

  for (let word of words) {
    if (numbers && Math.random() < 0.08) {
      result.push(randomNumberWord());
      continue;
    }

    if (punctuation) {
      if (capitalizeNext) {
        word = word[0].toUpperCase() + word.slice(1);
        capitalizeNext = false;
      }
      const r = Math.random();
      if (r < 0.1) {
        word += ".";
        capitalizeNext = true;
      } else if (r < 0.17) {
        word += ",";
      } else if (r < 0.2) {
        word += "?";
        capitalizeNext = true;
      } else if (r < 0.22) {
        word += "!";
        capitalizeNext = true;
      } else if (r < 0.24) {
        word = `"${word}"`;
      } else if (r < 0.26) {
        word += ";";
      } else if (r < 0.28) {
        word = `(${word})`;
      } else if (r < 0.3) {
        word += ":";
      }
    }

    result.push(word);
  }
  return result;
}

export function generateWordList(mode, count = 200, options = {}) {
  const { punctuation = false, numbers = false } = options;

  if (mode === "words") {
    const result = [];
    let lastWord = "";
    for (let i = 0; i < count; i++) {
      let word;
      do {
        word = weightedWord();
      } while (word === lastWord);
      lastWord = word;
      result.push(word);
    }
    if (punctuation || numbers) {
      return applyPunctuationAndNumbers(result, { punctuation, numbers });
    }
    return result;
  }

  // Sentences mode: shuffle all sentences and play them back to back
  const shuffled = [...SENTENCES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result = [];
  for (const sentence of shuffled) {
    result.push(...sentence.split(" "));
    if (result.length >= count * 2) break;
  }
  return result;
}
