import { useState, useCallback, useRef, useEffect } from "react";
import { generateWordList } from "../data/words";
import {
  wpmFrom,
  classifyInsert,
  countNetChars,
  charBreakdown,
  consistencyOf,
} from "../utils/scoring";

const INITIAL_WORD_COUNT = 200;
const VALID_DURATIONS = [15, 30, 60, 120];
const VALID_WORD_COUNTS = [10, 25, 50, 100];

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem("klacks-settings")) || {};
    return {
      mode: raw.mode === "sentences" ? "sentences" : "words",
      testType: raw.testType === "wordcount" ? "wordcount" : "time",
      duration: VALID_DURATIONS.includes(raw.duration) ? raw.duration : 15,
      wordCountTarget: VALID_WORD_COUNTS.includes(raw.wordCountTarget)
        ? raw.wordCountTarget
        : 25,
      punctuation: !!raw.punctuation,
      numbers: !!raw.numbers,
    };
  } catch {
    return {
      mode: "words",
      testType: "time",
      duration: 15,
      wordCountTarget: 25,
      punctuation: false,
      numbers: false,
    };
  }
}

const EMPTY_POINT = { at: 0, second: 0, keys: 0, errors: 0 };

function tallyKeys(keys, prev, next, target) {
  const { correct, incorrect } = classifyInsert(prev, next, target);
  keys.correct += correct;
  keys.incorrect += incorrect;
}

export function useTypingTest() {
  const initialRef = useRef(null);
  if (initialRef.current === null) initialRef.current = loadSettings();
  const init = initialRef.current;

  const [mode, setMode] = useState(init.mode);
  const [testType, setTestType] = useState(init.testType); // "time" | "wordcount"
  const [duration, setDuration] = useState(init.duration);
  const [wordCountTarget, setWordCountTarget] = useState(init.wordCountTarget);
  const [punctuation, setPunctuation] = useState(init.punctuation);
  const [numbers, setNumbers] = useState(init.numbers);
  const [words, setWords] = useState(() =>
    generateWordList(init.mode, INITIAL_WORD_COUNT, {
      punctuation: init.punctuation,
      numbers: init.numbers,
    })
  );
  const [typedWords, setTypedWords] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(init.duration);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [wpmHistory, setWpmHistory] = useState([]);
  const [liveWpm, setLiveWpm] = useState(0);
  const [wordSpeeds, setWordSpeeds] = useState([]);

  // Timing uses performance.now(): monotonic, unaffected by clock changes
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const finishedRef = useRef(false);
  const timerRef = useRef(null);
  const deadlineRef = useRef(null);
  const keysRef = useRef({ correct: 0, incorrect: 0 });
  const lastPointRef = useRef(EMPTY_POINT);
  const historyRef = useRef([]);
  const lastWordTimeRef = useRef(null);

  // Refs mirror state so input handling never reads a stale value. Handlers
  // update them immediately; renders keep them in sync otherwise.
  const wordsRef = useRef(words);
  const typedWordsRef = useRef(typedWords);
  const currentInputRef = useRef(currentInput);
  const currentWordIndexRef = useRef(currentWordIndex);
  const testTypeRef = useRef(testType);
  const durationRef = useRef(duration);
  const wordCountTargetRef = useRef(wordCountTarget);
  const optionsRef = useRef({ punctuation, numbers });

  wordsRef.current = words;
  typedWordsRef.current = typedWords;
  currentInputRef.current = currentInput;
  currentWordIndexRef.current = currentWordIndex;
  testTypeRef.current = testType;
  durationRef.current = duration;
  wordCountTargetRef.current = wordCountTarget;
  optionsRef.current = { punctuation, numbers };

  // Persist settings
  useEffect(() => {
    localStorage.setItem(
      "klacks-settings",
      JSON.stringify({ mode, testType, duration, wordCountTarget, punctuation, numbers })
    );
  }, [mode, testType, duration, wordCountTarget, punctuation, numbers]);

  const lastIndex = useCallback(
    () => (testTypeRef.current === "wordcount" ? wordCountTargetRef.current - 1 : Infinity),
    []
  );

  const netChars = useCallback(
    () =>
      countNetChars(
        wordsRef.current,
        typedWordsRef.current,
        currentInputRef.current,
        currentWordIndexRef.current,
        lastIndex()
      ),
    [lastIndex]
  );

  // Add a history point covering the time since the previous one
  const recordPoint = useCallback(
    (elapsed, second) => {
      const last = lastPointRef.current;
      const span = elapsed - last.at;
      if (span <= 0) return;
      const keys = keysRef.current.correct + keysRef.current.incorrect;
      const errors = keysRef.current.incorrect;
      const point = {
        second,
        wpm: Math.floor(wpmFrom(netChars(), elapsed)),
        raw: Math.floor(wpmFrom(keys, elapsed)),
        burst: Math.floor(wpmFrom(keys - last.keys, span)),
        errors: errors - last.errors,
      };
      lastPointRef.current = { at: elapsed, second, keys, errors };
      historyRef.current = [...historyRef.current, point];
      setWpmHistory(historyRef.current);
    },
    [netChars]
  );

  const finish = useCallback(
    (endTime) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      endTimeRef.current = endTime;
      clearInterval(timerRef.current);
      clearTimeout(deadlineRef.current);

      const elapsed = (endTime - startTimeRef.current) / 1000;
      if (testTypeRef.current === "time") {
        if (lastPointRef.current.second < Math.floor(elapsed)) {
          recordPoint(elapsed, Math.floor(elapsed));
        }
      } else if (elapsed - lastPointRef.current.at >= 0.5) {
        // Final partial second of a word-count test
        recordPoint(elapsed, Math.round(elapsed * 10) / 10);
      }

      setIsRunning(false);
      setIsFinished(true);
    },
    [recordPoint]
  );

  // Clock: 10 ticks a second for the display, plus an exact deadline timer
  useEffect(() => {
    if (!isRunning) return;
    const deadline = startTimeRef.current + duration * 1000;

    timerRef.current = setInterval(() => {
      if (finishedRef.current) return;
      const now = performance.now();
      const isTime = testTypeRef.current === "time";
      if (isTime && now >= deadline) {
        finish(deadline);
        return;
      }
      const elapsed = (now - startTimeRef.current) / 1000;
      if (elapsed >= 1) setLiveWpm(Math.floor(wpmFrom(netChars(), elapsed)));
      const second = Math.floor(elapsed);
      if (second > lastPointRef.current.second) recordPoint(elapsed, second);
      if (isTime) setTimeLeft(Math.max(0, duration - second));
      else setElapsedTime(second);
    }, 100);

    if (testTypeRef.current === "time") {
      deadlineRef.current = setTimeout(
        () => finish(deadline),
        Math.max(0, deadline - performance.now())
      );
    }

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(deadlineRef.current);
    };
  }, [isRunning, duration, finish, netChars, recordPoint]);

  // Handle character input
  const handleInput = useCallback(
    (value) => {
      if (finishedRef.current) return;
      const now = performance.now();

      if (startTimeRef.current === null) {
        startTimeRef.current = now;
        setIsRunning(true);
      } else if (
        testTypeRef.current === "time" &&
        now - startTimeRef.current >= durationRef.current * 1000
      ) {
        // Keystrokes after time is up don't count
        finish(startTimeRef.current + durationRef.current * 1000);
        return;
      }

      const idx = currentWordIndexRef.current;
      const target = wordsRef.current[idx] || "";
      const prev = currentInputRef.current;
      const isWordCount = testTypeRef.current === "wordcount";

      // Space — commit the word and move on
      if (value.endsWith(" ")) {
        const word = value.slice(0, -1);
        if (word.length === 0) return; // a space before any letters is ignored

        tallyKeys(keysRef.current, prev, word, target);
        if (word === target) keysRef.current.correct++;
        else keysRef.current.incorrect++;

        const typed = [...typedWordsRef.current];
        typed[idx] = word;
        typedWordsRef.current = typed;
        setTypedWords(typed);

        // Per-word speed (used by the live ruler in word-count tests)
        const since = lastWordTimeRef.current ?? startTimeRef.current;
        const dt = Math.max(now - since, 120);
        lastWordTimeRef.current = now;
        setWordSpeeds((speeds) => {
          const nextSpeeds = [...speeds];
          nextSpeeds[idx] = Math.floor(wpmFrom(word.length + 1, dt / 1000));
          return nextSpeeds;
        });

        const nextIndex = idx + 1;
        currentWordIndexRef.current = nextIndex;
        currentInputRef.current = "";
        setCurrentWordIndex(nextIndex);
        setCurrentInput("");

        if (isWordCount && nextIndex >= wordCountTargetRef.current) {
          finish(now);
          return;
        }

        if (nextIndex >= wordsRef.current.length - 20) {
          setWords((prevWords) => [
            ...prevWords,
            ...generateWordList(mode, INITIAL_WORD_COUNT, optionsRef.current),
          ]);
        }
        return;
      }

      tallyKeys(keysRef.current, prev, value, target);

      // Word-count tests end the moment the last word is typed correctly
      if (isWordCount && idx === wordCountTargetRef.current - 1 && value === target) {
        const typed = [...typedWordsRef.current];
        typed[idx] = value;
        typedWordsRef.current = typed;
        currentWordIndexRef.current = idx + 1;
        currentInputRef.current = "";
        setTypedWords(typed);
        setCurrentWordIndex(idx + 1);
        setCurrentInput("");
        finish(now);
        return;
      }

      currentInputRef.current = value;
      setCurrentInput(value);
    },
    [mode, finish]
  );

  // Handle backspace to previous word
  const goToPrevWord = useCallback(() => {
    const idx = currentWordIndexRef.current;
    const input = currentInputRef.current;
    if (idx > 0 && input === "") {
      const prevIndex = idx - 1;
      const prevTyped = typedWordsRef.current[prevIndex] || "";
      currentWordIndexRef.current = prevIndex;
      currentInputRef.current = prevTyped;
      setCurrentWordIndex(prevIndex);
      setCurrentInput(prevTyped);
      return prevTyped;
    }
    return null;
  }, []);

  // Clear current word (Ctrl+Backspace)
  const clearCurrentWord = useCallback(() => {
    currentInputRef.current = "";
    setCurrentInput("");
  }, []);

  // Final results, read once the test has finished
  const getResults = useCallback(() => {
    const seconds =
      testTypeRef.current === "time"
        ? durationRef.current
        : (endTimeRef.current - startTimeRef.current) / 1000;
    const args = [
      wordsRef.current,
      typedWordsRef.current,
      currentInputRef.current,
      currentWordIndexRef.current,
      lastIndex(),
    ];
    const net = countNetChars(...args);
    const chars = charBreakdown(...args);
    const { correct, incorrect } = keysRef.current;
    const keys = correct + incorrect;
    const history = historyRef.current;
    const consistency = consistencyOf(history.map((h) => h.burst));

    return {
      wpm: Math.floor(wpmFrom(net, seconds)),
      rawWpm: Math.floor(wpmFrom(keys, seconds)),
      accuracy: keys > 0 ? Math.floor((correct / keys) * 100) : 0,
      consistency: consistency === null ? null : Math.floor(consistency),
      correctChars: chars.correct,
      incorrectChars: chars.incorrect,
      extraChars: chars.extra,
      missedChars: chars.missed,
      totalChars: chars.correct + chars.incorrect + chars.extra,
      wpmHistory: history,
      timeTaken: Math.round(seconds * 10) / 10,
    };
  }, [lastIndex]);

  // Full reset helper
  const fullReset = useCallback((newMode, newTestType, newDuration, newWordCountTarget, opts) => {
    clearInterval(timerRef.current);
    clearTimeout(deadlineRef.current);
    const options = opts || optionsRef.current;
    setWords(generateWordList(newMode, INITIAL_WORD_COUNT, options));
    setTypedWords([]);
    setCurrentInput("");
    setCurrentWordIndex(0);
    setIsRunning(false);
    setIsFinished(false);
    setTimeLeft(newTestType === "time" ? newDuration : 0);
    setElapsedTime(0);
    setWpmHistory([]);
    setLiveWpm(0);
    setWordSpeeds([]);
    typedWordsRef.current = [];
    currentInputRef.current = "";
    currentWordIndexRef.current = 0;
    startTimeRef.current = null;
    endTimeRef.current = null;
    finishedRef.current = false;
    keysRef.current = { correct: 0, incorrect: 0 };
    lastPointRef.current = EMPTY_POINT;
    historyRef.current = [];
    lastWordTimeRef.current = null;
  }, []);

  // Reset
  const reset = useCallback(() => {
    fullReset(mode, testType, duration, wordCountTarget);
  }, [mode, testType, duration, wordCountTarget, fullReset]);

  // Change mode (words/sentences)
  const changeMode = useCallback(
    (newMode) => {
      setMode(newMode);
      fullReset(newMode, testType, duration, wordCountTarget);
    },
    [testType, duration, wordCountTarget, fullReset]
  );

  // Change duration (time mode)
  const changeDuration = useCallback(
    (newDuration) => {
      setTestType("time");
      setDuration(newDuration);
      fullReset(mode, "time", newDuration, wordCountTarget);
    },
    [mode, wordCountTarget, fullReset]
  );

  // Change word count target
  const changeWordCount = useCallback(
    (newCount) => {
      setTestType("wordcount");
      setWordCountTarget(newCount);
      fullReset(mode, "wordcount", duration, newCount);
    },
    [mode, duration, fullReset]
  );

  // Toggle punctuation (words mode)
  const togglePunctuation = useCallback(() => {
    const next = !punctuation;
    setPunctuation(next);
    fullReset(mode, testType, duration, wordCountTarget, { punctuation: next, numbers });
  }, [punctuation, numbers, mode, testType, duration, wordCountTarget, fullReset]);

  // Toggle numbers (words mode)
  const toggleNumbers = useCallback(() => {
    const next = !numbers;
    setNumbers(next);
    fullReset(mode, testType, duration, wordCountTarget, { punctuation, numbers: next });
  }, [punctuation, numbers, mode, testType, duration, wordCountTarget, fullReset]);

  return {
    mode,
    testType,
    duration,
    wordCountTarget,
    punctuation,
    numbers,
    liveWpm,
    wpmHistory,
    wordSpeeds,
    togglePunctuation,
    toggleNumbers,
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    elapsedTime,
    handleInput,
    goToPrevWord,
    clearCurrentWord,
    reset,
    changeMode,
    changeDuration,
    changeWordCount,
    getResults,
  };
}
